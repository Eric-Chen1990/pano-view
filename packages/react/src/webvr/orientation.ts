import { useSyncExternalStore } from "react";

function subscribePortraitOrientation(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const media = window.matchMedia("(orientation: portrait)");
  const notify = () => onChange();
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", notify);
  } else {
    media.addListener(notify);
  }
  window.addEventListener("orientationchange", notify);
  window.addEventListener("resize", notify);
  return () => {
    if (typeof media.removeEventListener === "function") {
      media.removeEventListener("change", notify);
    } else {
      media.removeListener(notify);
    }
    window.removeEventListener("orientationchange", notify);
    window.removeEventListener("resize", notify);
  };
}

function getPortraitOrientation(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(orientation: portrait)").matches;
}

export function usePortraitOrientation(): boolean {
  return useSyncExternalStore(
    subscribePortraitOrientation,
    getPortraitOrientation,
    () => false,
  );
}
