import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import type { PanoViewerHandle } from "./types";

export type UsePanoViewerResult = PanoViewerHandle & {
  ref: RefObject<PanoViewerHandle | null>;
};

function createPanoViewerHandle(
  ref: RefObject<PanoViewerHandle | null>,
): PanoViewerHandle {
  return {
    getView: () => ref.current?.getView() ?? { yaw: 0, pitch: 0, fov: 75 },
    setView: (view, options) => {
      ref.current?.setView(view, options);
    },
    reset: () => {
      ref.current?.reset();
    },
    activateMedia: () => ref.current?.activateMedia() ?? Promise.resolve(),
    enterFullscreen: () => ref.current?.enterFullscreen() ?? Promise.resolve(),
    exitFullscreen: () => ref.current?.exitFullscreen() ?? Promise.resolve(),
    toggleFullscreen: () =>
      ref.current?.toggleFullscreen() ?? Promise.resolve(),
    isFullscreen: () => ref.current?.isFullscreen() ?? false,
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

export function usePanoViewer(): UsePanoViewerResult {
  const ref = useRef<PanoViewerHandle | null>(null);
  const handle = useMemo(() => createPanoViewerHandle(ref), []);
  return useMemo(() => ({ ref, ...handle }), [handle]);
}
