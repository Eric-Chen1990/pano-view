import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createUnlockingHowl,
  sourceList,
  type UnlockingHowlHandle,
} from "./audio/howl";
import {
  BackgroundAudioHostContext,
  notifyBackgroundAudioHost,
  type BackgroundAudioController,
  type BackgroundAudioSnapshot,
} from "./background-audio-host";
import type { AudioPlaybackState } from "./hotspot/audio-hotspot";
import { clampAudioVolume } from "./hotspot/audio-spatial";
import { PanoramaViewContext } from "./panorama-view-runtime";

const DEFAULT_FADE_MS = 400;

export type BackgroundAudioSource = string | readonly string[];

export type BackgroundAudioErrorEvent = {
  error: unknown;
};

export type BackgroundAudioProps = {
  /** Shared tour track when `sources` is omitted, or fallback when a scene has no entry. */
  src?: BackgroundAudioSource;
  /** Per-scene tracks keyed by `Scene.id`. Requires `sceneId`. */
  sources?: Readonly<Record<string, BackgroundAudioSource>>;
  /** Current scene id. Required when `sources` is set. */
  sceneId?: string;
  /**
   * Controlled playing state. When provided, the parent owns play/pause.
   * When omitted, the component manages its own state and imperative
   * `playBackgroundAudio` / `pauseBackgroundAudio` work directly.
   */
  playing?: boolean;
  /** Initial playing state when `playing` is omitted. Defaults to false. */
  defaultPlaying?: boolean;
  /** Defaults to true. */
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  pauseWhenHidden?: boolean;
  /** Crossfade duration when the resolved track changes. Defaults to 400; 0 is a hard cut. */
  fadeMs?: number;
  crossOrigin?: "" | "anonymous" | "use-credentials";
  onPlaybackStateChange?: (state: AudioPlaybackState) => void;
  onPlaybackError?: (error: unknown) => void;
  onEnded?: () => void;
  onError?: (event: BackgroundAudioErrorEvent) => void;
};

type AudioSlot = {
  handle: UnlockingHowlHandle;
  key: string;
  crossOrigin: "" | "anonymous" | "use-credentials" | undefined;
};

function resolveFadeMs(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_FADE_MS;
  }
  return Math.max(0, value!);
}

function resolveBackgroundAudioUrls(
  src: BackgroundAudioSource | undefined,
  sources: Readonly<Record<string, BackgroundAudioSource>> | undefined,
  sceneId: string | undefined,
): string[] {
  if (sources !== undefined) {
    if (sceneId === undefined) {
      throw new Error("<BackgroundAudio> requires sceneId when sources is set.");
    }
    if (Object.prototype.hasOwnProperty.call(sources, sceneId)) {
      return sourceList(sources[sceneId]);
    }
  }
  return sourceList(src);
}

function applyNonSpatialMix(
  slot: AudioSlot,
  loop: boolean,
  muted: boolean,
  volume: number,
) {
  slot.handle.howl.stereo(0);
  slot.handle.howl.loop(loop);
  slot.handle.howl.mute(muted);
  slot.handle.howl.volume(clampAudioVolume(volume));
}

/**
 * Adds a non-spatial soundtrack to the nearest PanoViewer. Render one instance
 * as a child of PanoViewer, alongside Scenes or a panorama source — not inside
 * renderHotspots.
 */
