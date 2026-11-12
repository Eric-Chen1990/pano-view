import { resolveSurfaceModelAdapter } from "./model-controls";
import {
  applySpatialAxes,
  axisValue,
  pointerInput,
  pointerStick,
  type PointerInput,
} from "../webvr/input";
import { scrollEdges, scrollViewportBounds } from "./scroll-edges";
import { probeMediaHasAudio } from "../controls/media-audio";
import { clampVolume, probeVolumeAdjustable } from "../video/format";
import {
  CONTROL_GROUP_DEFAULTS,
  controlGroupLayout,
  allowsAutomaticMediaControls,
  shouldPauseSurfaceMedia,
} from "../controls/layout";
import { mediaControllers } from "../controls/media";
import {
  CONTROL_PATHS,
  findScrollTarget,
  scrollActions,
  mediaActions,
  modelActions,
} from "../controls/actions";
import { controlBindings, explicitTargets } from "../controls/components";
import { panoPositionToVector3 } from "../hotspot/coordinates";
import {
  fillCaptureFooter,
  commitSpatialCapture,
  failSpatialCapture,
} from "./capture-support";
import {
  captureSpatialSurface,
  captureSpatialOverlays,
  type SpatialCaptureOverlay,
} from "./capture";
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
import { createActionUpdateState, type GazeAction } from "./gaze-action";
import { createSpatialVideo, type SpatialVideo } from "./video";
import { spatialVideoPlaybackBlocked } from "./media-controls";
import type { PanoMediaController } from "../controls/actions";

type Button = {
  label: string;
  icon?: string;
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
const volumeCapabilities = new WeakMap<HTMLMediaElement, boolean>();

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * RASTER_SCALE;
  canvas.height = HEIGHT * RASTER_SCALE;
  return canvas;
}

