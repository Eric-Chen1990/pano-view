import { useFrame, type RootState } from "@react-three/fiber";
import { Color, PerspectiveCamera, RenderTarget, Vector4, type Camera, type Scene } from "three";
import type { WebGPURenderer } from "three/webgpu";
import { isWebGPURenderer } from "./renderer-capabilities";

export type WebGPUShaderModules = {
  three: typeof import("three/webgpu");
  tsl: typeof import("three/tsl");
};

export type WebGPUPresentation = (state: RootState) => void;

export type WebGPUFramePasses = {
  compare?: WebGPUPresentation;
  stereo?: WebGPUPresentation;
  clarity?: (scene: Scene, camera: Camera, viewport: Vector4) => void;
  stereoEyes?: () => readonly [Camera, Camera];
  render: (scene: Scene, camera: Camera) => void;
  renderer: WebGPURenderer;
  modules: WebGPUShaderModules;
};

export function createWebGPUFramePasses(
  renderer: WebGPURenderer, modules: WebGPUShaderModules,
): WebGPUFramePasses {
  const viewport = new Vector4();
  const passes: WebGPUFramePasses = {
    renderer,
    modules,
    render(scene, camera) {
      if (!renderer.xr.isPresenting && camera.coordinateSystem !== renderer.coordinateSystem &&
          camera instanceof PerspectiveCamera) {
        camera.coordinateSystem = renderer.coordinateSystem;
        camera.updateProjectionMatrix();
      }
      const target = renderer.getRenderTarget() ?? renderer.getOutputRenderTarget();
      if (passes.clarity) {
        if (target) viewport.copy(target.viewport);
        else renderer.getViewport(viewport).multiplyScalar(renderer.getPixelRatio()).floor();
        scene.updateMatrixWorld();
        if (renderer.xr.enabled && renderer.xr.isPresenting) {
          const xrCamera = renderer.xr.getCamera();
          if (camera instanceof PerspectiveCamera && camera !== xrCamera) renderer.xr.updateCamera(camera);
          passes.clarity(scene, xrCamera, viewport);
        } else {
          camera.updateWorldMatrix(true, false);
          passes.clarity(scene, camera, viewport);
        }
      }
      renderer.render(scene, camera);
    },
  };
  return passes;
}

export function WebGPUFrame({ passes }: { passes: WebGPUFramePasses }) {
  useFrame((state) => {
    if (!isWebGPURenderer(state.gl)) return;
    const presentation = passes.stereo ?? passes.compare;
    if (presentation && !state.gl.xr.isPresenting) {
      presentation(state);
      return;
    }
    // Preserve the normal R3F takeover for host-owned render loops.
    if (state.internal.priority === 1) passes.render(state.scene, state.camera);
  }, 1);
  return null;
}

export function createWebGPUTarget(depthBuffer = true): RenderTarget {
  return new RenderTarget(1, 1, { depthBuffer, stencilBuffer: false });
}

export function withWebGPUState(renderer: WebGPURenderer, render: () => void): void {
  const target = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace();
  const mipLevel = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new Vector4());
  const scissor = renderer.getScissor(new Vector4());
  const scissorTest = renderer.getScissorTest();
  const autoClear = renderer.autoClear;
  const clear = renderer.getClearColor(new Color());
  const alpha = renderer.getClearAlpha();
  const xr = renderer.xr.enabled;
  try {
    render();
  } finally {
    renderer.setRenderTarget(target, face, mipLevel);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    renderer.setClearColor(clear, alpha);
    renderer.autoClear = autoClear;
    renderer.xr.enabled = xr;
  }
}
