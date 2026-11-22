import { getTextureAnisotropy, fitImageTexture } from "../renderer-capabilities";
import { useFrame, useThree } from "@react-three/fiber";
import { Howler, type Howl } from "howler";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Quaternion,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import { createUnlockingHowl, getAudioPanningModel, sourceList } from "../audio/howl";
import { usePanoMediaActivationIntent } from "../media-activation";
import { WebVRRuntimeContext } from "../webvr/host";
import {
  audioSpatialFromView,
  clampAudioVolume,
  clampLookRange,
  normalizeSoundDistance,
  relativeLookGain,
  relativeSoundPosition,
} from "./audio-spatial";
import { panoPositionToVector3 } from "./coordinates";
import { HotspotAnchor } from "./hotspot-anchor";
import { HotspotPlane } from "./hotspot-plane";
import type { HotspotCommonProps } from "./types";

const SPEAKER_TEXTURE_SIZE = 512;

export type AudioPlaybackState = "playing" | "paused" | "ended" | "blocked";

export type AudioHotspotErrorEvent = {
  id: string;
  error: unknown;
};

type AudioMarkerState = "stopped" | "playing";

export type AudioHotspotProps = HotspotCommonProps & {
  src: string | string[];
  /** Container hints for extensionless sources such as blob URLs, in source order. */
  format?: string | string[];
  playing: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  /** Degrees of look-away before silence. The default 360 keeps 3D sound audible behind you. */
  range?: number;
  /** Enables HRTF spatialization and positional tracking in WebXR. Defaults to false. */
  spatialAudio?: boolean;
  /** Distance from the panorama center in meters for spatial audio. Defaults to 3. */
  soundDistance?: number;
  pauseWhenHidden?: boolean;
  /** Optional stopped-state image. When omitted, a built-in speaker icon is used. */
  icon?: string;
  /** Optional playing-state image. Falls back to `icon`, then the built-in playing icon. */
  playingIcon?: string;
  /** When false, no visual marker is rendered. Audio still plays. Defaults to true. */
  marker?: boolean;
  crossOrigin?: "" | "anonymous" | "use-credentials";
  onPlaybackStateChange?: (state: AudioPlaybackState) => void;
  onPlaybackError?: (error: unknown) => void;
  onEnded?: () => void;
  onError?: (event: AudioHotspotErrorEvent) => void;
};

function paintSpeakerBody(
  context: CanvasRenderingContext2D,
  center: number,
) {
  context.fillStyle = "#f5fbfc";
  context.beginPath();
  context.moveTo(center - 92, center - 36);
  context.lineTo(center - 28, center - 36);
  context.lineTo(center + 28, center - 96);
  context.lineTo(center + 28, center + 96);
  context.lineTo(center - 28, center + 36);
  context.lineTo(center - 92, center + 36);
  context.closePath();
  context.fill();
}

