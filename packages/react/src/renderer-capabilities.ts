import type { Texture, WebGLRenderer } from "three";
import type { WebGPUBackend, WebGPURenderer } from "three/webgpu";

export type RendererFrameStats = {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
};

// Three r185 does not yet declare the WebGPU device on its backend type.
export function getWebGPUDevice(renderer: WebGPURenderer) {
  return (renderer.backend as WebGPUBackend & {
    device: {
      limits: { maxTextureDimension2D: number };
      pushErrorScope(filter: "validation"): void;
      popErrorScope(): Promise<unknown>;
    };
  }).device;
}

export function isWebGPURenderer(renderer: WebGLRenderer | WebGPURenderer): renderer is WebGPURenderer {
  return "isWebGPURenderer" in renderer && renderer.isWebGPURenderer;
}

/**
 * Read per-frame render and resource counters for both backends.
 * WebGPU exposes `drawCalls`; WebGL exposes `calls` for the same role.
 */
export function getRendererFrameStats(
  renderer: WebGLRenderer | WebGPURenderer,
): RendererFrameStats {
  if (isWebGPURenderer(renderer)) {
    return {
      drawCalls: renderer.info.render.drawCalls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    };
  }
  return {
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  };
}

/**
 * WebGL resets `info` on every `render()` by default, so multi-pass frames only
 * keep the last pass. Disable auto-reset while the performance monitor is
 * active; restore the previous value on teardown. WebGPU already resets once
 * per animation frame.
 */
export function configureRendererInfoForAggregation(
  renderer: WebGLRenderer | WebGPURenderer,
): () => void {
  if (isWebGPURenderer(renderer)) return () => {};
  const info = renderer.info;
  const previous = info.autoReset;
  info.autoReset = false;
  return () => {
    info.autoReset = previous;
  };
}

/** Reset WebGL frame counters at the start of a Fiber frame. No-op for WebGPU. */
export function resetRendererFrameStats(
  renderer: WebGLRenderer | WebGPURenderer,
): void {
  if (isWebGPURenderer(renderer)) return;
  renderer.info.reset();
}

export function getTextureAnisotropy(renderer: WebGLRenderer | WebGPURenderer): number {
  return isWebGPURenderer(renderer)
    ? renderer.getMaxAnisotropy()
    : renderer.capabilities.getMaxAnisotropy();
}

export function getMaxTextureSize(renderer: WebGLRenderer | WebGPURenderer): number {
  return isWebGPURenderer(renderer)
    ? getWebGPUDevice(renderer).limits.maxTextureDimension2D
    : renderer.capabilities.maxTextureSize;
}

/** WebGLRenderer already resizes oversized image uploads. Match its behavior for WebGPU. */
export function fitImageTexture(renderer: WebGLRenderer | WebGPURenderer, texture: Texture): void {
  if (!isWebGPURenderer(renderer)) return;
  const image: unknown = texture.image;
  if (typeof HTMLImageElement === "undefined" || !(image instanceof HTMLImageElement)) return;
  const { naturalWidth: width, naturalHeight: height } = image;
  const scale = getMaxTextureSize(renderer) / Math.max(width, height);
  if (scale >= 1) return;
  const canvas = image.ownerDocument.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // TextureLoader's image may be cached and shared with other viewers.
  texture.image = canvas;
  texture.needsUpdate = true;
}
