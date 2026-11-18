import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { M3U8Parser } from "hls.js/dist/hls.mjs";
import { isHlsSource, loadVideoSources, nativeHlsLevels } from "../src/video/video-source";
import {
  canRecoverWithVideoVariant,
  exceedsVideoTextureLimit,
  VideoTextureSizeError,
} from "../src/video/video-playback-protection";

const url = "https://media.example.test/tour/master.m3u8";
const master = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="external",NAME="Main",DEFAULT=YES,URI="audio/main.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="embedded",NAME="Main",DEFAULT=YES
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=960x480,AUDIO="embedded"
480.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1920x960,AUDIO="external"
960.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1440x720
720.m3u8
`;

test("identifies HLS by URL path or explicit media type", () => {
  assert.ok(isHlsSource({ src: "/tour.M3U8?signature=a#chapter" }));
  assert.ok(isHlsSource({ src: "/stream", type: "Application/X-MpegURL; charset=utf-8" }));
  assert.ok(!isHlsSource({ src: "/video.mp4?fallback=.m3u8", type: "video/mp4" }));
});

test("offers native child URLs only when they preserve the master playlist's media", () => {
  assert.deepEqual(nativeHlsLevels(M3U8Parser, master, url), [
    { index: 0, width: 960, height: 480, bitrate: 900000, url: "https://media.example.test/tour/480.m3u8" },
    { index: 2, width: 1440, height: 720, bitrate: 1500000, url: "https://media.example.test/tour/720.m3u8" },
  ]);
  assert.deepEqual(nativeHlsLevels(M3U8Parser, "#EXTM3U\n#EXTINF:1,\nvideo.ts\n#EXT-X-ENDLIST", url), []);
  assert.deepEqual(nativeHlsLevels(M3U8Parser, master.replace(
    "#EXTM3U",
    '#EXTM3U\n#EXT-X-DEFINE:NAME="dir",VALUE="test"',
  ), url), []);
});

class NativeVideo extends EventTarget {
  src = "";
  crossOrigin: string | null = null;
  videoWidth = 0;
  videoHeight = 0;
  canPlayType = () => "maybe";
  load = () => {};
  removeAttribute = () => { this.src = ""; };
}

test("ignores a native manifest response after the source has been disposed", async (t) => {
  let finishFetch!: (response: Response) => void;
  const fetchStarted = new Promise<void>((resolve) => {
    t.mock.method(globalThis, "fetch", () => {
      resolve();
      return new Promise<Response>((resolveResponse) => { finishFetch = resolveResponse; });
    });
  });
  const video = new NativeVideo() as unknown as HTMLVideoElement;
  const receivedError = t.mock.fn();
  const onChange = t.mock.fn();
  const source = loadVideoSources(video, [{ src: url }], {
    crossOrigin: undefined, startImmediately: true,
    hasLoaded: () => false, onError: receivedError, onChange,
  });
  await fetchStarted;
  assert.equal(video.src, url);
  assert.equal(video.crossOrigin, "anonymous");
  assert.equal(source.quality(video)?.selectedLevel, "auto");
  source.dispose();
  finishFetch({ ok: true, url, text: async () => master } as Response);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(video.src, "");
  assert.equal(source.quality(video), undefined);
  assert.equal(receivedError.mock.callCount(), 0);
  assert.equal(onChange.mock.callCount(), 1);
});

class SwitchVideo extends EventTarget {
  paused = true;
  muted = false;
  seeking = false;
  ended = false;
  currentTime = 4;
  duration = 20;
  readyState = 1;
  volume = 1;
  playbackRate = 1;
  loop = false;
  videoWidth = 0;
  HAVE_METADATA = 1;
  HAVE_CURRENT_DATA = 2;
  HAVE_FUTURE_DATA = 3;
  buffered = { length: 1, start: () => 0, end: () => 12 };
  audioTracks = { length: 1 };
  pause = () => { this.paused = true; };
  play = async () => { this.paused = false; };

  asMedia() { return this as unknown as HTMLVideoElement; }
}

function mockAnimationFrame(t: TestContext) {
  let callback: FrameRequestCallback | undefined;
  t.mock.method(globalThis, "setTimeout", () => 1);
  t.mock.method(globalThis, "clearTimeout", () => {});
  const originalFrame = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (next) => { callback = next; return 1; };
  globalThis.cancelAnimationFrame = () => { callback = undefined; };
  t.after(() => {
    globalThis.requestAnimationFrame = originalFrame;
    globalThis.cancelAnimationFrame = originalCancel;
  });
  return (now: number) => callback?.(now);
}

test("a paused native handoff waits for a decoded frame at the requested position", async (t) => {
  const { prepareNativeHlsSwitch } = await import("../src/video/native-hls-switch");
  const frame = mockAnimationFrame(t);
  const current = new SwitchVideo();
  current.currentTime = 9;
  const next = new SwitchVideo();
  next.readyState = 2;
  const commit = t.mock.fn();
  const fail = t.mock.fn();
  prepareNativeHlsSwitch(current.asMedia(), next.asMedia(), { commit, fail, awaitingGesture() {} });

  frame(0);
  assert.equal(next.currentTime, 9);
  assert.equal(commit.mock.callCount(), 0);
  next.readyState = 2;
  next.videoWidth = 1280;
  frame(16);
  assert.ok(next.paused);
  assert.equal(commit.mock.callCount(), 1);
  assert.equal(fail.mock.callCount(), 0);
});

test("an oversized native HLS candidate fails before replacing the current video", async (t) => {
  const { prepareNativeHlsSwitch } = await import("../src/video/native-hls-switch");
  const frame = mockAnimationFrame(t);
  const current = new SwitchVideo();
  current.paused = false;
  const next = new SwitchVideo();
  next.paused = false;
  next.readyState = 4;
  next.videoWidth = 7680;
  const commit = t.mock.fn();
  const fail = t.mock.fn();
  prepareNativeHlsSwitch(current.asMedia(), next.asMedia(), {
    commit,
    fail,
    awaitingGesture() {},
    validateFrame: () => exceedsVideoTextureLimit(next.asMedia(), 4096)
      ? new VideoTextureSizeError(next.asMedia(), 4096)
      : undefined,
  });

  frame(16);
  frame(32);
  assert.equal(commit.mock.callCount(), 0);
  assert.equal(fail.mock.callCount(), 1);
  assert.ok(fail.mock.calls[0]?.arguments[0] instanceof VideoTextureSizeError);
  assert.equal(current.paused, false);
  assert.equal(current.muted, false);
});

test("guards either texture dimension and only recovers from media capability errors", () => {
  assert.equal(exceedsVideoTextureLimit({ videoWidth: 4096, videoHeight: 2048 }, 4096), false);
  assert.equal(exceedsVideoTextureLimit({ videoWidth: 2048, videoHeight: 4097 }, 4096), true);
  assert.equal(exceedsVideoTextureLimit({ videoWidth: 0, videoHeight: 0 }, 4096), false);
  assert.equal(canRecoverWithVideoVariant({ code: 3 }), true);
  assert.equal(canRecoverWithVideoVariant({ code: 4 }), true);
  assert.equal(canRecoverWithVideoVariant({ code: 2 }), false);
  assert.equal(canRecoverWithVideoVariant({ type: "mediaError", fatal: true }), true);
  assert.equal(canRecoverWithVideoVariant({ type: "mediaError", fatal: false }), false);
  assert.equal(canRecoverWithVideoVariant(new DOMException("Gesture required", "NotAllowedError")), false);
});

test("an audible native handoff restores current audio when a gesture is required", async (t) => {
  const { prepareNativeHlsSwitch } = await import("../src/video/native-hls-switch");
  const frame = mockAnimationFrame(t);
  const current = new SwitchVideo();
  current.paused = false;
  current.readyState = 4;
  const next = new SwitchVideo();
  next.paused = false;
  next.readyState = 4;
  next.videoWidth = 1280;
  let gesture = false;
  next.play = async () => {
    if (!next.muted && !gesture) throw new DOMException("Gesture required", "NotAllowedError");
  };
  const commit = t.mock.fn();
  const awaitingGesture = t.mock.fn();
  const fail = t.mock.fn();
  const transition = prepareNativeHlsSwitch(current.asMedia(), next.asMedia(), { commit, awaitingGesture, fail });
  frame(0);
  await Promise.resolve();
  assert.equal(awaitingGesture.mock.callCount(), 1);
  assert.equal(commit.mock.callCount(), 0);
  assert.equal(current.muted, false);
  assert.equal(current.paused, false);
  assert.equal(next.muted, true);
  gesture = true;
  transition.confirm();
  await Promise.resolve();
  assert.equal(commit.mock.callCount(), 1);
  assert.equal(fail.mock.callCount(), 0);
});
