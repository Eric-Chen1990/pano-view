import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Texture,
  Vector2,
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
  if (typeof OffscreenCanvas !== "undefined" && image instanceof OffscreenCanvas) {
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

function sampleTextureAlpha(texture: Texture, u: number, v: number): number | null {
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
  return data.data[(pixelY * data.width + pixelX) * 4 + 3]! / 255;
}

function hotspotPlaneRaycast(
  this: Mesh,
  raycaster: Raycaster,
  intersects: Intersection[],
) {
  const material = Array.isArray(this.material) ? this.material[0] : this.material;
  if (!(material instanceof MeshBasicMaterial)) {
    Mesh.prototype.raycast.call(this, raycaster, intersects);
    return;
  }
  const cutoff = Math.max(material.alphaTest, HOTSPOT_ALPHA_CUTOFF);
  if (material.opacity < cutoff) {
    return;
  }
  RAYCAST_HITS.length = 0;
  Mesh.prototype.raycast.call(this, raycaster, RAYCAST_HITS);
  const map = material.map;
  for (const hit of RAYCAST_HITS) {
    if (!map || !hit.uv) {
      intersects.push(hit);
      continue;
    }
    const texelAlpha = sampleTextureAlpha(map, hit.uv.x, hit.uv.y);
    if (texelAlpha === null || texelAlpha * material.opacity >= cutoff) {
      intersects.push(hit);
    }
  }
}

export function HotspotPlane({
  map,
  opacity,
}: {
  map: Texture | null;
  opacity?: number;
}) {
  return (
    <mesh raycast={hotspotPlaneRaycast}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        alphaTest={HOTSPOT_ALPHA_CUTOFF}
        alphaToCoverage
        map={map}
        opacity={map ? clampOpacity(opacity) : 0}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}
