import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CanvasTexture, Euler, LinearFilter, MathUtils, Mesh, type MeshBasicMaterial, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { cssFontFamily } from "../css-font-family";
import { canRunSpatialGaze } from "../spatial/gaze-action";
import { SpatialHostContext } from "../spatial/host";
import { SPATIAL_UI_LAYER } from "../spatial/render-layer";
import { usePanoUiTranslation } from "../ui-translation";
import { getWebVRHotspotView, subscribeWebVRHost, WebVRRuntimeContext } from "../webvr/host";
import { pointerInput, pointerStick } from "../webvr/input";
import { sceneMenuView } from "../webvr/scene-menu-layout";
import { PanoChromeOverlayContext } from "./chrome-overlay";
import { formatMediaTime, panoVideoTrackId } from "./format";
import { PanoVideoHostContext, subscribePanoVideoHost } from "./host";
import { VIDEO_ICON_PATHS, VIDEO_MENU_CHEVRONS } from "./icons";
import type { PanoVideoController, PanoVideoControlsOptions } from "./types";
import {
  createVRVideoLookDownGesture,
  vrVideoCaptionBounds,
  vrVideoEyeBounds,
  vrVideoFollowBlend,
  vrVideoLookDown,
  vrVideoSeekTime,
  vrVideoToolbarTransition,
  wrapVRCaption,
} from "./vr-video-layout";

const DISTANCE = 2;
const RAD = Math.PI / 180;
const WIDTH = 1024;
const BAR_HEIGHT = 208;
const CAPTION_HEIGHT = 384;
const TRACKS_PER_PAGE = 3;
const DISPLAY_ORDER = 89_000;
const CAPTION_FONT = 'Inter, ui-sans-serif, system-ui, sans-serif';
type VideoIcon = keyof typeof VIDEO_ICON_PATHS;
const iconShapes = new Map<VideoIcon, Path2D>();

function drawIcon(context: CanvasRenderingContext2D, name: VideoIcon, x: number, y: number) {
  let shape = iconShapes.get(name);
  if (!shape) {
    shape = new Path2D(VIDEO_ICON_PATHS[name]);
    iconShapes.set(name, shape);
  }
  context.save();
  context.translate(x - 21, y - 21);
  context.scale(42 / 24, 42 / 24);
  context.fill(shape, "evenodd");
  context.restore();
}

function useVideoTexture(height: number) {
  const resource = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return { context, texture };
  }, [height]);
  useEffect(() => () => resource.texture.dispose(), [resource]);
  return resource;
}

function spatialLayer(mesh: Mesh) {
  mesh.layers.set(SPATIAL_UI_LAYER);
}

