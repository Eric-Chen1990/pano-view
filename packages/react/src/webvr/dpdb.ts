export const DEFAULT_WEBVR_DATABASE_URL =
  "https://storage.googleapis.com/cardboard-dpdb/dpdb.json";

export type DpdbDevice = {
  type?: string;
  rules?: Array<Record<string, unknown>>;
  dpi?: number | [number, number] | number[];
  bw?: number;
  ac?: number;
};

export type DpdbDocument = {
  format?: number;
  last_updated?: string;
  devices?: DpdbDevice[];
};

export type DpdbMatchInput = {
  userAgent: string;
  model?: string;
  platform?: "android" | "ios";
  /** CSS pixels from `screen.width`. */
  screenWidth: number;
  /** CSS pixels from `screen.height`. */
  screenHeight: number;
  devicePixelRatio: number;
};

export type DpdbMatchResult = {
  device: DpdbDevice;
  /** Diagonal screen size in inches. */
  screensizeInches: number;
};

const SCREENSIZE_MIN = 3;
const SCREENSIZE_MAX = 20;

const cache = new Map<string, Promise<DpdbDocument | null>>();

export function normalizeDatabaseUrl(
  value: string | null | undefined,
): string | null {
  if (value === null || value === "") {
    return null;
  }
  if (value === undefined) {
    return DEFAULT_WEBVR_DATABASE_URL;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function physicalResolution(
  screenWidth: number,
  screenHeight: number,
  devicePixelRatio: number,
): [number, number] {
  const ratio =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  return [
    Math.round(Math.max(0, screenWidth) * ratio),
    Math.round(Math.max(0, screenHeight) * ratio),
  ];
}

function resolutionsMatch(
  rule: [number, number],
  physical: [number, number],
): boolean {
  const [rw, rh] = rule;
  const [pw, ph] = physical;
  return (rw === pw && rh === ph) || (rw === ph && rh === pw);
}

function platformFromUa(ua: string): "android" | "ios" | undefined {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return undefined;
}

function deviceScore(device: DpdbDevice, input: DpdbMatchInput, physical: [number, number]): number {
  const platform = input.platform ?? platformFromUa(input.userAgent);
  if (!platform || (device.type && device.type !== platform)) return 0;
  let best = 0;
  for (const rule of device.rules ?? []) {
    if (!rule || typeof rule !== "object") continue;
    let score = 0;
    if (typeof rule.ua === "string") {
      const pattern = rule.ua.trim().toLowerCase();
      if (!pattern) continue;
      if (input.model) {
        if (input.model.trim().toLowerCase() !== pattern) continue;
        score = 10000 + pattern.length;
      } else {
        const ua = input.userAgent.toLowerCase();
        const index = ua.indexOf(pattern);
        if (index < 0 || /[a-z0-9]/.test(ua[index + pattern.length] ?? "")) continue;
        score = 100 + pattern.length;
      }
    }
    if (rule.res !== undefined) {
      if (!Array.isArray(rule.res) || rule.res.length !== 2 ||
        !rule.res.every((value) => typeof value === "number") ||
        !resolutionsMatch(rule.res as [number, number], physical)) continue;
      score = Math.max(score, 1);
    }
    best = Math.max(best, score);
  }
  return best;
}

/**
 * Diagonal inches from DPDB dpi and physical pixel resolution.
 * Uses the shorter edge with dpiX and the longer with dpiY when dpi is a pair,
 * matching portrait-oriented DPDB entries.
 */
export function diagonalInchesFromDpi(
  dpi: number | readonly number[],
  physicalWidth: number,
  physicalHeight: number,
): number | null {
  const shortPx = Math.min(physicalWidth, physicalHeight);
  const longPx = Math.max(physicalWidth, physicalHeight);
  if (!(shortPx > 0 && longPx > 0)) {
    return null;
  }

  let dpiX: number;
  let dpiY: number;
  if (typeof dpi === "number") {
    if (!(Number.isFinite(dpi) && dpi > 0)) {
      return null;
    }
    dpiX = dpi;
    dpiY = dpi;
  } else if (Array.isArray(dpi) && dpi.length >= 1) {
    const first = dpi[0];
    const second = dpi.length >= 2 ? dpi[1] : first;
    if (
      typeof first !== "number" ||
      typeof second !== "number" ||
      !(Number.isFinite(first) && first > 0) ||
      !(Number.isFinite(second) && second > 0)
    ) {
      return null;
    }
    dpiX = first;
    dpiY = second;
  } else {
    return null;
  }

  const widthIn = shortPx / dpiX;
  const heightIn = longPx / dpiY;
  const diagonal = Math.sqrt(widthIn * widthIn + heightIn * heightIn);
  if (
    !Number.isFinite(diagonal) ||
    diagonal < SCREENSIZE_MIN ||
    diagonal > SCREENSIZE_MAX
  ) {
    return null;
  }
  return Math.round(diagonal * 10) / 10;
}

export function matchDpdbDevice(
  document: DpdbDocument,
  input: DpdbMatchInput,
): DpdbMatchResult | null {
  const devices = document.devices;
  if (!Array.isArray(devices)) {
    return null;
  }
  const physical = physicalResolution(
    input.screenWidth,
    input.screenHeight,
    input.devicePixelRatio,
  );
  const candidates: Array<DpdbMatchResult & { score: number }> = [];
  for (const device of devices) {
    if (!device || typeof device !== "object" || !Array.isArray(device.rules)) continue;
    const score = deviceScore(device, input, physical);
    if (!score) {
      continue;
    }
    if (device.dpi === undefined) {
      continue;
    }
    const screensizeInches = diagonalInchesFromDpi(
      device.dpi,
      physical[0],
      physical[1],
    );
    if (screensizeInches === null) {
      continue;
    }
    candidates.push({ device, screensizeInches, score });
  }
  const best = Math.max(0, ...candidates.map((candidate) => candidate.score));
  const matches = candidates.filter((candidate) => candidate.score === best);
  if (!matches.length || new Set(matches.map((candidate) => candidate.screensizeInches)).size !== 1) return null;
  return { device: matches[0]!.device, screensizeInches: matches[0]!.screensizeInches };
}

export function readDpdbMatchInput(
  globalObject: Pick<typeof globalThis, "navigator" | "screen" | "devicePixelRatio"> = globalThis,
): DpdbMatchInput | null {
  const navigatorObject = globalObject.navigator;
  const screenObject = globalObject.screen;
  if (!navigatorObject || !screenObject) {
    return null;
  }
  const width = screenObject.width;
  const height = screenObject.height;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !(width > 0 && height > 0)
  ) {
    return null;
  }
  const dpr =
    typeof globalObject.devicePixelRatio === "number"
      ? globalObject.devicePixelRatio
      : 1;
  return {
    platform: navigatorObject.platform === "MacIntel" && navigatorObject.maxTouchPoints > 1 ? "ios" : platformFromUa(navigatorObject.userAgent),
    userAgent: navigatorObject.userAgent ?? "",
    screenWidth: width,
    screenHeight: height,
    devicePixelRatio: dpr,
  };
}

async function fetchDpdbDocument(url: string): Promise<DpdbDocument | null> {
  try {
    const response = await fetch(url, {
      credentials: "omit",
      mode: "cors",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as unknown;
    if (
      data === null ||
      typeof data !== "object" ||
      !("devices" in data) ||
      !Array.isArray((data as DpdbDocument).devices)
    ) {
      return null;
    }
    return data as DpdbDocument;
  } catch {
    return null;
  }
}

/**
 * Loads a DPDB document. Successful responses are cached by URL; failures are
 * not cached so a later enter can retry.
 */
export function loadDpdbDocument(url: string): Promise<DpdbDocument | null> {
  const existing = cache.get(url);
  if (existing) {
    return existing;
  }
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 5000); });
  const pending = Promise.race([fetchDpdbDocument(url), timeout]).then((document) => {
    clearTimeout(timer);
    if (!document) {
      cache.delete(url);
    }
    return document;
  });
  cache.set(url, pending);
  return pending;
}

