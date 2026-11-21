import { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";

export type SceneLoadProgress = Readonly<
  | { status: "idle"; sceneId: null; percent: null }
  | { status: "loading"; sceneId: string | null; percent: number | null }
  | { status: "ready"; sceneId: string | null; percent: 100 }
  | { status: "error"; sceneId: string | null; percent: null; error: unknown }
>;

type Listener = (progress: SceneLoadProgress) => void;

export const IDLE_SCENE_LOAD_PROGRESS: SceneLoadProgress = Object.freeze({
  status: "idle",
  sceneId: null,
  percent: null,
});

export function createSceneLoadProgressStore() {
  let snapshot: SceneLoadProgress = IDLE_SCENE_LOAD_PROGRESS;
  let attempt: { owner: object } | undefined;
  let loadingAttempt: Readonly<{ startedAt: number }> | null = null;
  const listeners = new Set<Listener>();

  function publish(next: SceneLoadProgress, newAttempt = false) {
    if (
      !newAttempt &&
      snapshot.status === next.status &&
      snapshot.sceneId === next.sceneId &&
      snapshot.percent === next.percent &&
      (next.status !== "error" ||
        (snapshot.status === "error" && Object.is(snapshot.error, next.error)))
    ) return;
    if (next.status !== "loading") {
      loadingAttempt = null;
    } else if (newAttempt || !loadingAttempt) {
      loadingAttempt = { startedAt: performance.now() };
    }
    snapshot = Object.freeze(next);
    for (const listener of listeners) {
      if (snapshot !== next) break;
      listener(next);
    }
  }

  return {
    getSnapshot: () => snapshot,
    getLoadingAttempt: () => loadingAttempt,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    begin(owner: object, sceneId: string | null, status: "idle" | "loading" | "ready" = "loading") {
      const current = { owner };
      attempt = current;
      let finished = status === "ready";
      publish(status === "ready"
        ? { status, sceneId, percent: 100 }
        : status === "idle"
          ? IDLE_SCENE_LOAD_PROGRESS
          : { status, sceneId, percent: null }, status === "loading");
      return {
        isLoading: () => attempt === current && snapshot.status === "loading",
        loading() {
          if (attempt === current && !finished && snapshot.status !== "loading") {
            publish({ status: "loading", sceneId, percent: null });
          }
        },
        measure(loaded: number, total: number) {
          if (attempt !== current || snapshot.status !== "loading" || finished ||
              total <= 0 || loaded < 0 || loaded >= total) return;
          const percent = (loaded / total) * 100;
          if (snapshot.percent === null || percent > snapshot.percent) {
            publish({ status: "loading", sceneId, percent });
          }
        },
        ready() {
          if (attempt !== current || finished) return;
          finished = true;
          publish({ status: "ready", sceneId, percent: 100 });
        },
        fail(error: unknown) {
          if (attempt !== current || finished) return;
          publish({ status: "error", sceneId, percent: null, error });
        },
      };
    },
    release(owner: object) {
      if (attempt?.owner !== owner) return;
      attempt = undefined;
      publish(IDLE_SCENE_LOAD_PROGRESS);
    },
    reset() {
      attempt = undefined;
      publish(IDLE_SCENE_LOAD_PROGRESS);
    },
  };
}

type SceneLoadProgressStore = ReturnType<typeof createSceneLoadProgressStore>;
export type SceneLoadAttempt = ReturnType<SceneLoadProgressStore["begin"]>;
export const SceneLoadProgressContext = createContext<SceneLoadProgressStore | null>(null);

/** undefined denotes a standalone source. null suppresses auxiliary source reporting. */
export type SceneLoadReporter = Pick<SceneLoadAttempt, "isLoading" | "measure" | "fail">;
export const SceneLoadSourceContext = createContext<SceneLoadReporter | null | undefined>(undefined);

export function useStandaloneSceneLoad(
  key: unknown,
  enabled: boolean,
  deferred = false,
): { current: SceneLoadAttempt | null } {
  const store = useContext(SceneLoadProgressContext);
  const standalone = useContext(SceneLoadSourceContext) === undefined;
  const attempt = useMemo<{ current: SceneLoadAttempt | null }>(
    () => ({ current: null }), [key, enabled, store, standalone],
  );
  // Deferral is sampled when the source registers. Play resumes the same attempt.
  const deferredRef = useRef(deferred);
  deferredRef.current = deferred;
  useLayoutEffect(() => {
    if (!enabled || !store || !standalone) return;
    attempt.current = store.begin(attempt, null, deferredRef.current ? "idle" : "loading");
    return () => {
      attempt.current = null;
      store.release(attempt);
    };
  }, [attempt, enabled, standalone, store]);
  return attempt;
}
