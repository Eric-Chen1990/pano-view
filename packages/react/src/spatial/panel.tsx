import { supportsNativeHtmlCapture } from "./capture-support";
import { spatialPanelScale, spatialUvToPoint } from "./layout";
import { SPATIAL_UI_LAYER } from "./render-layer";
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  LinearFilter,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type Vector2,
} from "three";
import {
  SpatialHostContext,
  type PanoSpatialControlAdapter,
  type SpatialSurface,
} from "./host";
import { WebVRRuntimeContext, subscribeWebVRHost } from "../webvr/host";
import { ScenesHostContext } from "../scenes-host";
import type { GazeAction } from "./gaze-action";

type Button = {
  label: string;
  action: GazeAction;
  x: number;
  y: number;
  w: number;
  h: number;
};
const WIDTH = 640;
const BODY_HEIGHT = 688;
const HEIGHT = 1000;
const RASTER_SCALE = 2;

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * RASTER_SCALE;
  canvas.height = HEIGHT * RASTER_SCALE;
  return canvas;
}

/** Native rendering is capability gated; the DOM clone never owns application state. */
async function capture(
  element: HTMLElement,
  owner: HTMLElement
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const native = ctx as CanvasRenderingContext2D & {
    drawElementImage?: (node: HTMLElement, x: number, y: number) => void;
  };
  canvas.setAttribute("content", "drawable");
  if (
    supportsNativeHtmlCapture(
      canvas as HTMLCanvasElement & {
        content?: string;
        requestPaint?: unknown;
      },
      native
    )
  ) {
    canvas.width = WIDTH;
    canvas.height = BODY_HEIGHT;
    const clone = element.cloneNode(true) as HTMLElement;
    const originals = [element, ...element.querySelectorAll<HTMLElement>("*")];
    const copies = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
    originals.forEach((node, i) => {
      const copy = copies[i];
      const css = getComputedStyle(node);
      for (const key of css)
        copy.style.setProperty(key, css.getPropertyValue(key));
    });
    Object.assign(clone.style, {
      left: "0",
      top: "0",
      transform: "none",
      position: "relative",
    });
    clone.setAttribute("drawable", "");
    canvas.append(clone);
    owner.append(canvas);
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("HTML paint timed out")),
          1500
        );
        canvas.addEventListener(
          "paint",
          () => {
            clearTimeout(timer);
            try {
              originals.forEach((node, i) => {
                copies[i].scrollTop = node.scrollTop;
                copies[i].scrollLeft = node.scrollLeft;
              });
              native.drawElementImage!(clone, 0, 0);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          { once: true }
        );
        (
          canvas as HTMLCanvasElement & { requestPaint: () => void }
        ).requestPaint();
      });
      if (!native.getImageData(20, 20, 1, 1).data[3])
        throw new Error("Native HTML capture produced an empty frame");
      return canvas;
    } catch {
      /* Fall through to the compatible renderer. */
    } finally {
      canvas.remove();
    }
  }
  const { domToCanvas } = await import("modern-screenshot");
  // Snapshot a layout clone with media placeholders, avoiding duplicate video decoders.
  const clone = element.cloneNode(true) as HTMLElement;
  const originals = [element, ...element.querySelectorAll<HTMLElement>("*")];
  const copies = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  originals.forEach((node, i) => {
    const copy = copies[i];
    const css = getComputedStyle(node);
    for (const key of css)
      copy.style.setProperty(key, css.getPropertyValue(key));
    copy.scrollTop = node.scrollTop;
    copy.scrollLeft = node.scrollLeft;
    if (node.tagName === "IFRAME") {
      const frame = node as HTMLIFrameElement;
      const box = document.createElement("div");
      box.style.cssText = copy.style.cssText;
      box.style.overflow = "hidden";
      try {
        const doc = frame.contentDocument;
        if (doc?.body) {
          const body = doc.body.cloneNode(true) as HTMLElement;
          const from = [
            doc.body,
            ...doc.body.querySelectorAll<HTMLElement>("*"),
          ];
          const to = [body, ...body.querySelectorAll<HTMLElement>("*")];
          from.forEach((original, index) => {
            const css = doc.defaultView!.getComputedStyle(original);
            for (const key of css)
              to[index].style.setProperty(key, css.getPropertyValue(key));
            if (original.tagName === "IMG")
              (to[index] as HTMLImageElement).src = (
                original as HTMLImageElement
              ).src;
          });
          const scroll = doc.scrollingElement;
          body.style.transform = `translate(${-(
            scroll?.scrollLeft ?? 0
          )}px, ${-(scroll?.scrollTop ?? 0)}px)`;
          box.append(body);
        }
      } catch {
        /* Cross-origin frames use the visible fallback message. */
      }
      copy.replaceWith(box);
    }
    if (node.matches("video,canvas,audio")) {
      const box = document.createElement("div");
      box.style.cssText = copy.style.cssText;
      box.style.width = `${node.getBoundingClientRect().width}px`;
      box.style.height = `${node.getBoundingClientRect().height}px`;
      copy.replaceWith(box);
    }
  });
  Object.assign(clone.style, {
    position: "relative",
    left: "0",
    top: "0",
    transform: "none",
  });
  owner.append(clone);
  originals.forEach((node, i) => {
    copies[i].scrollTop = node.scrollTop;
    copies[i].scrollLeft = node.scrollLeft;
  });
  try {
    return await domToCanvas(clone, {
      width: WIDTH,
      height: Math.min(BODY_HEIGHT, element.offsetHeight),
      scale: 2,
      timeout: 3000,
    });
  } finally {
    clone.remove();
  }
}

