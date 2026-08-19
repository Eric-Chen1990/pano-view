import { createContext, useContext } from "react";
import type {
  PanoVideoCaptionAppearance,
  PanoVideoController,
  PanoVideoControlsAppearance,
} from "./types";

export type PanoVideoHost = {
  controller: PanoVideoController | null;
  controls: boolean | PanoVideoControlsAppearance;
  captions: boolean | PanoVideoCaptionAppearance;
  controlClaims: number;
  revision: number;
  listeners: Set<() => void>;
};

export const PanoVideoHostContext = createContext<PanoVideoHost | null>(null);

export const DefaultPanoVideoControlsContext = createContext(false);

export function createPanoVideoHost(): PanoVideoHost {
  return {
    controller: null,
    controls: true,
    captions: true,
    controlClaims: 0,
    revision: 0,
    listeners: new Set(),
  };
}

export function resetPanoVideoHost(host: PanoVideoHost): void {
  host.controller = null;
  host.controls = true;
  host.captions = true;
  host.controlClaims = 0;
  notifyPanoVideoHost(host);
}

export function notifyPanoVideoHost(host: PanoVideoHost): void {
  host.revision += 1;
  host.listeners.forEach((listener) => {
    listener();
  });
}

export function subscribePanoVideoHost(
  host: PanoVideoHost,
  onStoreChange: () => void,
): () => void {
  host.listeners.add(onStoreChange);
  return () => {
    host.listeners.delete(onStoreChange);
  };
}

/** Host registration plus the active controller's playback snapshot. */
export function subscribePanoVideoStore(
  host: PanoVideoHost,
  onStoreChange: () => void,
): () => void {
  let unsubscribeController =
    host.controller?.subscribe(onStoreChange) ?? (() => {});
  const unsubscribeHost = subscribePanoVideoHost(host, () => {
    unsubscribeController();
    unsubscribeController =
      host.controller?.subscribe(onStoreChange) ?? (() => {});
    onStoreChange();
  });
  return () => {
    unsubscribeController();
    unsubscribeHost();
  };
}

export function getPanoVideoHostRevision(host: PanoVideoHost): number {
  return host.revision;
}

function isProduction(): boolean {
  const nodeEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV;
  return nodeEnv === "production";
}

/** Registers a user PanoVideoControls instance during render so the default slot can skip. */
export function useClaimPanoVideoControls(): void {
  const host = useContext(PanoVideoHostContext);
  const isDefault = useContext(DefaultPanoVideoControlsContext);
  if (!host || isDefault) {
    return;
  }
  host.controlClaims += 1;
  if (!isProduction() && host.controlClaims > 1) {
    console.warn(
      "PanoViewer: multiple <PanoVideoControls> instances are mounted. Render at most one.",
    );
  }
}
