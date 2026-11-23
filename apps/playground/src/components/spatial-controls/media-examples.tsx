import { usePlaygroundLanguage } from "../../i18n/language";
import { useState, useSyncExternalStore } from "react";
import {
  PanoMediaControls,
  PanoSpatialControls,
  VideoHotspot,
  hotspotSurfaceDistance,
  type HotspotMode,
  type PanoMediaController,
  type UsePanoViewerResult,
} from "@ericchen1990/pano-view";

const SCENE_MOVIE_YAW = 145;
const SCENE_MOVIE_PITCH = 0;
const SCENE_MOVIE_WIDTH = 28;
const SCENE_MOVIE_HEIGHT = 16;
/** Degrees from the video's bottom edge to the center of the control bar. */
const SCENE_MOVIE_CONTROL_GAP = 4;
const SCENE_MOVIE_FLOATING_DISTANCE = 10;

function sceneMovieControlAnchor(mode?: HotspotMode) {
  return {
    position: {
      yaw: SCENE_MOVIE_YAW,
      pitch: SCENE_MOVIE_PITCH - SCENE_MOVIE_HEIGHT / 2 - SCENE_MOVIE_CONTROL_GAP,
    },
    width: SCENE_MOVIE_WIDTH,
    distance:
      mode === "surface"
        ? hotspotSurfaceDistance(SCENE_MOVIE_WIDTH, SCENE_MOVIE_HEIGHT)
        : SCENE_MOVIE_FLOATING_DISTANCE,
  };
}

export function SceneMovie({
  mode,
  onController,
}: {
  mode?: HotspotMode;
  onController: (controller: PanoMediaController | null) => void;
}) {
  const { t } = usePlaygroundLanguage();
  const [playing, setPlaying] = useState(false);
  return (
    <VideoHotspot
      ref={onController}
      id="scene-movie"
      position={{ yaw: SCENE_MOVIE_YAW, pitch: SCENE_MOVIE_PITCH }}
      width={SCENE_MOVIE_WIDTH}
      height={SCENE_MOVIE_HEIGHT}
      mode={mode}
      src="/fixtures/360video/1/video-1024x512.mp4"
      playing={playing}
      onPlaybackStateChange={(state) => setPlaying(state === "playing")}
      onClick={() => setPlaying((value) => !value)}
      ariaLabel={t("Play or pause scene video")}
    />
  );
}
export function SceneMovieControls({
  controller,
  mode,
}: {
  controller: PanoMediaController | null;
  mode?: HotspotMode;
}) {
  const anchor = sceneMovieControlAnchor(mode);
  return (
    <PanoSpatialControls
      position={anchor.position}
      width={anchor.width}
      distance={anchor.distance}
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
