import type { WebVRFrameRate } from "./types";

export function clampWebVRFoveation(
  value: number | undefined,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * Requests the preferred rate after XR presentation starts. The runtime can
 * reject this optional setting even when it advertises supported rates.
 */
export async function applyWebVRFrameRate(
  session: Pick<XRSession, "supportedFrameRates" | "updateTargetFrameRate">,
  frameRate: WebVRFrameRate | undefined,
): Promise<void> {
  const rates = session.supportedFrameRates;
  if (!rates?.length || typeof session.updateTargetFrameRate !== "function") return;

  const last = rates.length - 1;
  let rate = rates[frameRate === "low" ? 0 : frameRate === "mid" ? Math.ceil(last / 2) : last]!;
  if (typeof frameRate === "number" && Number.isFinite(frameRate)) {
    rate = rates[0]!;
    for (const candidate of rates) {
      if (Math.abs(candidate - frameRate) < Math.abs(rate - frameRate)) rate = candidate;
    }
  }
  try {
    await session.updateTargetFrameRate(rate);
  } catch {
    // Keep presenting at the device's current rate.
  }
}