function SurfacePanel({ surface }: { surface: SpatialSurface }) {
  const host = useContext(SpatialHostContext)!;
  const { camera, gl, invalidate } = useThree();
  const group = useRef<Group>(null);
  const panelMesh = useRef<Mesh>(null);
  const canvas = useMemo(makeCanvas, []);
  const texture = useMemo(() => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = false;
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return t;
  }, [canvas, gl]);
  type Contact = {
    event: PointerInput;
    action: GazeAction | null;
    adapter: PanoSpatialControlAdapter | null;
    scroll: HTMLElement | null;
    x: number;
    y: number;
    moved: boolean;
    target: object;
    updates: ReturnType<typeof createActionUpdateState>;
    release: () => void;
  };
  const contacts = useRef(new Map<number, Contact>());
  const hovering = useRef(new Map<number, Contact>());
  const stopContact = (id: number) => {
    const contact = contacts.current.get(id);
    if (contact) {
      contacts.current.delete(id);
      contact.action?.end?.();
      contact.release();
      host.input.release(contact.target, id);
    }
  };
  useEffect(() => {
    const stop = () => {
      for (const id of [...contacts.current.keys()]) stopContact(id);
      hovering.current.clear();
    };
    const unsubscribe = host.input.onCancel(stop);
    return () => {
      unsubscribe();
      stop();
    };
  }, [host, surface]);
  const videos = useRef(new Map<HTMLVideoElement, SpatialVideo>());
  const controllers = useRef(new Map<HTMLMediaElement, PanoMediaController>());
  const blockedMedia = useRef(new WeakSet<HTMLMediaElement>());
  const layers = useRef(
    new Map<HTMLElement, Mesh<PlaneGeometry, MeshBasicMaterial>>(),
  );
  const scratch = useMemo(() => new Vector3(), []);
  const state = useRef({
    dirty: true,
    overlayDirty: true,
    overlayRevision: 0,
    busy: false,
    disposed: false,
    generation: 0,
    revision: 0,
    last: 0,
    painted: 0,
    height: HEIGHT,
    image: null as HTMLCanvasElement | null,
    overlays: [] as SpatialCaptureOverlay[],
    failed: false,
    mediaBlocked: false,
    buttons: [] as Button[],
    edgeButtons: [] as Button[],
    target: surface.element,
    adapter: null as PanoSpatialControlAdapter | null,
    modelAdapter: null as PanoSpatialControlAdapter | null,
    scrollTarget: null as HTMLElement | null,
    mediaTarget: null as HTMLMediaElement | null,
  });
  const getOverlays = () =>
    [
      ...new Set(
        [...host.controls].flatMap(([node, adapter]) =>
          surface.element.contains(node) ? (adapter.getOverlays?.() ?? []) : [],
        ),
      ),
    ].filter((node) => surface.element.contains(node));
  const controllerFor = (media: HTMLMediaElement) => {
    let controller = controllers.current.get(media);
    if (!controller) {
      if (!volumeCapabilities.has(media))
        volumeCapabilities.set(media, probeVolumeAdjustable(media));
      controller = {
        subscribe: () => () => {},
        getSnapshot: () => ({
          ready: media.readyState >= 1,
          playing: !media.paused && !media.ended,
          currentTime: media.currentTime,
          duration: media.duration,
          hasAudio: probeMediaHasAudio(media),
          volume: media.volume,
          volumeAdjustable: volumeCapabilities.get(media) ?? false,
          muted: media.muted,
        }),
        play: async () => {
          try {
            await media.play();
            blockedMedia.current.delete(media);
            if (media instanceof HTMLAudioElement)
              state.current.mediaBlocked = false;
          } catch (error) {
            blockedMedia.current.add(media);
            if (media instanceof HTMLAudioElement)
              state.current.mediaBlocked = true;
            throw error;
          }
        },
        pause: () => media.pause(),
        seek: (time) => {
          if (Number.isFinite(time) && Number.isFinite(media.duration))
            media.currentTime = Math.max(0, Math.min(media.duration, time));
        },
        setVolume: (value) => {
          if (Number.isFinite(value) && volumeCapabilities.get(media))
            media.volume = clampVolume(value);
        },
        setMuted: (value) => {
          media.muted = value;
        },
      };
      controllers.current.set(media, controller);
    }
    return controller;
  };
  const sceneHost = useContext(ScenesHostContext);
  useEffect(() => {
    const s = state.current;
    s.disposed = false;
    s.generation++;
    s.target = surface.element;
    s.adapter = null;
    s.modelAdapter = null;
    s.dirty = true;
    s.image = null;
    s.overlays = [];
    s.mediaBlocked = false;
    surface.element.dataset.panoSpatialState = "loading";
    group.current?.traverse((node) => node.layers.set(SPATIAL_UI_LAYER));
    const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    activeCamera.getWorldDirection(scratch);
    group.current?.position
      .copy(activeCamera.position)
      .addScaledVector(scratch, 2);
    group.current?.quaternion.copy(activeCamera.quaternion);
    if (surface.anchor && group.current) {
      const { position, distance, width } = surface.anchor;
      if (position) {
        group.current.position.copy(panoPositionToVector3(position, distance));
        group.current.lookAt(activeCamera.position);
      } else {
        group.current.position
          .copy(activeCamera.position)
          .addScaledVector(scratch, distance);
        group.current.position.y -= distance * 0.32;
      }
      group.current.scale.setScalar(
        (2 * distance * Math.tan((width * Math.PI) / 360)) /
          (WIDTH * spatialPanelScale(HEIGHT)),
      );
    }
    const releasePointer = () => {
      for (const id of [...contacts.current.keys()]) stopContact(id);
      hovering.current.clear();
      host.suppressGazeUntil = 0;
    };
    window.addEventListener("blur", releasePointer);
    const previousStyle = document.createElement("div").style;
    const projectionProperties = new Set([
      "transform",
      "transform-origin",
      "z-index",
      "visibility",
      "pointer-events",
      "display",
      "left",
      "top",
    ]);
    const observer = new MutationObserver((records) => {
      const overlays = getOverlays();
      let bodyChanged = false,
        overlayChanged = false;
      for (const record of records) {
        if (
          record.type === "attributes" &&
          record.attributeName?.startsWith("data-pano-spatial-")
        )
          continue;
        const target = record.target;
        const annotation = overlays.find(
          (node) => node === target || node.contains(target),
        );
        if (annotation) {
          overlayChanged = true;
          continue;
        }
        // Projection/occlusion moves an annotation without changing its raster.
        if (
          record.type === "attributes" &&
          record.attributeName === "style" &&
          target instanceof HTMLElement &&
          !target.querySelector("canvas") &&
          overlays.some((node) => target.contains(node))
        ) {
          previousStyle.cssText = record.oldValue ?? "";
          const properties = new Set([...previousStyle, ...target.style]);
          const affectsRaster = [...properties].some(
            (name) =>
              !projectionProperties.has(name) &&
              (previousStyle.getPropertyValue(name) !==
                target.style.getPropertyValue(name) ||
                previousStyle.getPropertyPriority(name) !==
                  target.style.getPropertyPriority(name)),
          );
          if (affectsRaster) {
            overlayChanged = true;
            continue;
          }
          if (
            overlays.some(
              (node) =>
                getComputedStyle(node).visibility !== "hidden" &&
                !s.overlays.some((frame) => frame.element === node),
            )
          )
            overlayChanged = true;
          continue;
        }
        if (
          target instanceof HTMLCanvasElement &&
          record.type === "attributes" &&
          ["width", "height", "data-engine"].includes(
            record.attributeName ?? "",
          )
        )
          continue;
        bodyChanged = true;
      }
      if (overlayChanged) {
        s.overlayRevision++;
        s.overlayDirty = true;
      }
      if (!bodyChanged) return;
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
      attributeOldValue: true,
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
    // Canvas frames request a viewer frame, never another DOM screenshot.
    const unsubscribers = [...host.controls]
      .filter(([node]) => surface.element.contains(node))
      .flatMap(([, a]) =>
        a.subscribeFrame ? [a.subscribeFrame(invalidate)] : [],
      );
    const sceneId = sceneHost?.controller?.getActiveSceneId();
    const sceneChanged = () => {
      const next = sceneHost?.controller?.getActiveSceneId();
      if (next && sceneId && next !== sceneId) surface.close();
    };
    sceneHost?.listeners.add(sceneChanged);
    return () => {
      releasePointer();
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
      videos.current.forEach((video) => video.dispose());
      videos.current.clear();
      controllers.current.clear();
      blockedMedia.current = new WeakSet();
      // Exiting VR preserves playback in the still-open screen dialog.
      if (
        shouldPauseSurfaceMedia(
          surface.element.isConnected,
          host.surfaces.has(surface),
        )
      )
        surface.element
          .querySelectorAll("video,audio")
          .forEach((m) => (m as HTMLMediaElement).pause());
    };
  }, [surface, camera, gl, host, sceneHost, scratch, invalidate]);
  useEffect(
    () => () => {
      texture.dispose();
      layers.current.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.removeFromParent();
      });
    },
    [texture],
  );

  const resolve = (uv: Vector2): GazeAction | null => {
    const s = state.current;
    s.adapter = null;
    s.scrollTarget = null;
    const { x, y } = spatialUvToPoint(uv, s.height);
    const button = [...s.edgeButtons, ...s.buttons].find(
      (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h,
    );
    if (button)
      return button.action.enabled?.() === false ? null : button.action;
    if (y >= BODY_HEIGHT) return null;
    const rect = surface.element.getBoundingClientRect();
    // The source stays offscreen. Measured boxes provide hit testing without moving portals.
    for (const candidate of surface.element.querySelectorAll<HTMLElement>(
      ".pano-dialog-close,[data-pano-dialog-close]",
    )) {
      if (candidate.matches(':disabled,[aria-disabled="true"]')) continue;
      if (getComputedStyle(candidate).pointerEvents === "none") continue;
      const r = candidate.getBoundingClientRect();
      const expandX = Math.max(0, (56 - r.width) / 2),
        expandY = Math.max(0, (56 - r.height) / 2);
      if (
        x >= r.left - rect.left - expandX &&
        x <= r.right - rect.left + expandX &&
        y >= r.top - rect.top - expandY &&
        y <= r.bottom - rect.top + expandY
      ) {
        return {
          id: candidate,
          activate: () => {
            candidate.click();
            s.dirty = true;
          },
        };
      }
    }
    let target: HTMLElement = surface.element;
    for (const el of surface.element.querySelectorAll<HTMLElement>("*")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (getComputedStyle(el).pointerEvents === "none") continue;
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
            y + rect.top - r.top,
          ) as HTMLElement) ?? target;
      } catch {
        /* Cross-origin content uses the exit fallback. */
      }
    }
    const control = [...host.controls].find(
      ([node]) => node === target || node.contains(target),
    );
    s.adapter = control?.[1] ?? null;
    if (target instanceof HTMLMediaElement) s.mediaTarget = target;
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
    const nextScroll =
      surface.scrollTarget?.() ?? findScrollTarget(surface.element, target);
    if (nextScroll) s.scrollTarget = nextScroll;
    const clickable = target.closest<HTMLElement>('button,a,[role="button"]');
    if (!clickable || clickable.matches(':disabled,[aria-disabled="true"]'))
      return null;
    const binding = controlBindings.get(clickable);
    if (binding)
      return {
        ...binding,
        id: clickable,
        enabled: () => {
          const visible = scrollViewportBounds(
            surface.element,
            clickable,
            Math.min(BODY_HEIGHT, surface.element.offsetHeight),
          );
          return (
            clickable.isConnected &&
            !binding.disabled &&
            binding.enabled?.() !== false &&
            visible.width > 0 &&
            visible.height > 0
          );
        },
      };
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
    if (
      delta > 0.25 ||
      (gl.xr.isPresenting
        ? gl.xr.getSession()?.visibilityState !== "visible"
        : document.hidden)
    )
      host.input.cancel();
    for (const [id, contact] of contacts.current) {
      if (
        contact.adapter &&
        ![...host.controls.values()].includes(contact.adapter)
      ) {
        stopContact(id);
        continue;
      }
      if (contact.action?.enabled?.() === false) {
        stopContact(id);
        continue;
      }
      if (contact.action) contact.updates.tick(contact.action, delta);
    }
    for (const [id, contact] of hovering.current) {
      if (
        contacts.current.has(id) ||
        contact.event.pointerState?.inputSource !== host.input.activeSource ||
        !host.input.hasStick ||
        host.input.getSnapshot().mode !== "pointer"
      )
        continue;
      const stick = pointerStick(contact.event);
      if (!stick || delta > 0.25) continue;
      const x = axisValue(stick.xAxis),
        y = axisValue(stick.yAxis);
      if (!x && !y) continue;
      const adapter = contact.adapter;
      const target = adapter?.zoomBy ? adapter : contact.scroll;
      if (!target || !host.input.claim(target, id)) continue;
      applySpatialAxes(adapter, contact.scroll, x, y, delta);
      host.input.release(target, id);
      s.dirty = true;
    }
    const ctx = canvas.getContext("2d")!;
    const appearance = getComputedStyle(surface.element);
    const token = (name: string, fallback: number) => {
      const value = parseFloat(
        appearance.getPropertyValue(`--pano-control-${name}`),
      );
      return Number.isFinite(value) ? value : fallback;
    };
    const controlSize = token("size", CONTROL_GROUP_DEFAULTS.size),
      controlGap = token("gap", CONTROL_GROUP_DEFAULTS.gap),
      controlPadding = token("padding", CONTROL_GROUP_DEFAULTS.padding);
    const nextHeight = Math.max(
      surface.anchor ? 1 : 200,
      Math.min(BODY_HEIGHT, surface.element.offsetHeight) +
        (s.buttons.length
          ? controlGroupLayout(
              s.buttons.length,
              WIDTH,
              controlSize,
              controlGap,
              controlPadding,
            ).height
          : 0),
    );
    if (canvas.height !== nextHeight * RASTER_SCALE) {
      // WebGL texture storage is immutable: release it before changing dimensions.
      texture.dispose();
      canvas.height = nextHeight * RASTER_SCALE;
      s.height = nextHeight;
      const scale = spatialPanelScale(nextHeight);
      if (surface.anchor)
        group.current?.scale.setScalar(
          (2 *
            surface.anchor.distance *
            Math.tan((surface.anchor.width * Math.PI) / 360)) /
            (WIDTH * scale),
        );
      panelMesh.current?.scale.set(WIDTH * scale, nextHeight * scale, 1);
    }
    ctx.setTransform(RASTER_SCALE, 0, 0, RASTER_SCALE, 0, 0);
    const now = performance.now();
    if (now - s.painted < 1000 / 30) return;
    s.painted = now;
    const media =
      s.mediaTarget && surface.element.contains(s.mediaTarget)
        ? s.mediaTarget
        : surface.element.querySelector<HTMLMediaElement>("video,audio");
    const restricted = [...surface.element.querySelectorAll("iframe")].some(
      (frame) => {
        try {
          return !frame.contentDocument?.documentElement;
        } catch {
          return true;
        }
      },
    );
    if ((s.dirty || s.overlayDirty) && !s.busy && now - s.last > 1000 / 15) {
      s.busy = true;
      const generation = s.generation,
        revision = s.revision,
        overlayRevision = s.overlayRevision;
      const bodyChanged = s.dirty || !s.image;
      s.dirty = false;
      s.overlayDirty = false;
      s.last = now;
      const owner = document.createElement("div");
      Object.assign(owner.style, {
        position: "absolute",
        left: "-20000px",
        top: "0",
      });
      owner.setAttribute("aria-hidden", "true");
      surface.element.closest("[data-pano-viewer]")?.append(owner);
      const overlays = getOverlays();
      const capture = bodyChanged
        ? captureSpatialSurface(
            surface.element,
            owner,
            s.buttons.length > 0,
            overlays,
          )
        : captureSpatialOverlays(overlays, owner).then((overlays) => ({
            image: s.image!,
            overlays,
          }));
      capture
        .then(({ image, overlays }) => {
          if (s.disposed || generation !== s.generation) return;
          if (
            !bodyChanged ||
            commitSpatialCapture(s, generation, revision, image)
          ) {
            s.overlays = overlays;
            s.overlayDirty ||= overlayRevision !== s.overlayRevision;
            surface.element.dataset.panoSpatialState = "ready";
          }
        })
        .catch(() => {
          if (failSpatialCapture(s, generation)) {
            surface.element.dataset.panoSpatialState = "error";
          }
        })
        .finally(() => {
          owner.remove();
          s.busy = false;
        });
    }
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
        Math.min(BODY_HEIGHT, surface.element.offsetHeight),
      );
    if (s.failed || restricted || s.mediaBlocked) {
      ctx.fillStyle = "#161b22";
      ctx.fillRect(0, 100, WIDTH, 170);
      ctx.fillStyle = "#fff";
      ctx.font = "24px sans-serif";
      ctx.fillText("Exit VR to view this content", 30, 165);
    }
    const rootRect = surface.element.getBoundingClientRect();
    for (const [node, video] of videos.current) {
      if (!surface.element.contains(node)) {
        video.dispose();
        videos.current.delete(node);
      }
    }
    for (const node of controllers.current.keys()) {
      if (!surface.element.contains(node)) controllers.current.delete(node);
    }
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
          }),
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
        0.001,
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
        ([el]) => el === node || el.contains(node),
      )?.[1];
      if (adapter?.texture) continue;
      const clip = scrollViewportBounds(
        surface.element,
        node,
        Math.min(BODY_HEIGHT, surface.element.offsetHeight),
      );
      const style = getComputedStyle(node);
      if (!clip.width || !clip.height || style.visibility === "hidden")
        continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(clip.x, clip.y, clip.width, clip.height);
      ctx.clip();
      if (node instanceof HTMLVideoElement) {
        let video = videos.current.get(node);
        if (!video) {
          video = createSpatialVideo(node);
          videos.current.set(node, video);
        }
        const frame = video.getFrame();
        ctx.fillStyle = "#101419";
        ctx.fillRect(x, y, r.width, r.height);
        if (frame) {
          const scale = Math.min(
            r.width / frame.width,
            r.height / frame.height,
          );
          const width = frame.width * scale,
            height = frame.height * scale;
          ctx.drawImage(
            frame.image,
            x + (r.width - width) / 2,
            y + (r.height - height) / 2,
            width,
            height,
          );
        } else {
          ctx.fillStyle =
            style.getPropertyValue("--pano-control-color").trim() || "#fff";
          ctx.font = "20px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            node.error ? "Video unavailable" : "Video · Press play to start",
            x + r.width / 2,
            y + r.height / 2,
            Math.max(1, r.width - 24),
          );
          ctx.textAlign = "start";
        }
        if (
          blockedMedia.current.has(node) ||
          spatialVideoPlaybackBlocked.has(node)
        ) {
          ctx.fillStyle = "rgba(12, 17, 24, 0.9)";
          ctx.fillRect(x, y, r.width, 44);
          ctx.fillStyle = "#fff";
          ctx.font = "18px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            "Playback blocked · Exit VR to allow playback",
            x + r.width / 2,
            y + 28,
            Math.max(1, r.width - 24),
          );
          ctx.textAlign = "start";
        }
      } else {
        try {
          ctx.drawImage(node, x, y, r.width, r.height);
        } catch {
          /* A host canvas may not have a frame yet. */
        }
      }
      ctx.restore();
    }
    for (const overlay of s.overlays) {
      if (!surface.element.contains(overlay.element)) continue;
      const rect = overlay.element.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        getComputedStyle(overlay.element).visibility === "hidden"
      )
        continue;
      const clip = scrollViewportBounds(
        surface.element,
        overlay.element,
        Math.min(BODY_HEIGHT, surface.element.offsetHeight),
      );
      // Only clipping ancestors constrain titles/shadows overflowing the annotation.
      let viewportRoot = overlay.element.parentElement;
      while (
        viewportRoot &&
        viewportRoot !== surface.element &&
        !/(auto|scroll|hidden|clip)/.test(
          getComputedStyle(viewportRoot).overflow,
        )
      )
        viewportRoot = viewportRoot.parentElement;
      const viewport = scrollViewportBounds(
        surface.element,
        viewportRoot ?? surface.element,
        Math.min(BODY_HEIGHT, surface.element.offsetHeight),
      );
      if (!clip.width || !clip.height) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
      ctx.clip();
      ctx.drawImage(
        overlay.image,
        rect.left - rootRect.left + overlay.offsetX,
        rect.top - rootRect.top + overlay.offsetY,
        overlay.width,
        overlay.height,
      );
      ctx.restore();
    }
    const buttons: Button[] = [];
    const add = (
      id: string,
      label: string,
      update?: (dt: number) => void,
      activate?: () => void,
      enabled?: () => boolean,
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
    if (surface.scrollTarget?.()) s.scrollTarget = surface.scrollTarget();
    if (
      !s.scrollTarget ||
      !surface.element.contains(s.scrollTarget) ||
      !scrollActions(s.scrollTarget).length
    ) {
      s.scrollTarget =
        surface.element.querySelector<HTMLElement>(
          "[data-pano-scroll-viewport]",
        ) ??
        [
          surface.element,
          ...surface.element.querySelectorAll<HTMLElement>("*"),
        ].find((node) => findScrollTarget(surface.element, node) === node) ??
        null;
    }
    s.edgeButtons =
      !host.input.hasStick &&
      !surface.anchor &&
      s.scrollTarget &&
      !explicitTargets.has(s.scrollTarget)
        ? scrollEdges(
            s.scrollTarget,
            scrollViewportBounds(
              surface.element,
              s.scrollTarget,
              Math.min(BODY_HEIGHT, surface.element.offsetHeight),
            ),
            () => {
              s.dirty = true;
            },
          )
        : [];
    const adapter = resolveSurfaceModelAdapter(
      surface.element,
      host.controls,
      s.adapter,
      s.modelAdapter,
    );
    s.modelAdapter = adapter;
    if (adapter && !explicitTargets.has(adapter))
      for (const action of modelActions(adapter)) {
        if (
          (host.input.canDrag &&
            adapter.rotateBy &&
            ["left", "right", "up", "down"].includes(action.id)) ||
          (host.input.hasStick &&
            adapter.zoomBy &&
            ["in", "out"].includes(action.id))
        )
          continue;
        add(
          action.id,
          action.label,
          action.update,
          action.activate,
          action.enabled,
        );
      }
    if (
      media instanceof HTMLAudioElement &&
      allowsAutomaticMediaControls(media) &&
      !adapter &&
      !explicitTargets.has(mediaControllers.get(media) ?? media)
    ) {
      for (const action of mediaActions(controllerFor(media)))
        add(
          action.id === "pause"
            ? "play"
            : action.id === "unmute"
              ? "mute"
              : action.id,
          action.label,
          action.update,
          action.activate,
          action.enabled,
        );
    }
    if (surface.anchor) buttons.length = 0;
    const layout = controlGroupLayout(
      buttons.length,
      WIDTH,
      controlSize,
      controlGap,
      controlPadding,
    );
    const bodyHeight = Math.min(BODY_HEIGHT, surface.element.offsetHeight);
    buttons.forEach((button, i) =>
      Object.assign(button, layout.buttons[i], {
        y: bodyHeight + layout.buttons[i]!.y,
      }),
    );
    if (s.buttons.length !== buttons.length) s.dirty = true;
    s.buttons = buttons;
    if (buttons.length) {
      fillCaptureFooter(
        ctx,
        WIDTH,
        bodyHeight,
        layout.height,
        radius,
        appearance.backgroundColor || "#161b22",
      );
    }
    for (const b of buttons) {
      ctx.save();
      ctx.globalAlpha = b.action.enabled?.() === false ? 0.4 : 1;
      ctx.fillStyle =
        appearance.getPropertyValue("--pano-control-background").trim() ||
        "#39424e";
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, token("radius", b.w / 2));
      ctx.fill();
      const border = /^(\d+(?:\.\d+)?)px\s+solid\s+(.+)$/.exec(
        appearance.getPropertyValue("--pano-control-border").trim() ||
          "1px solid #68778a",
      );
      if (border) {
        ctx.strokeStyle = border[2]!;
        ctx.lineWidth = Number(border[1]);
        ctx.stroke();
      }
      if (host.action?.id === b.action.id) {
        ctx.strokeStyle =
          appearance.getPropertyValue("--pano-control-focus").trim() ||
          "#ffb300";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      const id = String(b.action.id).replace("scroll-", "");
      const icon =
        id === "play" && media && !media.paused
          ? "pause"
          : id === "mute" && media?.muted
            ? "unmute"
            : id;
      ctx.save();
      ctx.translate(b.x + b.w / 2 - 12, b.y + b.h / 2 - 12);
      ctx.scale(1, 1);
      ctx.strokeStyle =
        appearance.getPropertyValue("--pano-control-color").trim() || "#baf5ff";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(new Path2D(CONTROL_PATHS[icon] ?? CONTROL_PATHS.reset));
      ctx.restore();
      ctx.restore();
    }
    for (const button of s.edgeButtons) {
      const focused =
        host.action?.id === button.action.id ||
        [...contacts.current.values()].some(
          (contact) => contact.action?.id === button.action.id,
        );
      ctx.save();
      const opacity = Number(
        appearance
          .getPropertyValue(
            focused ? "--pano-scroll-active-opacity" : "--pano-scroll-opacity",
          )
          .trim() || (focused ? 0.9 : 0.3),
      );
      ctx.globalAlpha = Number.isFinite(opacity)
        ? Math.max(0, Math.min(1, opacity))
        : focused
          ? 0.9
          : 0.3;
      ctx.fillStyle =
        appearance.getPropertyValue("--pano-scroll-background").trim() ||
        "#101923";
      ctx.beginPath();
      ctx.roundRect(button.x, button.y, button.w, button.h, 12);
      ctx.fill();
      ctx.translate(button.x + button.w / 2 - 14, button.y + button.h / 2 - 14);
      ctx.scale(28 / 24, 28 / 24);
      ctx.strokeStyle =
        appearance.getPropertyValue("--pano-scroll-color").trim() || "#fff";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(
        new Path2D(
          CONTROL_PATHS[`scroll-${button.icon}`] ?? CONTROL_PATHS[button.icon!],
        ),
      );
      ctx.restore();
    }
    ctx.textAlign = "start";
    ctx.restore();
    texture.needsUpdate = true;
  });
  return (
    <group ref={group} renderOrder={90000}>
      <mesh
        ref={panelMesh}
        pointerEventsOrder={10}
        onPointerDown={(event) => {
          event.stopPropagation();
          const inputEvent = pointerInput(event);
          if (
            !host.input.accept(
              inputEvent,
              "down",
              !!pointerStick(inputEvent),
            ) ||
            !event.uv
          )
            return;
          const action = resolve(event.uv);
          const adapter = state.current.adapter;
          const target =
            action?.id && typeof action.id === "object"
              ? action.id
              : (adapter ?? surface.element);
          if (!host.input.claim(target, inputEvent.pointerId)) return;
          host.suppressGazeUntil = performance.now() + 350;
          event.eventObject.setPointerCapture(inputEvent.pointerId);
          contacts.current.set(inputEvent.pointerId, {
            event: inputEvent,
            action,
            adapter: action ? null : adapter,
            scroll: state.current.scrollTarget,
            x: event.uv.x,
            y: event.uv.y,
            moved: false,
            target,
            updates: createActionUpdateState(),
            release: () => {
              if (event.eventObject.hasPointerCapture(inputEvent.pointerId))
                event.eventObject.releasePointerCapture(inputEvent.pointerId);
            },
          });
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          const e = pointerInput(event),
            contact = contacts.current.get(e.pointerId);
          if (
            host.input.accept(e, "up") &&
            contact &&
            !contact.moved &&
            event.uv
          ) {
            const action = resolve(event.uv);
            if (
              action?.id === contact.action?.id &&
              action?.enabled?.() !== false
            )
              action?.activate?.();
          }
          stopContact(e.pointerId);
          host.suppressGazeUntil = performance.now() + 350;
        }}
        onPointerCancel={(event) => {
          stopContact(pointerInput(event).pointerId);
        }}
        onLostPointerCapture={(event) => {
          stopContact(pointerInput(event).pointerId);
        }}
        onPointerOut={(event) => {
          hovering.current.delete(pointerInput(event).pointerId);
        }}
        userData={{ panoGazeResolve: resolve }}
        onPointerMove={(event) => {
          event.stopPropagation();
          const e = pointerInput(event);
          if (!host.input.accept(e, "hover", !!pointerStick(e)) || !event.uv)
            return;
          const action = resolve(event.uv),
            contact = contacts.current.get(e.pointerId);
          if (contact?.adapter?.rotateBy && host.input.canDrag) {
            const dx = event.uv.x - contact.x,
              dy = event.uv.y - contact.y;
            if (contact.moved || Math.hypot(dx, dy) > 0.01) {
              contact.moved = true;
              const yaw = dx * 180,
                pitch = dy * 180;
              contact.adapter.rotateBy(
                contact.adapter.canExecute?.(yaw > 0 ? "right" : "left") ===
                  false
                  ? 0
                  : yaw,
                contact.adapter.canExecute?.(pitch > 0 ? "up" : "down") ===
                  false
                  ? 0
                  : pitch,
              );
              contact.x = event.uv.x;
              contact.y = event.uv.y;
              state.current.dirty = true;
            }
          }
          if (contact?.action && action?.id !== contact.action.id)
            stopContact(e.pointerId);
          hovering.current.set(e.pointerId, {
            event: e,
            action,
            adapter: action ? null : state.current.adapter,
            scroll: state.current.scrollTarget,
            x: event.uv.x,
            y: event.uv.y,
            moved: false,
            target: surface.element,
            updates: createActionUpdateState(),
            release: () => {},
          });
          host.action = action;
        }}
        onPointerOver={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          host.input.accept(pointerInput(event), "click");
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
    () => null,
  );
  useEffect(() => {
    host.exit = () => vr.host.controller?.exitVR() ?? Promise.resolve();
    host.setMode(mode !== null);
    return () => host.setMode(false);
  }, [host, vr.host, mode]);
  const surfaces = [...host.surfaces];
  const surface = surfaces[surfaces.length - 1];
  return mode ? (
    surface ? (
      <SurfacePanel surface={surface} />
    ) : (
      <>
        {[...host.panels].map((panel, index) => (
          <SurfacePanel key={index} surface={panel} />
        ))}
      </>
    )
  ) : null;
}
