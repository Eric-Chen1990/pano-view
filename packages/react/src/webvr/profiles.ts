import type {
  WebVRProfile,
  WebVRProfileId,
  WebVRSettings,
} from "./types";

export const WEBVR_PROFILE_IDS = [
  "none",
  "cardboard-v1",
  "cardboard-v2",
  "gear-vr",
  "daydream",
] as const satisfies readonly WebVRProfileId[];

export const WEBVR_PROFILES: Record<WebVRProfileId, WebVRProfile> = {
  none: {
    id: "none",
    label: "No Distortion",
    fov: 80,
    ipdMm: 60,
    screenToLensMm: 42,
    k1: 0,
    k2: 0,
  },
  "cardboard-v1": {
    id: "cardboard-v1",
    label: "Cardboard V1",
    fov: 80,
    ipdMm: 60,
    screenToLensMm: 42,
    k1: 0.441,
    k2: 0.156,
  },
  "cardboard-v2": {
    id: "cardboard-v2",
    label: "Cardboard V2",
    fov: 90,
    ipdMm: 64,
    screenToLensMm: 39,
    k1: 0.336,
    k2: 0.553,
  },
  "gear-vr": {
    id: "gear-vr",
    label: "Gear VR",
    fov: 96,
    ipdMm: 63.5,
    screenToLensMm: 50,
    k1: 0.215,
    k2: 0.215,
  },
  daydream: {
    id: "daydream",
    label: "Daydream",
    fov: 90,
    ipdMm: 61.5,
    screenToLensMm: 44,
    k1: 0.385,
    k2: 0.593,
  },
};

export const DEFAULT_WEBVR_SETTINGS: WebVRSettings = {
  screensize: "auto",
  profileId: "cardboard-v1",
};

const STORAGE_KEY = "pano-view:webvr-settings:v1";

export function isWebVRProfileId(value: unknown): value is WebVRProfileId {
  return (
    typeof value === "string" &&
    (WEBVR_PROFILE_IDS as readonly string[]).includes(value)
  );
}

export function cycleWebVRProfileId(
  current: WebVRProfileId,
  step: -1 | 1,
): WebVRProfileId {
  const index = WEBVR_PROFILE_IDS.indexOf(current);
  const count = WEBVR_PROFILE_IDS.length;
  const next = ((index < 0 ? 0 : index) + step + count) % count;
  return WEBVR_PROFILE_IDS[next]!;
}

export function resolveWebVRProfile(
  profile: WebVRProfileId | WebVRProfile | undefined,
  storedId: WebVRProfileId,
): WebVRProfile {
  if (profile && typeof profile === "object") {
    return {
      ...profile,
      fov: clamp(profile.fov, 30, 140),
      ipdMm: clamp(profile.ipdMm, 40, 80),
    };
  }
  return WEBVR_PROFILES[profile ?? storedId];
}

export function loadWebVRSettings(): WebVRSettings {
  if (typeof localStorage === "undefined") {
    return DEFAULT_WEBVR_SETTINGS;
  }
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as {
      screensize?: unknown;
      profileId?: unknown;
    } | null;
    const screensize =
      value?.screensize === "auto" ||
      (typeof value?.screensize === "number" &&
        Number.isFinite(value.screensize) &&
        value.screensize >= 3 &&
        value.screensize <= 20)
        ? value.screensize
        : DEFAULT_WEBVR_SETTINGS.screensize;
    const profileId = isWebVRProfileId(value?.profileId)
      ? value.profileId
      : DEFAULT_WEBVR_SETTINGS.profileId;
    return { screensize, profileId };
  } catch {
    return DEFAULT_WEBVR_SETTINGS;
  }
}

export function saveWebVRSettings(settings: WebVRSettings): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in private or embedded browsing contexts.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
