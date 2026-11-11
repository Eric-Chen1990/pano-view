import { pointerInput, pointerStick } from "./input";
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  Mesh,
  BufferGeometry,
  PlaneGeometry,
  Float32BufferAttribute,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { PanoSceneMenuItem } from "../pano-scene-menu";
import { useVisitedSceneIds } from "../scenes-host";
import { SpatialHostContext } from "../spatial/host";
import { SPATIAL_UI_LAYER } from "../spatial/render-layer";
import type { GazeAction } from "../spatial/gaze-action";
import { WebVRRuntimeContext, subscribeWebVRHost } from "./host";
import {
  bounded,
  sceneMenuControlLayout,
  sceneMenuLayoutConfig,
  sceneMenuAtlasRects,
  sceneMenuPoint,
  sceneMenuFollow,
  sceneMenuNeighbor,
  sceneMenuPage,
  wrapSceneTitle,
} from "./scene-menu-layout";

export type WebVRSceneMenuAppearance = {
  controlColor?: string;
  controlBackground?: string;
  controlOpacity?: number;
  selectionColor?: string;
  focusColor?: string;
  /** Shared selected/gaze/focus outline width in reference pixels. Defaults to 4; range 0–8. */
  selectionWidth?: number;
  borderRadius?: number;
  labelColor?: string;
  labelBackground?: string;
  fontSize?: number;
  labelPlacement?: "center" | "bottom";
};
export const DEFAULT_WEBVR_SCENE_MENU_APPEARANCE: Required<WebVRSceneMenuAppearance> =
  {
    controlColor: "#ffffff",
    controlBackground: "transparent",
    controlOpacity: 0.75,
    selectionColor: "#ffffff",
    focusColor: "#7dd3fc",
    selectionWidth: 4,
    borderRadius: 8,
    labelColor: "#ffffff",
    labelBackground: "transparent",
    fontSize: 28,
    labelPlacement: "center",
  };
export type WebVRSceneMenuProps = {
  items: readonly PanoSceneMenuItem[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Show an icon for scenes successfully displayed by this viewer. Defaults to false. */
  showVisited?: boolean;
  /** Accessible description for visited scenes; never rendered as visible text. */
  visitedLabel?: string;
  /** Defaults to the original compact curved grid. */
  layout?: "compact" | "flat" | "arc";
  /** All mode grows the row count and ignores rows. Defaults to paged. */
  displayMode?: "paged" | "all";
  /** Arc coverage in degrees, 60–360. Defaults to 180. */
  arcAngle?: number;
  columns?: number;
  rows?: number;
  loop?: boolean;
  closeOnSelect?: boolean;
  follow?: boolean;
  navigationPitch?: number;
  distance?: number;
  scale?: number;
  fadeDurationMs?: number;
  showTitles?: boolean;
  appearance?: WebVRSceneMenuAppearance;
};
// Keep layout/hit testing in logical pixels; supersample text before GPU filtering.
const MENU_TEXTURE_SCALE = 2;

type Target = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  disabled?: boolean;
  activate: () => void;
};

