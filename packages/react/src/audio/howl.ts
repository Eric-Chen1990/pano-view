import { Howl, Howler } from "howler";

Howler.autoUnlock = true;

export type AudioSourceList = string | readonly string[];

export type UnlockingHowlCallbacks = {
  isActive: () => boolean;
  shouldRetryPlay: () => boolean;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onLoadError?: (error: unknown) => void;
  onPlayError?: (error: unknown) => void;
};

export type CreateUnlockingHowlOptions = UnlockingHowlCallbacks & {
  src: readonly string[];
  loop: boolean;
  crossOrigin?: "" | "anonymous" | "use-credentials";
};

export type UnlockingHowlHandle = {
  howl: Howl;
  dispose: () => void;
};

/** Resume Howler's shared audio context from a direct user gesture. */
export function resumePanoAudio(): Promise<void> {
  if (!Howler.ctx || Howler.ctx.state === "running") {
    return Promise.resolve();
  }
  return Howler.ctx.resume();
}

export function sourceList(
  src: AudioSourceList | undefined | null,
): string[] {
  if (src == null) {
    return [];
  }
  if (typeof src === "string") {
    return src ? [src] : [];
  }
  return src.filter((item): item is string => Boolean(item));
}

export function sourcesKey(src: AudioSourceList | undefined | null): string {
  return sourceList(src).join("\0");
}

export function createUnlockingHowl({
  src,
  loop,
  crossOrigin,
  isActive,
  shouldRetryPlay,
  onEnded,
  onPlay,
  onPause,
  onLoadError,
  onPlayError,
}: CreateUnlockingHowlOptions): UnlockingHowlHandle {
  let disposed = false;
  let blockedNotified = false;
  const unlockListeners: Array<{
    type: "pointerdown" | "keydown";
    listener: () => void;
  }> = [];

  const removeUnlockListeners = () => {
    for (const { type, listener } of unlockListeners) {
      window.removeEventListener(type, listener, true);
    }
    unlockListeners.length = 0;
  };

  const instance = new Howl({
    src: [...src],
    html5: false,
    preload: true,
    loop,
    xhr:
      crossOrigin === "use-credentials"
        ? { withCredentials: true }
        : undefined,
    onend: () => {
      if (disposed || !isActive() || instance.loop()) {
        return;
      }
      onEnded?.();
    },
    onplay: () => {
      if (!disposed && isActive()) {
        onPlay?.();
      }
    },
    onpause: () => {
      if (!disposed && isActive()) {
        onPause?.();
      }
    },
    onloaderror: (_soundId, error) => {
      if (!disposed && isActive()) {
        onLoadError?.(error);
      }
    },
    onplayerror: (_soundId, error) => {
      if (disposed || !isActive()) {
        return;
      }
      if (!blockedNotified) {
        blockedNotified = true;
        onPlayError?.(error);
      }
      const retry = () => {
        removeUnlockListeners();
        if (!disposed && isActive() && shouldRetryPlay()) {
          void resumePanoAudio();
          instance.play();
        }
      };
      removeUnlockListeners();
      unlockListeners.push({ type: "pointerdown", listener: retry });
      unlockListeners.push({ type: "keydown", listener: retry });
      window.addEventListener("pointerdown", retry, { capture: true });
      window.addEventListener("keydown", retry, { capture: true });
    },
  });

  return {
    howl: instance,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      removeUnlockListeners();
      instance.unload();
    },
  };
}