function createSpeakerTexture(state: AudioMarkerState): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SPEAKER_TEXTURE_SIZE;
  canvas.height = SPEAKER_TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D is unavailable for this audio hotspot.");
  }

  const center = SPEAKER_TEXTURE_SIZE / 2;
  context.clearRect(0, 0, SPEAKER_TEXTURE_SIZE, SPEAKER_TEXTURE_SIZE);
  context.lineJoin = "round";
  context.lineCap = "round";

  context.beginPath();
  context.arc(center, center, center - 18, 0, Math.PI * 2);
  context.fillStyle = state === "playing" ? "#df6b42" : "#1a3a40";
  context.fill();
  context.strokeStyle = "#f5fbfc";
  context.lineWidth = 22;
  context.stroke();

  paintSpeakerBody(context, center);

  context.strokeStyle = "#f5fbfc";
  context.lineWidth = 18;
  switch (state) {
    case "stopped":
      break;
    case "playing": {
      context.beginPath();
      context.arc(center + 44, center, 44, -Math.PI / 2.6, Math.PI / 2.6);
      context.stroke();
      context.beginPath();
      context.arc(center + 44, center, 78, -Math.PI / 2.8, Math.PI / 2.8);
      context.stroke();
      break;
    }
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function useSpeakerTextures(enabled: boolean): {
  playing: CanvasTexture | null;
  stopped: CanvasTexture | null;
} {
  const [textures, setTextures] = useState<{
    playing: CanvasTexture | null;
    stopped: CanvasTexture | null;
  }>({ playing: null, stopped: null });

  useEffect(() => {
    if (!enabled) {
      setTextures({ playing: null, stopped: null });
      return;
    }
    const playing = createSpeakerTexture("playing");
    const stopped = createSpeakerTexture("stopped");
    setTextures({ playing, stopped });
    return () => {
      playing.dispose();
      stopped.dispose();
    };
  }, [enabled]);

  return textures;
}

function useIconTexture(
  icon: string | undefined,
  enabled: boolean,
  onError: AudioHotspotProps["onError"],
  id: string,
) {
  const gl = useThree((state) => state.gl);
  const [texture, setTexture] = useState<Texture | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;
    setTexture(null);
    if (!enabled || !icon) {
      return () => {
        active = false;
      };
    }

    const loader = new TextureLoader();
    loader.load(
      icon,
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }
        fitImageTexture(gl, loadedTexture);
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.wrapS = ClampToEdgeWrapping;
        loadedTexture.wrapT = ClampToEdgeWrapping;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.minFilter = LinearMipmapLinearFilter;
        loadedTexture.generateMipmaps = true;
        loadedTexture.anisotropy = getTextureAnisotropy(gl);
        loadedTexture.needsUpdate = true;
        setTexture(loadedTexture);
      },
      undefined,
      (error) => {
        if (active) {
          onErrorRef.current?.({ id, error });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [enabled, gl, icon, id]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  return texture;
}

function useAudioHowl({
  crossOrigin,
  id,
  loop,
  onEnded,
  onError,
  onPlaybackError,
  onPlaybackStateChange,
  playing,
  pauseWhenHidden,
  spatialAudio,
  src,
  format,
}: Pick<
  AudioHotspotProps,
  | "crossOrigin"
  | "id"
  | "loop"
  | "onEnded"
  | "onError"
  | "onPlaybackError"
  | "onPlaybackStateChange"
  | "playing"
  | "pauseWhenHidden"
  | "spatialAudio"
  | "src"
  | "format"
>) {
  const [howl, setHowl] = useState<Howl | null>(null);
  const playingRef = useRef(playing);
  const pauseWhenHiddenRef = useRef(pauseWhenHidden);
  const loopRef = useRef(loop ?? false);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onPlaybackErrorRef = useRef(onPlaybackError);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  playingRef.current = playing;
  pauseWhenHiddenRef.current = pauseWhenHidden;
  loopRef.current = loop ?? false;
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onPlaybackErrorRef.current = onPlaybackError;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  const sourcesKey = sourceList(src).join("\0");
  const formatsKey = sourceList(format).join("\0");

  useEffect(() => {
    const sources = sourcesKey.length > 0 ? sourcesKey.split("\0") : [];
    setHowl(null);
    if (sources.length === 0) return;

    let active = true;
    const handle = createUnlockingHowl({
      src: sources,
      format: formatsKey ? formatsKey.split("\0") : undefined,
      loop: loopRef.current,
      crossOrigin,
      spatialAudio,
      onLoad: setHowl,
      isActive: () => active,
      shouldRetryPlay: () =>
        playingRef.current && !(pauseWhenHiddenRef.current && document.hidden),
      onEnded: () => {
        onPlaybackStateChangeRef.current?.("ended");
        onEndedRef.current?.();
      },
      onPlay: () => {
        onPlaybackStateChangeRef.current?.("playing");
      },
      onPause: () => {
        onPlaybackStateChangeRef.current?.("paused");
      },
      onLoadError: (error) => {
        onErrorRef.current?.({ id, error });
      },
      onPlayError: (error) => {
        onPlaybackStateChangeRef.current?.("blocked");
        onPlaybackErrorRef.current?.(error);
      },
    });
    return () => {
      active = false;
      handle.dispose();
    };
  }, [crossOrigin, id, sourcesKey, formatsKey, spatialAudio]);

  useEffect(() => {
    howl?.loop(loop ?? false);
  }, [howl, loop]);

  return howl;
}

export function AudioHotspot({
  id,
  src,
  format,
  playing,
  loop = false,
  muted = false,
  volume = 1,
  range = 360,
  spatialAudio = false,
  soundDistance,
  pauseWhenHidden = true,
  icon,
  playingIcon,
  marker = true,
  crossOrigin,
  width = 8,
  height = 8,
  opacity,
  onPlaybackStateChange,
  onPlaybackError,
  onEnded,
  onError,
  ...anchorProps
}: AudioHotspotProps) {
  usePanoMediaActivationIntent(playing);
  const camera = useThree((state) => state.camera);
  const xr = useThree((state) => state.gl.xr);
  const xrAudioPose = useContext(WebVRRuntimeContext)?.xrAudioPose;
  const howl = useAudioHowl({
    crossOrigin,
    id,
    loop,
    onEnded,
    onError,
    onPlaybackError,
    onPlaybackStateChange,
    playing,
    pauseWhenHidden,
    spatialAudio,
    src,
    format,
  });
  const speakerTextures = useSpeakerTextures(marker && !icon);
  const stoppedIconTexture = useIconTexture(icon, marker, onError, id);
  const playingIconTexture = useIconTexture(playingIcon, marker, onError, id);
  const markerTexture = playing
    ? playingIconTexture ?? stoppedIconTexture ?? speakerTextures.playing
    : stoppedIconTexture ?? speakerTextures.stopped;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const { yaw, pitch } = anchorProps.position;
  const source = useMemo(() => panoPositionToVector3(
    { yaw, pitch }, normalizeSoundDistance(soundDistance),
  ), [yaw, pitch, soundDistance]);
  const settings = useRef({ position: anchorProps.position, source, range, muted, volume });
  settings.current = { position: anchorProps.position, source, range, muted, volume };
  const audio = useMemo(() => ({
    zero: new Vector3(),
    inverseOrientation: new Quaternion(),
    position: new Vector3(),
    previousPosition: new Vector3(Infinity, Infinity, Infinity),
    pan: NaN,
    volume: NaN,
    muted: undefined as boolean | undefined,
  }), [howl]);

  const syncAudio = useCallback(() => {
    if (!howl || howl.state() !== "loaded") return;
    const current = settings.current;
    const model = getAudioPanningModel(Howler.ctx);
    const lookRange = clampLookRange(current.range);
    let pan: number | undefined;
    let gain: number;
    if (spatialAudio) {
      const head = xr?.isPresenting && xrAudioPose?.valid ? xrAudioPose : null;
      if (head) audio.inverseOrientation.copy(head.orientation);
      else camera.getWorldQuaternion(audio.inverseOrientation);
      const position = relativeSoundPosition(
        audio.position, current.source, head?.position ?? audio.zero, audio.inverseOrientation.invert(),
      );
      if (model === "hrtf") {
        if (!audio.previousPosition.equals(position)) {
          howl.pos(position.x, position.y, position.z);
          audio.previousPosition.copy(position);
        }
      } else {
        const horizontalDistance = Math.hypot(position.x, position.z);
        pan = horizontalDistance > 0 ? position.x / horizontalDistance : 0;
      }
      gain = relativeLookGain(position, lookRange);
    } else {
      const spatial = audioSpatialFromView(camera, current.position, lookRange);
      pan = spatial.pan;
      gain = spatial.gain;
    }
    if (model !== "none" && pan !== undefined && audio.pan !== pan) {
      howl.stereo(pan);
      audio.pan = pan;
    }
    const nextVolume = clampAudioVolume(current.volume) * gain;
    if (audio.volume !== nextVolume) {
      howl.volume(nextVolume);
      audio.volume = nextVolume;
    }
    if (audio.muted !== current.muted) {
      howl.mute(current.muted);
      audio.muted = current.muted;
    }
  }, [audio, camera, howl, spatialAudio, xr, xrAudioPose]);

  useEffect(() => {
    if (!howl || howl.state() !== "loaded") return;
    if (!playing || (pauseWhenHidden && document.hidden)) {
      howl.pause();
      return;
    }
    syncAudio();
    if (!howl.playing()) howl.play();
  }, [howl, pauseWhenHidden, playing, syncAudio]);

  useEffect(() => {
    if (!howl || !pauseWhenHidden) {
      return;
    }
    const handleVisibility = () => {
      if (document.hidden) {
        howl.pause();
        return;
      }
      if (playingRef.current && !howl.playing()) {
        syncAudio();
        howl.play();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [howl, pauseWhenHidden, syncAudio]);

  useFrame(() => {
    if (playing && !(pauseWhenHidden && document.hidden)) syncAudio();
  });

  return (
    <HotspotAnchor {...anchorProps} id={id} height={height} width={width}>
      {marker ? <HotspotPlane map={markerTexture} opacity={opacity} /> : null}
    </HotspotAnchor>
  );
}
