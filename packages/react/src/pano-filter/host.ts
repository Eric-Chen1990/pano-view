import { createContext, useContext, useSyncExternalStore } from "react";
import {
  DEFAULT_PANO_FILTER_SNAPSHOT,
  type PanoFilterSnapshot,
} from "./presets";

export type PanoFilterHost = {
  snapshot: PanoFilterSnapshot;
  claims: number;
  revision: number;
  listeners: Set<() => void>;
};

export const PanoFilterHostContext = createContext<PanoFilterHost | null>(null);

export function createPanoFilterHost(): PanoFilterHost {
  return {
    snapshot: { ...DEFAULT_PANO_FILTER_SNAPSHOT },
    claims: 0,
    revision: 0,
    listeners: new Set(),
  };
}

export function notifyPanoFilterHost(host: PanoFilterHost): void {
  host.revision += 1;
  host.listeners.forEach((listener) => {
    listener();
  });
}

export function setPanoFilterSnapshot(
  host: PanoFilterHost,
  snapshot: PanoFilterSnapshot,
): void {
  host.snapshot = snapshot;
  notifyPanoFilterHost(host);
}

export function resetPanoFilterHost(host: PanoFilterHost): void {
  host.snapshot = { ...DEFAULT_PANO_FILTER_SNAPSHOT };
  notifyPanoFilterHost(host);
}

export function claimPanoFilter(host: PanoFilterHost): void {
  host.claims += 1;
  if (!isProduction() && host.claims > 1) {
    console.warn(
      "PanoViewer: multiple <PanoFilter> instances are mounted. Render at most one.",
    );
  }
}

export function releasePanoFilter(host: PanoFilterHost): void {
  host.claims = Math.max(0, host.claims - 1);
  if (host.claims === 0) {
    resetPanoFilterHost(host);
  }
}

export function subscribePanoFilterHost(
  host: PanoFilterHost,
  onStoreChange: () => void,
): () => void {
  host.listeners.add(onStoreChange);
  return () => {
    host.listeners.delete(onStoreChange);
  };
}

export function getPanoFilterHostRevision(host: PanoFilterHost): number {
  return host.revision;
}

const INACTIVE_FILTER_SNAPSHOT: PanoFilterSnapshot = {
  ...DEFAULT_PANO_FILTER_SNAPSHOT,
};

function subscribeNoop(): () => void {
  return () => {};
}

export function usePanoFilterSnapshot(): PanoFilterSnapshot {
  const host = useContext(PanoFilterHostContext);
  const revision = useSyncExternalStore(
    host
      ? (onStoreChange) => subscribePanoFilterHost(host, onStoreChange)
      : subscribeNoop,
    () => (host ? getPanoFilterHostRevision(host) : 0),
    () => (host ? getPanoFilterHostRevision(host) : 0),
  );
  void revision;
  return host?.snapshot ?? INACTIVE_FILTER_SNAPSHOT;
}

function isProduction(): boolean {
  const nodeEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV;
  return nodeEnv === "production";
}
