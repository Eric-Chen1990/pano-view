import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
  Vector3,
} from "three";
import type {
  SphereTileAddress,
  SphereTileLevel,
  SphereTileMultiresConfig,
} from "./types";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

export function parseSphereMultires(
  input: string | SphereTileMultiresConfig,
): SphereTileMultiresConfig {
  const parts =
    typeof input === "string"
      ? input.split(",").map((part) => part.trim())
      : null;
  const tileSize = positiveInteger(
    parts ? Number(parts[0]) : (input as SphereTileMultiresConfig).tileSize,
    "tileSize",
  );
  const levels = parts
    ? parts.slice(1).map((part) => {
        const match = /^(\d+)\s*x\s*(\d+)$/i.exec(part);
        if (!match)
          throw new Error("sphere multires levels must use widthxheight");
        return { width: Number(match[1]), height: Number(match[2]) };
      })
    : (input as SphereTileMultiresConfig).levels.map((level) => ({ ...level }));
  if (levels.length === 0)
    throw new Error("sphere multires needs at least one level");
  levels.forEach((level, index) => {
    positiveInteger(level.width, "level width");
    positiveInteger(level.height, "level height");
    // Odd source dimensions accumulate one pixel of rounding at small levels.
    if (Math.abs(level.width - level.height * 2) > 2)
      throw new Error("sphere levels must be full 2:1 equirectangular images");
    const previous = levels[index - 1];
    if (
      previous &&
      (level.width <= previous.width || level.height <= previous.height)
    ) {
      throw new Error("sphere multires dimensions must be strictly ascending");
    }
  });
  return { tileSize, levels };
}

export function resolveSphereTemplateUrl(
  template: string,
  address: SphereTileAddress,
  indexBase: 0 | 1 = 1,
): string {
  return template
    .replace(/%l/g, String(address.level + indexBase))
    .replace(
      /%(0*)([hxucvywr])/g,
      (_match, zeroes: string, placeholder: string) =>
        String(
          ("hxuc".includes(placeholder) ? address.col : address.row) +
            indexBase,
        ).padStart(zeroes.length + 1, "0"),
    );
}

export function sphereTileKey(address: SphereTileAddress): string {
  return `${address.level}/${address.row}/${address.col}`;
}

export function sphereTileAddresses(
  size: SphereTileLevel,
  level: number,
  tileSize: number,
): SphereTileAddress[] {
  const addresses: SphereTileAddress[] = [];
  for (let row = 0; row < Math.ceil(size.height / tileSize); row++) {
    for (let col = 0; col < Math.ceil(size.width / tileSize); col++) {
      addresses.push({
        level,
        col,
        row,
        imageWidth: size.width,
        imageHeight: size.height,
        tileSize,
        width: Math.min(tileSize, size.width - col * tileSize),
        height: Math.min(tileSize, size.height - row * tileSize),
      });
    }
  }
  return addresses;
}

export function sphereTileRange(address: SphereTileAddress) {
  return {
    left: (address.col * address.tileSize) / address.imageWidth,
    right:
      (address.col * address.tileSize + address.width) / address.imageWidth,
    top: (address.row * address.tileSize) / address.imageHeight,
    bottom:
      (address.row * address.tileSize + address.height) / address.imageHeight,
  };
}

/** Source center faces yaw 0; image right follows positive yaw, top positive pitch. */
export function spherePoint(
  u: number,
  v: number,
  yawOffset = 0,
  radius = DEFAULT_PANORAMA_RADIUS,
): Vector3 {
  const yaw = (u - 0.5) * Math.PI * 2 + MathUtils.degToRad(yawOffset);
  const pitch = (0.5 - v) * Math.PI;
  return new Vector3(
    Math.sin(yaw) * Math.cos(pitch) * radius,
    Math.sin(pitch) * radius,
    -Math.cos(yaw) * Math.cos(pitch) * radius,
  );
}

export function sphereTileBounds(
  address: SphereTileAddress,
  yawOffset: number,
): Box3 {
  const { left, right, top, bottom } = sphereTileRange(address);
  const us = [left, right];
  // Include all longitude extrema after rotation, not just tile corners.
  for (let i = -4; i <= 8; i++) {
    const u = 0.5 + (i * 90 - (yawOffset % 360)) / 360;
    if (u > left && u < right) us.push(u);
  }
  const vs = top < 0.5 && bottom > 0.5 ? [top, 0.5, bottom] : [top, bottom];
  return new Box3().setFromPoints(
    us.flatMap((u) => vs.map((v) => spherePoint(u, v, yawOffset))),
  );
}

export function sphereTileGeometry(
  address: SphereTileAddress,
  yawOffset: number,
  radius = DEFAULT_PANORAMA_RADIUS,
): BufferGeometry {
  const { left, right, top, bottom } = sphereTileRange(address);
  const columns = Math.max(2, Math.ceil(((right - left) * 360) / 3));
  const rows = Math.max(2, Math.ceil(((bottom - top) * 180) / 3));
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const u = col / columns,
        v = row / rows;
      const point = spherePoint(
        left + (right - left) * u,
        top + (bottom - top) * v,
        yawOffset,
        radius,
      );
      positions.push(point.x, point.y, point.z);
      uvs.push(u, 1 - v);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col,
          b = a + 1,
          c = a + columns + 1,
          d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function preferredSphereLevel(
  levels: SphereTileLevel[],
  height: number,
  dpr: number,
  verticalFov: number,
): number {
  const needed = (height * dpr * 180) / Math.max(1, verticalFov);
  const index = levels.findIndex((level) => level.height >= needed);
  return index < 0 ? levels.length - 1 : index;
}
