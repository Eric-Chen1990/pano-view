import { DataTexture, LinearFilter, LinearMipmapLinearFilter, MathUtils } from "three";

const RAYS = [
  [0.14, 0.91, 0.022, 0.78],
  [0.65, 0.61, 0.032, 0.47],
  [1.37, 0.73, 0.023, 0.66],
  [1.94, 0.55, 0.026, 0.46],
  [2.64, 0.94, 0.019, 0.88],
  [3.28, 0.68, 0.031, 0.58],
  [4.03, 0.84, 0.021, 0.64],
  [4.58, 0.57, 0.028, 0.45],
  [5.32, 0.95, 0.024, 0.84],
  [5.86, 0.64, 0.036, 0.51],
].map(([angle, length, width, strength]) => ({
  x: Math.cos(angle), y: Math.sin(angle), length, width, strength,
}));

type SunTexture = "disc" | "glow" | "rays" | "flare";

function alphaAt(layer: SunTexture, x: number, y: number) {
  const radius = Math.hypot(x, y);
  if (layer === "disc") return 1 - MathUtils.smoothstep(radius, 0.78, 1);
  if (layer === "glow") {
    // A hot inner halo falls into a much broader, faint haze.
    const haze = 0.7 * Math.exp(-6 * radius) + 0.3 * Math.exp(-3 * radius * radius);
    return haze * (1 - MathUtils.smoothstep(radius, 0.36, 1));
  }
  if (layer === "flare") {
    const edge = 1 - MathUtils.smoothstep(radius, 0.62, 1);
    return edge * (0.34 + 0.28 * MathUtils.smoothstep(radius, 0.3, 0.79));
  }

  let alpha = 0;
  for (const ray of RAYS) {
    const along = x * ray.x + y * ray.y;
    if (along <= 0 || along >= ray.length) continue;
    const across = Math.abs(y * ray.x - x * ray.y);
    const width = ray.width * (0.36 + along);
    const taper = (1 - MathUtils.smoothstep(along, 0.12, ray.length));
    const start = MathUtils.smoothstep(along, 0.025, 0.1);
    alpha += ray.strength * start * taper * (1 - MathUtils.smoothstep(across, width * 0.1, width));
  }
  return Math.min(1, alpha);
}

export function createSunTexture(layer: SunTexture) {
  const size = layer === "rays" ? 256 : layer === "glow" ? 128 : 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) {
    const y = (2 * row) / (size - 1) - 1;
    for (let column = 0; column < size; column++) {
      const x = (2 * column) / (size - 1) - 1;
      const index = (row * size + column) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(255 * alphaAt(layer, x, y));
    }
  }
  const texture = new DataTexture(pixels, size, size);
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
