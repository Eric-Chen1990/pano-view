import { NATIVE_IFRAME_SUPPORT } from "./types";
import { useMemo } from "react";
import type { RefObject } from "react";
import type { PanoViewerHandle } from "./types";
import { IDLE_SCENE_LOAD_PROGRESS, type SceneLoadProgress } from "./scene-load-progress";
import { EMPTY_WEBVR_STATE } from "./webvr/host";

export type UsePanoViewerResult = PanoViewerHandle & {
  ref: RefObject<PanoViewerHandle | null>;
};

function createPanoViewerHandle(
  ref: RefObject<PanoViewerHandle | null>,
  sceneLoad: ReturnType<typeof createSceneLoadRef>,
): PanoViewerHandle {
  return {
    getRendererBackend: () => ref.current?.getRendererBackend() ?? null,
    captureScreenshot: (options) => ref.current?.captureScreenshot(options) ??
      Promise.reject(new DOMException("The viewer is not mounted.", "InvalidStateError")),
    getView: () => ref.current?.getView() ?? { yaw: 0, pitch: 0, fov: 75 },
    setView: (view, options) => {
      ref.current?.setView(view, options);
    },
    reset: () => {
      ref.current?.reset();
    },
    lookTo: (position, options) =>
      ref.current?.lookTo(position, options) ??
      Promise.resolve({ status: "cancelled" }),
    moveTo: (position, options) =>
      ref.current?.moveTo(position, options) ??
      Promise.resolve({ status: "cancelled" }),
    zoomTo: (fov, options) =>
      ref.current?.zoomTo(fov, options) ??
      Promise.resolve({ status: "cancelled" }),
    getHotspotCorners: (id) => ref.current?.getHotspotCorners(id) ?? null,
    lookToHotspot: (id, options) =>
      ref.current?.lookToHotspot(id, options) ??
      Promise.resolve({ status: "not-found" }),
    activateMedia: () => ref.current?.activateMedia() ?? Promise.resolve(),
    enterFullscreen: () => ref.current?.enterFullscreen() ?? Promise.resolve(),
    exitFullscreen: () => ref.current?.exitFullscreen() ?? Promise.resolve(),
    toggleFullscreen: () =>
      ref.current?.toggleFullscreen() ?? Promise.resolve(),
    isFullscreen: () => ref.current?.isFullscreen() ?? false,
    getSceneLoadProgress: sceneLoad.getSnapshot,
    subscribeSceneLoadProgress: sceneLoad.subscribe,
    setScene: (id) => ref.current?.setScene(id) ?? false,
    nextScene: () => ref.current?.nextScene() ?? false,
    previousScene: () => ref.current?.previousScene() ?? false,
    getActiveSceneId: () => ref.current?.getActiveSceneId() ?? null,
    getSceneIds: () => ref.current?.getSceneIds() ?? [],
    isSceneTransitioning: () => ref.current?.isSceneTransitioning() ?? false,
    enterVR: () => ref.current?.enterVR() ?? Promise.resolve(false),
    exitVR: () => ref.current?.exitVR() ?? Promise.resolve(),
    toggleVR: () => ref.current?.toggleVR() ?? Promise.resolve(false),
    isVRAvailable: () => ref.current?.isVRAvailable() ?? false,
    isVREnabled: () => ref.current?.isVREnabled() ?? false,
    getVRMode: () => ref.current?.getVRMode() ?? null,
    getVRState: () => ref.current?.getVRState() ?? EMPTY_WEBVR_STATE,
    getIframeSupport: () =>
      ref.current?.getIframeSupport() ?? NATIVE_IFRAME_SUPPORT,
    subscribeVR: (onStoreChange) => {
      // The imperative handle may attach one frame after useSyncExternalStore
      // first subscribes. Retry briefly so host buttons stay reactive.
      let disposed = false;
      let unsubscribe: (() => void) | undefined;
      const timers: number[] = [];

      const attach = () => {
        if (disposed || unsubscribe) {
          return;
        }
        const handle = ref.current;
        if (!handle) {
          return;
        }
        unsubscribe = handle.subscribeVR(onStoreChange);
        onStoreChange();
      };

      attach();
      if (typeof window !== "undefined") {
        for (const delay of [0, 16, 50, 100, 250]) {
          timers.push(window.setTimeout(attach, delay));
        }
      }

      return () => {
        disposed = true;
        for (const id of timers) {
          window.clearTimeout(id);
        }
        unsubscribe?.();
      };
    },
    requestVRPermission: () =>
      ref.current?.requestVRPermission() ?? Promise.resolve(false),
    getVideo: () => ref.current?.getVideo() ?? null,
    subscribeVideo: (onStoreChange) =>
      ref.current?.subscribeVideo(onStoreChange) ?? (() => {}),
    playVideo: () => ref.current?.playVideo() ?? Promise.resolve(),
    pauseVideo: () => {
      ref.current?.pauseVideo();
    },
    toggleVideo: () => {
      ref.current?.toggleVideo();
    },
    seekVideo: (time) => {
      ref.current?.seekVideo(time);
    },
    setVideoVolume: (volume) => {
      ref.current?.setVideoVolume(volume);
    },
    setVideoMuted: (muted) => {
      ref.current?.setVideoMuted(muted);
    },
    toggleVideoMuted: () => {
      ref.current?.toggleVideoMuted();
    },
    getBackgroundAudio: () => ref.current?.getBackgroundAudio() ?? null,
    subscribeBackgroundAudio: (onStoreChange) =>
      ref.current?.subscribeBackgroundAudio(onStoreChange) ?? (() => {}),
    playBackgroundAudio: () =>
      ref.current?.playBackgroundAudio() ?? Promise.resolve(),
    pauseBackgroundAudio: () => {
      ref.current?.pauseBackgroundAudio();
    },
    toggleBackgroundAudio: () => {
      ref.current?.toggleBackgroundAudio();
    },
    setBackgroundAudioVolume: (volume) => {
      ref.current?.setBackgroundAudioVolume(volume);
    },
    setBackgroundAudioMuted: (muted) => {
      ref.current?.setBackgroundAudioMuted(muted);
    },
    toggleBackgroundAudioMuted: () => {
      ref.current?.toggleBackgroundAudioMuted();
    },
    startAutoRotate: () => {
      ref.current?.startAutoRotate();
    },
    stopAutoRotate: () => {
      ref.current?.stopAutoRotate();
    },
  } satisfies PanoViewerHandle;
}

