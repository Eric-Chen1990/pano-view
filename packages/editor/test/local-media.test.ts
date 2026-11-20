import assert from "node:assert/strict";
import { test } from "node:test";
import { audioExtension, hotspotAssetPicker, matchesLocalMedia, popupAssetPicker, selectLocalMedia } from "../src/local-media";
import { translator } from "../src/i18n";

test("local media follows the field type and recovers missing browser MIME types", async () => {
  assert.equal(hotspotAssetPicker("src", "video").mediaKind, "video");
  assert.equal(hotspotAssetPicker("src", "audio").mediaKind, "audio");
  assert.equal(hotspotAssetPicker("poster", "video").mediaKind, "image");
  assert.equal(hotspotAssetPicker("tooltip.image", "iframe").mediaKind, "image");
  assert.equal(hotspotAssetPicker("graphic.src", "graphic").mediaKind, "svg");

  const file = new File(["media"], "clip #1.WEBM");
  const normalized = selectLocalMedia([file], "video");
  assert.equal(normalized.type, "video/webm");
  assert.equal(normalized.name, file.name);
  assert.equal(await normalized.text(), await file.text());
});

test("audio import handles WAV and Ogg MIME types and distinguishes the picker target", async () => {
  const wave = new File(["sound"], "sound.WAV", { type: "application/octet-stream" });
  const normalized = selectLocalMedia([wave], "audio");
  assert.equal(matchesLocalMedia(wave, "audio"), true);
  assert.equal(matchesLocalMedia(wave, "image"), false);
  assert.equal(normalized.type, "audio/wav");
  assert.equal(await normalized.text(), "sound");
  assert.equal(selectLocalMedia([new File(["sound"], "sound.ogg", { type: "application/ogg" })], "audio").type, "audio/ogg");
  assert.equal(audioExtension("audio/x-wav"), "wav");
  assert.equal(audioExtension("audio/mpeg"), "mp3");

  const t = translator("zh-CN");
  assert.equal(t(hotspotAssetPicker("src", "audio").title), "选择热点音频");
  assert.equal(t(popupAssetPicker("src", "audio").title), "选择弹窗音频");
  assert.equal(t(hotspotAssetPicker("poster", "video").title), "选择热点视频封面");
  assert.equal(t(popupAssetPicker("poster", "video").title), "选择弹窗视频封面");
});

test("local media rejects directories, multiple files, and conflicting media types", () => {
  const image = new File(["image"], "image.png", { type: "image/png" });
  assert.throws(() => selectLocalMedia([image], "image", true), /one file/);
  assert.throws(() => selectLocalMedia([image, image], "image"), /one file/);
  assert.throws(() => selectLocalMedia([image], "video"), /video file/);
  assert.throws(() => selectLocalMedia([image], "audio"), /audio file/);
  assert.throws(() => selectLocalMedia([image], "svg"), /SVG image/);
  assert.throws(() => selectLocalMedia([new File([], "image.png")], "image"), /image file/);
});