function SurfacePanel({ surface }: { surface: SpatialSurface }) {
  const host = useContext(SpatialHostContext)!;
  const { camera, gl } = useThree();
  const group = useRef<Group>(null);
  const panelMesh = useRef<Mesh>(null);
  const canvas = useMemo(makeCanvas, []);
  const texture = useMemo(() => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearFilter; t.magFilter = LinearFilter; t.generateMipmaps = false;
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return t;
  }, [canvas, gl]);
  const pressed = useRef<GazeAction | null>(null);
  const layers = useRef(
    new Map<HTMLElement, Mesh<PlaneGeometry, MeshBasicMaterial>>()
  );
  const scratch = useMemo(() => new Vector3(), []);
  const state = useRef({
    dirty: true,
    busy: false,
    disposed: false,
    generation: 0,
    revision: 0,
    last: 0,
    painted: 0,
    height: HEIGHT,
    image: null as HTMLCanvasElement | null,
    failed: false,
    mediaBlocked: false,
    buttons: [] as Button[],
    target: surface.element,
    adapter: null as PanoSpatialControlAdapter | null,
  });
  const sceneHost = useContext(ScenesHostContext);
  useEffect(() => {
    const s = state.current;
    s.disposed = false;
    s.generation++;
    s.target = surface.element;
    s.adapter = null;
    s.dirty = true;
    s.image = null;
    surface.element.dataset.panoSpatialState = "loading";
    group.current?.traverse((node) => node.layers.set(SPATIAL_UI_LAYER));
    const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    activeCamera.getWorldDirection(scratch);
    group.current?.position
      .copy(activeCamera.position)
      .addScaledVector(scratch, 2);
    group.current?.quaternion.copy(activeCamera.quaternion);
    const releasePointer = () => {
      pressed.current = null;
      host.suppressGazeUntil = 0;
    };
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("blur", releasePointer);
    const observer = new MutationObserver((records) => {
      if (
        records.every(
          (record) =>
            record.type === "attributes" &&
            record.attributeName?.startsWith("data-pano-spatial-")
        )
      )
        return;
      s.revision++;
      surface.element.dataset.panoSpatialState = "loading";
      if (!surface.element.contains(s.target)) {
        s.target = surface.element;
        s.adapter = null;
      }
      s.dirty = true;
    });
    observer.observe(surface.element, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    const resize = new ResizeObserver(() => {
      s.dirty = true;
    });
    resize.observe(surface.element);
    const dirty = () => {
      s.dirty = true;
    };
    surface.element.addEventListener("scroll", dirty, true);
    surface.element.addEventListener("load", dirty, true);
    const unsubscribers = [...host.controls.values()].flatMap((a) =>
      a.subscribeFrame ? [a.subscribeFrame(dirty)] : []
    );
    const sceneId = sceneHost?.controller?.getActiveSceneId();
    const sceneChanged = () => {
      const next = sceneHost?.controller?.getActiveSceneId();
      if (next && sceneId && next !== sceneId) surface.close();
    };
    sceneHost?.listeners.add(sceneChanged);
    return () => {
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("blur", releasePointer);
      s.disposed = true;
      s.generation++;
      host.suppressGazeUntil = 0;
      observer.disconnect();
      resize.disconnect();
      unsubscribers.forEach((fn) => fn());
      sceneHost?.listeners.delete(sceneChanged);
      surface.element.removeEventListener("scroll", dirty, true);
      surface.element.removeEventListener("load", dirty, true);
      surface.element
        .querySelectorAll("video,audio")
        .forEach((m) => (m as HTMLMediaElement).pause());
    };
  }, [surface, camera, gl, host, sceneHost, scratch]);
  useEffect(
    () => () => {
      texture.dispose();
      layers.current.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.removeFromParent();
      });
    },
    [texture]
  );

  const resolve = (uv: Vector2): GazeAction | null => {
    const s = state.current;
    const { x, y } = spatialUvToPoint(uv, s.height);
    const button = s.buttons.find(
      (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
    );
    if (button) return button.action;
    if (y >= BODY_HEIGHT) return null;
    const rect = surface.element.getBoundingClientRect();
    // The source stays offscreen. Measured boxes provide hit testing without moving portals.
    for (const candidate of surface.element.querySelectorAll<HTMLElement>('.pano-dialog-close,[data-pano-dialog-close]')) {
      if (candidate.matches(':disabled,[aria-disabled="true"]')) continue;
      if (getComputedStyle(candidate).pointerEvents === "none") continue;
      const r = candidate.getBoundingClientRect();
      const expandX = Math.max(0, (56 - r.width) / 2), expandY = Math.max(0, (56 - r.height) / 2);
      if (x >= r.left - rect.left - expandX && x <= r.right - rect.left + expandX && y >= r.top - rect.top - expandY && y <= r.bottom - rect.top + expandY) {
        return { id: candidate, activate: () => { candidate.click(); s.dirty = true; } };
      }
    }
    let target: HTMLElement = surface.element;
    for (const el of surface.element.querySelectorAll<HTMLElement>("*")) {
      if (getComputedStyle(el).pointerEvents === "none") continue;
      const r = el.getBoundingClientRect();
      if (
        x < r.left - rect.left ||
        x > r.right - rect.left ||
        y < r.top - rect.top ||
        y > r.bottom - rect.top
      )
        continue;
      let clipped = false;
      for (
        let parent = el.parentElement;
        parent && parent !== surface.element;
        parent = parent.parentElement
      ) {
        if (
          !/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflow)
        )
          continue;
        const p = parent.getBoundingClientRect();
        if (
          x < p.left - rect.left ||
          x > p.right - rect.left ||
          y < p.top - rect.top ||
          y > p.bottom - rect.top
        )
          clipped = true;
      }
      if (!clipped && getComputedStyle(el).visibility !== "hidden") target = el;
    }
    if (target instanceof HTMLIFrameElement) {
      try {
        const r = target.getBoundingClientRect();
        target =
          (target.contentDocument?.elementFromPoint(
            x + rect.left - r.left,
            y + rect.top - r.top
          ) as HTMLElement) ?? target;
      } catch {
        /* Cross-origin content uses the exit fallback. */
      }
    }
    const control = [...host.controls].find(
      ([node]) => node === target || node.contains(target)
    );
    s.adapter = control?.[1] ?? null;
    let scroll: HTMLElement | null = target;
    while (
      scroll &&
      scroll !== surface.element &&
      !(
        scroll.scrollHeight > scroll.clientHeight + 1 ||
        scroll.scrollWidth > scroll.clientWidth + 1
      )
    )
      scroll = scroll.parentElement;
    s.target = control?.[0] ?? scroll ?? surface.element;
    const clickable = target.closest<HTMLElement>('button,a,[role="button"]');
    if (!clickable || clickable.matches(':disabled,[aria-disabled="true"]'))
      return null;
    return {
      id: clickable,
      activate: () => {
        clickable.click();
        s.dirty = true;
      },
    };
  };

  useFrame((_, delta) => {
    const s = state.current;
    if (delta > 0.25 || document.hidden) pressed.current = null;
    if (pressed.current) {
      host.suppressGazeUntil = performance.now() + 350;
      if (pressed.current.enabled?.() !== false)
        pressed.current.update?.(Math.min(delta, 0.048));
    }
    const ctx = canvas.getContext("2d")!;
    const nextHeight = Math.max(
      200,
      Math.min(BODY_HEIGHT, surface.element.offsetHeight) +
        (s.buttons.length ? 32 + Math.ceil(s.buttons.length / 5) * 88 : 0)
    );
    if (canvas.height !== nextHeight * RASTER_SCALE) {
      // WebGL texture storage is immutable: release it before changing dimensions.
      texture.dispose();
      canvas.height = nextHeight * RASTER_SCALE;
      s.height = nextHeight;
      const scale = spatialPanelScale(nextHeight);
      panelMesh.current?.scale.set(WIDTH * scale, nextHeight * scale, 1);
    }
    ctx.setTransform(RASTER_SCALE, 0, 0, RASTER_SCALE, 0, 0);
    const now = performance.now();
    if (now - s.painted < 1000 / 30) return;
    s.painted = now;
    const media =
      surface.element.querySelector<HTMLMediaElement>("video,audio");
    const restricted = [...surface.element.querySelectorAll("iframe")].some(
      (frame) => {
        try {
          return !frame.contentDocument?.documentElement;
        } catch {
          return true;
        }
      }
    );
    if (s.dirty && !s.busy && now - s.last > 1000 / 15) {
      s.busy = true;
      const generation = s.generation,
        revision = s.revision;
      s.dirty = false;
      s.last = now;
      const owner = document.createElement("div");
      Object.assign(owner.style, {
        position: "absolute",
        left: "-20000px",
        top: "0",
      });
      owner.setAttribute("aria-hidden", "true");
      surface.element.closest("[data-pano-viewer]")?.append(owner);
      capture(surface.element, owner)
        .then((image) => {
          if (
            !s.disposed &&
            generation === s.generation &&
            revision === s.revision
          ) {
            s.image = image;
            s.failed = false;
            surface.element.dataset.panoSpatialState = "ready";
          } else if (!s.disposed) s.dirty = true;
        })
        .catch(() => {
          if (generation === s.generation) {
            s.failed = true;
            surface.element.dataset.panoSpatialState = "error";
          }
        })
        .finally(() => {
          owner.remove();
          s.busy = false;
        });
    }
    const appearance = getComputedStyle(surface.element);
    const radius = Math.max(0, parseFloat(appearance.borderTopLeftRadius) || 0);
    ctx.clearRect(0, 0, WIDTH, s.height);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, WIDTH, s.height, radius);
    ctx.clip();
    ctx.fillStyle = appearance.backgroundColor || "#161b22";
    ctx.fill();
    if (s.image)
      ctx.drawImage(
        s.image,
        0,
        0,
        WIDTH,
        Math.min(BODY_HEIGHT, surface.element.offsetHeight)
      );
    if (s.failed || restricted || s.mediaBlocked) {
      ctx.fillStyle = "#161b22";
      ctx.fillRect(0, 100, WIDTH, 170);
      ctx.fillStyle = "#fff";
      ctx.font = "24px sans-serif";
      ctx.fillText("Exit VR to view this content", 30, 165);
    }
    const rootRect = surface.element.getBoundingClientRect();
    for (const [node, mesh] of layers.current)
      if (!host.controls.has(node) || !surface.element.contains(node)) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.removeFromParent();
        layers.current.delete(node);
      }
    for (const [node, adapter] of host.controls) {
      if (!adapter.texture || !surface.element.contains(node)) continue;
      let mesh = layers.current.get(node);
      if (!mesh) {
        mesh = new Mesh(
          new PlaneGeometry(1, 1),
          new MeshBasicMaterial({
            map: adapter.texture,
            toneMapped: false,
            depthTest: false,
          })
        );
        mesh.layers.set(SPATIAL_UI_LAYER);
        mesh.renderOrder = 2;
        mesh.raycast = () => {};
        layers.current.set(node, mesh);
        group.current?.add(mesh);
      }
      const rect = node.getBoundingClientRect();
      const top = Math.max(0, rect.top - rootRect.top),
        bottom = Math.min(BODY_HEIGHT, rect.bottom - rootRect.top);
      mesh.visible = bottom > top;
      const scale = spatialPanelScale(s.height);
      mesh.position.set(
        (rect.left - rootRect.left + rect.width / 2 - WIDTH / 2) * scale,
        (s.height / 2 - (top + bottom) / 2) * scale,
        0.001
      );
      mesh.scale.set(rect.width * scale, (bottom - top) * scale, 1);
      mesh.material.map = adapter.texture;
      const uv = mesh.geometry.attributes.uv;
      const vTop = 1 - (top - (rect.top - rootRect.top)) / rect.height,
        vBottom = 1 - (bottom - (rect.top - rootRect.top)) / rect.height;
      uv.setXY(0, 0, vTop);
      uv.setXY(1, 1, vTop);
      uv.setXY(2, 0, vBottom);
      uv.setXY(3, 1, vBottom);
      uv.needsUpdate = true;
    }
    for (const node of surface.element.querySelectorAll<
      HTMLVideoElement | HTMLCanvasElement
    >("video,canvas")) {
      const r = node.getBoundingClientRect();
      const x = r.left - rootRect.left,
        y = r.top - rootRect.top;
      const adapter = [...host.controls].find(
        ([el]) => el === node || el.contains(node)
      )?.[1];
      if (adapter?.texture) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        0,
        0,
        WIDTH,
        Math.min(BODY_HEIGHT, surface.element.offsetHeight)
      );
      ctx.clip();
      try {
        ctx.drawImage(node, x, y, r.width, r.height);
      } catch {
        /* Loading media has no frame yet. */
      }
      ctx.restore();
    }
    const buttons: Button[] = [];
    const add = (
      id: string,
      label: string,
      update?: (dt: number) => void,
      activate?: () => void,
      enabled?: () => boolean
    ) => {
      const i = buttons.length;
      buttons.push({
        label,
        x: 16 + (i % 5) * 124,
        y:
          Math.min(BODY_HEIGHT, surface.element.offsetHeight) +
          18 +
          Math.floor(i / 5) * 88,
        w: 104,
        h: 64,
        action: { id, update, activate, enabled },
      });
    };
    const target = s.target;
    const scrollable =
      target.scrollHeight > target.clientHeight + 1 ||
      target.scrollWidth > target.clientWidth + 1;
    if (scrollable && !s.adapter) {
      const axis = (dx: number, dy: number) => (dt: number) => {
        target.scrollLeft += (dx * target.clientWidth * dt) / 2;
        target.scrollTop += (dy * target.clientHeight * dt) / 2;
        s.dirty = true;
      };
      add("up", "Up", axis(0, -1), undefined, () => target.scrollTop > 0);
      add(
        "down",
        "Down",
        axis(0, 1),
        undefined,
        () => target.scrollTop < target.scrollHeight - target.clientHeight - 1
      );
      if (target.scrollWidth > target.clientWidth + 1) {
        add(
          "left",
          "Left",
          axis(-1, 0),
          undefined,
          () => target.scrollLeft > 0
        );
        add(
          "right",
          "Right",
          axis(1, 0),
          undefined,
          () => target.scrollLeft < target.scrollWidth - target.clientWidth - 1
        );
      }
    }
    const a = s.adapter;
    if (a) {
      const rotate = (yaw: number, pitch: number) => (dt: number) => {
        a.rotateBy?.(yaw * 30 * dt, pitch * 30 * dt);
        s.dirty = true;
      };
      if (a.rotateBy)
        for (const [id, label, yaw, pitch] of [
          ["left", "Left", -1, 0],
          ["right", "Right", 1, 0],
          ["up", "Up", 0, 1],
          ["down", "Down", 0, -1],
        ] as const)
          add(
            id,
            label,
            rotate(yaw, pitch),
            undefined,
            () => a.canExecute?.(id) !== false
          );
      if (a.zoomBy) {
        add(
          "in",
          "Zoom +",
          (dt) => a.zoomBy!(1.5 ** dt),
          undefined,
          () => a.canExecute?.("in") !== false
        );
        add(
          "out",
          "Zoom -",
          (dt) => a.zoomBy!(1.5 ** -dt),
          undefined,
          () => a.canExecute?.("out") !== false
        );
      }
      if (a.resetView) add("reset", "Reset", undefined, a.resetView);
    }
    if (media && !a) {
      add("play", media.paused ? "Play" : "Pause", undefined, () => {
        if (media.paused)
          void media.play().catch(() => {
            s.mediaBlocked = true;
          });
        else media.pause();
      });
      if (Number.isFinite(media.duration)) {
        add("rewind", "-10s", (dt) => {
          media.currentTime = Math.max(0, media.currentTime - dt * 10);
        });
        add("forward", "+10s", (dt) => {
          media.currentTime = Math.min(
            media.duration,
            media.currentTime + dt * 10
          );
        });
      }
      add(
        "vol-",
        "Vol -",
        (dt) => {
          media.volume = Math.max(0, media.volume - dt / 4);
        },
        undefined,
        () => media.volume > 0
      );
      add(
        "vol+",
        "Vol +",
        (dt) => {
          media.volume = Math.min(1, media.volume + dt / 4);
        },
        undefined,
        () => media.volume < 1
      );
      add("mute", media.muted ? "Unmute" : "Mute", undefined, () => {
        media.muted = !media.muted;
      });
    }
    s.buttons = buttons;
    for (const b of buttons) {
      ctx.fillStyle = b.action.enabled?.() === false ? "#333a43" : "#39424e";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "#fff";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.label, b.x + b.w / 2, b.y + 39);
    }
    ctx.textAlign = "start";
    ctx.restore();
    texture.needsUpdate = true;
  });
  return (
    <group ref={group} renderOrder={90000}>
      <mesh
        ref={panelMesh}
        onPointerDown={(event) => {
          host.suppressGazeUntil = performance.now() + 350;
          event.stopPropagation();
          if (event.uv) pressed.current = resolve(event.uv);
        }}
        onPointerUp={() => {
          host.suppressGazeUntil = 0;
          pressed.current = null;
        }}
        onPointerOut={() => {
          host.suppressGazeUntil = 0;
          pressed.current = null;
        }}
        userData={{ panoGazeResolve: resolve }}
        onPointerMove={(event) => {
          event.stopPropagation();
          if (event.uv) host.action = resolve(event.uv);
        }}
        onPointerOver={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (event.uv) resolve(event.uv)?.activate?.();
        }}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          depthTest={false}
          depthWrite={false}
          transparent
        />
      </mesh>
    </group>
  );
}

export function SpatialPanels() {
  const host = useContext(SpatialHostContext)!;
  const vr = useContext(WebVRRuntimeContext)!;
  const camera = useThree((state) => state.camera);
  const raycaster = useThree((state) => state.raycaster);
  useEffect(() => {
    const originalMask = camera.layers.mask;
    camera.layers.enable(SPATIAL_UI_LAYER);
    const rayMask = raycaster.layers.mask;
    raycaster.layers.enable(SPATIAL_UI_LAYER);
    return () => {
      camera.layers.mask = originalMask;
      raycaster.layers.mask = rayMask;
    };
  }, [camera, raycaster]);
  useSyncExternalStore(host.subscribe, host.getSnapshot, () => 0);
  const mode = useSyncExternalStore(
    (fn) => subscribeWebVRHost(vr.host, fn),
    () => vr.host.snapshot.mode,
    () => null
  );
  useEffect(() => {
    host.exit = () => vr.host.controller?.exitVR() ?? Promise.resolve();
    host.setMode(mode !== null);
    return () => host.setMode(false);
  }, [host, vr.host, mode]);
  const surfaces = [...host.surfaces];
  const surface = surfaces[surfaces.length - 1];
  return mode && surface ? <SurfacePanel surface={surface} /> : null;
}
