import { useSyncExternalStore } from "react";
import type { PanoContextMenuActionsApi } from "../pano-context-menu";
import {
  getPanoVideoHostRevision,
  subscribePanoVideoHost,
  type PanoVideoHost,
} from "./host";
import { PanoVideoCaptionsOverlay } from "./pano-video-captions";
import { PanoVideoControlsHud } from "./pano-video-controls";

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
