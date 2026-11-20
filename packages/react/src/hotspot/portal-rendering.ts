import type { RootState } from "@react-three/fiber";
import {
  Color, LinearFilter, LinearSRGBColorSpace, Vector4, WebGLRenderTarget, type Camera,
  type RenderTarget, type Scene,
} from "three";
import { createWebGPUTarget, withWebGPUState, type WebGPUFramePasses } from "../webgpu-frame";

export function createPortalTarget(gpu: WebGPUFramePasses | undefined) {
  const target = gpu ? createWebGPUTarget() : new WebGLRenderTarget(1, 1);
  target.texture.colorSpace = LinearSRGBColorSpace;
  target.texture.minFilter = LinearFilter;
  target.texture.magFilter = LinearFilter;
  target.texture.generateMipmaps = false;
  return target;
}

/** Offscreen rendering never owns the canvas or the XR frame. */
export function renderPortalTarget(
  gl: RootState["gl"], gpu: WebGPUFramePasses | undefined,
  target: RenderTarget, scene: Scene, camera: Camera,
) {
  if (gpu) {
    withWebGPUState(gpu.renderer, () => {
      gpu.renderer.xr.enabled = false;
      gpu.renderer.autoClear = true;
      gpu.renderer.setRenderTarget(target);
      gpu.renderer.setScissorTest(false);
      gpu.render(scene, camera);
    });
    return;
  }
  const previous = gl.getRenderTarget();
  const face = gl.getActiveCubeFace();
  const level = gl.getActiveMipmapLevel();
  const viewport = gl.getViewport(new Vector4());
  const scissor = gl.getScissor(new Vector4());
  const scissorTest = gl.getScissorTest();
  const autoClear = gl.autoClear;
  const xr = gl.xr.enabled;
  const clear = gl.getClearColor(new Color());
  const alpha = gl.getClearAlpha();
  try {
    gl.xr.enabled = false;
    gl.autoClear = true;
    gl.setRenderTarget(target as WebGLRenderTarget);
    gl.setScissorTest(false);
    gl.render(scene, camera);
  } finally {
    gl.setViewport(viewport);
    gl.setScissor(scissor);
    gl.setScissorTest(scissorTest);
    gl.setRenderTarget(previous, face, level);
    gl.setClearColor(clear, alpha);
    gl.autoClear = autoClear;
    gl.xr.enabled = xr;
  }
}
