import { useLayoutEffect, useMemo, type RefObject } from "react";
import { PerspectiveCamera, Vector2, type StereoCamera } from "three";
import { renderSpatialEye } from "../spatial/render-layer";
import { createWebGPUTarget, withWebGPUState, type WebGPUFramePasses, type WebGPUShaderModules } from "../webgpu-frame";
import { syncStereoCameras } from "./stereo";
import type { WebVRProfile } from "./types";

function createResources({ three, tsl }: WebGPUShaderModules) {
  const { NodeMaterial, QuadMesh } = three;
  const { dot, screenUV, texture, uniform, vec2, vec4 } = tsl;
  const views = [createWebGPUTarget(), createWebGPUTarget()] as const;
  const source = createWebGPUTarget();
  const distortion = uniform(new Vector2());
  const lensCenter = uniform(new Vector2());
  const split = uniform(0.5);
  const frameUv = screenUV;
  const clampedUv = vec2(frameUv.x.clamp(0, 1), frameUv.y.clamp(0, 1));
  const centered = vec2(frameUv.x, frameUv.y.oneMinus()).mul(2).sub(1).sub(lensCenter);
  const radius = dot(centered, centered);
  const scale = distortion.y.mul(radius).add(distortion.x).mul(radius).add(1);
  const warped = centered.mul(scale).add(lensCenter).mul(0.5).add(0.5);
  const inside = warped.x.greaterThanEqual(0).and(warped.x.lessThanEqual(1))
    .and(warped.y.greaterThanEqual(0)).and(warped.y.lessThanEqual(1));
  const lensMaterial = new NodeMaterial();
  lensMaterial.setValues({ depthTest: false, depthWrite: false, toneMapped: false });
  lensMaterial.fragmentNode = inside.select(texture(source.texture, vec2(warped.x, warped.y.oneMinus())), vec4(0, 0, 0, 1));
  const maskMaterial = new NodeMaterial();
  maskMaterial.setValues({ depthTest: false, depthWrite: false, toneMapped: false,
    transparent: true });
  maskMaterial.fragmentNode = vec4(0, 0, 0, inside.select(0, 1));
  const frameMaterial = new NodeMaterial();
  frameMaterial.setValues({ depthTest: false, depthWrite: false, toneMapped: false });
  const leftUv = vec2(clampedUv.x.div(split), clampedUv.y);
  const rightUv = vec2(clampedUv.x.sub(split).div(split.oneMinus()), clampedUv.y);
  frameMaterial.fragmentNode = clampedUv.x.lessThan(split).select(
    texture(views[0].texture, leftUv), texture(views[1].texture, rightUv));
  return {
    views, source, split, distortion, lensCenter,
    lens: new QuadMesh(lensMaterial), mask: new QuadMesh(maskMaterial), frame: new QuadMesh(frameMaterial),
    dispose() {
      for (const target of [...views, source]) target.dispose();
      for (const material of [lensMaterial, maskMaterial, frameMaterial]) material.dispose();
    },
  };
}

export function WebGPUStereo({
  passes, stereo, options,
}: {
  passes: WebGPUFramePasses;
  stereo: StereoCamera;
  options: RefObject<{ profile: WebVRProfile; screensize: number | "auto"; oversampling: number }>;
}) {
  const resources = useMemo(() => createResources(passes.modules), [passes]);
  useLayoutEffect(() => () => resources.dispose(), [resources]);
  useLayoutEffect(() => {
    const renderer = passes.renderer;
    const size = new Vector2();
    const outputSize = new Vector2();
    const eyes = [stereo.cameraL, stereo.cameraR] as const;
    passes.stereoEyes = () => eyes;
    passes.stereo = ({ camera, scene }) => {
      if (!(camera instanceof PerspectiveCamera)) {
        passes.render(scene, camera);
        return;
      }
      const { profile, screensize, oversampling } = options.current;
      const { layout, centers } = syncStereoCameras(stereo, camera, profile, screensize, oversampling, size, renderer);
      renderer.getDrawingBufferSize(outputSize);
      if (outputSize.x < 2 || outputSize.y < 1) return;
      const dpr = renderer.getPixelRatio();
      const leftWidth = Math.max(1, Math.min(outputSize.x - 1, Math.round(layout.left.width * dpr)));
      const distorted = profile.k1 !== 0 || profile.k2 !== 0;
      resources.distortion.value.set(profile.k1, profile.k2);
      resources.split.value = leftWidth / outputSize.x;
      withWebGPUState(renderer, () => {
        renderer.setScissorTest(false);
        eyes.forEach((eye, index) => {
          const view = resources.views[index];
          view.setSize(index === 0 ? leftWidth : outputSize.x - leftWidth, outputSize.y);
          renderer.autoClear = true;
          renderSpatialEye(renderer, eye, () => {
            if (distorted) {
              resources.source.setSize(layout.renderTargetWidth, layout.renderTargetHeight);
              renderer.setRenderTarget(resources.source);
              passes.render(scene, eye);
              renderer.setRenderTarget(view);
              const center = index === 0 ? centers.left : centers.right;
              resources.lensCenter.value.set(center.x, center.y);
              resources.lens.render(renderer);
            } else {
              renderer.setRenderTarget(view);
              passes.render(scene, eye);
            }
          }, () => renderer.render(scene, eye), () => {
            if (distorted) resources.mask.render(renderer);
          });
        });
        renderer.setRenderTarget(null);
        renderer.setViewport(0, 0, size.x, size.y);
        renderer.autoClear = true;
        resources.frame.render(renderer);
      });
    };
    return () => {
      delete passes.stereo;
      delete passes.stereoEyes;
    };
  }, [options, passes, resources, stereo]);
  return null;
}
