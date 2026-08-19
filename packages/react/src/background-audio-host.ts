import { createContext } from "react";

export type BackgroundAudioSnapshot = {
  ready: boolean;
  playing: boolean;
  blocked: boolean;
  ended: boolean;
  muted: boolean;
  volume: number;
};

export type BackgroundAudioController = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => BackgroundAudioSnapshot;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
};

export type BackgroundAudioHost = {
  controller: BackgroundAudioController | null;
  revision: number;
  listeners: Set<() => void>;
};

export const BackgroundAudioHostContext =
  createContext<BackgroundAudioHost | null>(null);

export function createBackgroundAudioHost(): BackgroundAudioHost {
  return {
    controller: null,
    revision: 0,
    listeners: new Set(),
  };
}

export function notifyBackgroundAudioHost(host: BackgroundAudioHost): void {
  host.revision += 1;
  for (const listener of host.listeners) {
    listener();
  }
}

export function subscribeBackgroundAudioHost(
  host: BackgroundAudioHost,
  listener: () => void,
): () => void {
  host.listeners.add(listener);
  return () => {
    host.listeners.delete(listener);
  };
}
