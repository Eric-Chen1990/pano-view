export type SceneRuntimePhase =
  | "idle"
  | "preloading"
  | "capturing"
  | "recapturing"
  | "awaitingDetail"
  | "transitioning";

/**
 * Hidden incoming scenes preload the preview and base level. Full detail starts
 * after the outgoing snapshot is taken, including while the blend is running.
 */
export function pendingSceneUsesBaseLayer(
  phase: SceneRuntimePhase,
  isPending: boolean,
): boolean {
  return isPending && (phase === "preloading" || phase === "capturing");
}

/** Negative, non-finite, and omitted waits start the blend with no extra delay. */
export function normalizeTransitionWaitMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
}

export type DetailWait = {
  generation: number;
  sceneId: string;
  deadline: number;
};

export function planDetailHold(input: {
  waitMs: number;
  now: number;
  generation: number;
  sceneId: string;
}): DetailWait | null {
  if (input.waitMs <= 0) {
    return null;
  }
  return {
    generation: input.generation,
    sceneId: input.sceneId,
    deadline: input.now + input.waitMs,
  };
}

export type DetailWaitSignal =
  | { kind: "ready"; generation: number; sceneId: string }
  | { kind: "timeout"; generation: number; now: number }
  | { kind: "cancel"; generation: number };

export function acceptDetailWait(
  wait: DetailWait | null,
  signal: DetailWaitSignal,
): { wait: DetailWait | null; start: boolean } {
  if (!wait) {
    return { wait: null, start: false };
  }
  switch (signal.kind) {
    case "ready":
      if (signal.generation !== wait.generation || signal.sceneId !== wait.sceneId) {
        return { wait, start: false };
      }
      return { wait: null, start: true };
    case "timeout":
      if (signal.generation !== wait.generation || signal.now < wait.deadline) {
        return { wait, start: false };
      }
      return { wait: null, start: true };
    case "cancel":
      if (signal.generation !== wait.generation) {
        return { wait, start: false };
      }
      return { wait: null, start: false };
    default: {
      const exhaustive: never = signal;
      return exhaustive;
    }
  }
}

export function phaseAfterSnapshot(
  preset: "none" | string,
  hold: DetailWait | null,
): "idle" | "awaitingDetail" | "transitioning" {
  if (hold) {
    return "awaitingDetail";
  }
  if (preset === "none") {
    return "idle";
  }
  return "transitioning";
}
