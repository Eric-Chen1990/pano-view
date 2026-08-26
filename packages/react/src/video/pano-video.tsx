import { useThree } from "@react-three/fiber";
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
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  VideoTexture,
} from "three";
import type { VideoPlaybackState } from "../hotspot/video-hotspot";
import { usePanoMediaActivationIntent } from "../media-activation";
import { isAutoplayPolicyError } from "../media-activation-event";
import { PanoBasicMaterial } from "../pano-filter/pano-basic-material";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import { PanoChromeOverlayContext } from "./chrome-overlay";
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
  PanoVideoControlsAppearance,
  PanoVideoErrorEvent,
  PanoVideoPlaybackSnapshot,
  PanoVideoTrack,
  PanoVideoVariant,
} from "./types";

const EMPTY_TRACKS: readonly PanoVideoTrack[] = [];

export type PanoVideoProps = {
  /** Single-file shortcut when `variants` is omitted. */
  src?: string;
  poster?: string;
  variants?: readonly PanoVideoVariant[];
  defaultVariantId?: string;
  tracks?: readonly PanoVideoTrack[];
  /**
   * Caption overlay. `true` / omit uses the default appearance; `false`
   * hides captions and the control-bar language menu; an object merges
   * with the defaults.
   */
  captions?: boolean | PanoVideoCaptionAppearance;
  /**
   * Playback chrome. `true` / omit mounts the default bar; `false` skips
   * it; an object mounts the default bar with appearance overrides.
   * Render `PanoVideoControls` as a PanoViewer child to replace the default.
   */
  controls?: boolean | PanoVideoControlsAppearance;
  /** Horizontal video offset in degrees. */
  yawOffset?: number;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  autoPlay?: boolean;
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

type VideoResource = {
  video: HTMLVideoElement;
  texture: VideoTexture;
};

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

function findTextTrack(
  video: HTMLVideoElement,
  tracks: readonly PanoVideoTrack[],
  trackId: string | null,
): TextTrack | null {
  if (!trackId) {
    return null;
  }
  const configured = tracks.find((track) => panoVideoTrackId(track) === trackId);
  if (!configured) {
    return null;
  }
  const list = video.textTracks;
  for (let index = 0; index < list.length; index += 1) {
    const textTrack = list[index];
    if (!textTrack) {
      continue;
    }
    if (
      textTrack.language === configured.srcLang ||
      textTrack.label === configured.label
    ) {
      return textTrack;
    }
  }
  return list.length > 0 ? list[0]! : null;
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
        applyEquirectangularLayout(
          loadedTexture,
          gl.capabilities.getMaxAnisotropy(),
        );
        loadedTexture.wrapT = RepeatWrapping;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.minFilter = LinearMipmapLinearFilter;
        loadedTexture.generateMipmaps = true;
        setTexture(loadedTexture);
      },
      undefined,
      (error) => {
        if (active) {
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
      texture?.dispose();
    },
    [texture],
  );

  return texture;
}

