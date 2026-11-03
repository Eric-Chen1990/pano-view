import type { XRStore } from "@react-three/xr";
import { createContext } from "react";
import type { WebVRStereoView } from "./stereo-view";
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
};

export type WebVRHostSnapshot = {
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
  revision: number;
  snapshot: WebVRHostSnapshot;
  /** Stable reference for useSyncExternalStore when available/mode are unchanged. */
  state: WebVRState;
  listeners: Set<() => void>;
};

export type WebVRRuntimeApi = {
  host: WebVRHost;
  xrStore: XRStore;
  stereoView: WebVRStereoView;
};

export const WebVRRuntimeContext = createContext<WebVRRuntimeApi | null>(null);

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
    revision: 0,
    snapshot: {
      available: false,
      chrome: true,
      mode: null,
      setupOpen: false,
      settings: { screensize: "auto", profileId: "cardboard-v1" },
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
    previous.mode !== next.mode
  ) {
    host.state = createWebVRState(next.available, next.mode);
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
