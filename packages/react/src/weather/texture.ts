import { DataTexture, LinearFilter, LinearMipmapLinearFilter, MathUtils } from "three";
import type { WeatherStyle } from "./presets";

const FLUFF_LOBES = [
  [-0.29, 0.12, 0.5],
  [0.24, 0.25, 0.49],
  [0.36, -0.18, 0.42],
  [-0.17, -0.31, 0.48],
  [-0.01, 0.02, 0.61],
] as const;

const FERN_BRANCHES = [0.25, 0.43, 0.61] as const;
const CRYSTAL_BRANCHES = [0.36, 0.60] as const;
const NEEDLES = [[-0.58, -0.6, 0.51, 0.52], [-0.24, -0.79, 0.30, 0.73], [-0.60, 0.44, 0.66, -0.45]] as const;

function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

function crystalAlpha(shape: "crystal" | "fern" | "star", x: number, y: number) {
  const radius = Math.hypot(x, y);
  const sector = Math.PI / 3;
  const angle = Math.atan2(y, x);
  const armAngle = angle - Math.round(angle / sector) * sector;
  const along = radius * Math.cos(armAngle);
  const across = Math.abs(radius * Math.sin(armAngle));
  if (shape === "star") {
    const edge = along + 1.55 * across;
    const face = 1 - MathUtils.smoothstep(edge, 0.82, 0.93);
    return face * MathUtils.lerp(0.72, 1, 1 - MathUtils.smoothstep(across, 0.015, 0.12));
  }

  const stem = Math.hypot(Math.max(0, along - 0.88), across);
  let distance = stem;
  const fern = shape === "fern";
  for (const branch of fern ? FERN_BRANCHES : CRYSTAL_BRANCHES) {
    // Reflect across the stem to make a pair of branches in each sector.
    const length = fern ? 0.31 - 0.32 * branch : 0.16;
    distance = Math.min(distance, segmentDistance(along, across, branch, 0, branch + length, length));
    if (fern) {
      const twig = length * 0.53;
      distance = Math.min(distance, segmentDistance(along, across, branch + twig, twig, branch + length, twig + 0.10));
    }
  }
  const branches = 1 - MathUtils.smoothstep(distance, fern ? 0.018 : 0.028, fern ? 0.058 : 0.073);
  const center = 1 - MathUtils.smoothstep(radius, 0.06, 0.18);
  return Math.max(branches, center);
}

function shapeAlpha(shape: WeatherStyle["shape"], x: number, y: number) {
  switch (shape) {
    case "streak": {
      const along = (y + 1) / 2;
      const width = MathUtils.lerp(0.88, 0.26, along);
      const cross = 1 - MathUtils.smoothstep(Math.abs(x) / width, 0.04, 1);
      return cross * MathUtils.smoothstep(along, 0, 0.13) * (1 - MathUtils.smoothstep(along, 0.2, 0.99));
    }
    case "powder":
      return 1 - MathUtils.smoothstep(Math.hypot(x, y), 0.13, 0.91);
    case "crystal":
    case "star":
    case "fern":
      return crystalAlpha(shape, x, y);
    case "needles": {
      let distance = 1;
      for (const [ax, ay, bx, by] of NEEDLES) {
        distance = Math.min(distance, segmentDistance(x, y, ax, ay, bx, by));
      }
      return 1 - MathUtils.smoothstep(distance, 0.028, 0.085);
    }
    case "fluffy": {
      let coverage = 0;
      for (const [cx, cy, radius] of FLUFF_LOBES) {
        const lobe = 1 - MathUtils.smoothstep(Math.hypot(x - cx, y - cy), 0, radius);
        coverage += lobe * (1 - coverage) * 0.78;
      }
      return coverage;
    }
  }
}

export function createWeatherTexture(shape: WeatherStyle["shape"]): DataTexture {
  const width = shape === "streak" ? 16 : 64;
  const height = 64;
  const pixels = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const y = (2 * row) / (height - 1) - 1;
    for (let column = 0; column < width; column++) {
      const x = (2 * column) / (width - 1) - 1;
      const index = (row * width + column) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(255 * shapeAlpha(shape, x, y));
    }
  }
  const texture = new DataTexture(pixels, width, height);
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
