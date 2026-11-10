import { useRef, useState } from "react";
import {
  PanoOverlay,
  PanoScrollControls,
  PanoVideo,
  PanoViewer,
  Sphere,
  WebVR,
  usePanoViewer,
  type PanoMediaController,
} from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/ui/styles.css";
import {
  pageControlsClassName,
  segmentedButtonClassName,
  viewerChromeButtonClassName,
} from "../../ui";
import { HostModelExample } from "./host-model-example";
import {
  PanoramaMovieControls,
  SceneMovie,
  SceneMovieControls,
} from "./media-examples";

export type SpatialExampleKind =
  | "scene-video"
  | "360-video"
  | "model"
  | "scroll";

function ScrollExample() {
  const targetRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div
        ref={targetRef}
        className="h-64 overflow-auto border border-line p-3"
        tabIndex={0}
        aria-label="Scrollable article"
      >
        {Array.from({ length: 12 }, (_, index) => (
          <p key={index}>
            Chapter {index + 1}. In VR, gaze at the arrows near this reading
            area's edges to scroll. Outside VR, use the mouse wheel, touch or
            keyboard.
          </p>
        ))}
      </div>
      <PanoScrollControls targetRef={targetRef} />
    </>
  );
}

export function SpatialExample({ kind }: { kind: SpatialExampleKind }) {
  const viewer = usePanoViewer();
  const [controller, setController] = useState<PanoMediaController | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(
    "Select the example, then enter VR to see its icon controls.",
  );
  const hasDialog = kind === "model" || kind === "scroll";
  const openLabel = kind === "model" ? "Open model" : "Open article";
  return (
    <>
      <div className={pageControlsClassName}>
        <button
          type="button"
          className={segmentedButtonClassName}
          onClick={() =>
            void viewer
              .toggleVR()
              .catch(() =>
                setStatus(
                  "VR could not start. Check browser support and permissions, then retry.",
                ),
              )
          }
        >
          Toggle VR
        </button>
        {hasDialog ? (
          <button
            type="button"
            className={segmentedButtonClassName}
            onClick={() => setOpen(true)}
          >
            {openLabel}
          </button>
        ) : null}
        <span className="text-sm" role="status">
          {status}
        </span>
      </div>
      <PanoViewer
        ref={viewer.ref}
        aria-label="Spatial controls viewer"
        initialView={{
          yaw: kind === "scene-video" ? 145 : 0,
          pitch: 0,
          fov: 75,
        }}
        style={{ height: 560 }}
      >
        <WebVR />
        {kind === "360-video" ? (
          <PanoVideo
            src="/fixtures/360video/1/video-1024x512.mp4"
            poster="/fixtures/360video/1/video-1024x512-poster.jpg"
            loop
          />
        ) : (
          <Sphere
            src="/fixtures/panorama/panos/1/sphere.webp"
            previewUrl="preview.webp"
          />
        )}
        {kind === "scene-video" ? (
          <SceneMovie onController={setController} />
        ) : null}
        <PanoOverlay>
          {kind === "scene-video" ? (
            <SceneMovieControls controller={controller} />
          ) : null}
          {kind === "360-video" ? (
            <PanoramaMovieControls viewer={viewer} />
          ) : null}
          {hasDialog ? (
            <>
              <button
                type="button"
                className={`${viewerChromeButtonClassName} pointer-events-auto absolute right-4 bottom-4`}
                onClick={() => setOpen(true)}
              >
                {openLabel}
              </button>
              <PanoDialog
                open={open}
                onOpenChange={setOpen}
                title={
                  kind === "model" ? "Host model controls" : "Scroll controls"
                }
              >
                {kind === "model" ? <HostModelExample /> : <ScrollExample />}
              </PanoDialog>
            </>
          ) : null}
        </PanoOverlay>
      </PanoViewer>
    </>
  );
}