/** Clears the in-memory DPDB cache. Intended for tests. */
export function clearDpdbCache(): void {
  cache.clear();
}

/**
 * Resolves auto screen size from the Cardboard DPDB.
 * Returns `null` when the URL is disabled, the device is unknown, or loading fails.
 */
export async function resolveScreensizeFromDpdb(
  databaseUrl: string | null | undefined,
  input: DpdbMatchInput | null = readDpdbMatchInput(),
): Promise<number | null> {
  const url = normalizeDatabaseUrl(databaseUrl);
  if (!url || !input) {
    return null;
  }
  const documentPromise = loadDpdbDocument(url);
  if (!input.model && (input.platform ?? platformFromUa(input.userAgent)) === "android" && typeof navigator !== "undefined") {
    const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues: (hints: string[]) => Promise<{ model?: string }> } }).userAgentData;
    if (uaData) {
      let timer: ReturnType<typeof setTimeout>;
      try {
        const hints = await Promise.race([
          uaData.getHighEntropyValues(["model"]),
          new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 500); }),
        ]);
        if (hints?.model) input = { ...input, model: hints.model };
      } catch { /* Model information is optional. */ }
      finally { clearTimeout(timer!); }
    }
  }
  const document = await documentPromise;
  if (!document) {
    return null;
  }
  return matchDpdbDevice(document, input)?.screensizeInches ?? null;
}
