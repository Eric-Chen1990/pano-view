import { getTextureAnisotropy, getMaxTextureSize, fitImageTexture } from "../renderer-capabilities";
import { probeMediaHasAudio, subscribeMediaAudio } from "../controls/media-audio";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  type Mesh,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  VideoTexture,
} from "three";
import type { VideoPlaybackState } from "../hotspot/video-hotspot";
import { usePanoMediaActivationIntent } from "../media-activation";
import { isAutoplayPolicyError } from "../media-activation-event";
import { useStandaloneSceneLoad } from "../scene-load-progress";
import { PanoBasicMaterial } from "../pano-filter/pano-basic-material";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import { applyInlineVideoPlayback, mountTextureVideo } from "./inline-playback";
import { prepareNativeHlsSwitch } from "./native-hls-switch";
import { isHlsSource, loadVideoSources, resetVideoSource } from "./video-source";
import {
  canRecoverWithVideoVariant,
  exceedsVideoTextureLimit,
  VideoTextureSizeError,
} from "./video-playback-protection";
import {
  DEFAULT_PANO_VIDEO_CAPTION_APPEARANCE,
  PanoVideoCaptions,
  resolvePanoVideoCaptionAppearance,
} from "./pano-video-captions";
import {
  clampVolume,
  cueText,
  DEFAULT_PANO_VIDEO_PLAYBACK_RATES,
  defaultPanoVideoTrackId,
  filterSupportedPlaybackRates,
  panoVideoTrackId,
  probeVolumeAdjustable,
  resolvePanoVideoVariantId,
  resolvePanoVideoVariants,
} from "./format";
import { PanoVideoHostContext, notifyPanoVideoHost } from "./host";
import type {
  PanoVideoCaptionAppearance,
  PanoVideoController,
  PanoVideoControlsOptions,
  PanoVideoErrorEvent,
  PanoVideoHlsSelection,
  PanoVideoQualitySwitch,
  PanoVideoPlaybackSnapshot,
  PanoVideoTrack,
  PanoVideoVariant,
} from "./types";

const EMPTY_TRACKS: readonly PanoVideoTrack[] = [];

export type PanoVideoProps = {
  /** Video file or HLS playlist when `variants` is omitted. */
  src?: string;
  poster?: string;
  variants?: readonly PanoVideoVariant[];
  defaultVariantId?: string;
  /** Variant to try once when the active source cannot be decoded or rendered. */
  fallbackVariantId?: string;
  tracks?: readonly PanoVideoTrack[];
  /**
   * Caption overlay. `true` / omit uses the default appearance; `false`
   * hides captions and the control-bar language menu; an object merges
   * with the defaults.
   */
  captions?: boolean | PanoVideoCaptionAppearance;
  /**
   * Playback chrome. `true` / omit mounts the default bar; `false` skips
   * it; an object configures the default bar's appearance and visible buttons.
   * Render `PanoVideoControls` as a PanoViewer child to replace the default.
   */
  controls?: boolean | PanoVideoControlsOptions;
  /** Click or tap the panorama to toggle playback in screen mode. Defaults to true. */
  clickToTogglePlayback?: boolean;
  /** Show a centered play button while the visible video is stopped. Defaults to true. */
  showCenterPlayButton?: boolean;
  /** Horizontal video offset in degrees. */
  yawOffset?: number;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  autoPlay?: boolean;
  /**
   * Keep playback in the page. Defaults to true, including the WebKit and
   * X5 attributes for iPhone Safari, WeChat, QQ, and UC.
   */
  playsInline?: boolean;
  preload?: "none" | "metadata" | "auto";
  crossOrigin?: "" | "anonymous" | "use-credentials";
  playbackRates?: readonly number[];
  /** Keeps the source mounted for preloading without drawing it. */
  visible?: boolean;
  onLoad?: () => void;
  onError?: (event: PanoVideoErrorEvent) => void;
  onPlaybackStateChange?: (state: VideoPlaybackState) => void;
  onEnded?: () => void;
  onVariantChange?: (id: string) => void;
  onTrackChange?: (id: string | null) => void;
};

type PendingQualitySwitch = {
  video: HTMLVideoElement;
  target: PanoVideoQualitySwitch["target"];
  state: PanoVideoQualitySwitch["state"];
  transition: ReturnType<typeof prepareNativeHlsSwitch>;
};

type PlaybackResume = { time: number; playing: boolean; rate: number };

type Store = {
  snapshot: PanoVideoPlaybackSnapshot;
  listeners: Set<() => void>;
};

const EMPTY_RATES: readonly number[] = DEFAULT_PANO_VIDEO_PLAYBACK_RATES;

