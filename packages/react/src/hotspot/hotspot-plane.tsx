import { useMemo } from "react";
import { chromaKeyAlpha, resolveHotspotChromaKey, type HotspotChromaKey, type ResolvedChromaKey } from "../../../../shared/chroma-key";
import { PanoBasicMaterial } from "../pano-filter/pano-basic-material";
import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Texture,
  Vector2,
  type BufferGeometry,
  type Intersection,
} from "three";

/** Discard fully empty texels so the plane does not occlude other hotspots. */
const HOTSPOT_ALPHA_CUTOFF = 0.05;
const SAMPLE_UV = new Vector2();
const RAYCAST_HITS: Intersection[] = [];
const IMAGE_DATA_CACHE = new WeakMap<object, ImageData>();

type SampleableImage =
  | HTMLCanvasElement
  | HTMLImageElement
  | ImageBitmap
  | OffscreenCanvas;

function clampOpacity(opacity: number | undefined): number {
  if (!Number.isFinite(opacity)) {
    return 1;
  }
  return Math.max(0, Math.min(opacity!, 1));
}

function isSampleableImage(image: unknown): image is SampleableImage {
  if (image instanceof HTMLImageElement) {
    return image.naturalWidth > 0 && image.naturalHeight > 0;
  }
  if (image instanceof HTMLCanvasElement) {
    return image.width > 0 && image.height > 0;
  }
  if (
    typeof OffscreenCanvas !== "undefined" &&
    image instanceof OffscreenCanvas
  ) {
    return image.width > 0 && image.height > 0;
  }
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return image.width > 0 && image.height > 0;
  }
  return false;
}

function imageSize(image: SampleableImage): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  return { width: image.width, height: image.height };
}

function readImageData(image: SampleableImage): ImageData | null {
  const cached = IMAGE_DATA_CACHE.get(image);
  if (cached) {
    return cached;
  }
  const { width, height } = imageSize(image);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  try {
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, width, height);
    IMAGE_DATA_CACHE.set(image, data);
    return data;
  } catch {
    return null;
  }
}

function sampleTextureAlpha(
  texture: Texture,
  u: number,
  v: number,
  key: ResolvedChromaKey | undefined,
): number | null {
  if (!isSampleableImage(texture.image)) {
    return null;
  }
  const data = readImageData(texture.image);
  if (!data) {
    return null;
  }
  SAMPLE_UV.set(u, v);
  texture.transformUv(SAMPLE_UV);
  const pixelX = Math.min(
    data.width - 1,
    Math.max(0, Math.floor(SAMPLE_UV.x * data.width)),
  );
  const pixelY = Math.min(
    data.height - 1,
    Math.max(0, Math.floor(SAMPLE_UV.y * data.height)),
  );
  const offset = (pixelY * data.width + pixelX) * 4;
  const alpha = data.data[offset + 3]! / 255;
  return key ? chromaKeyAlpha(key,
    data.data[offset]! / 255, data.data[offset + 1]! / 255, data.data[offset + 2]! / 255, alpha,
  ) : alpha;
}

function hotspotPlaneRaycast(
  this: Mesh,
  raycaster: Raycaster,
  intersects: Intersection[],
  key: ResolvedChromaKey | undefined,
) {
  if (!this.visible || this.parent?.visible === false) return;
  const material = Array.isArray(this.material)
    ? this.material[0]
    : this.material;
  if (!(material instanceof MeshBasicMaterial) && !("map" in material)) {
    Mesh.prototype.raycast.call(this, raycaster, intersects);
    return;
  }
  const cutoff = Math.max(material.alphaTest, HOTSPOT_ALPHA_CUTOFF);
  if (material.opacity < cutoff) {
    return;
  }
  RAYCAST_HITS.length = 0;
  Mesh.prototype.raycast.call(this, raycaster, RAYCAST_HITS);
  const map = material.map instanceof Texture ? material.map : null;
  for (const hit of RAYCAST_HITS) {
    if (!map || !hit.uv) {
      intersects.push(hit);
      continue;
    }
    const texelAlpha = sampleTextureAlpha(map, hit.uv.x, hit.uv.y, key);
    if (texelAlpha === null || texelAlpha * material.opacity >= cutoff) {
      intersects.push(hit);
    }
  }
}

export function HotspotPlane({
  map,
  opacity,
  geometry,
  chromaKey,
}: {
  map: Texture | null;
  geometry?: BufferGeometry;
  opacity?: number;
  chromaKey?: HotspotChromaKey;
}) {
  const key = useMemo(() => resolveHotspotChromaKey(chromaKey), [chromaKey]);
  const raycast = useMemo(() => function (this: Mesh, raycaster: Raycaster, hits: Intersection[]) {
    hotspotPlaneRaycast.call(this, raycaster, hits, key);
  }, [key]);
  return (
    <mesh geometry={geometry} raycast={raycast}>
      {geometry ? null : <planeGeometry args={[1, 1]} />}
      <PanoBasicMaterial
        target="hotspot"
        alphaTest={HOTSPOT_ALPHA_CUTOFF}
        map={map}
        chromaKey={map ? key : undefined}
        opacity={map ? clampOpacity(opacity) : 0}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}
