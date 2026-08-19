import { useFrame, useThree } from "@react-three/fiber";
import type { Howl } from "howler";
import { useEffect, useRef, useState } from "react";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import { createUnlockingHowl, sourceList } from "../audio/howl";
import {
  audioSpatialFromView,
  clampAudioVolume,
  clampLookRange,
} from "./audio-spatial";
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
  playing: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  /** Degrees of look-away before the source is silent. Defaults to 360 (no look attenuation). */
  range?: number;
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
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.wrapS = ClampToEdgeWrapping;
        loadedTexture.wrapT = ClampToEdgeWrapping;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.minFilter = LinearMipmapLinearFilter;
        loadedTexture.generateMipmaps = true;
        loadedTexture.anisotropy = gl.capabilities.getMaxAnisotropy();
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
  src,
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
  | "src"
>) {
  const [howl, setHowl] = useState<Howl | null>(null);
  const playingRef = useRef(playing);
  const loopRef = useRef(loop ?? false);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onPlaybackErrorRef = useRef(onPlaybackError);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  playingRef.current = playing;
  loopRef.current = loop ?? false;
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onPlaybackErrorRef.current = onPlaybackError;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  const sourcesKey = sourceList(src).join("\0");

  useEffect(() => {
    const sources = sourcesKey.length > 0 ? sourcesKey.split("\0") : [];
    if (sources.length === 0) {
      setHowl(null);
      return;
    }

    let active = true;
    const handle = createUnlockingHowl({
      src: sources,
      loop: loopRef.current,
      crossOrigin,
      isActive: () => active,
      shouldRetryPlay: () => playingRef.current,
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
    setHowl(handle.howl);

    return () => {
      active = false;
      handle.dispose();
    };
  }, [crossOrigin, id, sourcesKey]);

  useEffect(() => {
    howl?.loop(loop ?? false);
  }, [howl, loop]);

  return howl;
}

export function AudioHotspot({
  id,
  src,
  playing,
  loop = false,
  muted = false,
  volume = 1,
  range = 360,
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
  const camera = useThree((state) => state.camera);
  const howl = useAudioHowl({
    crossOrigin,
    id,
    loop,
    onEnded,
    onError,
    onPlaybackError,
    onPlaybackStateChange,
    playing,
    src,
  });
  const speakerTextures = useSpeakerTextures(marker && !icon);
  const stoppedIconTexture = useIconTexture(icon, marker, onError, id);
  const playingIconTexture = useIconTexture(playingIcon, marker, onError, id);
  const markerTexture = playing
    ? playingIconTexture ?? stoppedIconTexture ?? speakerTextures.playing
    : stoppedIconTexture ?? speakerTextures.stopped;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  const rangeRef = useRef(range);
  mutedRef.current = muted;
  volumeRef.current = volume;
  rangeRef.current = range;

  useEffect(() => {
    if (!howl) {
      return;
    }
    if (!playing) {
      howl.pause();
      return;
    }
    howl.play();
  }, [howl, playing]);

  useEffect(() => {
    if (!howl || !pauseWhenHidden) {
      return;
    }
    const handleVisibility = () => {
      if (document.hidden) {
        howl.pause();
        return;
      }
      if (playingRef.current) {
        howl.play();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [howl, pauseWhenHidden]);

  useFrame(() => {
    if (!howl) {
      return;
    }
    const spatial = audioSpatialFromView(
      camera,
      anchorProps.position,
      clampLookRange(rangeRef.current),
    );
    howl.stereo(spatial.pan);
    howl.mute(mutedRef.current);
    howl.volume(clampAudioVolume(volumeRef.current) * spatial.gain);
  });

  return (
    <HotspotAnchor {...anchorProps} id={id} height={height} width={width}>
      {marker ? <HotspotPlane map={markerTexture} opacity={opacity} /> : null}
    </HotspotAnchor>
  );
}
