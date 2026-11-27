import { createContext, useContext, useLayoutEffect } from "react";
import type {
  PanoVideoCaptionAppearance,
  PanoVideoController,
  PanoVideoControlsOptions,
} from "./types";

type VideoRecovery = {
  sourceKey: string;
  time: number;
  playing: boolean;
  rate: number;
  muted: boolean;
  volume: number;
  variantId: string;
  trackId: string | null;
};

export type PanoVideoHost = {
  controller: PanoVideoController | null;
  visibleSourceKey: string | null;
  xrRecovery: VideoRecovery | null;
  controls: boolean | PanoVideoControlsOptions;
  captions: boolean | PanoVideoCaptionAppearance;
  vrControls?: boolean;
  vrCaptions: boolean;
  clickToTogglePlayback: boolean;
  showCenterPlayButton: boolean;
  activationPlayEvents: WeakMap<Event, PanoVideoController>;
  controlClaims: number;
  revision: number;
  listeners: Set<() => void>;
};

export const PanoVideoHostContext = createContext<PanoVideoHost | null>(null);

export const DefaultPanoVideoControlsContext = createContext(false);

export function createPanoVideoHost(): PanoVideoHost {
  return {
    controller: null,
    visibleSourceKey: null,
    xrRecovery: null,
    controls: true,
    captions: true,
    vrCaptions: true,
    clickToTogglePlayback: false,
    showCenterPlayButton: false,
    activationPlayEvents: new WeakMap(),
    controlClaims: 0,
    revision: 0,
    listeners: new Set(),
  };
}

export function resetPanoVideoHost(host: PanoVideoHost): void {
  host.controller = null;
  host.visibleSourceKey = null;
  host.xrRecovery = null;
  host.controls = true;
  host.captions = true;
  host.vrControls = undefined;
  host.vrCaptions = true;
  host.clickToTogglePlayback = false;
  host.showCenterPlayButton = false;
  host.activationPlayEvents = new WeakMap();
  host.controlClaims = 0;
  notifyPanoVideoHost(host);
}

export function capturePanoVideoXRRecovery(host: PanoVideoHost): void {
  const sourceKey = host.visibleSourceKey;
  const snapshot = host.controller?.getSnapshot();
  if (!sourceKey || !snapshot) return;
  host.xrRecovery = {
    sourceKey,
    time: snapshot.currentTime,
    playing: snapshot.playing,
    rate: snapshot.playbackRate,
    muted: snapshot.muted,
    volume: snapshot.volume,
    variantId: snapshot.variantId,
    trackId: snapshot.trackId,
  };
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

/** Registers a custom replacement in both the screen and immersive viewers. */
export function useClaimPanoVideoControls(): void {
  const host = useContext(PanoVideoHostContext);
  const isDefault = useContext(DefaultPanoVideoControlsContext);
  useLayoutEffect(() => {
    if (!host || isDefault) return;
    host.controlClaims += 1;
    if (!isProduction() && host.controlClaims > 1) {
      console.warn(
        "PanoViewer: multiple <PanoVideoControls> instances are mounted. Render at most one.",
      );
    }
    notifyPanoVideoHost(host);
    return () => {
      host.controlClaims -= 1;
      notifyPanoVideoHost(host);
    };
  }, [host, isDefault]);
}
