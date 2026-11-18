import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_PANO_VIDEO_PLAYBACK_RATES } from "../src/video/format";
import { PanoVideoControlsHud } from "../src/video/pano-video-controls";
import { DEFAULT_PANO_VIDEO_CAPTION_APPEARANCE } from "../src/video/pano-video-captions";
import {
  formatVideoQualitySize,
  hlsLevelLabels,
  hlsQualityMenuItems,
} from "../src/video/quality-label";
import type {
  PanoVideoController,
  PanoVideoHlsLevel,
  PanoVideoHlsQuality,
  PanoVideoPlaybackSnapshot,
  PanoVideoQualitySwitch,
  PanoVideoVariant,
} from "../src/video/types";

const ladder: readonly PanoVideoHlsLevel[] = [
  { index: 0, width: 900, height: 480, bitrate: 925_260 },
  { index: 1, width: 1350, height: 720, bitrate: 1_959_712 },
  { index: 2, width: 2026, height: 1080, bitrate: 4_094_188 },
  { index: 3, width: 3840, height: 2048, bitrate: 14_047_360 },
];

const defaultVariant: PanoVideoVariant = {
  id: "default",
  label: "Default",
  sources: [{ src: "/video.m3u8" }],
};

function quality(
  patch: Partial<PanoVideoHlsQuality> & Pick<PanoVideoHlsQuality, "selectedLevel">,
): PanoVideoHlsQuality {
  return {
    levels: ladder,
    activeLevel: patch.selectedLevel === "auto" ? null : patch.selectedLevel,
    ...patch,
  };
}

function snapshot(
  hlsQuality: PanoVideoHlsQuality | undefined,
  extras: Partial<PanoVideoPlaybackSnapshot> = {},
): PanoVideoPlaybackSnapshot {
  return {
    ready: true,
    playing: false,
    blocked: false,
    ended: false,
    currentTime: 0,
    duration: 20,
    hasAudio: false,
    volume: 1,
    volumeAdjustable: true,
    muted: true,
    playbackRate: 1,
    variantId: "default",
    variants: [defaultVariant],
    hlsQuality,
    trackId: null,
    tracks: [],
    captionText: "",
    captionAppearance: DEFAULT_PANO_VIDEO_CAPTION_APPEARANCE,
    captionsEnabled: false,
    playbackRates: DEFAULT_PANO_VIDEO_PLAYBACK_RATES,
    playbackState: "paused",
    ...extras,
  };
}

function renderControls(state: PanoVideoPlaybackSnapshot, width = 800): string {
  const controller: PanoVideoController = {
    subscribe: () => () => {},
    getSnapshot: () => state,
    play: async () => {},
    pause: () => {},
    togglePlay: () => {},
    seek: () => {},
    setVolume: () => {},
    setMuted: () => {},
    toggleMuted: () => {},
    setPlaybackRate: () => {},
    setVariantId: () => {},
    setHlsLevel: () => {},
    setTrackId: () => {},
    setCaptionAppearance: () => {},
  };
  const overlay = { clientWidth: width } as HTMLDivElement;
  return renderToStaticMarkup(createElement(PanoVideoControlsHud, {
    controller,
    fullscreen: null,
    overlayElement: overlay,
  }));
}

function variantButtonText(html: string): string {
  const button = html.match(/id="[^"]*-variant-btn">([^<]*)</);
  if (button) return button[1]!;
  const labels = [...html.matchAll(/class="pano-video-chrome-label"(?:[^>]*)>([^<]*)</g)]
    .map((match) => match[1]!)
    .filter((label) => !/^\d+(?:\.\d+)?x$/.test(label));
  assert.equal(labels.length, 1, html);
  return labels[0]!;
}

test("names panorama widths from 8K down to 4K and uses the real height otherwise", () => {
  assert.equal(formatVideoQualitySize(7680, 3840), "8K");
  assert.equal(formatVideoQualitySize(8000, 4000), "8K");
  assert.equal(formatVideoQualitySize(5760, 2880), "6K");
  assert.equal(formatVideoQualitySize(5120, 2560), "5K");
  assert.equal(formatVideoQualitySize(3840, 2048), "4K");
  assert.equal(formatVideoQualitySize(4096, 2160), "4K");
  assert.equal(formatVideoQualitySize(3839, 1920), "1920p");
  assert.equal(formatVideoQualitySize(2026, 1080), "1080p");
  assert.equal(formatVideoQualitySize(1920, 960), "960p");
  assert.equal(formatVideoQualitySize(2560, 1440), "1440p");
  assert.equal(formatVideoQualitySize(1350, 720), "720p");
  assert.equal(formatVideoQualitySize(900, 480), "480p");
});