function useVideoSnapshot(controller: PanoVideoController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

function useVideoView() {
  const vr = useContext(WebVRRuntimeContext)!;
  const { camera, gl } = useThree();
  return () => {
    const view = getWebVRHotspotView(vr, gl.xr.isPresenting);
    if (!view?.projectionScaleY) return null;
    const eyes = gl.xr.isPresenting
      ? gl.xr.getCamera().cameras
      : [vr.stereoView.stereo.cameraL, vr.stereoView.stereo.cameraR];
    const bounds = vrVideoEyeBounds(eyes, DISTANCE);
    return bounds ? { camera: view.camera, ...bounds } : null;
  };
}

function PanoVideoVRCaptions({ controller }: { controller: PanoVideoController }) {
  const { captionText, captionAppearance: style, trackId, captionsEnabled } = useVideoSnapshot(controller);
  const { context, texture } = useVideoTexture(CAPTION_HEIGHT);
  const mesh = useRef<Mesh>(null);
  const follow = useMemo(() => ({
    initialized: false,
    position: new Vector3(),
    target: new Vector3(),
    local: new Vector3(),
    inverse: new Quaternion(),
  }), []);
  const readView = useVideoView();
  const text = captionsEnabled && trackId ? captionText.trim() : "";
  const paintKey = JSON.stringify([text, style.color, style.background, style.fontFamily, style.fontSize, style.fontWeight]);
  const painted = useRef("");
  const lastFont = useRef("");
  const paintedHeight = useRef(1);

  useEffect(() => {
    const repaint = () => { painted.current = ""; };
    document.fonts?.addEventListener("loadingdone", repaint);
    return () => document.fonts?.removeEventListener("loadingdone", repaint);
  }, []);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const view = readView();
    mesh.current.visible = Boolean(view && text);
    if (!view || !text) {
      follow.initialized = false;
      return;
    }
    if (painted.current !== paintKey) {
      painted.current = paintKey;
      context.clearRect(0, 0, WIDTH, CAPTION_HEIGHT);
      const parsedSize = typeof style.fontSize === "number" ? style.fontSize : Number.parseFloat(style.fontSize);
      let size = Math.min(100, Math.max(32, (parsedSize || 16) * 3.5));
      const family = cssFontFamily(style.fontFamily || CAPTION_FONT) || "sans-serif";
      const wrap = () => {
        context.font = `${style.fontWeight ?? 500} ${size}px ${family}`;
        return wrapVRCaption(text, WIDTH - 64, (line) => context.measureText(line).width);
      };
      let lines = wrap();
      while (lines.length * size * 1.25 > CAPTION_HEIGHT - 32 && size > 20) {
        size = Math.max(20, size * 0.85);
        lines = wrap();
      }
      const fontRequest = context.font + text;
      if (lastFont.current !== fontRequest) {
        lastFont.current = fontRequest;
        void document.fonts?.load(context.font, text).catch(() => {});
      }
      const lineHeight = Math.min(size * 1.25, (CAPTION_HEIGHT - 32) / lines.length);
      const boxWidth = Math.max(...lines.map((line) => context.measureText(line).width)) + 40;
      const boxHeight = lineHeight * lines.length + 24;
      paintedHeight.current = boxHeight;
      context.fillStyle = "rgba(0, 0, 0, 0.55)";
      context.fillStyle = style.background;
      context.beginPath();
      context.roundRect((WIDTH - boxWidth) / 2, CAPTION_HEIGHT - boxHeight, boxWidth, boxHeight, 12);
      context.fill();
      context.fillStyle = "#ffffff";
      context.fillStyle = style.color;
      context.textAlign = "center";
      context.textBaseline = "middle";
      lines.forEach((line, index) => context.fillText(
        line, WIDTH / 2, CAPTION_HEIGHT - boxHeight + 12 + (index + 0.5) * lineHeight,
      ));
      texture.needsUpdate = true;
    }

    const { camera } = view;
    const bounds = vrVideoCaptionBounds(view.halfWidth, view.below, paintedHeight.current / WIDTH);
    const height = bounds.width * CAPTION_HEIGHT / WIDTH;
    follow.target.set(0, -bounds.targetBottom, -DISTANCE)
      .applyQuaternion(camera.quaternion).add(camera.position);
    if (!follow.initialized) {
      follow.position.copy(follow.target);
      follow.initialized = true;
    } else {
      follow.position.lerp(follow.target, vrVideoFollowBlend(delta));
    }

    // Keep the lagging position in the lower safe area even during fast turns.
    follow.local.copy(follow.position).sub(camera.position)
      .applyQuaternion(follow.inverse.copy(camera.quaternion).invert());
    if (follow.local.z < -DISTANCE / 2) {
      follow.local.multiplyScalar(-DISTANCE / follow.local.z);
      follow.local.x = MathUtils.clamp(follow.local.x, -bounds.maxOffsetX, bounds.maxOffsetX);
      follow.local.y = MathUtils.clamp(follow.local.y, -bounds.bottom, -bounds.minBottom);
    } else {
      follow.local.set(0, -bounds.targetBottom, -DISTANCE);
    }
    follow.position.copy(follow.local).applyQuaternion(camera.quaternion).add(camera.position);
    follow.local.y += height / 2;
    mesh.current.position.copy(follow.local).applyQuaternion(camera.quaternion).add(camera.position);
    mesh.current.quaternion.copy(camera.quaternion);
    mesh.current.scale.set(bounds.width, height, 1);
  }, -0.5);

  return (
    <mesh ref={mesh} onUpdate={spatialLayer} visible={false} renderOrder={DISPLAY_ORDER} raycast={() => {}}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

type Button = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  selected?: boolean;
  icon?: VideoIcon | keyof typeof VIDEO_MENU_CHEVRONS;
  activate: () => void;
};

