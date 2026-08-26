import { Howler } from "howler";
import { createContext, useContext, useEffect, useRef } from "react";

export type PanoMediaActivationControls = {
  /** Resume the shared Web Audio context while a user gesture is still active. */
  resumeAudio: () => Promise<void>;
  /** Start the mounted 360 video. Set `unmute` for the usual tour-entry flow. */
  playVideo: (options?: { unmute?: boolean }) => Promise<boolean>;
  /** Start an uncontrolled mounted BackgroundAudio instance, if one is available. */
  playBackgroundAudio: () => boolean;
};

export type PanoMediaActivationOptions = {
  /**
   * Runs synchronously from the activation gesture. Start only the media your
   * experience intends to make audible; do not await before starting it.
   */
  onActivate?: (controls: PanoMediaActivationControls) => void;
};

type PanoMediaActivationHost = {
  intents: Set<symbol>;
  listeners: Set<() => void>;
  revision: number;
};

export const PanoMediaActivationHostContext =
  createContext<PanoMediaActivationHost | null>(null);

export function createPanoMediaActivationHost(): PanoMediaActivationHost {
  return { intents: new Set(), listeners: new Set(), revision: 0 };
}

function notify(host: PanoMediaActivationHost): void {
  host.revision += 1;
  for (const listener of host.listeners) {
    listener();
  }
}

export function getPanoMediaActivationRevision(host: PanoMediaActivationHost): number {
  return host.revision;
}

export function subscribePanoMediaActivation(
  host: PanoMediaActivationHost,
  listener: () => void,
): () => void {
  host.listeners.add(listener);
  return () => {
    host.listeners.delete(listener);
  };
}

export function hasPanoMediaActivationIntent(host: PanoMediaActivationHost): boolean {
  return host.intents.size > 0;
}

/**
 * Returns true when audible playback still needs a user gesture to unlock.
 * Skips waiting while transient user activation is current, or Web Audio is
 * already running (background-audio-only hosts can start immediately).
 * Sticky activation (`hasBeenActive`) is not a substitute for either.
 * A running context is not HTML video autoplay permission; the viewer keeps
 * gesture listeners when this attempt requested video and it stayed blocked.
 */
export function needsMediaGesture(): boolean {
  if (typeof navigator !== "undefined" && navigator.userActivation?.isActive) {
    return false;
  }
  if (Howler.ctx?.state === "running") {
    return false;
  }
  return true;
}

/** Registers media that intends to start playing when this Viewer mounts. */
export function usePanoMediaActivationIntent(required: boolean): void {
  const host = useContext(PanoMediaActivationHostContext);
  const keyRef = useRef<symbol | null>(null);
  if (keyRef.current === null) {
    keyRef.current = Symbol("pano-media-intent");
  }

  useEffect(() => {
    if (!host || !required) {
      return;
    }
    const key = keyRef.current!;
    host.intents.add(key);
    notify(host);
    return () => {
      host.intents.delete(key);
      notify(host);
    };
  }, [host, required]);
}
