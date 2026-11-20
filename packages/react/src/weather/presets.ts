export const PANO_RAIN_PRESETS = ["drizzle", "steady", "downpour"] as const;
export const PANO_SNOW_PRESETS = ["powder", "crystal", "fluffy", "star", "fern", "needles"] as const;

export type PanoRainPreset = (typeof PANO_RAIN_PRESETS)[number];
export type PanoSnowPreset = (typeof PANO_SNOW_PRESETS)[number];

type WeatherSettings = {
  enabled?: boolean;
  intensity?: number;
  /** Horizontal wind along the viewer's world X and Z axes. */
  wind?: readonly [x: number, z: number];
};

export type PanoWeatherProps = WeatherSettings &
  (
    | { type: "rain"; preset?: PanoRainPreset }
    | {
        type: "snow";
        preset?: PanoSnowPreset;
        /** Smallest and largest snowflake diameters, in Three.js world units. */
        sizeRange?: readonly [min: number, max: number];
        /** World Y where snowflakes disappear. Omit to use the preset's falling volume. */
        groundY?: number;
      }
  );

type Range = readonly [min: number, max: number];

export type WeatherStyle = {
  shape: "streak" | PanoSnowPreset;
  count: number;
  width: Range;
  height?: Range;
  fallSpeed: Range;
  opacity: number;
  sway: number;
  spin: number;
};

const RAIN_STYLES: Record<PanoRainPreset, WeatherStyle> = {
  drizzle: {
    shape: "streak", count: 1400, width: [0.035, 0.065], height: [0.2, 0.4],
    fallSpeed: [9, 14], opacity: 0.38, sway: 0, spin: 0,
  },
  steady: {
    shape: "streak", count: 2100, width: [0.05, 0.085], height: [0.42, 0.85],
    fallSpeed: [16, 24], opacity: 0.54, sway: 0, spin: 0,
  },
  downpour: {
    shape: "streak", count: 3000, width: [0.075, 0.135], height: [0.72, 1.45],
    fallSpeed: [22, 32], opacity: 0.64, sway: 0, spin: 0,
  },
};

const SNOW_STYLES: Record<PanoSnowPreset, WeatherStyle> = {
  powder: {
    shape: "powder", count: 2700, width: [0.095, 0.25],
    fallSpeed: [1.6, 2.5], opacity: 0.72, sway: 0.28, spin: 0,
  },
  crystal: {
    shape: "crystal", count: 2200, width: [0.28, 0.58],
    fallSpeed: [1.1, 1.9], opacity: 0.87, sway: 0.58, spin: 0.7,
  },
  fluffy: {
    shape: "fluffy", count: 1550, width: [0.33, 0.72],
    fallSpeed: [0.62, 1.3], opacity: 0.8, sway: 1.24, spin: 0.32,
  },
  star: {
    shape: "star", count: 1850, width: [0.24, 0.5],
    fallSpeed: [1.05, 1.7], opacity: 0.8, sway: 0.5, spin: 0.55,
  },
  fern: {
    shape: "fern", count: 1750, width: [0.36, 0.7],
    fallSpeed: [0.82, 1.48], opacity: 0.86, sway: 0.82, spin: 0.4,
  },
  needles: {
    shape: "needles", count: 2500, width: [0.19, 0.42],
    fallSpeed: [1.45, 2.35], opacity: 0.83, sway: 0.45, spin: 1.15,
  },
};

export const WEATHER_CAPACITY = {
  rain: RAIN_STYLES.downpour.count,
  snow: SNOW_STYLES.powder.count,
};

export function resolveWeatherStyle(props: PanoWeatherProps): WeatherStyle {
  if (props.type === "rain") {
    return props.preset !== undefined && PANO_RAIN_PRESETS.includes(props.preset)
      ? RAIN_STYLES[props.preset]
      : RAIN_STYLES.steady;
  }
  return props.preset !== undefined && PANO_SNOW_PRESETS.includes(props.preset)
    ? SNOW_STYLES[props.preset]
    : SNOW_STYLES.crystal;
}

export function normalizeWeatherValue(value: number | undefined, min: number, fallback: number) {
  return value !== undefined && Number.isFinite(value)
    ? Math.min(1, Math.max(min, value))
    : fallback;
}

export function weatherParticleCount(capacity: number, intensity: number) {
  return Math.ceil(capacity * intensity * intensity);
}

export function resolveSnowSizeRange(value: Range | undefined, fallback: Range): Range {
  if (value === undefined) return fallback;
  const [lower, upper] = fallback;
  const min = Number.isFinite(value[0]) ? Math.min(2, Math.max(0.02, value[0])) : lower;
  const max = Number.isFinite(value[1]) ? Math.min(2, Math.max(0.02, value[1])) : upper;
  return min <= max ? [min, max] : [max, min];
}

export function resolveSnowGroundY(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value)
    ? Math.min(0, Math.max(-100, value))
    : undefined;
}
