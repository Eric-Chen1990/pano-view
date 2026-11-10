import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mediaActions,
  modelActions,
  scrollActions,
  type PanoMediaController,
} from "../src/controls/actions";
import { createGazeActionState } from "../src/spatial/gaze-action";

test("media controls clamp seeking and volume, retain target identity, and do not repeat toggles", () => {
  const snapshot = {
    ready: true,
    playing: false,
    currentTime: 5,
    duration: 20,
    volume: 0.5,
    volumeAdjustable: true,
    muted: true,
  };
  const controller: PanoMediaController = {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    play: async () => {
      snapshot.playing = true;
    },
    pause: () => {
      snapshot.playing = false;
    },
    seek: (value) => {
      snapshot.currentTime = value;
    },
    setVolume: (value) => {
      snapshot.volume = value;
    },
    setMuted: (value) => {
      snapshot.muted = value;
    },
  };
  const actions = mediaActions(controller);
  actions.find((a) => a.id === "rewind")!.update!(1);
  assert.equal(snapshot.currentTime, 0);
  assert.equal(actions.find((a) => a.id === "rewind")!.enabled!(), false);
  actions.find((a) => a.id === "forward")!.update!(5);
  assert.equal(snapshot.currentTime, 20);
  actions.find((a) => a.id === "vol+")!.update!(5);
  assert.equal(snapshot.volume, 1);
  snapshot.volumeAdjustable = false;
  assert.equal(actions.find((a) => a.id === "vol-")!.enabled!(), false);
  const fixedVolumeActions = mediaActions(controller);
  assert.equal(fixedVolumeActions.some((action) => action.id.startsWith("vol")), false);
  fixedVolumeActions.find((action) => action.id === "unmute")!.activate!();
  assert.equal(snapshot.muted, false);
  snapshot.volumeAdjustable = true;
  assert.equal(mediaActions(controller).find((action) => action.id === "vol+")!.enabled!(), false);
  assert.equal(mediaActions(controller).find((action) => action.id === "vol-")!.enabled!(), true);
  const gaze = createGazeActionState();
  const toggle = { ...actions[0]!, id: controller };
  for (let index = 0; index < 50; index++) gaze.tick(toggle, 0.02, 100);
  assert.equal(snapshot.playing, true);
  gaze.stop();
  for (let index = 0; index < 10; index++)
    gaze.tick({ ...mediaActions(controller)[0]!, id: controller }, 0.02, 100);
  assert.equal(snapshot.playing, false);
});

test("scroll actions support both axes, clamp boundaries and preserve independent model actions", () => {
  const viewport = {
    scrollHeight: 500,
    clientHeight: 100,
    scrollWidth: 300,
    clientWidth: 100,
    scrollTop: 0,
    scrollLeft: 0,
  } as HTMLElement;
  const actions = scrollActions(viewport);
  assert.equal(actions.length, 4);
  assert.equal(actions[0]!.enabled!(), false);
  actions[1]!.update!(50);
  assert.equal(viewport.scrollTop, 400);
  assert.equal(actions[1]!.enabled!(), false);
  actions[3]!.update!(50);
  assert.equal(viewport.scrollLeft, 200);
  let rotation = 0;
  const models = modelActions({
    rotateBy: (yaw) => {
      rotation += yaw;
    },
  });
  models.find((action) => action.id === "right")!.update!(2);
  assert.equal(rotation, 60);
  assert.equal(viewport.scrollTop, 400);
  viewport.scrollTop = 0;
  Object.assign(viewport, { scrollHeight: 100, scrollWidth: 100 });
  assert.equal(scrollActions(viewport).length, 0);
});

test("disabled and removed continuous targets stop and require another dwell", () => {
  let enabled = true,
    steps = 0,
    ends = 0;
  const state = createGazeActionState();
  const action = {
    id: "target",
    enabled: () => enabled,
    update: () => steps++,
    end: () => ends++,
  };
  for (let i = 0; i < 10; i++) state.tick(action, 0.02, 100);
  const before = steps;
  enabled = false;
  state.tick(action, 0.02, 100);
  assert.equal(steps, before);
  assert.equal(ends, 1);
  enabled = true;
  state.tick(action, 0.02, 100);
  state.tick(action, 0.02, 100);
  assert.equal(steps, before);
  state.tick(null, 0.02, 100);
  assert.equal(ends, 1);
});
