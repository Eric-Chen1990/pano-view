export type HotspotChromaKey = {
  /** Six-digit sRGB hex color, for example "#00B140". */
  color: string;
  /** Radius of the fully transparent region in normalized chroma. Defaults to 0.12. */
  threshold?: number;
  /** Width of the soft edge in normalized chroma. Defaults to 0.08. */
  smoothing?: number;
};

export const DEFAULT_CHROMA_KEY = { color: "#00B140", threshold: 0.12, smoothing: 0.08 };

export function isChromaKeyColor(color: unknown): color is string {
  return typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
}

export function parseHotspotChromaKey(value: unknown): HotspotChromaKey {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("chromaKey: expected an object");
  const { color, threshold, smoothing } = value as Record<string, unknown>;
  if (!isChromaKeyColor(color)) throw new Error("chromaKey.color: expected #RRGGBB");
  const result: HotspotChromaKey = { color };
  for (const [name, amount] of [["threshold", threshold], ["smoothing", smoothing]] as const) {
    if (amount === undefined) continue;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 1)
      throw new Error(`chromaKey.${name}: expected a finite number from 0 to 1`);
    result[name] = amount;
  }
  return result;
}

// BT.709 Cb and Cr, scaled so the distance between any two colors is at most one.
export const CHROMA_BLUE = [-0.2126 / 1.8556, -0.7152 / 1.8556, 0.5].map(value => value * Math.SQRT1_2);
export const CHROMA_RED = [0.5, -0.7152 / 1.5748, -0.0722 / 1.5748].map(value => value * Math.SQRT1_2);

// sRGB texture decoding and encoding can shift chroma by less than one code value.
export const CHROMA_TOLERANCE = 0.001;

function chroma(weights: number[], r: number, g: number, b: number) {
  return weights[0]! * r + weights[1]! * g + weights[2]! * b;
}

function unit(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

export function resolveHotspotChromaKey(config: HotspotChromaKey | undefined) {
  if (!isChromaKeyColor(config?.color)) return undefined;
  const hex = Number.parseInt(config.color.slice(1), 16);
  const r = (hex >> 16) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return {
    cb: chroma(CHROMA_BLUE, r, g, b),
    cr: chroma(CHROMA_RED, r, g, b),
    threshold: unit(config.threshold, DEFAULT_CHROMA_KEY.threshold),
    smoothing: unit(config.smoothing, DEFAULT_CHROMA_KEY.smoothing),
  };
}

export type ResolvedChromaKey = NonNullable<ReturnType<typeof resolveHotspotChromaKey>>;

export function chromaKeyAlpha(key: ResolvedChromaKey, r: number, g: number, b: number, sourceAlpha = 1) {
  const distance = Math.hypot(chroma(CHROMA_BLUE, r, g, b) - key.cb, chroma(CHROMA_RED, r, g, b) - key.cr);
  const threshold = key.threshold + CHROMA_TOLERANCE;
  if (key.smoothing === 0) return distance > threshold ? sourceAlpha : 0;
  const t = Math.min(1, Math.max(0, (distance - threshold) / Math.max(key.smoothing, 0.000001)));
  return sourceAlpha * t * t * (3 - 2 * t);
}
