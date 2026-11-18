import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import {
  ArrayCamera,
  Camera,
  Color,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import { SPATIAL_UI_MASK } from "../spatial/render-layer";

const panoramaMaterials = new WeakSet<MeshBasicMaterial>();
const MAX_CLARITY_PIXELS = 524_288;

export function markPanoClaritySource(material: MeshBasicMaterial | null): void {
  if (material) panoramaMaterials.add(material);
}

export function clarityBufferSize(width: number, height: number): [number, number] {
  const scale = Math.min(0.5, Math.sqrt(MAX_CLARITY_PIXELS / (width * height)));
  const bufferWidth = Math.max(1, Math.floor(width * scale));
  return [
    Math.min(MAX_CLARITY_PIXELS, bufferWidth),
    Math.max(1, Math.min(
      Math.floor(height * scale),
      Math.floor(MAX_CLARITY_PIXELS / bufferWidth),
    )),
  ];
}

export type PanoClarityView = {
  target: WebGLRenderTarget;
  viewport: Vector4;
  texel: Vector2;
  output: ReturnType<WebGLRenderer["getRenderTarget"]>;
  complete?: boolean;
};

function createClaritySource(source: Mesh): Mesh<Mesh["geometry"], MeshBasicMaterial> {
  const material = new MeshBasicMaterial({ toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <colorspace_fragment>",
      `float luma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
       gl_FragColor = sRGBTransferOETF(vec4(vec3(luma), 1.0));`,
    );
  };
  const mesh = new Mesh(source.geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.matrixWorldAutoUpdate = false;
  return mesh;
}

export function PanoClarityPass({ views }: { views: Map<Camera, PanoClarityView> }) {
  const scene = useThree((state) => state.scene);
  const canvas = useThree((state) => state.gl.domElement);

  useLayoutEffect(() => {
    const lumaScene = new Scene();
    // The MobileVR render wrapper treats perspective cameras as stereo entry
    // points. This camera uses the final per-eye matrices without re-entering it.
    const cameraCopy = new Camera();
    cameraCopy.matrixWorldAutoUpdate = false;
    const proxies = new Map<Mesh, ReturnType<typeof createClaritySource>>();
    const buffers: PanoClarityView[] = [];
    const viewport = new Vector4();
    const logicalViewport = new Vector4();
    const logicalScissor = new Vector4();
    const clearColor = new Color();
    const previous = scene.onBeforeRender;

    const prepare: Scene["onBeforeRender"] = function (renderer, _root, camera) {
      // Three's Scene hook receives the render target as its fourth argument.
      // Forward the call as-is because its shared Object3D type describes meshes.
      Reflect.apply(previous, scene, arguments);
      views.clear();
      if (renderer.getContext().isContextLost()) return;
      const cameras = camera instanceof ArrayCamera ? camera.cameras : [camera];
      if (cameras.every((view) => view.layers.mask === SPATIAL_UI_MASK)) return;

      // Proxies share source geometry and textures, including whichever preview
      // and detail tiles are visible in this frame. The pass never draws overlays.
      scene.traverseVisible((source) => {
        if (!(source instanceof Mesh) || !(source.material instanceof MeshBasicMaterial)) return;
        const original = source.material;
        if (!panoramaMaterials.has(original) || !original.map || !original.visible ||
            !cameras.some((view) => source.layers.test(view.layers))) return;

        let proxy = proxies.get(source);
        if (!proxy) {
          proxy = createClaritySource(source);
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

      const savedTarget = renderer.getRenderTarget();
      const savedFace = renderer.getActiveCubeFace();
      const savedMipLevel = renderer.getActiveMipmapLevel();
      const savedAlpha = renderer.getClearAlpha();
      const savedAutoClear = renderer.autoClear;
      const savedXR = renderer.xr.enabled;
      renderer.getClearColor(clearColor);
      renderer.getCurrentViewport(viewport);
      if (!savedTarget) {
        renderer.getViewport(logicalViewport);
        renderer.getScissor(logicalScissor);
      }
      try {
        renderer.xr.enabled = false;
        renderer.autoClear = false;
        renderer.setClearColor(0, 0);
        cameras.forEach((viewCamera, index) => {
          const viewRect = viewCamera.viewport ?? viewport;
          if (viewRect.z <= 0 || viewRect.w <= 0) return;
          const [width, height] = clarityBufferSize(viewRect.z, viewRect.w);
          const view = buffers[index] ??= {
            target: new WebGLRenderTarget(1, 1),
            viewport: new Vector4(),
            texel: new Vector2(),
            output: savedTarget,
          };
          const resized = view.target.width !== width || view.target.height !== height;
          if (resized) view.target.setSize(width, height);
          if (!resized && view.complete === false) return;
          renderer.setRenderTarget(view.target);
          const context = renderer.getContext();
          if (resized || view.complete === undefined) {
            view.complete = context.checkFramebufferStatus(context.FRAMEBUFFER) === context.FRAMEBUFFER_COMPLETE;
          }
          if (!view.complete) return;

          cameraCopy.layers.mask = viewCamera.layers.mask;
          cameraCopy.matrixWorld.copy(viewCamera.matrixWorld);
          cameraCopy.matrixWorldInverse.copy(viewCamera.matrixWorldInverse);
          cameraCopy.projectionMatrix.copy(viewCamera.projectionMatrix);
          cameraCopy.projectionMatrixInverse.copy(viewCamera.projectionMatrixInverse);
          renderer.clear();
          renderer.render(lumaScene, cameraCopy);

          view.viewport.copy(viewRect);
          view.texel.set(1 / width, 1 / height);
          view.output = savedTarget;
          views.set(viewCamera, view);
        });
      } finally {
        lumaScene.clear();
        renderer.setRenderTarget(savedTarget, savedFace, savedMipLevel);
        // setRenderTarget(null) floors fractional DPR coordinates, while
        // setViewport rounds them. Restore the caller's screen viewport.
        if (!savedTarget) {
          renderer.setViewport(logicalViewport);
          if (renderer.getScissorTest()) renderer.setScissor(logicalScissor);
        }
        renderer.setClearColor(clearColor, savedAlpha);
        renderer.autoClear = savedAutoClear;
        renderer.xr.enabled = savedXR;
      }
    };
    const resetBufferStatus = () => {
      for (const view of buffers) view.complete = undefined;
    };
    canvas.addEventListener("webglcontextrestored", resetBufferStatus);
    scene.onBeforeRender = prepare;
    return () => {
      if (scene.onBeforeRender === prepare) scene.onBeforeRender = previous;
      canvas.removeEventListener("webglcontextrestored", resetBufferStatus);
      views.clear();
      for (const { material } of proxies.values()) material.dispose();
      for (const { target } of buffers) target.dispose();
    };
  }, [canvas, scene, views]);

  return null;
}
