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
  return (
    <PanoSpatialControls
      position={{ yaw: 145, pitch: -14 }}
      width={28}
      distance={10}
    >
      <PanoMediaControls controller={controller} />
    </PanoSpatialControls>
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
    () => null,
  );
  return (
    <PanoSpatialControls>
      <PanoMediaControls controller={controller} />
    </PanoSpatialControls>
  );
}