function createEmptySnapshot(): PanoVideoPlaybackSnapshot {
  return {
    ready: false,
    playing: false,
    blocked: false,
    ended: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    volumeAdjustable: true,
    muted: true,
    playbackRate: 1,
    variantId: "default",
    variants: [],
    trackId: null,
    tracks: [],
    captionText: "",
    captionAppearance: DEFAULT_PANO_VIDEO_CAPTION_APPEARANCE,
    captionsEnabled: true,
    playbackRates: EMPTY_RATES,
    playbackState: "paused",
  };
}

function playbackStateFromVideo(
  video: HTMLVideoElement,
  blocked: boolean,
): VideoPlaybackState {
  if (blocked) {
    return "blocked";
  }
  if (video.ended) {
    return "ended";
  }
  if (!video.paused) {
    return "playing";
  }
  return "paused";
}

function collectCaptionText(track: TextTrack | null): string {
  if (!track?.activeCues || track.activeCues.length === 0) {
    return "";
  }
  const parts: string[] = [];
  for (let index = 0; index < track.activeCues.length; index += 1) {
    const cue = track.activeCues[index];
    if (!cue) {
      continue;
    }
    const text = cueText(cue);
    if (text) {
      parts.push(text);
    }
  }
  return parts.join("\n");
}

function findTextTrack(video: HTMLVideoElement, trackId: string | null): TextTrack | null {
  if (!trackId) return null;
  return [...video.querySelectorAll<HTMLTrackElement>("track")].find(
    (element) => element.dataset.panoVideoTrack === trackId,
  )?.track ?? null;
}

function applyEquirectangularLayout(texture: Texture, anisotropy: number): void {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.repeat.x = -1;
  texture.offset.x = 1;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
}

function usePosterTexture(
  poster: string | undefined,
  onError: PanoVideoProps["onError"],
) {
  const gl = useThree((state) => state.gl);
  const [loaded, setLoaded] = useState<{ poster: string; gl: typeof gl; texture: Texture }>();
  const [failed, setFailed] = useState<{ poster: string; gl: typeof gl; error: unknown }>();
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;
    setLoaded(undefined);
    setFailed(undefined);
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
        fitImageTexture(gl, loadedTexture);
        applyEquirectangularLayout(
          loadedTexture,
          getTextureAnisotropy(gl),
        );
        loadedTexture.wrapT = RepeatWrapping;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.minFilter = LinearMipmapLinearFilter;
        loadedTexture.generateMipmaps = true;
        setLoaded({ poster, gl, texture: loadedTexture });
      },
      undefined,
      (error) => {
        if (active) {
          setFailed({ poster, gl, error });
          onErrorRef.current?.({ source: "poster", error });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [gl, poster]);

  useEffect(
    () => () => {
      loaded?.texture.dispose();
    },
    [loaded],
  );

  return {
    texture: loaded?.poster === poster && loaded?.gl === gl ? loaded.texture : null,
    failure: failed?.poster === poster && failed?.gl === gl ? failed : undefined,
  };
}

function replaceTextTracks(video: HTMLVideoElement, tracks: readonly PanoVideoTrack[]): void {
  video.querySelectorAll("track").forEach((node) => node.remove());
  for (const track of tracks) {
    const element = document.createElement("track");
    element.dataset.panoVideoTrack = panoVideoTrackId(track);
    element.kind = track.kind ?? "subtitles";
    element.src = track.src;
    element.srclang = track.srcLang;
    element.label = track.label;
    if (track.default) {
      element.default = true;
    }
    video.appendChild(element);
  }
}

/**
 * Equirectangular 360 video mapped onto the panorama sphere. Mount inside
 * PanoViewer. Default playback chrome and captions portal to the viewer overlay.
 */
