import assert from "node:assert/strict";
import test from "node:test";
import { vrVideoCaptionBounds, vrVideoSeekTime, wrapVRCaption } from "../src/video/vr-video-layout";
import { createLookDownGesture, lookDownPanelTransition, lookDownThreshold, vrEyeBounds } from "../src/webvr/look-down-layout";

test("floating captions stay within the lower binocular safe area", () => {
  const eyeBottom = 1.2;
  const caption = vrVideoCaptionBounds(0.9, eyeBottom, 0.15);
  assert.ok(caption.bottom <= eyeBottom * 0.96);
  assert.ok(caption.minBottom >= eyeBottom * 0.50 + caption.width * 0.15);
  assert.ok(caption.targetBottom >= caption.minBottom && caption.targetBottom <= caption.bottom);
  assert.ok(caption.width / 2 + caption.maxOffsetX <= 0.9);
});

test("a tall caption scales into the safe band of a narrow view", () => {
  const oneLine = vrVideoCaptionBounds(1.0, 0.6, 0.09);
  const multiline = vrVideoCaptionBounds(1.0, 0.6, 0.35);
  assert.equal(oneLine.width, 1.72);
  assert.ok(multiline.width < oneLine.width);
  assert.ok(multiline.minBottom <= multiline.bottom);
});

test("VR playback controls use different pitch boundaries to reveal and hide", () => {
  assert.equal(lookDownThreshold(0, 0, -20, false), false);
  assert.equal(lookDownThreshold(-14, 0, -20, false), true);
  assert.equal(lookDownThreshold(-10, 0, -20, true), true);
  assert.equal(lookDownThreshold(-8, 0, -20, true), false);
  assert.equal(lookDownThreshold(-6, 0, -8, false), true);
  assert.equal(lookDownThreshold(0, 0, -4, true), false);
});

test("a quick downward nod reveals the VR toolbar at common headset frame rates", () => {
  for (const refreshRate of [60, 90, 120]) {
    const gesture = createLookDownGesture();
    const delta = 1 / refreshRate;
    gesture.update(0, 0, -20, delta);
    let triggered = false;
    for (let frame = 1; frame <= refreshRate / 5; frame++) {
      triggered = gesture.update(-frame * delta * 100, 0, -20, delta) || triggered;
    }
    assert.equal(triggered, true, `${refreshRate} Hz`);
  }
});

test("slow looks and later adjustments while looking down do not reveal the VR toolbar", () => {
  const gesture = createLookDownGesture();
  const update = (pitch: number, delta = 1 / 60) => gesture.update(pitch, 0, -20, delta);
  for (let frame = 0; frame <= 90; frame++) {
    assert.equal(update(-frame / 3), false);
  }
  assert.equal(update(-45), false);
  assert.equal(update(0), false);
  assert.equal(update(-6), false);
  assert.equal(update(-18, 0.25), false);
  assert.equal(update(-20), false);
  assert.equal(update(0), false);
  assert.equal(update(-15), true);
});

test("VR playback controls reverse a partial fade and only accept input once fully visible", () => {
  const showing = lookDownPanelTransition(0, true, 0.048, false);
  assert.ok(showing.opacity > 0 && showing.opacity < 1);
  assert.equal(showing.interactive, false);

  const closing = lookDownPanelTransition(showing.progress, false, 0, false);
  assert.equal(closing.opacity, showing.opacity);
  assert.equal(lookDownPanelTransition(closing.progress, false, 0.048, false).opacity, 0);
  assert.equal(lookDownPanelTransition(1, false, 0.016, false).interactive, false);
  assert.equal(lookDownPanelTransition(0.96, true, 0.016, false).interactive, true);
});

test("VR playback controls reveal instantly with reduced motion enabled", () => {
  assert.deepEqual(lookDownPanelTransition(0, true, 0, true), { progress: 1, opacity: 1, interactive: true });
  assert.deepEqual(lookDownPanelTransition(1, false, 0, true), { progress: 0, opacity: 0, interactive: false });
});

test("VR video seek maps a finite duration and clamps to the progress bar edges", () => {
  assert.equal(vrVideoSeekTime(0.25, 80), 20);
  assert.equal(vrVideoSeekTime(-0.1, 80), 0);
  assert.equal(vrVideoSeekTime(1.1, 80), 80);
  assert.equal(vrVideoSeekTime(0.5, Infinity), null);
  assert.equal(vrVideoSeekTime(0.5, 0), null);
  assert.equal(vrVideoSeekTime(NaN, 80), null);
});

test("VR captions preserve cue breaks and wrap English and Chinese text", () => {
  assert.deepEqual(
    wrapVRCaption("Hello world\n欢迎观看全景视频", 6, (line) => line.length),
    ["Hello", "world", "欢迎观看全景", "视频"],
  );
});

test("VR video layout uses the tighter limits of asymmetric eye projections", () => {
  const eye = (shiftX: number, shiftY: number) => ({
    projectionMatrix: { elements: [1, 0, 0, 0, 0, 2, 0, 0, shiftX, shiftY] },
  });
  const bounds = vrEyeBounds([eye(-0.1, -0.1), eye(0.3, 0.2)], 2);
  assert.equal(bounds?.halfWidth, 1);
  assert.ok(Math.abs((bounds?.below ?? 0) - 0.6) < 1e-10);
  assert.equal(vrEyeBounds([], 2), null);
});
