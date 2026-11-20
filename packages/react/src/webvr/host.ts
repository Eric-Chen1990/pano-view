import { NATIVE_IFRAME_SUPPORT, SPATIAL_IFRAME_SUPPORT } from "../types";
import { DEFAULT_WEBVR_SETTINGS } from "./profiles";
import type { XRStore } from "@react-three/xr";
import { createContext } from "react";
import type { WebVRHotspotView, WebVRStereoView } from "./stereo-view";
import type {
  WebVRChrome,
  WebVRMode,
  WebVRSettings,
  WebVRState,
} from "./types";

export type WebVRController = {
  enterVR: () => Promise<boolean>;
  exitVR: () => Promise<void>;
  toggleVR: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
  openSetup: () => void;
  closeSetup: () => void;
  updateSettings: (settings: WebVRSettings) => void;
  resetSettings: () => void;
};

export type WebVRHostSnapshot = {
  pointerLocked: boolean;
  screensizeStatus: "idle" | "loading" | "detected" | "unknown";
  screensizeManaged: boolean;
  profileManaged: boolean;
  profileLabel: string;
  input?: WebVRState["input"];
  available: boolean;
  chrome: WebVRChrome;
  mode: WebVRMode | null;
  setupOpen: boolean;
  settings: WebVRSettings;
  /** Detected diagonal inches when settings.screensize is `"auto"`. */
  detectedScreensize: number | null;
};

export type WebVRHost = {
  controller: WebVRController | null;
  pendingXR: { session: XRSession; connecting: boolean; finish: (entered: boolean) => void } | null;
  requestingXR: boolean;
  hotspotReferenceHeight: number;
  revision: number;
  snapshot: WebVRHostSnapshot;
  /** Stable reference for useSyncExternalStore when available/mode are unchanged. */
  state: WebVRState;
  listeners: Set<() => void>;
};

export type WebVRRuntimeApi = {
  host: WebVRHost;
  xrStore: XRStore;
  mode: WebVRMode | null;
  stereoView: WebVRStereoView;
  xrHeadView: WebVRHotspotView;
};

export const WebVRRuntimeContext = createContext<WebVRRuntimeApi | null>(null);

export function getWebVRHotspotView(runtime: WebVRRuntimeApi, presenting: boolean) {
  if (presenting) return runtime.xrHeadView;
  return runtime.stereoView.active ? runtime.stereoView.hotspotView : null;
}

export const EMPTY_WEBVR_STATE: WebVRState = Object.freeze({
  available: false,
  enabled: false,
  mode: null,
});

function createWebVRState(
  available: boolean,
  mode: WebVRMode | null,
): WebVRState {
  return Object.freeze({
    available,
    enabled: mode !== null,
    mode,
  });
}

export function createWebVRHost(): WebVRHost {
  return {
    controller: null,
    pendingXR: null,
    requestingXR: false,
    hotspotReferenceHeight: 1,
    revision: 0,
    snapshot: {
      available: false,
      chrome: true,
      mode: null,
      setupOpen: false,
      settings: { ...DEFAULT_WEBVR_SETTINGS },
      pointerLocked: false,
      screensizeStatus: "idle",
      screensizeManaged: false,
      profileManaged: false,
      profileLabel: "No Distortion",
      detectedScreensize: null,
    },
    state: EMPTY_WEBVR_STATE,
    listeners: new Set(),
  };
}

export function updateWebVRHost(
  host: WebVRHost,
  snapshot: Partial<WebVRHostSnapshot>,
): void {
  const previous = host.snapshot;
  const next = { ...previous, ...snapshot };
  host.snapshot = next;
  host.revision += 1;

  if (
    previous.available !== next.available ||
    previous.mode !== next.mode ||
    previous.input !== next.input
  ) {
    host.state = Object.freeze({
      ...createWebVRState(next.available, next.mode),
      ...(next.input ? { input: next.input } : {}),
    });
  }

  for (const listener of host.listeners) {
    listener();
  }
}

export function getWebVRState(host: WebVRHost): WebVRState {
  return host.state;
}

export function subscribeWebVRHost(
  host: WebVRHost,
  listener: () => void,
): () => void {
  host.listeners.add(listener);
  return () => {
    host.listeners.delete(listener);
  };
}

/** All current VR modes use spatial snapshot panels, with DOM overlays disabled. */
export function getWebVRIframeSupport(host: WebVRHost) {
  return host.snapshot.mode === null
    ? NATIVE_IFRAME_SUPPORT
    : SPATIAL_IFRAME_SUPPORT;
}
