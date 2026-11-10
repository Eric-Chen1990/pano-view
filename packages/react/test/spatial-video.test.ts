import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { createSpatialVideo } from "../src/spatial/video";

class Video extends EventTarget {
  src = "movie.mp4";
  currentSrc = "movie.mp4";
  poster = "";
  preload = "metadata";
  readyState = 0;
  videoWidth = 640;
  videoHeight = 360;
  currentTime = 0;
  paused = true;
  isConnected = true;
  tainted = false;
  alpha = 255;
  unavailable = false;
  playCalls = 0;
  loadCalls = 0;
  play() { this.playCalls++; }
  load() { this.loadCalls++; }
  getAttribute(name: string) { return name === "preload" ? this.preload || null : null; }
  setAttribute(name: string, value: string) { if (name === "preload") this.preload = value; }
  removeAttribute(name: string) { if (name === "preload") this.preload = ""; }
  get element() { return this as unknown as HTMLVideoElement; }
}

function environment(t: TestContext) {
  const images: Preview[] = [];
  const settings = { imageTainted: false };
  class Preview {
    constructor() { images.push(this); }
    src = "";
    crossOrigin = "";
    complete = true;
    naturalWidth = 320;
    naturalHeight = 180;
    tainted = settings.imageTainted;
    removeAttribute(name: string) { if (name === "src") this.src = ""; }
  }
  const reads: unknown[] = [];
  let tainted = false;
  let alpha = 0;
  const context = {
    clearRect() { alpha = 0; },
    drawImage(input: { tainted: boolean; alpha?: number; unavailable?: boolean }) {
      reads.push(input);
      if (input.unavailable) throw new DOMException("No drawable frame", "InvalidStateError");
      tainted ||= input.tainted;
      alpha = input.alpha ?? 255;
    },
    getImageData() {
      if (tainted) throw new DOMException("Unreadable source", "SecurityError");
      return { data: [0, 0, 0, alpha] };
    },
  };
  const canvas = {
    set width(_value: number) { tainted = false; },
    height: 1,
    getContext: () => context,
  };
  for (const [name, value] of Object.entries({ Image: Preview, document: { createElement: () => canvas } })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  return { images, reads, settings };
}

test("a paused video displays its poster without needing a decoded frame or playback", (t) => {
  const { images } = environment(t);
  const video = new Video();
  video.poster = "poster.jpg";
  const preview = createSpatialVideo(video.element);
  assert.equal(preview.getFrame()?.image, images[0]);
  assert.equal(images[0]!.crossOrigin, "anonymous");
  assert.equal(video.readyState, 0);
  assert.equal(video.preload, "metadata");
  video.readyState = 2;
  assert.equal(preview.getFrame()?.image, images[0], "poster takes precedence before play");
  video.dispatchEvent(new Event("play"));
  assert.equal(preview.getFrame()?.image, video);
  video.paused = true;
  assert.equal(preview.getFrame()?.image, video, "pausing retains the video frame");
  assert.equal(video.playCalls, 0);
  assert.equal(video.loadCalls, 0);
  assert.equal(video.currentTime, 0);
  video.src = video.currentSrc = "second.mp4";
  video.dispatchEvent(new Event("emptied"));
  assert.equal(preview.getFrame()?.image, images[0], "a new source starts at its poster again");
  video.currentTime = 1;
  assert.equal(preview.getFrame()?.image, video, "seeking before play reveals the selected frame");
  preview.dispose();
  assert.equal(images[0]!.src, "");
  assert.equal(preview.getFrame(), null);
});

test("no-poster previews hint preload, expose a first frame when available, and restore host settings", (t) => {
  environment(t);
  const video = new Video();
  const preview = createSpatialVideo(video.element);
  assert.equal(preview.getFrame(), null);
  assert.equal(video.preload, "auto");
  video.readyState = 1;
  assert.equal(preview.getFrame(), null);
  video.readyState = 2;
  assert.equal(preview.getFrame()?.image, video);
  assert.equal(video.paused, true);
  assert.equal(video.playCalls + video.loadCalls, 0);
  preview.dispose();
  assert.equal(video.preload, "metadata");

  video.preload = "";
  const withoutAttribute = createSpatialVideo(video.element);
  withoutAttribute.getFrame();
  withoutAttribute.dispose();
  assert.equal(video.getAttribute("preload"), null);

  const changedByHost = createSpatialVideo(video.element);
  changedByHost.getFrame();
  video.preload = "none";
  changedByHost.getFrame();
  changedByHost.dispose();
  assert.equal(video.preload, "none", "do not overwrite a host's subsequent preload change");
});

test("poster loading, failures and changes release old resources and keep a usable fallback", (t) => {
  const { images } = environment(t);
  const video = new Video();
  video.poster = "one.jpg";
  const preview = createSpatialVideo(video.element);
  preview.getFrame();
  images[0]!.complete = false;
  assert.equal(preview.getFrame(), null);
  images[0]!.complete = true;
  images[0]!.naturalWidth = 0;
  assert.equal(preview.getFrame(), null);
  video.readyState = 2;
  assert.equal(preview.getFrame()?.image, video);
  video.poster = "two.jpg";
  assert.equal(preview.getFrame()?.image, images[1]);
  assert.equal(images[0]!.src, "");
  preview.getFrame();
  assert.equal(images.length, 2, "reuse the poster while its URL is unchanged");
  video.poster = "";
  preview.getFrame();
  assert.equal(images[1]!.src, "");
  assert.equal(video.preload, "auto");
  preview.dispose();
  assert.equal(video.preload, "metadata");
});

test("unreadable frames never reach the panel and a source change resets readability", (t) => {
  const { reads, settings } = environment(t);
  const video = new Video();
  settings.imageTainted = true;
  video.poster = "blocked.jpg";
  video.readyState = 2;
  video.tainted = true;
  const preview = createSpatialVideo(video.element);
  assert.equal(preview.getFrame(), null);
  const count = reads.length;
  assert.equal(preview.getFrame(), null);
  assert.equal(reads.length, count, "do not repeatedly read a rejected source");
  video.src = video.currentSrc = "safe.mp4";
  video.poster = "";
  video.tainted = false;
  video.dispatchEvent(new Event("emptied"));
  assert.equal(preview.getFrame()?.image, video);
  preview.dispose();
});

test("a ready decoder with a transparent or temporarily unavailable frame remains pending and retries", (t) => {
  environment(t);
  const video = new Video();
  video.readyState = 4;
  video.alpha = 0;
  const preview = createSpatialVideo(video.element);
  assert.equal(preview.getFrame(), null);
  video.alpha = 255;
  assert.equal(preview.getFrame()?.image, video, "a later opaque frame becomes visible without playback");
  video.alpha = 0;
  assert.equal(preview.getFrame(), null, "an offscreen paused decoder may lose a previously drawable frame");
  video.alpha = 255;
  assert.equal(preview.getFrame()?.image, video);
  video.src = video.currentSrc = "next.mp4";
  video.unavailable = true;
  assert.equal(preview.getFrame(), null);
  video.unavailable = false;
  assert.equal(preview.getFrame()?.image, video, "transient decoder failures must not be cached as CORS rejection");
  assert.equal(video.playCalls + video.loadCalls, 0);
  preview.dispose();
});
