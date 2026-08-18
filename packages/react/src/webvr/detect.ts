export type WebVRCapabilities = {
  webxr: boolean;
  mobile: boolean;
  sensor: boolean;
};

export function isMobileVRDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return (
    /Android|iPad|iPhone|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export async function detectWebVRCapabilities(): Promise<WebVRCapabilities> {
  const mobile = isMobileVRDevice();
  const sensor =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof DeviceOrientationEvent !== "undefined";
  let webxr = false;
  try {
    webxr =
      typeof navigator !== "undefined" &&
      navigator.xr !== undefined &&
      (await navigator.xr.isSessionSupported("immersive-vr"));
  } catch {
    webxr = false;
  }
  return { webxr, mobile, sensor };
}
