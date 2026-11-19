import type { Texture, WebGLRenderer } from "three";
import type { WebGPUBackend, WebGPURenderer } from "three/webgpu";

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
