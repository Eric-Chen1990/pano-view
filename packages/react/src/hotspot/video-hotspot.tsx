import { mediaControllers } from "../controls/media";
import { usePanoMediaController } from "../controls/media";
import type { PanoMediaController } from "../controls/actions";
import { useThree } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  VideoTexture,
} from "three";
import { HotspotAnchor } from "./hotspot-anchor";
import { HotspotPlane } from "./hotspot-plane";
import { usePanoMediaActivationIntent } from "../media-activation";
import {
  applyInlineVideoPlayback,
  mountTextureVideo,
} from "../video/inline-playback";
import type { HotspotCommonProps } from "./types";

export type VideoPlaybackState = "playing" | "paused" | "ended" | "blocked";

export type VideoHotspotErrorEvent = {
  id: string;
  source: "poster" | "video";
  error: unknown;
};

export type VideoHotspotProps = HotspotCommonProps & {
  ref?: Ref<PanoMediaController>;
  src: string;
  playing: boolean;
  poster?: string;
  loop?: boolean;
  /** Defaults to false so manually started playback includes audio. */
  muted?: boolean;
  volume?: number;
  /**
   * Keep playback in the page. Defaults to true, including the WebKit and
   * X5 attributes for iPhone Safari, WeChat, QQ, and UC.
   */
  playsInline?: boolean;
  preload?: "none" | "metadata" | "auto";
  crossOrigin?: "" | "anonymous" | "use-credentials";
  onPlaybackStateChange?: (state: VideoPlaybackState) => void;
  onPlaybackError?: (error: unknown) => void;
  onEnded?: () => void;
  onError?: (event: VideoHotspotErrorEvent) => void;
};

type VideoResource = {
  video: HTMLVideoElement;
  texture: VideoTexture;
  ready: boolean;
};

function clampVolume(volume: number | undefined): number {
  if (!Number.isFinite(volume)) {
    return 1;
  }
  return Math.max(0, Math.min(volume!, 1));
}

function usePosterTexture(
  id: string,
  poster: string | undefined,
  onError: VideoHotspotProps["onError"],
) {
  const gl = useThree((state) => state.gl);
  const [texture, setTexture] = useState<Texture | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;
    setTexture(null);
    if (!poster) {
      return () => {
        active = false;
      };
    }

    const loader = new TextureLoader();
    loader.load(
      poster,
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
          onErrorRef.current?.({ id, source: "poster", error });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [gl, id, poster]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  return texture;
}

function useVideoResource({
  crossOrigin,
  id,
  onEnded,
  onError,
  onPlaybackStateChange,
  playsInline,
  poster,
  src,
}: Pick<
  VideoHotspotProps,
  | "crossOrigin"
  | "id"
  | "onEnded"
  | "onError"
  | "onPlaybackStateChange"
  | "playsInline"
  | "poster"
  | "src"
>) {
  const gl = useThree((state) => state.gl);
  const [resource, setResource] = useState<VideoResource | null>(null);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  useEffect(() => {
    if (!src) {
      setResource(null);
      return;
    }

    let active = true;
    const video = document.createElement("video");
    if (crossOrigin !== undefined) {
      video.crossOrigin = crossOrigin;
    }
    applyInlineVideoPlayback(video, playsInline ?? true);
    video.poster = poster ?? "";
    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;

    const notifyState = (state: VideoPlaybackState) => {
      if (active) {
        onPlaybackStateChangeRef.current?.(state);
      }
    };
    const markReady = () => {
      if (!active) {
        return;
      }
      setResource((current) =>
        current?.video === video && !current.ready ? { ...current, ready: true } : current,
      );
    };
    const reportError = () => {
      if (active) {
        onErrorRef.current?.({
          id,
          source: "video",
          error: video.error ?? new Error(`Unable to load video source: ${src}`),
        });
      }
    };

    const handleEnded = () => {
      notifyState("ended");
      onEndedRef.current?.();
    };
    const handlePause = () => notifyState("paused");
    const handlePlay = () => notifyState("playing");
    video.addEventListener("canplay", markReady);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", reportError);
    video.addEventListener("pause", handlePause);
    video.addEventListener("play", handlePlay);
    mountTextureVideo(video, gl.domElement);
    setResource({ video, texture, ready: false });
    video.src = src;
    video.load();

    return () => {
      active = false;
      video.removeEventListener("canplay", markReady);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", reportError);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("play", handlePlay);
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
      texture.dispose();
    };
  }, [crossOrigin, gl, id, playsInline, poster, src]);

  const video = resource?.video;
  useLayoutEffect(() => {
    if (!video) {
      return;
    }
    mountTextureVideo(video, gl.domElement);
    return () => {
      video.remove();
    };
  }, [gl, video]);

  return resource;
}

export function VideoHotspot({
  ref,
  id,
  src,
  playing,
  poster,
  loop = false,
  muted = false,
  volume = 1,
  playsInline = true,
  preload = "metadata",
  crossOrigin,
  width = 16,
  height = 9,
  opacity,
  onPlaybackStateChange,
  onPlaybackError,
  onEnded,
  onError,
  ...anchorProps
}: VideoHotspotProps) {
  usePanoMediaActivationIntent(playing);
  const resource = useVideoResource({
    crossOrigin,
    id,
    onEnded,
    onError,
    onPlaybackStateChange,
    playsInline,
    poster,
    src,
  });
  const video = resource?.video;
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  mediaRef.current = video ?? null;
  const controller = usePanoMediaController(mediaRef);
  const exposedController = useMemo<PanoMediaController>(() => ({ ...controller, play: async () => {
    try { await controller.play(); } catch (error) {
      onPlaybackStateChangeRef.current?.("blocked");
      onPlaybackErrorRef.current?.(error);
      throw error;
    }
  } }), [controller]);
  useImperativeHandle(ref, () => exposedController, [exposedController]);
  useEffect(() => {
    if (video) mediaControllers.set(video, exposedController);
    return () => {
      if (video && mediaControllers.get(video) === exposedController) mediaControllers.delete(video);
    };
  }, [exposedController, video]);
  const posterTexture = usePosterTexture(id, poster, onError);
  const onPlaybackErrorRef = useRef(onPlaybackError);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  onPlaybackErrorRef.current = onPlaybackError;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  useLayoutEffect(() => {
    if (!video) {
      return;
    }
    video.loop = loop;
    applyInlineVideoPlayback(video, playsInline);
    video.preload = preload;
  }, [loop, playsInline, preload, video]);

  // Readiness changes must not overwrite the user's media controller settings.
  useLayoutEffect(() => {
    if (video) video.muted = muted;
  }, [muted, video]);

  useLayoutEffect(() => {
    if (video) video.volume = clampVolume(volume);
  }, [video, volume]);

  useEffect(() => {
    if (!video) {
      return;
    }
    let active = true;
    if (!playing) {
      video.pause();
      return () => {
        active = false;
      };
    }

    void video.play().catch((error: unknown) => {
      if (!active) {
        return;
      }
      onPlaybackStateChangeRef.current?.("blocked");
      onPlaybackErrorRef.current?.(error);
    });

    return () => {
      active = false;
    };
  }, [playing, video]);

  const activeTexture = resource?.ready ? resource.texture : posterTexture;

  return (
    <HotspotAnchor {...anchorProps} id={id} height={height} width={width}>
      <HotspotPlane map={activeTexture} opacity={opacity} />
    </HotspotAnchor>
  );
}
