import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeChromeOverlapPx,
  computeIphoneFullscreenState,
  computeScrollAwayDistance,
  isIphoneLandscapeFullscreenCandidate,
  type IphoneFullscreenViewport,
} from "../src/ios-landscape-fullscreen";

function viewport(
  partial: Partial<IphoneFullscreenViewport>,
): IphoneFullscreenViewport {
  return {
    inIframe: false,
    landscape: true,
    largeViewportHeight: 390,
    scrollY: 0,
    visualViewportHeight: 390,
    visualViewportOffsetTop: 0,
    ...partial,
  };
}

test("iPhone UA without fullscreen API is a candidate", () => {
  assert.equal(
    isIphoneLandscapeFullscreenCandidate(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      { fullscreenEnabled: false, standalone: false },
    ),
    true,
  );
});

test("CriOS and FxiOS iPhone UAs are candidates", () => {
  assert.equal(
    isIphoneLandscapeFullscreenCandidate(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
      { fullscreenEnabled: false, standalone: false },
    ),
    true,
  );
  assert.equal(
    isIphoneLandscapeFullscreenCandidate(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15",
      { fullscreenEnabled: false, standalone: false },
    ),
    true,
  );
});

test("iPad, desktop, fullscreen API, and standalone are not candidates", () => {
  assert.equal(
    isIphoneLandscapeFullscreenCandidate(
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      { fullscreenEnabled: false, standalone: false },
    ),
    false,
  );
  assert.equal(
    isIphoneLandscapeFullscreenCandidate(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15",
      { fullscreenEnabled: false, standalone: false },
    ),
    false,
  );
  assert.equal(
    isIphoneLandscapeFullscreenCandidate(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      { fullscreenEnabled: true, standalone: false },
    ),
    false,
  );
  assert.equal(
    isIphoneLandscapeFullscreenCandidate(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      { fullscreenEnabled: false, standalone: true },
    ),
    false,
  );
});

test("state 0 when bars are collapsed or portrait / iframe", () => {
  assert.equal(
    computeIphoneFullscreenState(
      viewport({ largeViewportHeight: 390, visualViewportHeight: 380 }),
    ),
    0,
  );
  assert.equal(
    computeIphoneFullscreenState(viewport({ landscape: false })),
    0,
  );
  assert.equal(
    computeIphoneFullscreenState(viewport({ inIframe: true })),
    0,
  );
});

test("state 1 when landscape bars are visible at the top", () => {
  assert.equal(
    computeIphoneFullscreenState(
      viewport({
        largeViewportHeight: 390,
        visualViewportHeight: 320,
        scrollY: 0,
        visualViewportOffsetTop: 0,
      }),
    ),
    1,
  );
});

test("state 2 when bars remain after a scroll or visual offset", () => {
  assert.equal(
    computeIphoneFullscreenState(
      viewport({
        largeViewportHeight: 390,
        visualViewportHeight: 320,
        scrollY: 40,
      }),
    ),
    2,
  );
  assert.equal(
    computeIphoneFullscreenState(
      viewport({
        largeViewportHeight: 390,
        visualViewportHeight: 320,
        visualViewportOffsetTop: 24,
      }),
    ),
    2,
  );
});

test("a finished swipe-up stays hidden instead of asking to swipe down", () => {
  const open = {
    minVisualHeight: 320,
    maxVisualHeight: 320,
  };
  assert.equal(
    computeIphoneFullscreenState(
      viewport({
        largeViewportHeight: 844,
        visualViewportHeight: 320,
        scrollY: 0,
        visualViewportOffsetTop: 0,
      }),
      open,
    ),
    1,
  );
  assert.equal(
    computeIphoneFullscreenState(
      viewport({
        largeViewportHeight: 844,
        visualViewportHeight: 372,
        scrollY: 64,
        visualViewportOffsetTop: 28,
      }),
      { minVisualHeight: 320, maxVisualHeight: 372 },
    ),
    0,
  );
});

test("scroll without a taller viewport still asks to swipe down then up", () => {
  assert.equal(
    computeIphoneFullscreenState(
      viewport({
        largeViewportHeight: 390,
        visualViewportHeight: 320,
        scrollY: 40,
        visualViewportOffsetTop: 24,
      }),
      { minVisualHeight: 320, maxVisualHeight: 320 },
    ),
    2,
  );
});

test("scroll-away distance is the chrome overlap while bars are visible", () => {
  const open = viewport({
    largeViewportHeight: 390,
    visualViewportHeight: 320,
  });
  assert.equal(computeChromeOverlapPx(open), 70);
  assert.equal(computeScrollAwayDistance(open), 70);
  assert.equal(
    computeScrollAwayDistance(
      viewport({ largeViewportHeight: 390, visualViewportHeight: 385 }),
    ),
    0,
  );
  assert.equal(
    computeScrollAwayDistance(viewport({ landscape: false, visualViewportHeight: 200 })),
    0,
  );
});
