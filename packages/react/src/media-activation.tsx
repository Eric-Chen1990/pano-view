import { createContext, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type PanoMediaActivationControls = {
  /** Resume the shared Web Audio context while a user gesture is still active. */
  resumeAudio: () => Promise<void>;
  /** Start the mounted 360 video. Set `unmute` for the usual tour-entry flow. */
  playVideo: (options?: { unmute?: boolean }) => Promise<boolean>;
  /** Start an uncontrolled mounted BackgroundAudio instance, if one is available. */
  playBackgroundAudio: () => boolean;
};

export type PanoMediaActivationOptions = {
  /** Message shown on the first-interaction button. Defaults to "Tap to enable sound". */
  message?: ReactNode;
  /** Accessible name for the first-interaction button. */
  ariaLabel?: string;
  className?: string;
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

export function PanoMediaActivationOverlay({
  ariaLabel = "Enable sound",
  className,
  message = "Tap to enable sound",
  onActivate,
}: PanoMediaActivationOptions & { onActivate: () => void }) {
  return (
    <div className={cn("pano-media-activation", className)}>
      <button
        aria-label={ariaLabel}
        className="pano-media-activation-button"
        onClick={onActivate}
        type="button"
      >
        {message}
      </button>
    </div>
  );
}
