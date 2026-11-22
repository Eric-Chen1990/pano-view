import assert from "node:assert/strict";
import { test } from "node:test";
import { Quaternion, Vector3 } from "three";
import { getAudioPanningModel } from "../src/audio/howl";
import { createXRAudioPose } from "../src/audio/xr-audio-pose";
import { lookRangeGain, normalizeSoundDistance, relativeLookGain, relativeSoundPosition } from "../src/hotspot/audio-spatial";
import { panoPositionToVector3 } from "../src/hotspot/coordinates";

const up = new Vector3(0, 1, 0);
const identity = new Quaternion();

test("full-sphere 3D sound stays audible behind the listener with a clear front-to-back level change", () => {
  const front = relativeLookGain(new Vector3(0, 0, -3), 360);
  const side = relativeLookGain(new Vector3(3, 0, 0), 360);
  const back = relativeLookGain(new Vector3(0, 0, 3), 360);
  assert.equal(front, 1);
  assert.ok(Math.abs(20 * Math.log10(back / front) + 12) < 1e-9,
    `a half-turn should lower the source by 12 dB, got ${20 * Math.log10(back / front)} dB`);
  assert.ok(side < front && side > back);
  assert.equal(relativeLookGain(new Vector3(0, 0, 3), 120), 0);
  assert.equal(lookRangeGain(180, 360), 1, "legacy stereo retains its full-sphere gain");
});

test("directional sound preserves elevation and moves from right to front to left as each listener turns", () => {
  const source = panoPositionToVector3({ yaw: 90, pitch: 30 }, 3);
  const position = new Vector3();
  const center = new Vector3();
  relativeSoundPosition(position, source, center, identity);
  assert.ok(position.x > 2 && position.y > 1);
  assert.equal(relativeLookGain(position, 90), 0);
  assert.ok(relativeLookGain(position, 360) < 1);

  const lookingRight = new Quaternion().setFromAxisAngle(up, Math.PI / 2);
  relativeSoundPosition(position, source, center, lookingRight);
  assert.ok(Math.abs(position.x) < 1e-10 && position.z < -2 && position.y > 1);
  assert.ok(Math.abs(relativeLookGain(position, 90) - 2 / 3) < 1e-10);

  const lookingBack = new Quaternion().setFromAxisAngle(up, Math.PI);
  relativeSoundPosition(position, source, center, lookingBack);
  assert.ok(position.x < -2 && position.y > 1);
  relativeSoundPosition(position, source, center, identity);
  assert.ok(position.x > 2, "a second viewer's orientation cannot change this listener");
});

test("XR steps change source distance and direction, with a new origin on recenter", () => {
  const pose = createXRAudioPose();
  const sample = (x: number, y: number, z: number, emulated = false) => pose.update({
    position: { x, y, z },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
  } as XRRigidTransform, identity, emulated);
  const source = new Vector3(0, 0, -3);
  const relative = new Vector3();
  assert.equal(pose.valid, false);
  sample(1, 1.7, 2);
  assert.deepEqual(pose.position.toArray(), [0, 0, 0]);
  sample(1.5, 1.7, 1);
  relativeSoundPosition(relative, source, pose.position, identity);
  assert.deepEqual(relative.toArray(), [-0.5, 0, -2]);
  assert.ok(relative.length() < source.length());
  sample(4, 0, 6, true);
  assert.deepEqual(pose.position.toArray(), [0.5, 0, -1]);
  pose.recenter();
  sample(4, 1.7, 6);
  assert.deepEqual(pose.position.toArray(), [0, 0, 0]);
  sample(4, 1.7, 7);
  relativeSoundPosition(relative, source, pose.position, identity);
  assert.equal(relative.length(), 4);
});

test("audio capability selection falls back without Web Audio or HRTF", () => {
  assert.equal(getAudioPanningModel(null), "none");
  const stereo = {
    createStereoPanner: () => ({}),
    createPanner: () => ({ get panningModel() { return "equalpower"; }, set panningModel(_value: string) {} }),
  } as unknown as AudioContext;
  assert.equal(getAudioPanningModel(stereo), "stereo");
  const spatial = { createPanner: () => ({ panningModel: "equalpower" }) } as unknown as AudioContext;
  assert.equal(getAudioPanningModel(spatial), "hrtf");
  for (const value of [undefined, 0, -1, NaN, Infinity]) assert.equal(normalizeSoundDistance(value), 3);
  assert.equal(normalizeSoundDistance(2.5), 2.5);
});