type SceneLoadListener = Parameters<PanoViewerHandle["subscribeSceneLoadProgress"]>[0];

function createSceneLoadRef() {
  let handle: PanoViewerHandle | null = null;
  let unsubscribe: (() => void) | undefined;
  let last: SceneLoadProgress = IDLE_SCENE_LOAD_PROGRESS;
  const listeners = new Set<SceneLoadListener>();
  const getSnapshot = () => handle?.getSceneLoadProgress() ?? IDLE_SCENE_LOAD_PROGRESS;
  const notify = () => {
    const next = getSnapshot();
    if (last === next) return;
    last = next;
    for (const listener of listeners) listener(next);
  };
  const ref: RefObject<PanoViewerHandle | null> = {
    get current() { return handle; },
    set current(next) {
      if (handle === next) return;
      unsubscribe?.();
      handle = next;
      unsubscribe = next?.subscribeSceneLoadProgress(notify);
      // React can detach and reattach the imperative handle in one commit.
      queueMicrotask(notify);
    },
  };
  return {
    ref,
    getSnapshot,
    subscribe(listener: SceneLoadListener) {
      if (listeners.size === 0) last = getSnapshot();
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export function usePanoViewer(): UsePanoViewerResult {
  const sceneLoad = useMemo(createSceneLoadRef, []);
  return useMemo(() => ({
    ref: sceneLoad.ref,
    ...createPanoViewerHandle(sceneLoad.ref, sceneLoad),
  }), [sceneLoad]);
}
