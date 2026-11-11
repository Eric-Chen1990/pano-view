import assert from "node:assert/strict";
import { test } from "node:test";
import { probeMediaHasAudio, subscribeMediaAudio } from "../src/controls/media-audio";
import { clampVolume } from "../src/video/format";

class Tracks extends EventTarget { length = 0; }
class Media extends EventTarget {
  readyState = 0;
  audioTracks?: Tracks;
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
  get element() { return this as unknown as HTMLMediaElement; }
}

test("audio detection distinguishes absent, present and unknown without measuring loudness", () => {
  const media = new Media();
  media.audioTracks = new Tracks();
  assert.equal(probeMediaHasAudio(media.element), undefined);
  media.readyState = 1;
  assert.equal(probeMediaHasAudio(media.element), false);
  media.audioTracks.length = 1;
  assert.equal(probeMediaHasAudio(media.element), true);
  media.audioTracks = undefined;
  assert.equal(probeMediaHasAudio(media.element), undefined);
  media.webkitAudioDecodedByteCount = 0;
  assert.equal(probeMediaHasAudio(media.element), undefined);
  media.mozHasAudio = false;
  assert.equal(probeMediaHasAudio(media.element), false);
  media.mozHasAudio = true;
  assert.equal(probeMediaHasAudio(media.element), true);
  media.mozHasAudio = undefined;
  media.webkitAudioDecodedByteCount = 12;
  assert.equal(probeMediaHasAudio(media.element), true);
  media.readyState = 0;
  assert.equal(probeMediaHasAudio(media.element), undefined, "a new source starts unknown");
});

test("audio subscriptions rebind track lists on source changes and release listeners", () => {
  const media = new Media();
  const first = media.audioTracks = new Tracks();
  const values: (boolean | undefined)[] = [];
  const unsubscribe = subscribeMediaAudio(media.element, () => values.push(probeMediaHasAudio(media.element)));
  media.readyState = 1;
  media.dispatchEvent(new Event("loadedmetadata"));
  first.length = 1;
  first.dispatchEvent(new Event("addtrack"));
  first.length = 0;
  first.dispatchEvent(new Event("removetrack"));
  media.readyState = 0;
  const second = media.audioTracks = new Tracks();
  media.dispatchEvent(new Event("emptied"));
  first.dispatchEvent(new Event("addtrack"));
  media.readyState = 1;
  second.length = 1;
  second.dispatchEvent(new Event("change"));
  assert.deepEqual(values, [undefined, false, true, false, undefined, true]);
  unsubscribe();
  second.dispatchEvent(new Event("addtrack"));
  media.dispatchEvent(new Event("playing"));
  assert.equal(values.length, 6);
});

test("volume properties retain their default and clamp finite values", () => {
  for (const invalid of [undefined, NaN, Infinity, -Infinity]) assert.equal(clampVolume(invalid), 1);
  assert.equal(clampVolume(-4), 0);
  assert.equal(clampVolume(4), 1);
  assert.equal(clampVolume(0.4), 0.4);
});
