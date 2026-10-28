type InteractionRuntime = { acquireInteractionLock: () => () => void };

/** Keeps modal leases alive even when the Canvas runtime has not mounted yet. */
export function createPanoModalHost() {
  const leases = new Set<symbol>();
  const listeners = new Set<() => void>();
  let runtime: InteractionRuntime | null = null;
  let releaseRuntime: (() => void) | undefined;

  const syncRuntime = () => {
    if (leases.size > 0 && runtime) {
      releaseRuntime ??= runtime.acquireInteractionLock();
    } else {
      releaseRuntime?.();
      releaseRuntime = undefined;
    }
  };
  const notify = () => {
    syncRuntime();
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => leases.size > 0,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    connect(next: InteractionRuntime | null) {
      if (runtime === next) return;
      releaseRuntime?.();
      releaseRuntime = undefined;
      runtime = next;
      syncRuntime();
    },
    acquire() {
      const token = Symbol();
      leases.add(token);
      notify();
      return () => {
        if (leases.delete(token)) notify();
      };
    },
  };
}

export type PanoModalHost = ReturnType<typeof createPanoModalHost>;