test("keeps Auto first and the manifest order, then distinguishes repeated short names", () => {
  const reversed = [ladder[3]!, ladder[0]!, ladder[2]!, ladder[1]!];
  const items = hlsQualityMenuItems(quality({ levels: reversed, selectedLevel: "auto", activeLevel: 3 }));
  assert.deepEqual(items.map((item) => item.label), ["Auto", "4K", "480p", "1080p", "720p"]);
  assert.deepEqual(items.map((item) => item.id), ["auto", "3", "0", "2", "1"]);
  assert.equal(items[0]?.active, true);

  const sameHeight = [
    { index: 0, width: 1920, height: 1080, bitrate: 2_500_000 },
    { index: 1, width: 2026, height: 1080, bitrate: 4_000_000 },
  ];
  assert.deepEqual(
    hlsQualityMenuItems(quality({ levels: sameHeight, selectedLevel: 1 })).map((item) => item.label),
    ["Auto", "1080p · 2500 kbps", "1080p · 4000 kbps"],
  );

  const sameRate = [
    { index: 0, width: 3840, height: 1920, bitrate: 8_000_000 },
    { index: 1, width: 3840, height: 2048, bitrate: 8_000_000 },
  ];
  assert.deepEqual([...hlsLevelLabels(sameRate).values()], ["4K · 3840 × 1920", "4K · 3840 × 2048"]);

  const identical = [
    { index: 3, width: 1920, height: 1080, bitrate: 3_000_000 },
    { index: 4, width: 1920, height: 1080, bitrate: 3_000_000 },
  ];
  assert.deepEqual([...hlsLevelLabels(identical).values()], ["1080p · Level 3", "1080p · Level 4"]);

  const mixedRates = [
    { index: 0, width: 1920, height: 1080, bitrate: 2_500_000 },
    { index: 1, width: 2026, height: 1080, bitrate: 2_500_000 },
    { index: 2, width: 1920, height: 1080, bitrate: 4_000_000 },
  ];
  assert.deepEqual([...hlsLevelLabels(mixedRates).values()], [
    "1080p · 2500 kbps · 1920 × 1080",
    "1080p · 2500 kbps · 2026 × 1080",
    "1080p · 4000 kbps",
  ]);
});

test("uses bitrate and then the level index when a rendition has no size", () => {
  const levels = [
    { index: 1, width: 0, height: 0, bitrate: 1_200_000 },
    { index: 2, width: 0, height: 0, bitrate: 0 },
    { index: 6, width: 0, height: 0, bitrate: 1_200_000 },
  ];
  assert.deepEqual([...hlsLevelLabels(levels).values()], [
    "1200 kbps · Level 1",
    "Level 2",
    "1200 kbps · Level 6",
  ]);
});

test("a manual 1080p choice stays on the bar while the decoded frame is still 4K", () => {
  const still4k = { width: 3840, height: 2048 };
  const selections = [3, 2, 1, 0] as const;
  const expected = ["4K", "1080p", "720p", "480p"];
  selections.forEach((selectedLevel, index) => {
    const state = quality({
      selectedLevel,
      activeLevel: 3,
      resolution: still4k,
    });
    const html = renderControls(snapshot(state));
    const label = variantButtonText(html);
    assert.equal(label, expected[index]);
    assert.equal(label, hlsQualityMenuItems(state).find((item) => item.active)?.label);
    assert.doesNotMatch(html, /2048p/);
  });

  const returned = quality({ selectedLevel: "auto", activeLevel: 3, resolution: still4k });
  const autoHtml = renderControls(snapshot(returned));
  assert.equal(variantButtonText(autoHtml), "Auto · 4K");
  assert.equal(hlsQualityMenuItems(returned).find((item) => item.active)?.label, "Auto");
  assert.doesNotMatch(autoHtml, /2048p/);
});