function replaceMediaChildren(
  video: HTMLVideoElement,
  variant: PanoVideoVariant,
  tracks: readonly PanoVideoTrack[],
): void {
  video.querySelectorAll("source, track").forEach((node) => {
    node.remove();
  });
  for (const source of variant.sources) {
    const element = document.createElement("source");
    element.src = source.src;
    if (source.type) {
      element.type = source.type;
    }
    video.appendChild(element);
  }
  for (const track of tracks) {
    const element = document.createElement("track");
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
  tracks: tracksProp,
  captions = true,
  controls = true,
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
  const host = useContext(PanoVideoHostContext);
  const overlay = useContext(PanoChromeOverlayContext);
  const variants = useMemo(
    () => resolvePanoVideoVariants({ poster, src, variants: variantsProp }),
    [poster, src, variantsProp],
  );
  const tracks = tracksProp ?? EMPTY_TRACKS;
  const captionsEnabled = captions !== false;
  const captionAppearance = useMemo(
    () =>
      resolvePanoVideoCaptionAppearance(
        typeof captions === "object" ? captions : undefined,
      ),
    [captions],
  );
  const [variantId, setVariantId] = useState(() =>
    resolvePanoVideoVariantId(variants, defaultVariantId),
  );
  const [trackId, setTrackId] = useState<string | null>(() =>
    captionsEnabled ? defaultPanoVideoTrackId(tracks) : null,
  );
  const [ready, setReady] = useState(false);
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

  const resource = useMemo<VideoResource | null>(() => {
    if (typeof document === "undefined") {
      return null;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.preload = "metadata";
    const texture = new VideoTexture(video);
    applyEquirectangularLayout(texture, 1);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return { video, texture };
  }, []);

  useEffect(
    () => () => {
      if (!resource) {
        return;
      }
      resource.video.pause();
      resource.video.removeAttribute("src");
      resource.video.querySelectorAll("source, track").forEach((node) => {
        node.remove();
      });
      resource.video.load();
      resource.texture.dispose();
    },
    [resource],
  );

  useEffect(() => {
    if (!resource) {
      return;
    }
    resource.texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  }, [gl, resource]);

  useEffect(() => {
    if (!resource || !overlay?.overlayElement) {
      return;
    }
    const { video } = resource;
    video.setAttribute("data-pano-video", "");
    video.style.position = "absolute";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    overlay.overlayElement.appendChild(video);
    return () => {
      video.remove();
    };
  }, [overlay?.overlayElement, resource]);

  const resolvedVariantId = resolvePanoVideoVariantId(variants, variantId);
  const activeVariant =
    variants.find((variant) => variant.id === resolvedVariantId) ?? variants[0];
  const mediaKey = activeVariant
    ? `${activeVariant.id}:${activeVariant.sources.map((source) => source.src).join("|")}:${tracks
        .map((track) => `${panoVideoTrackId(track)}:${track.src}`)
        .join("|")}:${crossOrigin ?? ""}`
    : "";
  const posterTexture = usePosterTexture(
    activeVariant?.poster ?? poster,
    onError,
  );

  const emitSnapshot = useCallback(
    (patch?: Partial<PanoVideoPlaybackSnapshot>) => {
      const store = storeRef.current;
      const video = resource?.video;
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
      const next: PanoVideoPlaybackSnapshot = {
        ...store.snapshot,
        ready,
        playing: playbackState === "playing",
        blocked: blockedRef.current,
        ended: playbackState === "ended",
        currentTime: video?.currentTime ?? 0,
        duration: video && Number.isFinite(video.duration) ? video.duration : 0,
        volume: video ? clampVolume(video.volume) : clampVolume(volume),
        volumeAdjustable: mediaCapabilitiesRef.current.volumeAdjustable,
        muted: video?.muted ?? muted,
        playbackRate: video?.playbackRate ?? 1,
        variantId: resolvedVariantId,
        variants,
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
      resource,
      trackId,
      tracks,
      variants,
      volume,
      captionAppearance,
    ],
  );

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
    host.controller = controller;
    notifyPanoVideoHost(host);
    return () => {
      host.controller = null;
      notifyPanoVideoHost(host);
    };
  }, [captionsEnabled, controller, controls, host, variants.length]);

  useLayoutEffect(() => {
    if (!resource) {
      return;
    }
    mediaCapabilitiesRef.current = {
      volumeAdjustable: probeVolumeAdjustable(resource.video),
      playbackRates: filterSupportedPlaybackRates(
        resource.video,
        playbackRates,
      ),
    };
    emitSnapshot();
  }, [emitSnapshot, playbackRates, resource]);

  useEffect(() => {
    emitSnapshot();
  }, [emitSnapshot]);

  useEffect(() => {
    if (!resource || !activeVariant || !mediaKey) {
      return;
    }
    const { video } = resource;
    if (crossOrigin !== undefined) {
      video.crossOrigin = crossOrigin;
    }
    const resumeTime = video.currentTime;
    const wasPlaying = !video.paused && !video.ended && video.readyState > 0;
    const resumeRate = video.playbackRate;
    blockedRef.current = false;
    setReady(false);
    replaceMediaChildren(video, activeVariant, tracks);
    video.load();

    let active = true;
    const handleLoadedMetadata = () => {
      if (!active) {
        return;
      }
      if (resumeTime > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(resumeTime, video.duration);
      }
      try {
        video.playbackRate = resumeRate;
      } catch {
        // Some browsers reject rates outside a narrow range.
      }
    };
    const handleLoadedData = () => {
      if (!active) {
        return;
      }
      setReady(true);
      onLoadRef.current?.();
      if (wasPlaying || autoPlayRef.current) {
        void actionsRef.current.play();
      }
    };
    const handleError = () => {
      if (!active) {
        return;
      }
      onErrorRef.current?.({
        source: "video",
        error: video.error ?? new Error("Unable to load panorama video."),
      });
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);
    return () => {
      active = false;
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);
    };
  }, [mediaKey, resource]);

  useEffect(() => {
    if (!resource) {
      return;
    }
    const { video } = resource;
    actionsRef.current = {
      play: async () => {
        blockedRef.current = false;
        try {
          await video.play();
        } catch (error) {
          if (isAutoplayPolicyError(error)) {
            blockedRef.current = true;
            onPlaybackStateChangeRef.current?.("blocked");
          }
          onErrorRef.current?.({ source: "video", error });
          emitSnapshot();
        }
      },
      pause: () => {
        video.pause();
      },
      seek: (time) => {
        if (!Number.isFinite(time)) {
          return;
        }
        const duration = Number.isFinite(video.duration) ? video.duration : time;
        video.currentTime = Math.max(0, Math.min(time, duration));
        emitSnapshot();
      },
      setVolume: (nextVolume) => {
        if (!mediaCapabilitiesRef.current.volumeAdjustable) {
          return;
        }
        video.volume = clampVolume(nextVolume);
        if (video.volume > 0) {
          video.muted = false;
        }
        emitSnapshot();
      },
      setMuted: (nextMuted) => {
        video.muted = nextMuted;
        emitSnapshot();
      },
      setPlaybackRate: (rate) => {
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
        setVariantId((current) => {
          if (current === id) {
            return current;
          }
          onVariantChangeRef.current?.(id);
          return id;
        });
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
  }, [emitSnapshot, resource]);

  useEffect(() => {
    if (!resource) {
      return;
    }
    const { video } = resource;
    video.loop = loop;
    video.muted = muted;
    if (mediaCapabilitiesRef.current.volumeAdjustable) {
      video.volume = clampVolume(volume);
    }
    video.playsInline = playsInline;
    if (playsInline) {
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
    } else {
      video.removeAttribute("playsinline");
      video.removeAttribute("webkit-playsinline");
    }
    video.preload = preload;
  }, [loop, muted, playsInline, preload, resource, volume]);

  useEffect(() => {
    if (!resource) {
      return;
    }
    const { video } = resource;
    let active = true;
    const handleTimeUpdate = () => {
      if (active) {
        emitSnapshot();
      }
    };
    const handlePlay = () => {
      blockedRef.current = false;
      onPlaybackStateChangeRef.current?.("playing");
      emitSnapshot();
    };
    const handlePause = () => {
      onPlaybackStateChangeRef.current?.(
        video.ended ? "ended" : "paused",
      );
      emitSnapshot();
    };
    const handleEnded = () => {
      onPlaybackStateChangeRef.current?.("ended");
      onEndedRef.current?.();
      emitSnapshot();
    };
    const handleVolume = () => {
      emitSnapshot();
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleTimeUpdate);
    video.addEventListener("progress", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("volumechange", handleVolume);
    video.addEventListener("ratechange", handleVolume);
    return () => {
      active = false;
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleTimeUpdate);
      video.removeEventListener("progress", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("volumechange", handleVolume);
      video.removeEventListener("ratechange", handleVolume);
    };
  }, [emitSnapshot, resource]);

  useEffect(() => {
    if (!resource) {
      return;
    }
    const { video } = resource;
    const applyModes = () => {
      const selected = findTextTrack(video, tracks, trackId);
      const list = video.textTracks;
      for (let index = 0; index < list.length; index += 1) {
        const textTrack = list[index];
        if (!textTrack) {
          continue;
        }
        textTrack.mode = textTrack === selected ? "hidden" : "disabled";
      }
      emitSnapshot({ captionText: collectCaptionText(selected) });
    };

    applyModes();
    const selected = findTextTrack(video, tracks, trackId);
    const handleCueChange = () => {
      emitSnapshot({
        captionText: collectCaptionText(
          findTextTrack(video, tracks, trackId),
        ),
      });
    };
    selected?.addEventListener("cuechange", handleCueChange);
    video.textTracks.addEventListener("addtrack", applyModes);
    video.textTracks.addEventListener("change", applyModes);
    return () => {
      selected?.removeEventListener("cuechange", handleCueChange);
      video.textTracks.removeEventListener("addtrack", applyModes);
      video.textTracks.removeEventListener("change", applyModes);
    };
  }, [emitSnapshot, resource, trackId, tracks]);

  useEffect(() => {
    if (!captionsEnabled) {
      setTrackId(null);
      return;
    }
    setTrackId(defaultPanoVideoTrackId(tracks));
  }, [captionsEnabled, tracks]);

  const activeTexture = ready && resource ? resource.texture : posterTexture;

  if (variants.length === 0) {
    return null;
  }

  return (
    <>
      {activeTexture ? (
        <mesh
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
