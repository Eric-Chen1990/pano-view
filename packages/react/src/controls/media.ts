import { useEffect, useMemo, useRef, type RefObject } from "react";
import { probeVolumeAdjustable } from "../video/format";
import type { PanoMediaController } from "./actions";

export const mediaControllers = new WeakMap<
  HTMLMediaElement,
  PanoMediaController
>();

/** Adapts an existing media element without owning its source or playback lifetime. */
export function usePanoMediaController(
  ref: RefObject<HTMLMediaElement | null>
): PanoMediaController {
  const listeners = useRef(new Set<() => void>());
  const adjustable = useRef(true);
  const cache = useRef<ReturnType<PanoMediaController["getSnapshot"]> | null>(
    null
  );
  const controller = useMemo<PanoMediaController>(
    () => ({
      subscribe(fn) {
        listeners.current.add(fn);
        return () => {
          listeners.current.delete(fn);
        };
      },
      getSnapshot() {
        const media = ref.current;
        const next = {
          ready: (media?.readyState ?? 0) >= 1,
          playing: media ? !media.paused && !media.ended : false,
          currentTime: media?.currentTime ?? 0,
          duration: media?.duration ?? 0,
          volume: media?.volume ?? 1,
          volumeAdjustable: adjustable.current,
          muted: media?.muted ?? true,
        };
        if (
          !cache.current ||
          Object.keys(next).some(
            (key) =>
              !Object.is(
                next[key as keyof typeof next],
                cache.current![key as keyof typeof next]
              )
          )
        )
          cache.current = next;
        return cache.current;
      },
      play: () => ref.current?.play() ?? Promise.resolve(),
      pause: () => ref.current?.pause(),
      seek(time) {
        const media = ref.current;
        if (media && Number.isFinite(time) && Number.isFinite(media.duration))
          media.currentTime = Math.max(0, Math.min(media.duration, time));
      },
      setVolume(value) {
        if (ref.current && Number.isFinite(value))
          ref.current.volume = Math.max(0, Math.min(1, value));
      },
      setMuted(value) {
        if (ref.current) ref.current.muted = value;
      },
    }),
    [ref]
  );
  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    mediaControllers.set(media, controller);
    adjustable.current = probeVolumeAdjustable(media);
    const notify = () => listeners.current.forEach((fn) => fn());
    const events = [
      "loadedmetadata",
      "durationchange",
      "timeupdate",
      "play",
      "pause",
      "ended",
      "volumechange",
      "error",
      "emptied",
    ];
    events.forEach((event) => media.addEventListener(event, notify));
    notify();
    return () => {
      mediaControllers.delete(media);
      events.forEach((event) => media.removeEventListener(event, notify));
    };
  }, [ref, ref.current]);
  return controller;
}