test("auto follows the decoded frame, then the active rendition, then Auto", () => {
  const decoded = quality({
    selectedLevel: "auto",
    activeLevel: 3,
    resolution: { width: 2026, height: 1080 },
  });
  assert.equal(variantButtonText(renderControls(snapshot(decoded))), "Auto · 1080p");

  const beforeFirstFrame = quality({
    selectedLevel: "auto",
    activeLevel: 2,
    resolution: undefined,
  });
  assert.equal(variantButtonText(renderControls(snapshot(beforeFirstFrame))), "Auto · 1080p");

  const unknown = quality({
    selectedLevel: "auto",
    activeLevel: null,
    levels: [{ index: 0, width: 0, height: 0, bitrate: 1_200_000 }],
    resolution: undefined,
  });
  assert.equal(variantButtonText(renderControls(snapshot(unknown))), "Auto");
});

test("native switching shows the target immediately and restores the current rendition", () => {
  const current = quality({
    selectedLevel: 3,
    activeLevel: 3,
    resolution: { width: 3840, height: 2048 },
  });
  const switching: PanoVideoQualitySwitch = { target: { level: 2 }, state: "buffering" };
  const switchingHtml = renderControls(snapshot(current, { qualitySwitch: switching }));
  assert.equal(variantButtonText(switchingHtml), "1080p · Switching…");
  assert.equal(
    hlsQualityMenuItems(current, switching).find((item) => item.active)?.label,
    "1080p · Switching…",
  );
  assert.equal(hlsQualityMenuItems(current, switching).find((item) => item.id === "3")?.active, false);

  const tapAgain: PanoVideoQualitySwitch = { target: { level: 2 }, state: "awaiting-gesture" };
  assert.equal(
    variantButtonText(renderControls(snapshot(current, { qualitySwitch: tapAgain }))),
    "1080p · Tap to switch",
  );

  const toAuto: PanoVideoQualitySwitch = { target: { level: "auto" }, state: "buffering" };
  assert.equal(
    variantButtonText(renderControls(snapshot(current, { qualitySwitch: toAuto }))),
    "Auto · Switching…",
  );

  const restored = renderControls(snapshot(current));
  assert.equal(variantButtonText(restored), "4K");
  assert.doesNotMatch(restored, /Switching|Tap to switch|2048p/);
});

test("duplicate and unsized renditions use the same label on the rendered bar", () => {
  const duplicates = quality({
    levels: [
      { index: 0, width: 1920, height: 1080, bitrate: 2_500_000 },
      { index: 1, width: 2026, height: 1080, bitrate: 4_000_000 },
    ],
    selectedLevel: 1,
    activeLevel: 0,
    resolution: { width: 3840, height: 2048 },
  });
  const duplicateHtml = renderControls(snapshot(duplicates));
  assert.equal(variantButtonText(duplicateHtml), "1080p · 4000 kbps");
  assert.doesNotMatch(duplicateHtml, /2048p/);

  const unsized = quality({
    levels: [{ index: 4, width: 0, height: 0, bitrate: 1_200_000 }],
    selectedLevel: 4,
    activeLevel: null,
    resolution: { width: 3840, height: 2048 },
  });
  assert.equal(variantButtonText(renderControls(snapshot(unsized))), "1200 kbps");
});

test("caller variant names stay intact while a native variant switch is in progress", () => {
  const variants: readonly PanoVideoVariant[] = [
    { id: "auto", label: "Auto (up to 2026 × 1080)", sources: [{ src: "/mobile.m3u8" }] },
    { id: "4k", label: "4K (3840 × 2048)", sources: [{ src: "/4k.m3u8" }] },
  ];
  const hlsQuality = quality({ selectedLevel: "auto", resolution: { width: 3840, height: 2048 } });
  const current = snapshot(hlsQuality, { variantId: "auto", variants });
  assert.equal(variantButtonText(renderControls(current)), "Auto (up to 2026 × 1080)");

  const pending: PanoVideoQualitySwitch = { target: { variantId: "4k" }, state: "buffering" };
  assert.equal(
    variantButtonText(renderControls(snapshot(hlsQuality, { variantId: "auto", variants, qualitySwitch: pending }))),
    "4K (3840 × 2048) · Switching…",
  );
  assert.equal(variantButtonText(renderControls(current)), "Auto (up to 2026 × 1080)");
});
