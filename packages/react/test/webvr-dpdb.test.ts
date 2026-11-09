import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearDpdbCache,
  loadDpdbDocument,
  diagonalInchesFromDpi,
  matchDpdbDevice,
  normalizeDatabaseUrl,
  DEFAULT_WEBVR_DATABASE_URL,
  type DpdbDocument,
} from "../src/webvr/dpdb";

test("normalizeDatabaseUrl uses the default Google DPDB URL", () => {
  assert.equal(normalizeDatabaseUrl(undefined), DEFAULT_WEBVR_DATABASE_URL);
});

test("normalizeDatabaseUrl disables lookups for empty or null", () => {
  assert.equal(normalizeDatabaseUrl(""), null);
  assert.equal(normalizeDatabaseUrl(null), null);
  assert.equal(normalizeDatabaseUrl("   "), null);
});

test("diagonalInchesFromDpi computes a portrait phone diagonal", () => {
  // iPhone 8 Plus style: 1242×2208 @ ~454/458 dpi ≈ 5.5"
  const inches = diagonalInchesFromDpi([453.6, 458.4], 1242, 2208);
  assert.ok(inches !== null);
  assert.ok(inches! >= 5.4 && inches! <= 5.6);
});

test("diagonalInchesFromDpi rejects out-of-range results", () => {
  assert.equal(diagonalInchesFromDpi(1000, 100, 100), null);
  assert.equal(diagonalInchesFromDpi(10, 2000, 3000), null);
});

test("matchDpdbDevice matches Android ua rules", () => {
  const document: DpdbDocument = {
    devices: [
      {
        type: "android",
        rules: [{ ua: "Pixel 7" }],
        dpi: 420,
      },
    ],
  };
  const match = matchDpdbDevice(document, {
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36",
    screenWidth: 412,
    screenHeight: 915,
    devicePixelRatio: 2.625,
  });
  assert.ok(match);
  assert.equal(match!.device.rules?.[0]?.ua, "Pixel 7");
  assert.ok(match!.screensizeInches >= 3 && match!.screensizeInches <= 20);
});

test("matchDpdbDevice matches iOS physical resolution either orientation", () => {
  const document: DpdbDocument = {
    devices: [
      {
        type: "ios",
        rules: [{ res: [1125, 2436] }],
        dpi: 458,
      },
    ],
  };
  const portrait = matchDpdbDevice(document, {
    userAgent: "iPhone",
    screenWidth: 375,
    screenHeight: 812,
    devicePixelRatio: 3,
  });
  const landscape = matchDpdbDevice(document, {
    userAgent: "iPhone",
    screenWidth: 812,
    screenHeight: 375,
    devicePixelRatio: 3,
  });
  assert.ok(portrait);
  assert.ok(landscape);
  assert.equal(portrait!.screensizeInches, landscape!.screensizeInches);
});

test("matchDpdbDevice ignores native-only mdmh rules", () => {
  const document: DpdbDocument = {
    devices: [
      {
        type: "android",
        rules: [{ mdmh: "Google/*/Pixel 7/*" }],
        dpi: 420,
      },
    ],
  };
  const match = matchDpdbDevice(document, {
    userAgent: "Pixel 7",
    screenWidth: 412,
    screenHeight: 915,
    devicePixelRatio: 2.625,
  });
  assert.equal(match, null);
});

test("clearDpdbCache is callable", () => {
  clearDpdbCache();
});

const input = { userAgent: "Android; Pixel 7 Pro", screenWidth: 412, screenHeight: 915, devicePixelRatio: 2.625 };
test("DPDB prefers specific models and rejects platform mismatches and conflicting sizes", () => {
  const devices = [
    { type: "android", rules: [{ ua: "Pixel 7" }], dpi: 400 },
    { type: "android", rules: [{ ua: "Pixel 7 Pro" }], dpi: 420 },
  ];
  assert.equal(matchDpdbDevice({ devices }, input)?.device, devices[1]);
  assert.equal(matchDpdbDevice({ devices }, { ...input, model: "Pixel 7" })?.device, devices[0]);
  assert.equal(matchDpdbDevice({ devices }, { ...input, platform: "ios" }), null);
  assert.equal(matchDpdbDevice({ devices: [devices[1]!, { ...devices[1], dpi: 500 }] }, input), null);
  assert.equal(matchDpdbDevice({ devices: [{ type: "ios", rules: [{ res: [1082, 2402] }], dpi: 400 }] }, input), null);
});

test("DPDB failures can retry and a hung fetch times out", async (t) => {
  clearDpdbCache();
  const original = globalThis.fetch;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.equal(await loadDpdbDocument("https://example.test/dpdb"), null);
    globalThis.fetch = async () => new Response(JSON.stringify({ devices: [] }));
    assert.deepEqual(await loadDpdbDocument("https://example.test/dpdb"), { devices: [] });
    globalThis.fetch = () => new Promise(() => {});
    const pending = loadDpdbDocument("https://example.test/hung");
    t.mock.timers.tick(5000);
    assert.equal(await pending, null);
  } finally {
    globalThis.fetch = original;
    clearDpdbCache();
    t.mock.timers.reset();
  }
});
