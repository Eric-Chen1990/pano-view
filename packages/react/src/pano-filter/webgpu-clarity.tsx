import { useLayoutEffect } from "react";
import { Camera, Mesh, Scene, Vector2, Vector4, type Material, type Texture } from "three";
import { clarityBufferSize } from "./clarity-pass";
import type { PanoFilterHost } from "./host";
import { SPATIAL_UI_MASK } from "../spatial/render-layer";
import { createWebGPUTarget, withWebGPUState, type WebGPUFramePasses, type WebGPUShaderModules } from "../webgpu-frame";

function createLumaProxy(source: Mesh, modules: WebGPUShaderModules) {
  const { dot, materialColor, sRGBTransferOETF, vec3, vec4 } = modules.tsl;
  const material = new modules.three.MeshBasicNodeMaterial({ toneMapped: false });
  const luma = dot(materialColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  material.outputNode = sRGBTransferOETF(vec4(vec3(luma), 1));
  const mesh = new Mesh(source.geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.matrixWorldAutoUpdate = false;
  return mesh;
}

export function WebGPUClarityPass({ host, passes }: { host: PanoFilterHost; passes: WebGPUFramePasses }) {
  useLayoutEffect(() => {
    const renderer = passes.renderer;
    const lumaScene = new Scene();
    const proxies = new Map<Mesh, ReturnType<typeof createLumaProxy>>();
    const buffers: Array<{ target: ReturnType<typeof createWebGPUTarget>; viewport: Vector4; texel: Vector2 }> = [];
    const copy = new Camera();
    copy.matrixWorldAutoUpdate = false;
    const prepare: NonNullable<WebGPUFramePasses["clarity"]> = (scene, camera, viewport) => {
      host.webgpuClarityViews.clear();
      const cameras = "isArrayCamera" in camera && camera.isArrayCamera && "cameras" in camera
        ? (camera as import("three").ArrayCamera).cameras : [camera];
      if (cameras.every((eye) => eye.layers.mask === SPATIAL_UI_MASK)) return;
      scene.traverseVisible((source) => {
        if (!(source instanceof Mesh)) return;
        const original = source.material as Material & { map?: Texture | null };
        if (!host.webgpuClaritySources.has(original) || !original.map || !original.visible ||
            !cameras.some((eye) => eye.layers.test(source.layers))) return;

        let proxy = proxies.get(source);
        if (!proxy) {
          proxy = createLumaProxy(source, passes.modules);
          proxies.set(source, proxy);
        }
        proxy.geometry = source.geometry;
        proxy.matrixWorld.copy(source.matrixWorld);
        proxy.layers.mask = source.layers.mask;
        proxy.renderOrder = source.renderOrder;
        proxy.frustumCulled = source.frustumCulled;
        proxy.material.depthTest = original.depthTest;
        proxy.material.depthWrite = original.depthWrite;
        proxy.material.side = original.side;
        proxy.material.alphaTest = original.alphaTest;
        if (proxy.material.map !== original.map) {
          proxy.material.map = original.map;
          proxy.material.needsUpdate = true;
        }
        lumaScene.add(proxy);
      });
      for (const [source, proxy] of proxies) {
        if (!proxy.parent) {
          proxy.material.dispose();
          proxies.delete(source);
        }
      }
      if (!lumaScene.children.length) return;
      while (buffers.length > cameras.length) buffers.pop()?.target.dispose();

      try {
        withWebGPUState(renderer, () => {
          renderer.xr.enabled = false;
          renderer.setScissorTest(false);
          renderer.autoClear = true;
          renderer.setClearColor(0, 0);
          cameras.forEach((eye, index) => {
            const rect = ("viewport" in eye ? eye.viewport as Vector4 : undefined) ?? viewport;
            if (rect.z <= 0 || rect.w <= 0) return;
            const [width, height] = clarityBufferSize(rect.z, rect.w);
            const view = buffers[index] ??= {
              target: createWebGPUTarget(), viewport: new Vector4(), texel: new Vector2(),
            };
            view.target.setSize(width, height);
            view.viewport.copy(rect);
            view.texel.set(1 / width, 1 / height);
            copy.coordinateSystem = renderer.coordinateSystem;
            copy.layers.mask = eye.layers.mask;
            copy.matrixWorld.copy(eye.matrixWorld);
            copy.matrixWorldInverse.copy(eye.matrixWorldInverse);
            copy.projectionMatrix.copy(eye.projectionMatrix);
            copy.projectionMatrixInverse.copy(eye.projectionMatrixInverse);
            renderer.setRenderTarget(view.target);
            renderer.render(lumaScene, copy);
            host.webgpuClarityViews.set(eye, view);
          });
        });
      } finally {
        lumaScene.clear();
      }
    };
    passes.clarity = prepare;
    return () => {
      if (passes.clarity === prepare) delete passes.clarity;
      host.webgpuClarityViews.clear();
      for (const { material } of proxies.values()) material.dispose();
      for (const { target } of buffers) target.dispose();
    };
  }, [host, passes]);
  return null;
}
