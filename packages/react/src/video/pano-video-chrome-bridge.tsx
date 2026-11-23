import { usePanoUiTranslation } from "../ui-translation";
import { useSyncExternalStore } from "react";
import type { PanoContextMenuActionsApi } from "../pano-context-menu";
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
}: {
  fullscreen: PanoContextMenuActionsApi;
  host: PanoVideoHost;
  overlayElement: HTMLDivElement | null;
}) {
  useSyncExternalStore(
    (onStoreChange) => subscribePanoVideoHost(host, onStoreChange),
    () => getPanoVideoHostRevision(host),
    () => getPanoVideoHostRevision(host),
  );

  if (!overlayElement) {
    return null;
  }

  const showDefaultControls =
    host.controller !== null &&
    host.controls !== false &&
    host.controlClaims === 0;

  return (
    <>
      {host.showCenterPlayButton && host.controller ? (
        <CenterPlayButton controller={host.controller} />
      ) : null}
      {showDefaultControls ? (
        <PanoVideoControlsHud
          appearance={
            typeof host.controls === "object" ? host.controls : undefined
          }
          controller={host.controller!}
          fullscreen={fullscreen}
          overlayElement={overlayElement}
        />
      ) : null}
      {host.captions !== false && host.controller ? (
        <PanoVideoCaptionsOverlay controller={host.controller} />
      ) : null}
    </>
  );
}
