import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useContext, useLayoutEffect, useRef } from "react";
import {
  CubeCamera, Euler, MathUtils, Matrix3, Matrix4, Mesh, Scene, ShaderMaterial, Vector4,
  WebGLCubeRenderTarget, type CubeTexture, type PerspectiveCamera, type WebGLRenderer,
} from "three";
import { PanoramaViewContext } from "../panorama-view-runtime";
import { WebGPURuntimeContext } from "../pano-renderer";
import { getMaxTextureSize } from "../renderer-capabilities";
import { SceneLoadProgressContext } from "../scene-load-progress";
import { FULLSCREEN_PLANE, isPerspectiveCamera, OVERLAY_RENDER_ORDER } from "../scene-transitions/overlay-utils";
import type { PanoViewerState } from "../types";
import { withWebGPUState, type WebGPUShaderModules } from "../webgpu-frame";
import { LittlePlanetIntroContext, type LittlePlanetSource } from "./host";
import { resolveLittlePlanetIntro, sampleLittlePlanetIntro, type PanoLittlePlanetIntroOptions } from "./options";

function createUniforms() {
  return {
    orientation: { value: new Matrix3() },
    aspect: { value: 1 },
    planet: { value: 1 },
    perspective: { value: 0 },
    slope: { value: 1 },
    opacity: { value: 1 },
  };
}

