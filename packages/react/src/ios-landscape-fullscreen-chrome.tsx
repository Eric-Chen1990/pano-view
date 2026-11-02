import { useSyncExternalStore } from "react";
import {
  getIphoneLandscapeFullscreenSnapshot,
  subscribeIphoneLandscapeFullscreen,
  type IphoneFullscreenSessionSnapshot,
} from "./ios-landscape-fullscreen";
import {
  subscribeWebVRHost,
  type WebVRHost,
} from "./webvr/host";

function RotatePhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      className="pano-webvr-portrait-icon"
      fill="none"
      height="48"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 48 48"
      width="48"
    >
      <rect height="28" rx="3" width="18" x="15" y="6" />
      <path d="M10 34c-3-3-4-7-3-11" />
      <path d="M8 36l2-2 2 2" />
      <path d="M38 14c3 3 4 7 3 11" />
      <path d="M40 12l-2 2-2-2" />
    </svg>
  );
}

function swipeMessage(state: IphoneFullscreenSessionSnapshot["state"]): string | null {
  switch (state) {
    case 0:
      return null;
    case 1:
      return "Swipe up to hide the browser bars";
    case 2:
      return "Swipe down, then swipe up to hide the browser bars";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

/**
 * Portrait / swipe instructions while an iPhone landscape fullscreen session
 * is active. Skips the portrait layer when MobileVR already shows its own.
 */
export function IphoneLandscapeFullscreenChrome({
  webVRHost,
}: {
  webVRHost: WebVRHost;
}) {
  const snapshot = useSyncExternalStore(
    subscribeIphoneLandscapeFullscreen,
    getIphoneLandscapeFullscreenSnapshot,
    getIphoneLandscapeFullscreenSnapshot,
  );
  useSyncExternalStore(
    (listener) => subscribeWebVRHost(webVRHost, listener),
    () => webVRHost.revision,
    () => webVRHost.revision,
  );

  if (!snapshot.active) {
    return null;
  }

  const vrMode = webVRHost.snapshot.mode;
  const vrOwnsPortraitPrompt = vrMode === "mobilevr";

  if (snapshot.portrait) {
    if (vrOwnsPortraitPrompt) {
      return null;
    }
    return (
      <div className="pano-webvr-portrait-prompt" role="status">
        <RotatePhoneIcon />
        <p className="pano-webvr-portrait-text">Rotate your phone to landscape</p>
      </div>
    );
  }

  const message = swipeMessage(snapshot.state);
  if (!message) {
    return null;
  }

  return (
    <div
      className="pano-iphone-fullscreen-swipe-prompt"
      role="status"
    >
      <p className="pano-iphone-fullscreen-swipe-text">{message}</p>
    </div>
  );
}