export function PanoVideo({
  src,
  poster,
  variants: variantsProp,
  defaultVariantId,
  fallbackVariantId,
  tracks: tracksProp,
  captions = true,
  controls = true,
  clickToTogglePlayback = true,
  showCenterPlayButton = true,
  yawOffset = 0,
  loop = false,
  muted = true,
  volume = 1,
  autoPlay = false,
  playsInline = true,
  preload = "metadata",
  crossOrigin,
  playbackRates = DEFAULT_PANO_VIDEO_PLAYBACK_RATES,
  visible = true,
  onLoad,
  onError,
  onPlaybackStateChange,
  onEnded,
  onVariantChange,
  onTrackChange,
}: PanoVideoProps) {
  usePanoMediaActivationIntent(autoPlay);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const host = useContext(PanoVideoHostContext);
  const variants = useMemo(
    () => resolvePanoVideoVariants({ poster, src, variants: variantsProp }),
    [poster, src, variantsProp],
  );
  const fallbackVariant = useRef<PanoVideoVariant | undefined>(undefined);
  fallbackVariant.current = variants.find(({ id, sources }) =>
    id === fallbackVariantId && sources.some(({ src }) => src.trim().length > 0));
  const tracks = tracksProp ?? EMPTY_TRACKS;
  const captionsEnabled = captions !== false;
  const captionAppearance = useMemo(
    () =>
      resolvePanoVideoCaptionAppearance(
        typeof captions === "object" ? captions : undefined,
      ),
    [captions],
  );
  const [selection, setSelection] = useState(() => ({
    id: resolvePanoVideoVariantId(variants, defaultVariantId),
    revision: 0,
  }));
  const [trackId, setTrackId] = useState<string | null>(() =>
    captionsEnabled ? defaultPanoVideoTrackId(tracks) : null,
  );
  const [ready, setReady] = useState(false);
  const [frameKey, setFrameKey] = useState<string>();
  const [mediaFailure, setMediaFailure] = useState<{ key: string; error: unknown }>();
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  const blockedRef = useRef(false);
  const captionAppearanceOverrideRef = useRef<Partial<PanoVideoCaptionAppearance>>(
    {},
  );
  const mediaCapabilitiesRef = useRef({
    volumeAdjustable: true,
    playbackRates: [...DEFAULT_PANO_VIDEO_PLAYBACK_RATES] as readonly number[],
  });
  const storeRef = useRef<Store | null>(null);
  if (!storeRef.current) {
    storeRef.current = {
      snapshot: {
        ...createEmptySnapshot(),
        captionAppearance,
      },
      listeners: new Set(),
    };
  }
  const actionsRef = useRef({
    play: async () => {},
    pause: () => {},
    seek: (_time: number) => {},
    setVolume: (_volume: number) => {},
    setMuted: (_muted: boolean) => {},
    setPlaybackRate: (_rate: number) => {},
    setVariantId: (_id: string) => {},
    setHlsLevel: (_level: PanoVideoHlsSelection) => {},
    setTrackId: (_id: string | null) => {},
    setCaptionAppearance: (
      _appearance: Partial<PanoVideoCaptionAppearance>,
    ) => {},
  });
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  const onEndedRef = useRef(onEnded);
  const onVariantChangeRef = useRef(onVariantChange);
  const onTrackChangeRef = useRef(onTrackChange);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;
  onEndedRef.current = onEnded;
  onVariantChangeRef.current = onVariantChange;
  onTrackChangeRef.current = onTrackChange;

  const [video, setVideo] = useState(() =>
    typeof document === "undefined" ? null : document.createElement("video"),
  );
  const videoRef = useRef(video);
  const sourceRef = useRef<ReturnType<typeof loadVideoSources> | null>(null);
  const initialSourceVideoRef = useRef<HTMLVideoElement | null>(null);
  const pendingSwitch = useRef<PendingQualitySwitch | null>(null);
  const nativeVariantId = useRef<string | null>(null);
  const resume = useRef<PlaybackResume | null>(null);
  const playAfterLoad = useRef(false);
  const sourceFailure = useRef<((error: unknown) => void) | null>(null);
  const failedSource = useRef(false);
  const fallbackAttempted = useRef(false);
  const meshRef = useRef<Mesh>(null);
  const maxTextureSize = getMaxTextureSize(gl);
  const [textureRevision, setTextureRevision] = useState(0);
  const videoTexture = useMemo(() => {
    if (!video || !ready) return null;
    const texture = new VideoTexture(video);
    applyEquirectangularLayout(texture, getTextureAnisotropy(gl));
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }, [gl, ready, video, textureRevision]);
  useEffect(() => () => videoTexture?.dispose(), [videoTexture]);

  useLayoutEffect(() => {
    if (!video) return;
    const handlePlaying = () => {
      if (videoRef.current === video) invalidate();
    };
    const handleSeeked = () => {
      if (videoRef.current !== video || !videoTexture) return;
      videoTexture.needsUpdate = true;
      invalidate();
    };
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("seeked", handleSeeked);
    return () => {
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [invalidate, video, videoTexture]);

  useLayoutEffect(() => {
    if (!video) return;
    mountTextureVideo(video, gl.domElement);
    return () => video.remove();
  }, [gl, video]);

  useLayoutEffect(() => () => {
    if (!video) return;
    resetVideoSource(video);
    video.querySelectorAll("track").forEach((node) => node.remove());
  }, [video]);

  const resolvedVariantId = resolvePanoVideoVariantId(variants, selection.id);
  const activeVariant = variants.find((variant) => variant.id === resolvedVariantId);
  const videoInteractionsEnabled = visible && activeVariant?.sources.some(({ src }) => src.trim().length > 0) === true;
  const mediaKey = activeVariant ? JSON.stringify([
    activeVariant.id,
    selection.revision,
    activeVariant.sources,
    tracks.map(({ id, src, srcLang, kind, label }) => [id, src, srcLang, kind, label]),
    crossOrigin,
    variants.some((variant) => variant.sources.some(isHlsSource))
      ? variants.map(({ id, sources }) => ({ id, sources }))
      : null,
  ]) : "";
  const posterUrl = variants.find((variant) => variant.id === nativeVariantId.current)?.poster ?? activeVariant?.poster ?? poster;
  const { texture: posterTexture, failure: posterFailure } = usePosterTexture(posterUrl, onError);
  const sourceKey = useMemo(() =>
    JSON.stringify(variants.map(({ id, sources, poster }) => ({ id, sources, poster }))),
  [variants]);
  const loadKey = useMemo(() => ({ sourceKey, crossOrigin, gl }), [sourceKey, crossOrigin, gl]);
  const canLoadVideo = activeVariant?.sources.some(({ src }) => src.trim().length > 0) === true;
  const load = useStandaloneSceneLoad(
    loadKey,
    visible && variants.length > 0,
    !posterUrl && preload === "none" && !autoPlay,
  );
  const loadRef = useRef(load);
  loadRef.current = load;

  const emitSnapshot = useCallback(
    (patch?: Partial<PanoVideoPlaybackSnapshot>) => {
      const store = storeRef.current;
      const video = videoRef.current;
      if (!store) {
        return;
      }
      const playbackState = video
        ? playbackStateFromVideo(video, blockedRef.current)
        : "paused";
      const nextCaptionAppearance = {
        ...captionAppearance,
        ...captionAppearanceOverrideRef.current,
      };
      const mediaAudio = video ? probeMediaHasAudio(video) : undefined;
      const pending = pendingSwitch.current;
      const next: PanoVideoPlaybackSnapshot = {
        ...store.snapshot,
        ready: ready && !failedSource.current,
        playing: playbackState === "playing",
        blocked: blockedRef.current,
        ended: playbackState === "ended",
        currentTime: video?.currentTime ?? 0,
        duration: video && Number.isFinite(video.duration) ? video.duration : 0,
        hasAudio: mediaAudio === true ? true : sourceRef.current?.audio ?? mediaAudio,
        volume: video ? clampVolume(video.volume) : clampVolume(volume),
        volumeAdjustable: mediaCapabilitiesRef.current.volumeAdjustable,
        muted: video?.muted ?? muted,
        playbackRate: video?.playbackRate ?? 1,
        variantId: nativeVariantId.current ?? resolvedVariantId,
        variants,
        hlsQuality: video ? sourceRef.current?.quality(video) : undefined,
        qualitySwitch: pending ? { target: pending.target, state: pending.state } : undefined,
        trackId,
        tracks,
        captionsEnabled,
        captionAppearance: nextCaptionAppearance,
        playbackRates: mediaCapabilitiesRef.current.playbackRates,
        playbackState,
        ...patch,
      };
      store.snapshot = next;
      store.listeners.forEach((listener) => {
        listener();
      });
    },
    [
      captionsEnabled,
      muted,
      ready,
      resolvedVariantId,
      trackId,
      tracks,
      variants,
      volume,
      captionAppearance,
    ],
  );

  const emitSnapshotRef = useRef(emitSnapshot);
  emitSnapshotRef.current = emitSnapshot;

  const cancelSwitch = useCallback(() => {
    const pending = pendingSwitch.current;
    if (!pending) return;
    pendingSwitch.current = null;
    pending.transition.cancel();
    resetVideoSource(pending.video);
    pending.video.remove();
    emitSnapshotRef.current();
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    const current = videoRef.current;
    if (!mesh) return;
    // A new HLS frame can reach Three.js before the browser dispatches resize.
    const oversized = ready && current && exceedsVideoTextureLimit(current, maxTextureSize);
    mesh.visible = visible && !(ready && failedSource.current) && !oversized;
    if (oversized && !failedSource.current) {
      sourceFailure.current?.(new VideoTextureSizeError(current, maxTextureSize));
    }
    // VideoTexture only refreshes while the canvas keeps drawing.
    if (current && !current.paused && !current.ended) {
      state.invalidate();
    }
  }, -1);

  const controller = useMemo<PanoVideoController>(
    () => ({
      subscribe: (onStoreChange) => {
        const store = storeRef.current;
        if (!store) {
          return () => {};
        }
        store.listeners.add(onStoreChange);
        return () => {
          store.listeners.delete(onStoreChange);
        };
      },
      getSnapshot: () =>
        storeRef.current?.snapshot ?? createEmptySnapshot(),
      play: () => actionsRef.current.play(),
      pause: () => actionsRef.current.pause(),
      togglePlay: () => {
        const snapshot = storeRef.current?.snapshot;
        if (snapshot?.playing) {
          actionsRef.current.pause();
          return;
        }
        void actionsRef.current.play();
      },
      seek: (time) => {
        actionsRef.current.seek(time);
      },
      setVolume: (nextVolume) => {
        actionsRef.current.setVolume(nextVolume);
      },
      setMuted: (nextMuted) => {
        actionsRef.current.setMuted(nextMuted);
      },
      toggleMuted: () => {
        const snapshot = storeRef.current?.snapshot;
        actionsRef.current.setMuted(!(snapshot?.muted ?? true));
      },
      setPlaybackRate: (rate) => {
        actionsRef.current.setPlaybackRate(rate);
      },
      setVariantId: (id) => {
        actionsRef.current.setVariantId(id);
      },
      setHlsLevel: (level) => actionsRef.current.setHlsLevel(level),
      setTrackId: (id) => {
        actionsRef.current.setTrackId(id);
      },
      setCaptionAppearance: (appearancePatch) => {
        actionsRef.current.setCaptionAppearance(appearancePatch);
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    if (!host || variants.length === 0) {
      return;
    }
    host.controls = controls;
    host.captions = captionsEnabled;
    host.clickToTogglePlayback = videoInteractionsEnabled && clickToTogglePlayback;
    host.showCenterPlayButton = videoInteractionsEnabled && showCenterPlayButton;
    host.controller = controller;
    notifyPanoVideoHost(host);
    return () => {
      host.controller = null;
      host.clickToTogglePlayback = false;
      host.showCenterPlayButton = false;
      notifyPanoVideoHost(host);
    };
  }, [
    captionsEnabled, clickToTogglePlayback, controller, controls, host,
    showCenterPlayButton, variants.length, videoInteractionsEnabled,
  ]);

  useLayoutEffect(() => {
    if (!video) return;
    mediaCapabilitiesRef.current = {
      volumeAdjustable: probeVolumeAdjustable(video),
      playbackRates: filterSupportedPlaybackRates(video, playbackRates),
    };
    emitSnapshotRef.current();
  }, [playbackRates, video]);

  useEffect(() => {
    emitSnapshot();
  }, [emitSnapshot]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    nativeVariantId.current = null;
    blockedRef.current = false;
    failedSource.current = false;
    setReady(false);
    setFrameKey(undefined);
    setMediaFailure(undefined);
    if (!activeVariant || !mediaKey) {
      resetVideoSource(video);
      return;
    }

    const saved = resume.current;
    resume.current = null;
    playAfterLoad.current = saved?.playing ?? autoPlayRef.current;
    let loaded = false;
    let restoredPosition = false;
    let restoredRate = false;
    initialSourceVideoRef.current = video;
    video.crossOrigin = crossOrigin ?? (activeVariant.sources.some(isHlsSource) ? "anonymous" : null);
    replaceTextTracks(video, tracks);
    emitSnapshotRef.current({ ready: false, captionText: "" });
    const capturePlayback = (current: HTMLVideoElement): PlaybackResume => ({
      time: restoredPosition || loaded ? current.currentTime : saved?.time ?? current.currentTime,
      playing: (loaded && !failedSource.current ? !current.paused : playAfterLoad.current) && !current.ended,
      rate: restoredRate || loaded ? current.playbackRate : saved?.rate ?? current.playbackRate,
    });
    const fail = (error: unknown) => {
      if (sourceFailure.current !== fail || failedSource.current) return;
      const current = videoRef.current!;
      const selected = nativeVariantId.current ?? activeVariant.id;
      const fallback = fallbackVariant.current;
      const shouldRecover = canRecoverWithVideoVariant(error) &&
        !fallbackAttempted.current && fallback && fallback.id !== selected;
      failedSource.current = true;
      resume.current = capturePlayback(current);
      cancelSwitch();
      sourceRef.current?.dispose();
      sourceRef.current = null;
      resetVideoSource(current);
      setReady(false);
      emitSnapshotRef.current({ ready: false, captionText: "" });
      if (shouldRecover) {
        fallbackAttempted.current = true;
        setSelection(({ revision }) => ({ id: fallback.id, revision: revision + 1 }));
        onVariantChangeRef.current?.(fallback.id);
      } else {
        setMediaFailure({ key: mediaKey, error });
        onErrorRef.current?.({ source: "video", error });
      }
    };
    sourceFailure.current = fail;
    const validateFrame = () => {
      if (failedSource.current || videoRef.current !== video) return false;
      if (!exceedsVideoTextureLimit(video, maxTextureSize)) return true;
      fail(new VideoTextureSizeError(video, maxTextureSize));
      return false;
    };
    const handleLoadedMetadata = () => {
      if (!validateFrame()) return;
      if (saved && saved.time > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(saved.time, video.duration);
        restoredPosition = true;
      }
      if (saved) {
        try {
          video.playbackRate = saved.rate;
          restoredRate = true;
        } catch {
          // Some browsers reject rates outside a narrow range.
        }
      }
    };
    const handleLoadedData = () => {
      if (loaded || video.readyState < video.HAVE_CURRENT_DATA || !video.videoWidth || !validateFrame()) return;
      loaded = true;
      // Browsers can stop delivering callbacks registered on the previous
      // source. Bind a fresh VideoTexture to the first frame of this source.
      setTextureRevision((revision) => revision + 1);
      setReady(true);
      setFrameKey(mediaKey);
      onLoadRef.current?.();
      if (playAfterLoad.current && video.paused) void actionsRef.current.play();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleLoadedData);
    const source = loadVideoSources(video, activeVariant.sources, {
      crossOrigin,
      startImmediately: video.preload !== "none" || playAfterLoad.current,
      hasLoaded: () => loaded,
      onError: (error) => {
        if (videoRef.current === video) queueMicrotask(() => {
          if (videoRef.current === video) fail(error);
        });
      },
      onChange: () => emitSnapshotRef.current(),
    });
    sourceRef.current = source;
    emitSnapshotRef.current();

    return () => {
      const current = videoRef.current!;
      resume.current ??= capturePlayback(current);
      cancelSwitch();
      sourceFailure.current = null;
      sourceRef.current = null;
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleLoadedData);
      source.dispose();
      if (!failedSource.current) resetVideoSource(current);
    };
  }, [mediaKey, cancelSwitch, maxTextureSize]);

  useLayoutEffect(() => {
    if (!video) return;
    const startNativeSwitch = (current: HTMLVideoElement, url: string, target: PanoVideoQualitySwitch["target"]) => {
      const pending = pendingSwitch.current;
      if (pending && JSON.stringify(pending.target) === JSON.stringify(target)) {
        pending.transition.confirm();
        return;
      }
      cancelSwitch();
      const next = current.ownerDocument.createElement("video");
      applyInlineVideoPlayback(next, current.playsInline);
      next.preload = "auto";
      next.crossOrigin = current.crossOrigin;
      next.muted = true;
      replaceTextTracks(next, tracks);
      mountTextureVideo(next, gl.domElement);
      const transition = prepareNativeHlsSwitch(current, next, {
        validateFrame: () => exceedsVideoTextureLimit(next, maxTextureSize)
          ? new VideoTextureSizeError(next, maxTextureSize)
          : undefined,
        commit: () => {
          pendingSwitch.current = null;
          current.pause();
          next.preload = current.preload;
          videoRef.current = next;
          setVideo(next);
          if ("level" in target) {
            sourceRef.current?.selectLevel(target.level);
          } else {
            nativeVariantId.current = target.variantId;
            sourceRef.current?.selectLevel("auto");
            onVariantChangeRef.current?.(target.variantId);
          }
          emitSnapshotRef.current();
        },
        awaitingGesture: () => {
          if (!pendingSwitch.current) return;
          pendingSwitch.current.state = "awaiting-gesture";
          emitSnapshotRef.current();
        },
        fail: (error) => {
          cancelSwitch();
          onErrorRef.current?.({ source: "video", error });
        },
      });
      pendingSwitch.current = { video: next, target, transition, state: "buffering" };
      next.src = url;
      next.load();
      // Prime playback in the selection gesture, including when the current
      // video is paused. Native preload can stop at metadata.
      transition.start();
      emitSnapshotRef.current();
    };
    actionsRef.current = {
      play: async () => {
        loadRef.current.current?.loading();
        const video = videoRef.current!;
        if (failedSource.current) {
          if (resume.current) resume.current.playing = true;
          fallbackAttempted.current = false;
          const id = nativeVariantId.current ?? resolvedVariantId;
          setSelection(({ revision }) => ({ id, revision: revision + 1 }));
          return;
        }
        playAfterLoad.current = true;
        sourceRef.current?.start();
        blockedRef.current = false;
        try {
          await video.play();
        } catch (error) {
          if (videoRef.current !== video || failedSource.current || (error instanceof DOMException && error.name === "AbortError")) return;
          if (isAutoplayPolicyError(error)) {
            blockedRef.current = true;
            onPlaybackStateChangeRef.current?.("blocked");
          }
          onErrorRef.current?.({ source: "video", error });
          emitSnapshot();
        }
      },
      pause: () => {
        playAfterLoad.current = false;
        videoRef.current?.pause();
      },
      seek: (time) => {
        const video = videoRef.current!;
        if (!Number.isFinite(time)) {
          return;
        }
        const duration = Number.isFinite(video.duration) ? video.duration : time;
        video.currentTime = Math.max(0, Math.min(time, duration));
        emitSnapshot();
      },
      setVolume: (nextVolume) => {
        const video = videoRef.current!;
        if (!Number.isFinite(nextVolume) || !mediaCapabilitiesRef.current.volumeAdjustable) {
          return;
        }
        video.volume = clampVolume(nextVolume);
        if (video.volume > 0) {
          video.muted = false;
        }
        emitSnapshot();
      },
      setMuted: (nextMuted) => {
        const video = videoRef.current!;
        video.muted = nextMuted;
        emitSnapshot();
      },
      setPlaybackRate: (rate) => {
        const video = videoRef.current!;
        if (!Number.isFinite(rate) || rate <= 0) {
          return;
        }
        const previous = video.playbackRate;
        try {
          video.playbackRate = rate;
        } catch {
          emitSnapshot();
          return;
        }
        if (Math.abs(video.playbackRate - rate) > 0.001) {
          try {
            video.playbackRate = previous;
          } catch {
            // Keep whatever the element accepted.
          }
          emitSnapshot();
          return;
        }
        emitSnapshot();
      },
      setVariantId: (id) => {
        const requested = variants.find((variant) => variant.id === id);
        if (!requested) return;
        const current = videoRef.current!;
        const selected = nativeVariantId.current ?? resolvedVariantId;
        if (selected === id && !failedSource.current) {
          cancelSwitch();
          return;
        }
        fallbackAttempted.current = false;
        const first = requested.sources[0];
        if (sourceRef.current?.native && current.readyState > 0 && first && isHlsSource(first)) {
          startNativeSwitch(current, first.src, { variantId: id });
          return;
        }
        cancelSwitch();
        setSelection(({ revision }) => ({ id, revision: revision + 1 }));
        onVariantChangeRef.current?.(id);
      },
      setHlsLevel: (level) => {
        const source = sourceRef.current;
        if (!source) return;
        if (!source.native) {
          source.selectLevel(level);
          return;
        }
        const current = videoRef.current!;
        const url = source.nativeTarget(level);
        if (!url || !current.readyState) return;
        if (source.quality(current)?.selectedLevel === level) {
          cancelSwitch();
          return;
        }
        startNativeSwitch(current, url, { level });
      },
      setTrackId: (id) => {
        setTrackId((current) => {
          if (current === id) {
            return current;
          }
          onTrackChangeRef.current?.(id);
          return id;
        });
      },
      setCaptionAppearance: (appearancePatch) => {
        captionAppearanceOverrideRef.current = {
          ...captionAppearanceOverrideRef.current,
          ...appearancePatch,
        };
        emitSnapshot();
      },
    };
  }, [cancelSwitch, emitSnapshot, gl, maxTextureSize, resolvedVariantId, tracks, variants, video]);

  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.loop = loop;
    video.muted = muted;
    if (mediaCapabilitiesRef.current.volumeAdjustable) video.volume = clampVolume(volume);
    applyInlineVideoPlayback(video, playsInline);
    video.preload = preload;
  }, [loop, muted, playsInline, preload, volume]);

  useEffect(() => {
    if (!video) return;
    let active = true;
    const handleTimeUpdate = () => {
      if (active) {
        emitSnapshot();
      }
    };
    const handlePlay = () => {
      if (videoRef.current !== video) return;
      blockedRef.current = false;
      onPlaybackStateChangeRef.current?.("playing");
      emitSnapshot();
    };
    const handlePause = () => {
      if (videoRef.current !== video) return;
      onPlaybackStateChangeRef.current?.(
        video.ended ? "ended" : "paused",
      );
      emitSnapshot();
    };
    const handleEnded = () => {
      if (videoRef.current !== video) return;
      onPlaybackStateChangeRef.current?.("ended");
      onEndedRef.current?.();
      emitSnapshot();
    };
    const handleVolume = () => {
      emitSnapshot();
    };
    const unsubscribeAudio = subscribeMediaAudio(video, handleTimeUpdate);
    let width = video.videoWidth;
    let height = video.videoHeight;
    const handleResize = () => {
      if (videoRef.current !== video || failedSource.current || !video.videoWidth || !video.videoHeight) return;
      if (exceedsVideoTextureLimit(video, maxTextureSize)) {
        sourceFailure.current?.(new VideoTextureSizeError(video, maxTextureSize));
        return;
      }
      if (width && height && (width !== video.videoWidth || height !== video.videoHeight)) {
        setTextureRevision((revision) => revision + 1);
      }
      width = video.videoWidth;
      height = video.videoHeight;
      emitSnapshot();
    };
    const handleSwitchedSourceError = () => {
      if (videoRef.current === video && video !== initialSourceVideoRef.current) {
        sourceFailure.current?.(video.error ?? new Error("Unable to play the switched HLS source."));
      }
    };
    video.addEventListener("loadeddata", handleResize);
    video.addEventListener("resize", handleResize);
    video.addEventListener("error", handleSwitchedSourceError);
    video.addEventListener("durationchange", handleTimeUpdate);
    video.addEventListener("progress", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("volumechange", handleVolume);
    video.addEventListener("ratechange", handleVolume);
    return () => {
      active = false;
      unsubscribeAudio();
      video.removeEventListener("loadeddata", handleResize);
      video.removeEventListener("resize", handleResize);
      video.removeEventListener("error", handleSwitchedSourceError);
      video.removeEventListener("durationchange", handleTimeUpdate);
      video.removeEventListener("progress", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("volumechange", handleVolume);
      video.removeEventListener("ratechange", handleVolume);
    };
  }, [emitSnapshot, maxTextureSize, video]);

  useEffect(() => {
    if (!video) return;
    let selected: TextTrack | null = null;
    const handleCueChange = () => {
      if (videoRef.current === video) emitSnapshot({ captionText: collectCaptionText(selected) });
    };
    const applyModes = () => {
      const next = findTextTrack(video, trackId);
      if (next !== selected) {
        selected?.removeEventListener("cuechange", handleCueChange);
        selected = next;
        selected?.addEventListener("cuechange", handleCueChange);
      }
      const list = video.textTracks;
      for (let index = 0; index < list.length; index += 1) {
        const textTrack = list[index];
        const mode = textTrack === selected ? "hidden" : "disabled";
        if (textTrack && textTrack.mode !== mode) textTrack.mode = mode;
      }
      handleCueChange();
    };

    applyModes();
    video.textTracks.addEventListener("addtrack", applyModes);
    video.textTracks.addEventListener("change", applyModes);
    video.addEventListener("load", applyModes, true);
    video.addEventListener("seeked", handleCueChange);
    return () => {
      selected?.removeEventListener("cuechange", handleCueChange);
      video.textTracks.removeEventListener("addtrack", applyModes);
      video.textTracks.removeEventListener("change", applyModes);
      video.removeEventListener("load", applyModes, true);
      video.removeEventListener("seeked", handleCueChange);
    };
  }, [emitSnapshot, video, trackId, tracks]);

  useEffect(() => {
    if (!captionsEnabled) {
      setTrackId(null);
      return;
    }
    setTrackId(defaultPanoVideoTrackId(tracks));
  }, [captionsEnabled, tracks]);

  const activeTexture = ready ? videoTexture : posterTexture;
  useEffect(() => {
    if (posterUrl || preload !== "none" || autoPlay) load.current?.loading();
  }, [autoPlay, load, posterUrl, preload]);

  useEffect(() => {
    if (posterTexture || (videoTexture && frameKey === mediaKey)) {
      load.current?.ready();
      return;
    }
    const failure = mediaFailure?.key === mediaKey ? mediaFailure : undefined;
    if ((!canLoadVideo || failure) && (!posterUrl || posterFailure)) {
      load.current?.fail(failure?.error ?? posterFailure?.error ?? new Error("Panorama video source is missing"));
    }
  }, [canLoadVideo, frameKey, load, mediaFailure, mediaKey, posterFailure, posterTexture, posterUrl, videoTexture]);

  if (variants.length === 0) {
    return null;
  }

  return (
    <>
      {activeTexture ? (
        <mesh
          ref={meshRef}
          rotation={[0, MathUtils.degToRad(90 + yawOffset), 0]}
          visible={visible}
        >
          <sphereGeometry args={[DEFAULT_PANORAMA_RADIUS, 128, 64]} />
          <PanoBasicMaterial
            map={activeTexture}
            side={BackSide}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      {captionsEnabled ? <PanoVideoCaptions appearance={typeof captions === "object" ? captions : undefined} /> : null}
    </>
  );
}