function webGLMaterial(cube: CubeTexture) {
  const uniforms = createUniforms();
  // Inverse stereographic and perspective projection express the same ray as
  // an angle from the view axis. Interpolating that angle keeps the image continuous.
  const material = new ShaderMaterial({
    uniforms: { ...uniforms, panoCube: { value: cube } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 screenPoint;
      void main() {
        screenPoint = position.xy * 2.0;
        gl_Position = vec4(screenPoint, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 screenPoint;
      uniform samplerCube panoCube;
      uniform mat3 orientation;
      uniform float aspect, planet, perspective, slope, opacity;
      void main() {
        vec2 point = screenPoint * vec2(aspect, 1.0);
        float radius = length(point);
        float angle = mix(2.0 * atan(radius * planet), atan(radius * slope), perspective);
        vec3 ray = vec3(point * sin(angle) / max(radius, 0.000001), -cos(angle));
        gl_FragColor = vec4(textureCube(panoCube, orientation * ray).rgb, opacity);
        #include <colorspace_fragment>
      }
    `,
  });
  return { material, uniforms };
}

function webGPUMaterial(modules: WebGPUShaderModules, cube: CubeTexture) {
  const { atan, cos, cubeTexture, length, max, mix, positionGeometry, sin, uniform, uv, vec2, vec3, vec4 } = modules.tsl;
  const orientation = uniform(new Matrix3());
  const aspect = uniform(1);
  const planet = uniform(1);
  const perspective = uniform(0);
  const slope = uniform(1);
  const opacity = uniform(1);
  const point = uv().mul(2).sub(1).mul(vec2(aspect, 1));
  const radius = length(point);
  const angle = mix(atan(radius.mul(planet)).mul(2), atan(radius.mul(slope)), perspective);
  const ray = vec3(point.mul(sin(angle).div(max(radius, 0.000001))), cos(angle).negate());
  const material = new modules.three.NodeMaterial();
  material.setValues({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  material.vertexNode = vec4(positionGeometry.xy.mul(2), 0, 1);
  material.fragmentNode = vec4(cubeTexture(cube, orientation.mul(ray)).rgb, opacity);
  return { material, uniforms: { orientation, aspect, planet, perspective, slope, opacity } };
}

function captureWebGL(renderer: WebGLRenderer, cube: CubeCamera, scene: Scene) {
  const target = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace();
  const mip = renderer.getActiveMipmapLevel();
  const viewport = renderer.getViewport(new Vector4());
  const scissor = renderer.getScissor(new Vector4());
  const scissorTest = renderer.getScissorTest();
  const autoClear = renderer.autoClear;
  const xr = renderer.xr.enabled;
  try {
    renderer.autoClear = true;
    renderer.setScissorTest(false);
    cube.update(renderer, scene);
  } finally {
    renderer.setRenderTarget(target, face, mip);
    if (!target) {
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
    }
    renderer.setScissorTest(scissorTest);
    renderer.autoClear = autoClear;
    renderer.xr.enabled = xr;
  }
}

type IntroSurface = ReturnType<typeof webGLMaterial> | ReturnType<typeof webGPUMaterial>;

function updateSurface(
  surface: IntroSurface,
  camera: PerspectiveCamera,
  frame: NonNullable<ReturnType<typeof sampleLittlePlanetIntro>>,
  planetScale: number,
  rotation: Matrix4,
  angles: Euler,
) {
  const { uniforms } = surface;
  angles.set(MathUtils.degToRad(frame.pitch), MathUtils.degToRad(-frame.yaw), 0, "YXZ");
  uniforms.orientation.value.setFromMatrix4(rotation.makeRotationFromEuler(angles));
  uniforms.aspect.value = camera.aspect;
  // At the nadir the horizon is a circle. Size it relative to the shorter side.
  uniforms.planet.value = 1 / (0.45 * Math.min(camera.aspect, 1) * planetScale);
  uniforms.slope.value = 1 / camera.projectionMatrix.elements[5]!;
  uniforms.perspective.value = frame.perspective;
  uniforms.opacity.value = frame.opacity;
}

export function LittlePlanetIntro({
  options,
  blocked,
}: {
  options: true | PanoLittlePlanetIntroOptions;
  blocked: boolean;
}) {
  const host = useContext(LittlePlanetIntroContext);
  const progress = useContext(SceneLoadProgressContext);
  const controls = useContext(PanoramaViewContext);
  const gpu = useContext(WebGPURuntimeContext)?.passes;
  const canvas = useThree((state) => state.gl.domElement);
  const previousOpacity = useRef<string | null>(null);
  const active = useRef<{
    source: LittlePlanetSource;
    surface: IntroSurface;
    startedAt: number | null;
    options: ReturnType<typeof resolveLittlePlanetIntro>;
    landing: PanoViewerState;
  } | null>(null);
  const angles = useRef(new Euler());
  const rotation = useRef(new Matrix4());
  const revealCanvas = useCallback(() => {
    if (previousOpacity.current === null) return;
    canvas.style.opacity = previousOpacity.current;
    previousOpacity.current = null;
  }, [canvas]);
  useLayoutEffect(() => revealCanvas, [revealCanvas]);

  useLayoutEffect(() => {
    if (blocked) host?.finish();
  }, [blocked, host]);

  useLayoutEffect(() => {
    if (!host) return;
    const media = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    const motionChanged = () => { if (media?.matches) host.finish(); };
    const contextLost = () => { if (host.isPlaying()) host.finish(); };
    media?.addEventListener("change", motionChanged);
    canvas.addEventListener("webglcontextlost", contextLost);
    motionChanged();
    return () => {
      media?.removeEventListener("change", motionChanged);
      canvas.removeEventListener("webglcontextlost", contextLost);
      if (host.isPlaying()) host.finish();
    };
  }, [canvas, host]);

  useFrame(({ camera, gl, scene, size }) => {
    const running = active.current;
    if (!host || (!running && host.isConsumed())) {
      revealCanvas();
      return;
    }
    const ready = progress?.getSnapshot();
    // Source meshes can be committed before scene readiness applies the landing
    // view. Keep those frames offscreen so the first visible panorama is the intro.
    if (!running && host.sources.size === 1 && ready?.status === "loading") {
      if (previousOpacity.current === null) {
        previousOpacity.current = canvas.style.opacity;
        canvas.style.opacity = "0";
      }
      return;
    }
    revealCanvas();
    const view = controls?.current;
    if (!ready || !view || !isPerspectiveCamera(camera)) return;
    if (running) {
      const elapsed = running.startedAt === null ? 0 : performance.now() - running.startedAt;
      const frame = sampleLittlePlanetIntro(elapsed, running.options, running.landing);
      if (!frame || ready.status !== "ready" || !host.sources.has(running.source)) {
        host.finish();
      } else {
        updateSurface(running.surface, camera, frame, running.options.planetScale, rotation.current, angles.current);
      }
      return;
    }
    if (ready.status === "error") {
      host.finish();
      return;
    }
    if (ready.status !== "ready" || size.width <= 0 || size.height <= 0) return;
    const source = host.sources.size === 1 ? host.sources.values().next().value : undefined;
    const root = source?.root();
    if (!source || !root || blocked || view.isUserInteracting()) {
      host.finish();
      return;
    }

    const settings = resolveLittlePlanetIntro(options);
    const landing = view.getView();
    const first = sampleLittlePlanetIntro(0, settings, landing);
    if (!first) {
      host.finish();
      return;
    }

    const capture = new Scene();
    root.updateWorldMatrix(true, true);
    root.traverseVisible((object) => {
      if (!(object instanceof Mesh)) return;
      const mesh = new Mesh(object.geometry, object.material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(object.matrixWorld);
      mesh.renderOrder = object.renderOrder;
      capture.add(mesh);
    });
    if (!capture.children.length) {
      host.finish();
      return;
    }

    const renderer = gpu?.renderer ?? gl;
    const resolution = Math.min(1024, getMaxTextureSize(renderer),
      Math.ceil(Math.min(size.width, size.height) * renderer.getPixelRatio()));
    const target = gpu ? new gpu.modules.three.CubeRenderTarget(resolution) : new WebGLCubeRenderTarget(resolution);
    const cube = new CubeCamera(camera.near, camera.far, target);
    camera.getWorldPosition(cube.position);
    let surface: IntroSurface | undefined;
    try {
      if (gpu) {
        withWebGPUState(gpu.renderer, () => {
          gpu.renderer.setScissorTest(false);
          gpu.renderer.autoClear = true;
          cube.update(gpu.renderer, capture);
        });
      } else {
        captureWebGL(gl, cube, capture);
      }
      surface = gpu ? webGPUMaterial(gpu.modules, target.texture) : webGLMaterial(target.texture);
      updateSurface(surface, camera, first, settings.planetScale, rotation.current, angles.current);
    } catch {
      surface?.material.dispose();
      target.dispose();
      host.finish();
      return;
    }
    const overlay = new Mesh(FULLSCREEN_PLANE, surface.material);
    overlay.name = "Little Planet Intro";
    overlay.frustumCulled = false;
    overlay.renderOrder = OVERLAY_RENDER_ORDER + 1;
    overlay.onAfterRender = () => {
      if (active.current) active.current.startedAt ??= performance.now();
    };
    scene.add(overlay);
    active.current = { source, surface, options: settings, landing, startedAt: null };
    host.start(() => {
      active.current = null;
      scene.remove(overlay);
      overlay.material.dispose();
      target.dispose();
    });
  });

  return null;
}
