import type { XRStore } from "@react-three/xr";
import { createContext } from "react";
import type { WebVRStereoView } from "./stereo-view";
import type { WebVRChrome, WebVRMode, WebVRSettings } from "./types";

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
};

export type WebVRHost = {
  controller: WebVRController | null;
  revision: number;
  snapshot: WebVRHostSnapshot;
  listeners: Set<() => void>;
};

export type WebVRRuntimeApi = {
  host: WebVRHost;
  xrStore: XRStore;
  stereoView: WebVRStereoView;
};

export const WebVRRuntimeContext = createContext<WebVRRuntimeApi | null>(null);

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
    },
    listeners: new Set(),
  };
}

export function updateWebVRHost(
  host: WebVRHost,
  snapshot: Partial<WebVRHostSnapshot>,
): void {
  host.snapshot = { ...host.snapshot, ...snapshot };
  host.revision += 1;
  for (const listener of host.listeners) {
    listener();
  }
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