function hitsButton(button: Pick<Button, "x" | "y" | "width" | "height">, x: number, y: number) {
  return x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height;
}

function PanoVideoVRControls({ controller, options }: {
  controller: PanoVideoController;
  options?: PanoVideoControlsOptions;
}) {
  const t = usePanoUiTranslation();
  const spatial = useContext(SpatialHostContext)!;
  const chrome = useContext(PanoChromeOverlayContext);
  const gl = useThree((state) => state.gl);
  const snapshot = useVideoSnapshot(controller);
  const [trackPage, setTrackPage] = useState<number | null>(null);
  const { context, texture } = useVideoTexture(BAR_HEIGHT);
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const transitionProgress = useRef(0);
  const interactive = useRef(false);
  const reducedMotion = useRef(false);
  const pointerTarget = useRef("");
  const gazeSeek = useRef(0);
  const actionOwner = useMemo(() => ({}), []);
  const actionIds = useMemo(() => new Map<string, { owner: object; id: string }>(), []);
  const anchor = useMemo(() => ({
    headYaw: 0,
    referencePitch: null as number | null,
    position: new Vector3(),
    direction: new Vector3(),
    offset: new Vector3(),
    rotation: new Euler(0, 0, 0, "YXZ"),
  }), []);
  const lookingDown = useRef(false);
  const lookDownGesture = useMemo(createVRVideoLookDownGesture, []);
  const lastCaptionTrack = useRef(snapshot.trackId);
  const painted = useRef("");
  const readView = useVideoView();
  const a11y = useRef<{ root: Root; element: HTMLDivElement } | null>(null);
  const { captionsEnabled, currentTime, duration, muted, playing, tracks } = snapshot;
  const showTracks = options?.buttons?.captions !== false && captionsEnabled && tracks.length > 0;
  const pageCount = Math.ceil(tracks.length / TRACKS_PER_PAGE);
  const page = trackPage === null || !showTracks ? null : Math.min(trackPage, pageCount - 1);
  const seekEnabled = page === null && vrVideoSeekTime(0, duration) !== null;
  const buttons: Button[] = [];
  const add = (id: string, label: string, x: number, y: number, width: number, height: number,
    activate: () => void, icon?: Button["icon"], selected?: boolean) => {
    buttons.push({ id, label, x, y, width, height, activate, selected, icon });
  };
  const seek = (fraction: number) => {
    const seconds = vrVideoSeekTime(fraction, controller.getSnapshot().duration);
    if (seconds !== null) controller.seek(seconds);
  };
  if (page !== null) {
    const select = (id: string | null) => {
      controller.setTrackId(id);
      setTrackPage(null);
    };
    add("track-back", t("Back"), 24, 22, 100, 60, () => setTrackPage(null), "previous");
    add("track-off", t("Turn captions off"), 900, 22, 100, 60, () => select(null), "captions", snapshot.trackId === null);
    if (page > 0) add("previous", t("Previous page"), 24, 106, 64, 74, () => setTrackPage(page - 1), "previous");
    if (page + 1 < pageCount) add("next", t("Next page"), 936, 106, 64, 74, () => setTrackPage(page + 1), "next");
    tracks.slice(page * TRACKS_PER_PAGE, (page + 1) * TRACKS_PER_PAGE).forEach((track, i) => {
      const id = panoVideoTrackId(track);
      add(`track:${id}`, track.label, 104 + i * 274, 106, 260, 74, () => select(id), undefined, snapshot.trackId === id);
    });
  } else {
    if (options?.buttons?.play !== false) {
      add("play", t(playing ? "Pause" : snapshot.ended ? "Replay video" : "Play"), 24, 119, 116, 66, () => {
        const current = controller.getSnapshot();
        if (current.ended) controller.seek(0);
        controller.togglePlay();
      }, playing ? "pause" : "play");
    }
    if (options?.buttons?.volume !== false && snapshot.hasAudio !== false) {
      add("mute", t(muted ? "Unmute" : "Mute"), 154, 119, 116, 66, controller.toggleMuted, muted ? "muted" : "volume");
    }
    if (showTracks) {
      add("caption-toggle", t(snapshot.trackId ? "Turn captions off" : "Turn captions on"), 744, 119, 116, 66, () => {
        const current = controller.getSnapshot();
        if (current.trackId) {
          lastCaptionTrack.current = current.trackId;
          controller.setTrackId(null);
          return;
        }
        const previous = current.tracks.find((track) => panoVideoTrackId(track) === lastCaptionTrack.current);
        const track = previous ?? current.tracks.find((item) => item.default) ?? current.tracks[0];
        if (track) controller.setTrackId(panoVideoTrackId(track));
      }, "captions", snapshot.trackId !== null);
    }
    if (showTracks && tracks.length > 1) add("captions", t("Caption language"), 884, 119, 116, 66, () => {
      const index = tracks.findIndex((track) => panoVideoTrackId(track) === controller.getSnapshot().trackId);
      setTrackPage(Math.floor(Math.max(0, index) / TRACKS_PER_PAGE));
    }, "settings");
  }

  useLayoutEffect(() => {
    if (!showTracks) setTrackPage(null);
  }, [showTracks]);
  useLayoutEffect(() => {
    if (snapshot.trackId) lastCaptionTrack.current = snapshot.trackId;
  }, [snapshot.trackId]);

  const clearInput = () => {
    pointerTarget.current = "";
    if ((spatial.action?.id as { owner?: object } | undefined)?.owner === actionOwner) {
      spatial.action = null;
    }
  };
  useEffect(() => {
    const unsubscribe = spatial.input.onCancel(clearInput);
    return () => {
      unsubscribe();
      clearInput();
    };
  }, [spatial, actionOwner]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = media.matches; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const resolve = (uv: { x: number; y: number }, gaze: boolean) => {
    if (!interactive.current) return null;
    const x = uv.x * WIDTH;
    const y = (1 - uv.y) * BAR_HEIGHT;
    const button = buttons.find((item) => hitsButton(item, x, y));
    const isSeek = seekEnabled && x >= 32 && x <= 992 && y >= 52 && y <= 109;
    const id = button?.id ?? (isSeek ? "seek" : "");
    if (!id) return null;
    if (isSeek && gaze) gazeSeek.current = (x - 32) / 960;
    let actionId = actionIds.get(id);
    if (!actionId) {
      actionId = { owner: actionOwner, id };
      actionIds.set(id, actionId);
    }
    return {
      id: actionId,
      activate: button?.activate ?? (() => seek(gaze ? gazeSeek.current : (x - 32) / 960)),
    };
  };

  useEffect(() => {
    const container = chrome?.overlayElement;
    if (!container) return;
    const element = document.createElement("div");
    element.dataset.panoVrVideoControls = "";
    container.append(element);
    const root = createRoot(element);
    a11y.current = { root, element };
    return () => {
      a11y.current = null;
      element.remove();
      // The canvas root can unmount while the host React root is committing.
      queueMicrotask(() => root.unmount());
    };
  }, [chrome?.overlayElement]);

  useEffect(() => {
    a11y.current?.root.render(
      <div role="group" aria-label={t("Video controls")}>
        {seekEnabled && (
          <input type="range" min={0} max={duration} step="any" value={Math.min(currentTime, duration)}
            aria-label={t("Seek video")} aria-valuetext={formatMediaTime(currentTime)} className="pano-sr-only"
            data-pano-vr-action="seek"
            onChange={(event) => seek(Number(event.currentTarget.value) / duration)}
          />
        )}
        {buttons.map(({ id, label, selected, activate }) => (
          <button key={id} type="button" aria-label={label} aria-pressed={selected}
            className="pano-sr-only" data-pano-vr-action={id} onClick={activate}
          />
        ))}
      </div>,
    );
  });

  useFrame((_, delta) => {
    if (!mesh.current || !material.current) return;
    const view = readView();
    const now = performance.now();
    if (!view || !canRunSpatialGaze(document.hidden, gl.xr.getSession()?.visibilityState, 0, now)) {
      mesh.current.visible = false;
      transitionProgress.current = 0;
      interactive.current = false;
      lookingDown.current = false;
      lookDownGesture.reset();
      clearInput();
      return;
    }

    const active = document.activeElement;
    const keyboardFocus = active instanceof HTMLElement && a11y.current?.element.contains(active)
      ? active.dataset.panoVrAction : "";
    const gazeAction = spatial.action?.id as { owner?: object; id?: string } | undefined;
    const focused = keyboardFocus || pointerTarget.current || (gazeAction?.owner === actionOwner ? gazeAction.id : "") || "";
    const centerY = -Math.min(0.72, view.below * 0.77);
    const orientation = sceneMenuView(view.camera.getWorldDirection(anchor.direction), anchor.headYaw);
    anchor.headYaw = orientation.yaw;
    const referencePitch = anchor.referencePitch ??= MathUtils.clamp(orientation.pitch, -10, 10);
    const barPitch = referencePitch + Math.atan2(centerY, DISTANCE) / RAD;
    const quickLookDown = lookDownGesture.update(orientation.pitch, referencePitch, barPitch, delta);
    lookingDown.current = lookingDown.current
      ? vrVideoLookDown(orientation.pitch, referencePitch, barPitch, true)
      : quickLookDown;
    const show = lookingDown.current || Boolean(keyboardFocus);
    const previousProgress = transitionProgress.current;
    const transition = vrVideoToolbarTransition(previousProgress, show, delta, reducedMotion.current);
    transitionProgress.current = transition.progress;
    interactive.current = transition.interactive;
    material.current.opacity = transition.opacity;
    mesh.current.visible = transition.progress > 0;
    if (!show) clearInput();
    if (!mesh.current.visible) {
      if (page !== null) setTrackPage(null);
      return;
    }
    // Hold the scene pose until the bar finishes hiding, including during a reversal.
    if (previousProgress === 0) {
      const width = Math.min(1.64, view.halfWidth * 2, view.below * 1.8);
      mesh.current.scale.set(width, width * BAR_HEIGHT / WIDTH, 1);
      anchor.rotation.set(referencePitch * RAD, -orientation.yaw * RAD, 0);
      anchor.offset.set(0, centerY, -DISTANCE).applyEuler(anchor.rotation);
      anchor.position.copy(view.camera.position).add(anchor.offset);
      mesh.current.rotation.set(orientation.pitch * RAD, -orientation.yaw * RAD, 0, "YXZ");
    }
    anchor.offset.set(0, -mesh.current.scale.y * 0.55 * (1 - transition.opacity), 0)
      .applyQuaternion(mesh.current.quaternion);
    mesh.current.position.copy(anchor.position).add(anchor.offset);
    mesh.current.updateWorldMatrix(true, false);

    const progress = seekEnabled ? Math.max(0, Math.min(960, Math.round(960 * currentTime / duration))) : 0;
    const time = page === null
      ? `${formatMediaTime(currentTime)} / ${duration > 0 ? formatMediaTime(duration) : "–:–"}`
      : "";
    const status = snapshot.blocked ? t("Press Play to start the video.") : "";
    const title = page !== null ? t("Captions") : "";
    const key = JSON.stringify([focused, time, progress, seekEnabled, status, title,
      options?.background, options?.accent, options?.color, buttons.map(({ id, label, selected }) => [id, label, selected]),
    ]);
    if (painted.current === key) return;
    painted.current = key;
    context.clearRect(0, 0, WIDTH, BAR_HEIGHT);
    const background = options?.background ?? "rgba(9, 17, 25, 0.92)";
    const accent = options?.accent ?? "#7dd3fc";
    const color = options?.color ?? "#ffffff";
    const rect = (x: number, y: number, w: number, h: number, fill: string, radius = 12) => {
      context.fillStyle = fill;
      context.beginPath();
      context.roundRect(x, y, w, h, radius);
      context.fill();
    };
    rect(0, 0, WIDTH, BAR_HEIGHT, background, 22);
    context.font = "600 34px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const button of buttons) {
      const active = button.id === focused;
      rect(button.x, button.y, button.width, button.height,
        active ? accent : button.selected ? "rgba(125, 211, 252, 0.27)" : "#243240");
      context.fillStyle = active ? "#091119" : color;
      const x = button.x + button.width / 2;
      const y = button.y + button.height / 2;
      if (button.icon === "previous" || button.icon === "next") {
        context.fillText(VIDEO_MENU_CHEVRONS[button.icon], x, y);
      } else if (button.icon) {
        drawIcon(context, button.icon, x, y);
      } else {
        context.fillText(button.label, x, y, button.width - 18);
      }
    }
    context.fillStyle = color;
    if (title) context.fillText(title, WIDTH / 2, 52, 560);
    if (time) {
      context.textAlign = "left";
      context.font = "500 31px system-ui, sans-serif";
      context.fillText(time, 32, 34);
      if (status) {
        context.textAlign = "right";
        context.fillText(status, 992, 34, 560);
      }
      rect(32, 76, 960, 10, seekEnabled ? "#657786" : "#36434f", 5);
      if (progress > 0) rect(32, 76, progress, 10, accent, 5);
      if (seekEnabled) {
        context.beginPath();
        context.arc(32 + progress, 81, focused === "seek" ? 17 : 11, 0, Math.PI * 2);
        context.fillStyle = accent;
        context.fill();
      }
    }
    texture.needsUpdate = true;
  }, -0.5);

  return (
    <mesh
      ref={mesh}
      onUpdate={spatialLayer}
      visible={false}
      renderOrder={DISPLAY_ORDER + 1}
      pointerEventsOrder={9}
      userData={{ panoGazeResolve: (uv: { x: number; y: number }) => resolve(uv, true) }}
      raycast={function (this: Mesh, raycaster, intersections) {
        if (this.visible && interactive.current) Mesh.prototype.raycast.call(this, raycaster, intersections);
      }}
      onPointerDown={(event) => {
        if (!event.uv || !resolve(event.uv, false)) return;
        event.stopPropagation();
        spatial.input.accept(pointerInput(event), "down", Boolean(pointerStick(pointerInput(event))));
      }}
      onPointerMove={(event) => {
        const target = event.uv && resolve(event.uv, false);
        if (!target) {
          pointerTarget.current = "";
          return;
        }
        event.stopPropagation();
        if (spatial.input.accept(pointerInput(event), "hover", Boolean(pointerStick(pointerInput(event))))) {
          pointerTarget.current = target.id.id;
        }
      }}
      onPointerOut={() => { pointerTarget.current = ""; }}
      onClick={(event) => {
        const target = event.uv && resolve(event.uv, false);
        if (!target) return;
        event.stopPropagation();
        if (spatial.input.accept(pointerInput(event), "click")) target.activate();
      }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={material} map={texture} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function PanoVideoVR({ modalOpen }: { modalOpen: boolean }) {
  const host = useContext(PanoVideoHostContext)!;
  const vr = useContext(WebVRRuntimeContext)!;
  const spatial = useContext(SpatialHostContext)!;
  useSyncExternalStore((listener) => subscribePanoVideoHost(host, listener), () => host.revision);
  useSyncExternalStore(spatial.subscribe, spatial.getSnapshot);
  const setupOpen = useSyncExternalStore(
    (listener) => subscribeWebVRHost(vr.host, listener), () => vr.host.snapshot.setupOpen,
  );
  const { controller, visibleSourceKey, controls, controlClaims } = host;
  if (!controller || !visibleSourceKey || setupOpen) return null;
  const showControls = host.vrControls ?? (controls !== false && controlClaims === 0);
  const blocked = modalOpen || spatial.surfaces.size > 0 || spatial.openSceneMenus.size > 0;
  return (
    <group key={visibleSourceKey}>
      {host.vrCaptions && <PanoVideoVRCaptions controller={controller} />}
      {showControls && !blocked && (
        <PanoVideoVRControls controller={controller} options={typeof controls === "object" ? controls : undefined} />
      )}
    </group>
  );
}