/** Native spatial UI. Mount beside WebVR and Scenes inside PanoViewer. */
export function WebVRSceneMenu(props: WebVRSceneMenuProps) {
  const runtime = useContext(WebVRRuntimeContext);
  const spatial = useContext(SpatialHostContext);
  if (!runtime || !spatial)
    throw new Error("WebVRSceneMenu must be rendered inside PanoViewer.");
  const snapshot = useSyncExternalStore(
    (fn) => subscribeWebVRHost(runtime.host, fn),
    () => runtime.host.snapshot,
    () => runtime.host.snapshot
  );
  useSyncExternalStore(spatial.subscribe, spatial.getSnapshot, () => 0);
  const blocked = spatial.surfaces.size > 0 || snapshot.setupOpen;
  return snapshot.mode && !blocked && props.items.length ? (
    <MenuSurface {...props} />
  ) : null;
}
function MenuSurface({
  items,
  activeId,
  onSelect,
  showVisited = false,
  visitedLabel = "Visited",
  layout = "compact",
  displayMode = "paged",
  arcAngle,
  columns,
  rows = 3,
  loop = true,
  closeOnSelect = true,
  follow = true,
  navigationPitch = -25,
  distance = 2,
  scale = 1,
  fadeDurationMs = 200,
  showTitles = true,
  appearance,
}: WebVRSceneMenuProps) {
  const visitedSceneIds = useVisitedSceneIds(showVisited);
  const { camera, gl } = useThree();
  const spatial = useContext(SpatialHostContext)!;
  const all = displayMode === "all";
  const { cols, rowCount, capacity, degrees } = sceneMenuLayoutConfig(
    layout,
    columns,
    rows,
    arcAngle,
    items.length,
    all
  );

  const [open, setOpen] = useState(false),
    [page, setPage] = useState(0),
    [epoch, setEpoch] = useState(0);
  const W = open && layout !== "compact" ? cols * 256 : 1024;
  const [keyboardFocus, setKeyboardFocus] = useState<string | null>(null);
  const [portal, setPortal] = useState<Element | null>(null);
  const state = useRef({
    yaw: 0,
    elapsed: 0,
    initialized: false,
    alpha: 0,
    closing: false,
    selected: "",
    dirty: true,
    focus: "",
    timer: 0,
  });
  const group = useRef<Group>(null);
  const direction = useMemo(() => new Vector3(), []);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    setPortal(
      gl.domElement
        .closest("[data-pano-viewer]")
        ?.querySelector("[data-pano-overlay]") ?? null
    );
    return () => {
      media.removeEventListener("change", update);
      window.clearTimeout(state.current.timer);
    };
  }, [gl]);
  const duration = reduced ? 0 : bounded(fadeDurationMs, 200, 0, 600);
  const close = () => {
    state.current.closing = true;
    state.current.selected = "";
    state.current.dirty = true;
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  const pages = all ? 1 : Math.ceil(items.length / capacity),
    currentPage = all ? 0 : Math.max(0, Math.min(page, pages - 1));
  const a = { ...DEFAULT_WEBVR_SCENE_MENU_APPEARANCE };
  for (const key of Object.keys(a) as (keyof WebVRSceneMenuAppearance)[]) {
    const value = appearance?.[key];
    if (value !== undefined) Object.assign(a, { [key]: value });
  }
  a.fontSize = bounded(a.fontSize, 28, 16, 48);
  a.borderRadius = bounded(a.borderRadius, 8, 0, 48);
  a.controlOpacity = bounded(a.controlOpacity, 0.75, 0, 1);
  a.selectionWidth = bounded(a.selectionWidth, 4, 0, 8);
  const rowHeight = ((W / cols - 16) * 9) / 16 + 16;
  const gridHeight = open ? Math.ceil(rowCount * rowHeight) : 0;
  const controls = sceneMenuControlLayout(W, gridHeight, open, all);
  const h = controls.height;
  const radius = bounded(distance, 2, 1.5, 3);
  const menuScale = bounded(scale, 1, 0.75, 1.25);
  const surfaces = useMemo(() => {
    const width = open ? W : 1024;
    const result: {
      canvas: HTMLCanvasElement;
      texture: CanvasTexture;
      geometry: BufferGeometry;
      material: MeshBasicMaterial;
      x: number;
      y: number;
      w: number;
      h: number;
    }[] = [];
    for (const { x: left, y: top, w, h: atlasHeight } of sceneMenuAtlasRects(
      width,
      h,
      gl.capabilities.maxTextureSize,
      MENU_TEXTURE_SCALE
    )) {
      const canvas = document.createElement("canvas");
      canvas.width = w * MENU_TEXTURE_SCALE;
      canvas.height = atlasHeight * MENU_TEXTURE_SCALE;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const positions: number[] = [],
        uvs: number[] = [];
      const point = (x: number, y: number) => {
        if (!open) {
          const angle = (28 * menuScale * Math.PI) / 180,
            theta = (x / 1024 - 0.5) * angle;
          return [
            Math.sin(theta) * radius,
            ((0.5 - y / h) * radius * angle * h) / 1024,
            -Math.cos(theta) * radius,
          ];
        }
        return sceneMenuPoint(
          x,
          y,
          width,
          h,
          gridHeight,
          cols,
          layout,
          degrees,
          radius,
          menuScale
        );
      };
      // Split at cell and footer boundaries so every arc card remains planar.
      const xs = [
        left,
        ...Array.from({ length: cols - 1 }, (_, i) => (i + 1) * 256).filter(
          (x) => open && layout === "arc" && x > left && x < left + w
        ),
        left + w,
      ];
      const ys = [
        top,
        ...[gridHeight].filter(
          (y) =>
            open && layout !== "compact" && y > top && y < top + atlasHeight
        ),
        top + atlasHeight,
      ];
      for (let j = 0; j < ys.length - 1; j++)
        for (let i = 0; i < xs.length - 1; i++) {
          const segments = !open || layout === "compact" ? 32 : 1;
          for (let k = 0; k < segments; k++) {
            const x0 = xs[i]! + ((xs[i + 1]! - xs[i]!) * k) / segments;
            const x1 = xs[i]! + ((xs[i + 1]! - xs[i]!) * (k + 1)) / segments;
            const y0 = ys[j]!,
              y1 = ys[j + 1]!;
            // Keep right/bottom edges on this card's transform rather than its neighbour.
            const sample = (x: number, y: number) => {
              const py =
                y === gridHeight && y0 < gridHeight && layout !== "compact"
                  ? y - 1e-6
                  : y;
              return point(
                x === x1 && open && layout === "arc" && py < gridHeight
                  ? x - 1e-6
                  : x,
                py
              );
            };
            for (const [x, y] of [
              [x0, y1],
              [x1, y1],
              [x1, y0],
              [x0, y1],
              [x1, y0],
              [x0, y0],
            ]) {
              positions.push(...sample(x!, y!));
              uvs.push((x! - left) / w, 1 - (y! - top) / atlasHeight);
            }
          }
        }
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3)
      );
      geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      geometry.computeVertexNormals();
      result.push({
        canvas,
        texture,
        geometry,
        material,
        x: left,
        y: top,
        w,
        h: atlasHeight,
      });
    }
    return result;
  }, [open, W, h, gridHeight, cols, layout, degrees, radius, menuScale, gl]);
  useEffect(
    () => () => {
      for (const s of surfaces) {
        s.texture.dispose();
        s.material.dispose();
        s.geometry.dispose();
      }
    },
    [surfaces]
  );
  const blocker = useMemo(() => {
    if (!open || layout !== "arc") return null;
    const geometry = new PlaneGeometry(1, 1, Math.ceil(degrees / 3), 1);
    const positions = geometry.attributes.position;
    const top = sceneMenuPoint(
      0,
      0,
      W,
      h,
      gridHeight,
      cols,
      layout,
      degrees,
      radius,
      menuScale
    )[1]!;
    const bottom = sceneMenuPoint(
      0,
      gridHeight - 1e-6,
      W,
      h,
      gridHeight,
      cols,
      layout,
      degrees,
      radius,
      menuScale
    )[1]!;
    for (let i = 0; i < positions.count; i++) {
      const theta = (positions.getX(i) * degrees * Math.PI) / 180;
      positions.setXYZ(
        i,
        Math.sin(theta) * radius * 1.2,
        (bottom + (positions.getY(i) + 0.5) * (top - bottom)) * 1.2,
        -Math.cos(theta) * radius * 1.2
      );
    }
    geometry.computeVertexNormals();
    return geometry;
  }, [open, layout, degrees, W, h, gridHeight, cols, radius, menuScale]);
  useEffect(() => () => blocker?.dispose(), [blocker]);
  const revision = JSON.stringify([
    layout,
    displayMode,
    degrees,
    cols,
    rowCount,
    currentPage,
    items.map((item) => [item.id, item.thumbnailUrl]),
  ]);
  useEffect(() => {
    spatial.action = null;
    spatial.progress = 0;
    state.current.focus = "";
    state.current.selected = "";
    window.clearTimeout(state.current.timer);
    setKeyboardFocus(null);
    setEpoch((value) => value + 1);
  }, [revision, spatial]);
  const targets: Target[] = [];
  const add = (
    id: string,
    label: string,
    x: number,
    y: number,
    w: number,
    height: number,
    activate: () => void,
    disabled = false
  ) =>
    targets.push({
      id: `${open ? "grid" : "nav"}:${epoch}:${id}`,
      label,
      x,
      y,
      w,
      h: height,
      activate,
      disabled,
    });
  const select = (id: string) => {
    if (state.current.closing || state.current.selected) return;
    state.current.selected = id;
    state.current.dirty = true;
    if (id !== activeId) onSelect?.(id);
    if (open && closeOnSelect)
      state.current.timer = window.setTimeout(close, reduced ? 0 : 120);
    else state.current.selected = "";
  };
  if (!open) {
    const prev = sceneMenuNeighbor(items, activeId, -1, loop),
      next = sceneMenuNeighbor(items, activeId, 1, loop);
    add(
      "previous",
      "Previous scene",
      controls.previous.x,
      controls.previous.y,
      controls.previous.w,
      controls.previous.h,
      () => prev && select(prev),
      !prev
    );
    add(
      "open",
      "Show scenes",
      controls.center.x,
      controls.center.y,
      controls.center.w,
      controls.center.h,
      () => {
        const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
        activeCamera.getWorldDirection(direction);
        state.current.yaw =
          (Math.atan2(direction.x, -direction.z) * 180) / Math.PI;
        state.current.alpha = 0;
        setPage(sceneMenuPage(items, activeId, capacity));
        setEpoch((v) => v + 1);
        setOpen(true);
      }
    );
    add(
      "next",
      "Next scene",
      controls.next.x,
      controls.next.y,
      controls.next.w,
      controls.next.h,
      () => next && select(next),
      !next
    );
  } else {
    items
      .slice(
        all ? 0 : currentPage * capacity,
        all ? items.length : (currentPage + 1) * capacity
      )
      .forEach((item, i) =>
        add(
          item.id,
          item.title?.trim() || item.id,
          ((i % cols) * W) / cols + 8,
          Math.floor(i / cols) * rowHeight + 8,
          W / cols - 16,
          rowHeight - 16,
          () => select(item.id)
        )
      );
    if (!all)
      add(
        "previous-page",
        "Previous page",
        controls.previous.x,
        controls.previous.y,
        controls.previous.w,
        controls.previous.h,
        () => {
          setPage(currentPage - 1);
          setEpoch((v) => v + 1);
        },
        currentPage === 0
      );
    add(
      "close",
      "Hide scenes",
      controls.center.x,
      controls.center.y,
      controls.center.w,
      controls.center.h,
      close
    );
    if (!all)
      add(
        "next-page",
        "Next page",
        controls.next.x,
        controls.next.y,
        controls.next.w,
        controls.next.h,
        () => {
          setPage(currentPage + 1);
          setEpoch((v) => v + 1);
        },
        currentPage >= pages - 1
      );
  }
  const current = useRef({
    targets,
    duration,
    follow,
    pitch: navigationPitch,
    keyboardFocus,
  });
  current.current = {
    targets,
    duration,
    follow,
    pitch: navigationPitch,
    keyboardFocus,
  };
  useEffect(() => {
    state.current.dirty = true;
  });
  const images = useRef(new Map<string, HTMLImageElement>());
  const visibleItems = open
    ? items.slice(
        all ? 0 : currentPage * capacity,
        all ? items.length : (currentPage + 1) * capacity
      )
    : [];
  const imageKey = JSON.stringify(
    visibleItems.map((item) => [item.id, item.thumbnailUrl])
  );
  useEffect(() => {
    images.current.clear();
    let alive = true;
    const pending = new Map<string, HTMLImageElement>();
    for (const item of visibleItems) {
      if (pending.has(item.thumbnailUrl)) continue;
      const img = new Image();
      pending.set(item.thumbnailUrl, img);
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (alive) {
          for (const candidate of visibleItems) {
            if (candidate.thumbnailUrl === item.thumbnailUrl)
              images.current.set(candidate.id, img);
          }
          state.current.dirty = true;
        }
      };
      img.onerror = () => {
        if (alive) state.current.dirty = true;
      };
      img.src = item.thumbnailUrl;
    }
    return () => {
      alive = false;
      images.current.clear();
    };
  }, [imageKey]);
  const resolve = (uv: { x: number; y: number }): GazeAction | null => {
    if (state.current.closing || state.current.selected) return null;
    const target = current.current.targets.find(
      (t) =>
        uv.x * W >= t.x &&
        uv.x * W <= t.x + t.w &&
        (1 - uv.y) * h >= t.y &&
        (1 - uv.y) * h <= t.y + t.h
    );
    return target && !target.disabled
      ? {
          id: target.id,
          enabled: () => !state.current.closing,
          activate: target.activate,
        }
      : null;
  };
  const visibleByTarget = new Map(
    visibleItems.map((item) => [`grid:${epoch}:${item.id}`, item])
  );
  useFrame((_, dt) => {
    const s = state.current,
      c = current.current;
    const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    activeCamera.getWorldDirection(direction);
    const yaw = (Math.atan2(direction.x, -direction.z) * 180) / Math.PI;
    if (!s.initialized) {
      s.yaw = yaw;
      s.initialized = true;
    }
    const focused =
      (targets.some((t) => t.id === c.keyboardFocus)
        ? c.keyboardFocus
        : null) ??
      (typeof spatial.action?.id === "string" &&
      targets.some((t) => t.id === spatial.action?.id)
        ? spatial.action.id
        : "");
    if (!open && c.follow)
      Object.assign(
        s,
        sceneMenuFollow(s.yaw, yaw, s.elapsed, dt, Boolean(focused))
      );
    if (group.current) {
      activeCamera.getWorldPosition(group.current.position);
      group.current.rotation.set(
        open ? 0 : (bounded(c.pitch, -25, -40, -15) * Math.PI) / 180,
        (-s.yaw * Math.PI) / 180,
        0,
        "YXZ"
      );
    }
    const step =
      c.duration === 0 ? 1 : (Math.min(dt, 0.05) * 1000) / c.duration;
    s.alpha = s.closing
      ? Math.max(0, s.alpha - step)
      : Math.min(1, s.alpha + step);
    for (const surface of surfaces) surface.material.opacity = s.alpha;
    if (s.closing && s.alpha === 0) {
      s.closing = false;
      setOpen(false);
      setEpoch((v) => v + 1);
    }
    if (s.focus !== focused) {
      s.focus = focused;
      s.dirty = true;
    }
    if (!s.dirty) return;
    s.dirty = false;
    for (const {
      canvas,
      texture,
      x: atlasX,
      y: atlasY,
      w: atlasWidth,
      h: atlasHeight,
    } of surfaces) {
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.setTransform(
        MENU_TEXTURE_SCALE,
        0,
        0,
        MENU_TEXTURE_SCALE,
        -atlasX * MENU_TEXTURE_SCALE,
        -atlasY * MENU_TEXTURE_SCALE
      );
      const drawIcon = (kind: string, x: number, y: number, size: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size / 24, size / 24);
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 5 * MENU_TEXTURE_SCALE;
        ctx.shadowOffsetY = 2 * MENU_TEXTURE_SCALE;
        ctx.strokeStyle = a.controlColor;
        ctx.lineWidth = 1.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        if (kind === "open") {
          ctx.arc(12, 12, 11, 0, Math.PI * 2);
          ctx.stroke();
          for (let r = 0; r < 3; r++)
            for (let col = 0; col < 3; col++)
              ctx.fillRect(6 + col * 4.5, 6 + r * 4.5, 3, 3);
        } else if (kind === "close") {
          ctx.arc(12, 12, 10, 0, Math.PI * 2);
          ctx.moveTo(8, 8);
          ctx.lineTo(16, 16);
          ctx.moveTo(16, 8);
          ctx.lineTo(8, 16);
          ctx.stroke();
        } else {
          const right = kind.startsWith("next");
          ctx.moveTo(right ? 8 : 16, 1);
          ctx.lineTo(right ? 16 : 8, 12);
          ctx.lineTo(right ? 8 : 16, 23);
          ctx.stroke();
        }
        ctx.restore();
      };
      for (const t of targets) {
        const focused = t.id === s.focus;
        const outlineMargin = Math.max(5, a.selectionWidth);
        if (
          t.x + t.w + outlineMargin < atlasX ||
          t.x - outlineMargin > atlasX + atlasWidth ||
          t.y + t.h + outlineMargin < atlasY ||
          t.y - outlineMargin > atlasY + atlasHeight
        )
          continue;
        const item = open ? visibleByTarget.get(t.id) : undefined;
        const visited = item !== undefined && visitedSceneIds.has(item.id);
        ctx.save();
        ctx.globalAlpha = t.disabled
          ? 0.22
          : focused || item
          ? 1
          : a.controlOpacity;
        ctx.beginPath();
        ctx.roundRect(t.x, t.y, t.w, t.h, a.borderRadius);
        ctx.clip();
        ctx.fillStyle = item ? "#20252d" : a.controlBackground;
        ctx.fillRect(t.x, t.y, t.w, t.h);
        if (item) {
          const img = images.current.get(item.id);
          if (img) {
            const ratio =
              Math.max(t.w / img.width, t.h / img.height) *
              (focused && !reduced ? 1.06 : 1);
            ctx.drawImage(
              img,
              t.x + (t.w - img.width * ratio) / 2,
              t.y + (t.h - img.height * ratio) / 2,
              img.width * ratio,
              img.height * ratio
            );
          }
          if (focused) {
            ctx.fillStyle = "rgba(0,0,0,.24)";
            ctx.fillRect(t.x, t.y, t.w, t.h);
          }
          if (showTitles) {
            ctx.font = `${a.fontSize}px sans-serif`;
            const lines = wrapSceneTitle(
              t.label,
              t.w - 24 - (visited ? 40 : 0),
              (text) => ctx.measureText(text).width
            );
            const lineHeight = a.fontSize * 1.15,
              height = lines.length * lineHeight + 10;
            const y =
              a.labelPlacement === "bottom"
                ? t.y + t.h - height
                : t.y + (t.h - height) / 2;
            ctx.fillStyle = a.labelBackground;
            ctx.fillRect(t.x, y, t.w, height);
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 3 * MENU_TEXTURE_SCALE;
            ctx.shadowOffsetY = 1.5 * MENU_TEXTURE_SCALE;
            ctx.fillStyle = a.labelColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            lines.forEach((line, i) =>
              ctx.fillText(
                line,
                t.x + (t.w - (visited ? 40 : 0)) / 2,
                y + 5 + lineHeight * (i + 0.5)
              )
            );
            ctx.restore();
          }
          if (visited) {
            ctx.save();
            ctx.translate(t.x + t.w - 40, t.y + 8);
            ctx.fillStyle = "rgba(0,0,0,0.78)";
            ctx.beginPath();
            ctx.arc(16, 16, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(8, 16);
            ctx.lineTo(13, 21);
            ctx.lineTo(24, 10);
            ctx.stroke();
            ctx.restore();
          }
          if (focused && c.keyboardFocus === t.id && a.selectionWidth === 0) {
            ctx.strokeStyle = a.focusColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(t.x + 2, t.y + 2, t.w - 4, t.h - 4);
          }
        } else {
          ctx.fillStyle = a.controlColor;
          const kind = t.id.split(":").slice(2).join(":");
          const iconSize = controls.iconSize;
          drawIcon(
            kind,
            t.x + t.w / 2 - iconSize / 2,
            t.y + t.h / 2 - iconSize / 2,
            iconSize
          );
        }
        if (focused && !item) {
          ctx.strokeStyle = a.controlColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(t.x + 2, t.y + 2, t.w - 4, t.h - 4);
        }
        ctx.restore();
        if (
          item &&
          a.selectionWidth > 0 &&
          (focused || item.id === activeId || item.id === s.selected)
        ) {
          // The inner stroke edge meets the thumbnail without covering it.
          const halfWidth = a.selectionWidth / 2;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(
            t.x - halfWidth,
            t.y - halfWidth,
            t.w + a.selectionWidth,
            t.h + a.selectionWidth,
            a.borderRadius + halfWidth
          );
          ctx.strokeStyle = focused ? a.focusColor : a.selectionColor;
          ctx.lineWidth = a.selectionWidth;
          ctx.stroke();
          ctx.restore();
        }
      }
      if (controls.pageLabel) {
        const label = controls.pageLabel;
        ctx.font = `${label.height}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = a.labelColor;
        ctx.fillText(
          `${currentPage + 1} / ${pages}`,
          label.x,
          label.y + label.height / 2
        );
      }
      ctx.restore();
      texture.needsUpdate = true;
    }
  });
  const domRoot = useRef<Root | null>(null);
  useEffect(() => {
    if (!portal) return;
    const element = document.createElement("div");
    portal.append(element);
    const root = createRoot(element);
    domRoot.current = root;
    return () => {
      domRoot.current = null;
      root.unmount();
      element.remove();
    };
  }, [portal]);
  useEffect(() => {
    domRoot.current?.render(
      <div role="group" aria-label="VR scenes">
        {targets.map((t) => (
          <button
            key={t.id}
            type="button"
            className="pano-sr-only"
            disabled={t.disabled || state.current.closing}
            aria-label={t.label}
            aria-description={
              visitedSceneIds.has(visibleByTarget.get(t.id)?.id ?? "")
                ? visitedLabel
                : undefined
            }
            aria-current={
              open && t.id === `grid:${epoch}:${activeId}` ? "true" : undefined
            }
            onFocus={() => setKeyboardFocus(t.id)}
            onBlur={() => setKeyboardFocus(null)}
            onClick={() => {
              if (!state.current.closing && !state.current.selected)
                t.activate();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  });
  return (
    <>
      <group
        ref={group}
        onUpdate={(node) =>
          node.traverse((child) => child.layers.set(SPATIAL_UI_LAYER))
        }
      >
        {blocker && (
          <mesh
            geometry={blocker}
            userData={{ panoGazeResolve: () => null }}
            onClick={(event) => event.stopPropagation()}
            onPointerMove={(event) => {
              event.stopPropagation();
              spatial.action = null;
            }}
          >
            <meshBasicMaterial
              transparent
              opacity={0}
              depthWrite={false}
              colorWrite={false}
            />
          </mesh>
        )}
        {surfaces.map((surface, index) => (
          <mesh
            key={index}
            geometry={surface.geometry}
            material={surface.material}
            renderOrder={90001}
            pointerEventsOrder={10}
            userData={{
              panoGazeResolve: (uv: { x: number; y: number }) =>
                resolve({
                  x: (surface.x + uv.x * surface.w) / (open ? W : 1024),
                  y: 1 - (surface.y + (1 - uv.y) * surface.h) / h,
                }),
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (spatial.input.accept(pointerInput(event), "click") && event.uv)
                event.object.userData.panoGazeResolve(event.uv)?.activate?.();
            }}
            onPointerMove={(event) => {
              event.stopPropagation();
              if (spatial.input.accept(pointerInput(event), "hover", !!pointerStick(pointerInput(event))) && event.uv)
                spatial.action = event.object.userData.panoGazeResolve(
                  event.uv
                );
            }}
            onPointerOut={() => {
              spatial.action = null;
            }}
            onPointerDown={(event) => { event.stopPropagation(); spatial.input.accept(pointerInput(event), "down", !!pointerStick(pointerInput(event))); }}
            raycast={function (this: Mesh, raycaster, intersections) {
              if (!state.current.closing && state.current.alpha > 0)
                Mesh.prototype.raycast.call(this, raycaster, intersections);
            }}
          />
        ))}
      </group>
    </>
  );
}