export function BackgroundAudio({
  src,
  sources,
  sceneId,
  playing: controlledPlaying,
  defaultPlaying = false,
  loop = true,
  muted = false,
  volume = 1,
  pauseWhenHidden = true,
  fadeMs,
  crossOrigin,
  onPlaybackStateChange,
  onPlaybackError,
  onEnded,
  onError,
}: BackgroundAudioProps) {
  const controlsRef = useContext(PanoramaViewContext);
  if (!controlsRef) {
    throw new Error("<BackgroundAudio> must be rendered inside <PanoViewer>.");
  }

  const isControlled = controlledPlaying !== undefined;
  const [internalPlaying, setInternalPlaying] = useState(defaultPlaying);
  const playing = isControlled ? controlledPlaying : internalPlaying;

  const urls = resolveBackgroundAudioUrls(src, sources, sceneId);
  const trackKey = urls.join("\0");

  const currentRef = useRef<AudioSlot | null>(null);
  const outgoingRef = useRef<AudioSlot[]>([]);
  const fadingInRef = useRef(false);
  const isFirstTrackRef = useRef(true);
  const playingRef = useRef(playing);
  const loopRef = useRef(loop);
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  const fadeMsRef = useRef(resolveFadeMs(fadeMs));
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  const onPlaybackErrorRef = useRef(onPlaybackError);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);

  playingRef.current = playing;
  loopRef.current = loop;
  mutedRef.current = muted;
  volumeRef.current = volume;
  fadeMsRef.current = resolveFadeMs(fadeMs);
  onPlaybackStateChangeRef.current = onPlaybackStateChange;
  onPlaybackErrorRef.current = onPlaybackError;
  onEndedRef.current = onEnded;
  onErrorRef.current = onError;

  // -- Snapshot & controller for host registration --
  const snapshotRef = useRef<BackgroundAudioSnapshot>({
    ready: false,
    playing: false,
    blocked: false,
    ended: false,
    muted,
    volume,
  });
  const snapshotListenersRef = useRef(new Set<() => void>());

  const notifySnapshot = (patch: Partial<BackgroundAudioSnapshot>) => {
    const prev = snapshotRef.current;
    snapshotRef.current = { ...prev, ...patch };
    for (const listener of snapshotListenersRef.current) {
      listener();
    }
  };

  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;

  const controller = useMemo<BackgroundAudioController>(
    () => ({
      subscribe: (onStoreChange) => {
        snapshotListenersRef.current.add(onStoreChange);
        return () => {
          snapshotListenersRef.current.delete(onStoreChange);
        };
      },
      getSnapshot: () => snapshotRef.current,
      play: () => {
        if (isControlledRef.current) {
          return;
        }
        setInternalPlaying(true);
      },
      pause: () => {
        if (isControlledRef.current) {
          return;
        }
        setInternalPlaying(false);
      },
      togglePlay: () => {
        if (isControlledRef.current) {
          return;
        }
        setInternalPlaying((prev) => !prev);
      },
      setVolume: (vol) => {
        if (isControlledRef.current) {
          return;
        }
        const howl = currentRef.current?.handle.howl;
        if (howl) {
          howl.volume(clampAudioVolume(vol));
        }
        notifySnapshot({ volume: clampAudioVolume(vol) });
      },
      setMuted: (m) => {
        if (isControlledRef.current) {
          return;
        }
        const howl = currentRef.current?.handle.howl;
        if (howl) {
          howl.mute(m);
        }
        notifySnapshot({ muted: m });
      },
      toggleMuted: () => {
        if (isControlledRef.current) {
          return;
        }
        const next = !snapshotRef.current.muted;
        const howl = currentRef.current?.handle.howl;
        if (howl) {
          howl.mute(next);
        }
        notifySnapshot({ muted: next });
      },
    }),
    [],
  );

  const bgmHost = useContext(BackgroundAudioHostContext);

  useEffect(() => {
    if (!bgmHost) {
      return;
    }
    bgmHost.controller = controller;
    notifyBackgroundAudioHost(bgmHost);
    return () => {
      if (bgmHost.controller === controller) {
        bgmHost.controller = null;
        notifyBackgroundAudioHost(bgmHost);
      }
    };
  }, [bgmHost, controller]);

  useEffect(() => {
    return () => {
      fadingInRef.current = false;
      isFirstTrackRef.current = true;
      currentRef.current?.handle.dispose();
      currentRef.current = null;
      for (const slot of outgoingRef.current) {
        slot.handle.dispose();
      }
      outgoingRef.current = [];
    };
  }, []);

  useEffect(() => {
    const previous = currentRef.current;
    if (
      previous?.key === trackKey &&
      previous.crossOrigin === crossOrigin
    ) {
      return;
    }

    const durationMs = fadeMsRef.current;
    const targetVolume = clampAudioVolume(volumeRef.current);
    const nextUrls = trackKey.length > 0 ? trackKey.split("\0") : [];

    const retire = (slot: AudioSlot) => {
      const howl = slot.handle.howl;
      const from = howl.volume();
      outgoingRef.current.push(slot);
      if (durationMs <= 0 || from <= 0 || !howl.playing()) {
        slot.handle.dispose();
        outgoingRef.current = outgoingRef.current.filter((item) => item !== slot);
        return;
      }
      howl.once("fade", () => {
        slot.handle.dispose();
        outgoingRef.current = outgoingRef.current.filter((item) => item !== slot);
      });
      howl.fade(from, 0, durationMs);
    };

    if (nextUrls.length > 0) {
      const incoming: AudioSlot = {
        key: trackKey,
        crossOrigin,
        handle: createUnlockingHowl({
          src: nextUrls,
          loop: loopRef.current,
          crossOrigin,
          isActive: () => currentRef.current?.key === trackKey,
          shouldRetryPlay: () =>
            currentRef.current?.key === trackKey && playingRef.current,
          onEnded: () => {
            notifySnapshot({ playing: false, ended: true });
            onPlaybackStateChangeRef.current?.("ended");
            onEndedRef.current?.();
          },
          onPlay: () => {
            if (fadingInRef.current && currentRef.current === incoming) {
              incoming.handle.howl.fade(
                0,
                clampAudioVolume(volumeRef.current),
                durationMs,
              );
            }
            notifySnapshot({ ready: true, playing: true, blocked: false, ended: false });
            onPlaybackStateChangeRef.current?.("playing");
          },
          onPause: () => {
            notifySnapshot({ playing: false });
            onPlaybackStateChangeRef.current?.("paused");
          },
          onLoadError: (error) => {
            onErrorRef.current?.({ error });
          },
          onPlayError: (error) => {
            notifySnapshot({ blocked: true });
            onPlaybackStateChangeRef.current?.("blocked");
            onPlaybackErrorRef.current?.(error);
          },
        }),
      };
      const fadeIn = durationMs > 0 && !isFirstTrackRef.current;
      isFirstTrackRef.current = false;
      fadingInRef.current = fadeIn;
      applyNonSpatialMix(
        incoming,
        loopRef.current,
        mutedRef.current,
        fadeIn ? 0 : targetVolume,
      );
      if (fadeIn) {
        incoming.handle.howl.once("fade", () => {
          if (currentRef.current === incoming) {
            fadingInRef.current = false;
            incoming.handle.howl.volume(clampAudioVolume(volumeRef.current));
          }
        });
      }
      currentRef.current = incoming;
      if (playingRef.current) {
        incoming.handle.howl.play();
      }
    } else {
      fadingInRef.current = false;
      isFirstTrackRef.current = false;
      currentRef.current = null;
      if (previous && durationMs > 0 && previous.handle.howl.playing()) {
        previous.handle.howl.once("fade", () => {
          onPlaybackStateChangeRef.current?.("paused");
        });
      } else if (previous) {
        onPlaybackStateChangeRef.current?.("paused");
      }
    }

    if (previous) {
      retire(previous);
    }
  }, [crossOrigin, trackKey]);

  useEffect(() => {
    const howl = currentRef.current?.handle.howl;
    if (!howl) {
      return;
    }
    if (!playing) {
      fadingInRef.current = false;
      howl.pause();
      for (const slot of outgoingRef.current) {
        slot.handle.dispose();
      }
      outgoingRef.current = [];
      return;
    }
    howl.play();
  }, [playing, trackKey]);

  useEffect(() => {
    const slot = currentRef.current;
    if (!slot) {
      return;
    }
    slot.handle.howl.loop(loop);
    slot.handle.howl.mute(muted);
    if (!fadingInRef.current) {
      slot.handle.howl.volume(clampAudioVolume(volume));
    }
    notifySnapshot({ muted, volume: clampAudioVolume(volume) });
  }, [loop, muted, trackKey, volume]);

  useEffect(() => {
    if (!pauseWhenHidden) {
      return;
    }
    const handleVisibility = () => {
      const howl = currentRef.current?.handle.howl;
      if (document.hidden) {
        howl?.pause();
        for (const slot of outgoingRef.current) {
          slot.handle.howl.pause();
        }
        return;
      }
      if (playingRef.current && howl) {
        howl.play();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pauseWhenHidden, trackKey]);

  return null;
}
