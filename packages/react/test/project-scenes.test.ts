import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ProjectHotspotSource,
  handleProjectHotspotClick,
} from "../src/project-scenes";
import type { ProjectHotspotDefinition } from "../src/data";
import type { HotspotInteractionEvent } from "../src/hotspot/types";
import { ImageHotspot } from "../src/hotspot/image-hotspot";
import { GraphicHotspot } from "../src/hotspot/graphic-hotspot";
import { SequenceHotspot } from "../src/hotspot/sequence-hotspot";
import { VideoHotspot } from "../src/hotspot/video-hotspot";
import { AudioHotspot } from "../src/hotspot/audio-hotspot";
import { TextHotspot } from "../src/hotspot/text-hotspot";
import { IframeHotspot } from "../src/hotspot/iframe-hotspot";
import { PolygonHotspot } from "../src/hotspot/polygon-hotspot";
import { PolylineHotspot } from "../src/hotspot/polyline-hotspot";

const position = { yaw: 0, pitch: 0 };
const point = { id: "marker", position, label: "Marker" };
const media: ProjectHotspotDefinition = {
  ...point,
  type: "audio",
  src: "sound.mp3",
};
const interaction = (): HotspotInteractionEvent => ({
  id: "marker",
  position,
  source: "keyboard",
  nativeEvent: new Event("click", { cancelable: true }) as MouseEvent,
});

test("default project renderer reuses every hotspot component and strips project-only properties", () => {
  const items: Array<[ProjectHotspotDefinition, unknown]> = [
    [{ ...point, type: "image", src: "image.webp" }, ImageHotspot],
    [{ ...point, type: "graphic", graphic: { kind: "arrow" } }, GraphicHotspot],
    [
      { ...point, type: "sequence", src: "sprite.webp", frameCount: 8 },
      SequenceHotspot,
    ],
    [{ ...point, type: "video", src: "video.mp4" }, VideoHotspot],
    [media, AudioHotspot],
    [{ ...point, type: "text", text: "Hello" }, TextHotspot],
    [{ ...point, type: "iframe", src: "embed.html" }, IframeHotspot],
    [
      {
        id: "polygon",
        type: "polygon",
        vertices: [position, { yaw: 10, pitch: 0 }, { yaw: 5, pitch: 10 }],
      },
      PolygonHotspot,
    ],
    [
      {
        id: "polyline",
        type: "polyline",
        vertices: [position, { yaw: 10, pitch: 0 }],
      },
      PolylineHotspot,
    ],
  ];
  const onClick = () => {};
  const onEnded = () => {};
  const onError = () => {};
  for (const [hotspot, component] of items) {
    const element = ProjectHotspotSource({
      hotspot: { ...hotspot, action: { type: "scene", sceneId: "next" } },
      playing: true,
      onClick,
      onEnded,
      onError,
    });
    assert.equal(element.type, component);
    assert.equal(element.props.ariaLabel, hotspot.label || hotspot.id);
    assert.equal(element.props.onClick, onClick);
    assert.equal(element.props.action, undefined);
    assert.equal(element.props.type, undefined);
    assert.equal(element.props.label, undefined);
    if (["sequence", "video", "audio"].includes(hotspot.type)) {
      assert.equal(element.props.playing, true);
      assert.equal(element.props.onEnded, onEnded);
    }
  }
});

test("click callbacks can suppress navigation or playback; scene actions take priority", () => {
  const navigated: string[] = [];
  let toggled = 0;
  const navigate = (id: string) => navigated.push(id);
  const toggle = () => toggled++;
  const link: ProjectHotspotDefinition = {
    ...media,
    action: { type: "scene", sceneId: "hall" },
  };
  handleProjectHotspotClick(
    link,
    "entrance",
    interaction(),
    (event) => {
      assert.equal(event.sceneId, "entrance");
      assert.equal(event.hotspot.id, "marker");
      event.preventDefault();
    },
    navigate,
    toggle
  );
  assert.deepEqual(navigated, []);
  handleProjectHotspotClick(
    link,
    "entrance",
    interaction(),
    undefined,
    navigate,
    toggle
  );
  assert.deepEqual(navigated, ["hall"]);
  assert.equal(toggled, 0);
  handleProjectHotspotClick(
    media,
    "entrance",
    interaction(),
    undefined,
    navigate,
    toggle
  );
  assert.equal(toggled, 1);
  handleProjectHotspotClick(
    media,
    "entrance",
    interaction(),
    (event) => event.interaction.nativeEvent.preventDefault(),
    navigate,
    toggle
  );
  assert.equal(toggled, 1);
  const keyboardEvent = interaction();
  keyboardEvent.nativeEvent.preventDefault();
  handleProjectHotspotClick(
    link,
    "entrance",
    keyboardEvent,
    undefined,
    navigate,
    toggle
  );
  assert.deepEqual(navigated, ["hall", "hall"]);
});
