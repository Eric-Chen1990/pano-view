export type GazeAction = {
  id: unknown;
  enabled?: () => boolean;
  activate?: () => void;
  update?: (seconds: number) => void;
  /** Optional pause between held updates; update receives one interval in seconds. */
  repeatIntervalMs?: number;
  end?: () => void;
};

/** Shared by gaze and pointer holds; timing lives outside recreated render actions. */
export function createActionUpdateState() {
  let id: unknown = null;
  let started = false;
  let elapsed = 0;
  const reset = () => {
    id = null;
    started = false;
    elapsed = 0;
  };
  return {
    reset,
    tick(action: GazeAction, seconds: number) {
      if (
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        seconds > 0.25 ||
        action.enabled?.() === false
      ) {
        reset();
        return;
      }
      if (action.id !== id) {
        reset();
        id = action.id;
      }
      const interval = action.repeatIntervalMs;
      if (
        interval === undefined ||
        !Number.isFinite(interval) ||
        interval <= 0
      ) {
        action.update?.(Math.min(seconds, 0.048));
        return;
      }
      if (started) {
        elapsed += seconds * 1000;
        if (elapsed + 1e-6 < interval) return;
      }
      started = true;
      // Do not replay missed steps after a slow frame or interruption.
      elapsed = 0;
      action.update?.(interval / 1000);
    },
  };
}

/** One timer per logical target, independent of frame rate and DOM repainting. */
export function createGazeActionState() {
  const updates = createActionUpdateState();
  let current: GazeAction | null = null;
  let elapsed = 0;
  let active = false;
  const stop = () => {
    updates.reset();
    if (active) current?.end?.();
    current = null;
    elapsed = 0;
    active = false;
  };
  return {
    stop,
    tick(target: GazeAction | null, seconds: number, dwellMs: number) {
      if (
        !Number.isFinite(seconds) ||
        seconds > 0.25 ||
        seconds < 0 ||
        dwellMs <= 0 ||
        target?.enabled?.() === false
      ) {
        stop();
        return 0;
      }
      if (target?.id !== current?.id) {
        stop();
        current = target;
        return 0;
      }
      if (!current || !target) return 0;
      current = target;
      if (!active) {
        elapsed += Math.min(seconds, 0.048) * 1000;
        if (elapsed >= dwellMs) {
          active = true;
          current.activate?.();
        }
      }
      if (active) updates.tick(current, seconds);
      return active ? 0 : Math.min(1, elapsed / dwellMs);
    },
  };
}

/** Immersive session visibility takes precedence over the companion DOM page. */
export function canRunSpatialGaze(
  documentHidden: boolean,
  sessionVisibility: string | undefined,
  suppressedUntil: number,
  now: number
) {
  const visible =
    sessionVisibility === undefined
      ? !documentHidden
      : sessionVisibility === "visible";
  return visible && now >= suppressedUntil;
}
