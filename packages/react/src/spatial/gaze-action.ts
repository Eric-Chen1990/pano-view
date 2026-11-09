export type GazeAction = {
  id: unknown;
  enabled?: () => boolean;
  activate?: () => void;
  update?: (seconds: number) => void;
  end?: () => void;
};

/** One timer per logical target, independent of frame rate and DOM repainting. */
export function createGazeActionState() {
  let current: GazeAction | null = null;
  let elapsed = 0;
  let active = false;
  const stop = () => {
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
      if (active) current.update?.(Math.min(seconds, 0.048));
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
