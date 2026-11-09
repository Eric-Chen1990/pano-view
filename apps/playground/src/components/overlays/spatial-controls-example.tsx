import { useState, useSyncExternalStore } from "react";
import {
  PanoMediaControls,
  PanoSpatialControls,
  VideoHotspot,
  type PanoMediaController,
  type UsePanoViewerResult,
} from "@ericchen1990/pano-view";

export function SceneMovie({
  onController,
}: {
  onController: (controller: PanoMediaController | null) => void;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <VideoHotspot
      ref={onController}
      id="scene-movie"
      position={{ yaw: 145, pitch: 0 }}
      width={28}
      height={16}
      src="/fixtures/360video/1/video-1024x512.mp4"
      playing={playing}
      onPlaybackStateChange={(state) => setPlaying(state === "playing")}
      onClick={() => setPlaying((value) => !value)}
      ariaLabel="Play or pause scene video"
    />
  );
}
export function SceneMovieControls({
  controller,
}: {
  controller: PanoMediaController | null;
}) {
  const [theme, setTheme] = useState(false);
  return (
    <PanoSpatialControls
      position={{ yaw: 145, pitch: -14 }}
      width={28}
      distance={10}
    >
      <PanoMediaControls
        controller={controller}
        style={{ background: theme ? "#422b69" : "#161b22" }}
        actions={[
          "rewind",
          "play",
          "pause",
          "forward",
          {
            id: "theme",
            label: "Change control theme",
            icon: (
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" fill="currentColor" />
              </svg>
            ),
            activate: () => setTheme((value) => !value),
          },
        ]}
      >
        {(actions) => (
          <div style={{ display: "flex", gap: 16 }}>
            {actions.map((action) => (
              <CustomButton
                key={action.id === "pause" ? "play" : action.id}
                action={action}
              />
            ))}
          </div>
        )}
      </PanoMediaControls>
    </PanoSpatialControls>
  );
}
import {
  PanoControlButton,
  type PanoControlAction,
} from "@ericchen1990/pano-view";
function CustomButton({ action }: { action: PanoControlAction }) {
  return (
    <PanoControlButton
      action={action}
      style={{ borderRadius: "50%", color: "#baf5ff" }}
    />
  );
}
export function PanoramaMovieControls({
  viewer,
}: {
  viewer: UsePanoViewerResult;
}) {
  const controller = useSyncExternalStore(
    viewer.subscribeVideo,
    viewer.getVideo,
    () => null
  );
  return (
    <PanoSpatialControls>
      <PanoMediaControls controller={controller} />
    </PanoSpatialControls>
  );
}
