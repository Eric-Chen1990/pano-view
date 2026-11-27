import { useFrame } from "@react-three/fiber";
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MathUtils, Mesh, Quaternion, Vector3 } from "three";
import { cssFontFamily } from "../css-font-family";
import { usePanoUiTranslation } from "../ui-translation";
import { subscribeWebVRHost, WebVRRuntimeContext } from "../webvr/host";
import { LOOK_DOWN_DISTANCE } from "../webvr/look-down-layout";
import {
  LookDownPanel, spatialPanelLayer, useLookDownPanelAvailable, useVRPanelTexture, useVRPanelView,
} from "../webvr/look-down-panel";
import { formatMediaTime, panoVideoTrackId } from "./format";
import { PanoVideoHostContext, subscribePanoVideoHost } from "./host";
import { VIDEO_ICON_PATHS, VIDEO_MENU_CHEVRONS } from "./icons";
import type { PanoVideoController, PanoVideoControlsOptions } from "./types";
import {
  vrVideoCaptionBounds,
  vrVideoFollowBlend,
  vrVideoSeekTime,
  wrapVRCaption,
} from "./vr-video-layout";

const DISTANCE = LOOK_DOWN_DISTANCE;
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

function useVideoSnapshot(controller: PanoVideoController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

function PanoVideoVRCaptions({ controller }: { controller: PanoVideoController }) {
  const { captionText, captionAppearance: style, trackId, captionsEnabled } = useVideoSnapshot(controller);
  const { context, texture } = useVRPanelTexture(WIDTH, CAPTION_HEIGHT);
  const mesh = useRef<Mesh>(null);
  const follow = useMemo(() => ({
    initialized: false,
    position: new Vector3(),
    target: new Vector3(),
    local: new Vector3(),
    inverse: new Quaternion(),
  }), []);
  const readView = useVRPanelView();
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
    <mesh ref={mesh} onUpdate={spatialPanelLayer} visible={false} renderOrder={DISPLAY_ORDER} raycast={() => {}}>
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
  const snapshot = useVideoSnapshot(controller);
  const [trackPage, setTrackPage] = useState<number | null>(null);
  const lastCaptionTrack = useRef(snapshot.trackId);
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

  const resolveAction = (x: number, y: number) => {
    const button = buttons.find((item) => hitsButton(item, x, y));
    if (button) return button;
    if (seekEnabled && x >= 32 && x <= 992 && y >= 52 && y <= 109) {
      const dragTo = (pixel: number) => seek((pixel - 32) / 960);
      return { id: "seek", activate: () => dragTo(x), dragTo };
    }
  };

  const progress = seekEnabled ? Math.max(0, Math.min(960, Math.round(960 * currentTime / duration))) : 0;
  const time = page === null
    ? `${formatMediaTime(currentTime)} / ${duration > 0 ? formatMediaTime(duration) : "–:–"}`
    : "";
  const status = snapshot.blocked ? t("Press Play to start the video.") : "";
  const title = page !== null ? t("Captions") : "";
  const paintKey = JSON.stringify([time, progress, seekEnabled, status, title,
    options?.background, options?.accent, options?.color, buttons.map(({ id, label, selected, icon }) => [id, label, selected, icon]),
  ]);
  const paint = (context: CanvasRenderingContext2D, focused: string) => {
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
  };

  return (
    <LookDownPanel
      width={WIDTH}
      height={BAR_HEIGHT}
      label={t("Video controls")}
      kind="video"
      paintKey={paintKey}
      paint={paint}
      resolveAction={resolveAction}
      onHidden={() => setTrackPage(null)}
      accessibility={
        <>
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
        </>
      }
    />
  );
}

export function PanoVideoVR() {
  const host = useContext(PanoVideoHostContext)!;
  const vr = useContext(WebVRRuntimeContext)!;
  const controlsAvailable = useLookDownPanelAvailable();
  useSyncExternalStore((listener) => subscribePanoVideoHost(host, listener), () => host.revision);
  const setupOpen = useSyncExternalStore(
    (listener) => subscribeWebVRHost(vr.host, listener), () => vr.host.snapshot.setupOpen,
  );
  const { controller, visibleSourceKey, controls, controlClaims } = host;
  if (!controller || !visibleSourceKey || setupOpen) return null;
  const showControls = host.vrControls ?? (controls !== false && controlClaims === 0);
  return (
    <group key={visibleSourceKey}>
      {host.vrCaptions && <PanoVideoVRCaptions controller={controller} />}
      {showControls && controlsAvailable && (
        <PanoVideoVRControls controller={controller} options={typeof controls === "object" ? controls : undefined} />
      )}
    </group>
  );
}
