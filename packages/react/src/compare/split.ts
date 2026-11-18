import { useLayoutEffect, useState } from "react";

export function normalizeCompareSplit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

type SplitListener = (value: number) => void;

export function createCompareSplit(
  defaultSplit: number,
  controlled?: number,
  onChange?: SplitListener,
) {
  let local = normalizeCompareSplit(defaultSplit);
  let value = normalizeCompareSplit(controlled ?? local);
  const listeners = new Set<SplitListener>();

  function publish(next: number) {
    if (next === value) return;
    value = next;
    for (const listener of listeners) listener(value);
  }

  return {
    get: () => value,
    subscribe(listener: SplitListener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    configure(next: number | undefined, callback?: SplitListener) {
      controlled = next;
      onChange = callback;
      publish(normalizeCompareSplit(controlled ?? local));
    },
    change(requested: number) {
      const next = normalizeCompareSplit(requested);
      if (controlled === undefined) {
        local = next;
        publish(next);
      }
      onChange?.(next);
    },
  };
}

export function useCompareSplit(defaultSplit: number, controlled?: number, onChange?: SplitListener) {
  const [split] = useState(() => createCompareSplit(defaultSplit, controlled, onChange));
  useLayoutEffect(() => split.configure(controlled, onChange), [split, controlled, onChange]);
  return split;
}
