import { usePanoUiTranslation } from "../ui-translation";
import { useSyncExternalStore } from "react";
import type { PanoContextMenuActionsApi } from "../pano-context-menu";
import { subscribeWebVRHost, type WebVRHost } from "../webvr/host";
import {
  getPanoVideoHostRevision,
  subscribePanoVideoHost,
  type PanoVideoHost,
} from "./host";
import { PanoVideoCaptionsOverlay } from "./pano-video-captions";
import { PanoVideoControlsHud } from "./pano-video-controls";
import type { PanoVideoController } from "./types";

function CenterPlayButton({ controller }: { controller: PanoVideoController }) {
  const t = usePanoUiTranslation();
  const playbackState = useSyncExternalStore(
    controller.subscribe,
    () => controller.getSnapshot().playbackState,
  );

  if (playbackState === "playing") return null;

  return (
    <button
      aria-label={playbackState === "ended" ? t("Replay video") : t("Play video")}
      className="pano-video-center-play"
      data-pano-video-center-play=""
      onClick={() => void controller.play()}
      type="button"
    >
      <svg aria-hidden="true" fill="currentColor" height="36" viewBox="0 0 16 16" width="36">
        <path d="M5 3.2v9.6L13 8z" />
      </svg>
    </button>
  );
}

export function PanoVideoChromeBridge({
  fullscreen,
  host,
  overlayElement,
  webVRHost,
}: {
  fullscreen: PanoContextMenuActionsApi;
  host: PanoVideoHost;
  overlayElement: HTMLDivElement | null;
  webVRHost: WebVRHost;
}) {
  useSyncExternalStore(
    (onStoreChange) => subscribePanoVideoHost(host, onStoreChange),
    () => getPanoVideoHostRevision(host),
    () => getPanoVideoHostRevision(host),
  );
  const vrButtonState = useSyncExternalStore(
    (listener) => subscribeWebVRHost(webVRHost, listener),
    () => {
      const { available, entering, mode } = webVRHost.snapshot;
      return available && mode === null ? (entering ? "pending" : "ready") : null;
    },
    () => null,
  );

  if (!overlayElement) {
    return null;
  }

  const showDefaultControls =
    host.controller !== null &&
    host.controls !== false &&
    host.controlClaims === 0;
  const options = typeof host.controls === "object" ? host.controls : undefined;

  return (
    <>
      {host.showCenterPlayButton && host.controller ? (
        <CenterPlayButton controller={host.controller} />
      ) : null}
      {showDefaultControls ? (
        <PanoVideoControlsHud
          appearance={options}
          buttons={options?.buttons}
          controller={host.controller!}
          fullscreen={fullscreen}
          overlayElement={overlayElement}
          vrEntry={vrButtonState ? {
            disabled: vrButtonState === "pending",
            onEnter: () => void webVRHost.controller?.enterVR(),
          } : undefined}
        />
      ) : null}
      {host.captions !== false && host.controller ? (
        <PanoVideoCaptionsOverlay controller={host.controller} />
      ) : null}
    </>
  );
}
