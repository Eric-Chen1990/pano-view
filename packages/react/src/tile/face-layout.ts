import {
  Box3,
  Euler,
  Quaternion,
  Vector3,
} from "three";
import type { CubeFaceCode, TileAddress } from "./types";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";

export const CUBE_FACES: CubeFaceCode[] = ["f", "r", "b", "l", "u", "d"];
export const PREVIEW_FACE_ORDER: CubeFaceCode[] = ["l", "f", "r", "b", "u", "d"];
export const CUBE_RADIUS = DEFAULT_PANORAMA_RADIUS;

export type FaceTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
};

export function getFaceTransform(
  face: CubeFaceCode,
  radius = CUBE_RADIUS,
): FaceTransform {
  switch (face) {
    case "f":
      return { position: [0, 0, -radius], rotation: [0, 0, 0] };
    case "b":
      return { position: [0, 0, radius], rotation: [0, Math.PI, 0] };
    case "r":
      return {
        position: [radius, 0, 0],
        rotation: [0, -Math.PI / 2, 0],
      };
    case "l":
      return {
        position: [-radius, 0, 0],
        rotation: [0, Math.PI / 2, 0],
      };
    case "u":
      return {
        position: [0, radius, 0],
        rotation: [Math.PI / 2, 0, 0],
      };
    case "d":
      return {
        position: [0, -radius, 0],
        rotation: [-Math.PI / 2, 0, 0],
      };
  }
}

export function getTileLocalLayout(address: TileAddress, radius = CUBE_RADIUS) {
  const left = (address.col - 1) * address.tileSize;
  const top = (address.row - 1) * address.tileSize;
  const right = left + address.width;
  const bottom = top + address.height;
  return {
    x: (((left + right) / address.faceSize) - 1) * radius,
    y: (1 - (top + bottom) / address.faceSize) * radius,
    width: (address.width / address.faceSize) * radius * 2,
    height: (address.height / address.faceSize) * radius * 2,
  };
}

const faceQuaternionCache = new Map<CubeFaceCode, Quaternion>();

function getFaceQuaternion(face: CubeFaceCode): Quaternion {
  const cached = faceQuaternionCache.get(face);
  if (cached) {
    return cached;
  }
  const transform = getFaceTransform(face);
  const quaternion = new Quaternion().setFromEuler(
    new Euler(...transform.rotation, "XYZ"),
  );
  faceQuaternionCache.set(face, quaternion);
  return quaternion;
}

export function getTileBoundingBox(
  address: TileAddress,
  radius = CUBE_RADIUS,
): Box3 {
  const transform = getFaceTransform(address.face, radius);
  const local = getTileLocalLayout(address, radius);
  const halfWidth = local.width / 2;
  const halfHeight = local.height / 2;
  const quaternion = getFaceQuaternion(address.face);
  const position = new Vector3(...transform.position);
  const corners = [
    new Vector3(local.x - halfWidth, local.y - halfHeight, 0),
    new Vector3(local.x + halfWidth, local.y - halfHeight, 0),
    new Vector3(local.x - halfWidth, local.y + halfHeight, 0),
    new Vector3(local.x + halfWidth, local.y + halfHeight, 0),
  ];

  for (const corner of corners) {
    corner.applyQuaternion(quaternion).add(position);
  }

  return new Box3().setFromPoints(corners);
}

export function makeTileAddress(
  face: CubeFaceCode,
  level: number,
  faceSize: number,
  tileSize: number,
  col: number,
  row: number,
): TileAddress {
  const left = (col - 1) * tileSize;
  const top = (row - 1) * tileSize;
  return {
    face,
    level,
    row,
    col,
    faceSize,
    tileSize,
    width: Math.min(tileSize, faceSize - left),
    height: Math.min(tileSize, faceSize - top),
  };
}

export function tileKey(address: TileAddress): string {
  return `${address.level}/${address.face}/${address.row}/${address.col}`;
}

export function getPreferredLevel(
  levels: number[],
  viewportHeight: number,
  pixelRatio: number,
  verticalFov: number,
  currentLevel: number,
): number {
  const requiredFaceSize =
    viewportHeight * pixelRatio * (90 / Math.max(verticalFov, 1));
  let preferredLevel = levels.length;
  for (let index = 0; index < levels.length; index += 1) {
    if (levels[index]! >= requiredFaceSize) {
      preferredLevel = index + 1;
      break;
    }
  }

  if (preferredLevel > currentLevel) {
    const currentSize = levels[currentLevel - 1] ?? levels[0]!;
    return requiredFaceSize > currentSize * 1.2
      ? preferredLevel
      : currentLevel;
  }
  if (preferredLevel < currentLevel) {
    const preferredSize = levels[preferredLevel - 1] ?? levels[0]!;
    return requiredFaceSize < preferredSize * 0.8
      ? preferredLevel
      : currentLevel;
  }
  return currentLevel;
}

export function previewAtlasVRange(
  face: CubeFaceCode,
  faceOrder: readonly CubeFaceCode[] = PREVIEW_FACE_ORDER,
): {
  offset: number;
  scale: number;
} {
  const index = faceOrder.indexOf(face);
  return {
    offset: (faceOrder.length - index - 1) / faceOrder.length,
    scale: 1 / faceOrder.length,
  };
}
