import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef } from "react";
import {
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  StereoCamera,
  Vector2,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { WebVRRuntimeContext } from "./host";
import { isFallbackStereoMode } from "./stereo-view";
import type { WebVRMode, WebVRProfile } from "./types";

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D sourceTexture;
uniform vec2 distortion;
varying vec2 vUv;
void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  float radius2 = dot(centered, centered);
  float scale = 1.0 + distortion.x * radius2 + distortion.y * radius2 * radius2;
  vec2 sourceUv = centered * scale * 0.5 + 0.5;
  if (sourceUv.x < 0.0 || sourceUv.x > 1.0 || sourceUv.y < 0.0 || sourceUv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = texture2D(sourceTexture, sourceUv);
  }
}
`;

type DistortionResources = {
  camera: OrthographicCamera;
  geometry: PlaneGeometry;
  material: ShaderMaterial;
  mesh: Mesh;
  scene: Scene;
  target: WebGLRenderTarget;
};

function createDistortionResources(): DistortionResources {
  const target = new WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader,
    uniforms: {
      distortion: { value: new Vector2() },
      sourceTexture: { value: target.texture },
    },
    vertexShader,
  });
  const mesh = new Mesh(geometry, material);
  const scene = new Scene();
  scene.add(mesh);
  return {
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    geometry,
    material,
    mesh,
    scene,
    target,
  };
}

function syncStereoCameras(
  stereo: StereoCamera,
  camera: PerspectiveCamera,
  profile: WebVRProfile,
  screensize: number | "auto",
  drawingSize: Vector2,
  gl: WebGLRenderer,
): { eyeWidth: number; fullHeight: number } {
  gl.getDrawingBufferSize(drawingSize);
  const fullWidth = Math.max(2, Math.floor(drawingSize.x));
  const fullHeight = Math.max(1, Math.floor(drawingSize.y));
  const eyeWidth = Math.max(1, Math.floor(fullWidth / 2));
  const screenToLensMm = profile.screenToLensMm ?? 42;
  const displayAspect = fullWidth / fullHeight;
  const screenHeightMm =
    screensize === "auto"
      ? null
      : (screensize * 25.4) /
        Math.sqrt(displayAspect * displayAspect + 1);
  const calibratedFov =
    screenHeightMm === null
      ? profile.fov
      : (2 * Math.atan(screenHeightMm / (2 * screenToLensMm)) * 180) /
        Math.PI;
  camera.fov = Math.max(30, Math.min(140, calibratedFov));
  camera.updateProjectionMatrix();
  stereo.aspect = eyeWidth / fullWidth;
  stereo.eyeSep = profile.ipdMm / 1000;
  stereo.update(camera);
  return { eyeWidth, fullHeight };
}

export function WebVRStereoRenderer({
  mode,
  profile,
  screensize,
}: {
  mode: WebVRMode | null;
  profile: WebVRProfile;
  screensize: number | "auto";
}) {
  const { camera, gl } = useThree();
  const runtime = useContext(WebVRRuntimeContext);
  const fallbackStereoRef = useRef<StereoCamera | null>(null);
  if (!fallbackStereoRef.current) {
    fallbackStereoRef.current = new StereoCamera();
  }
  const stereo = runtime?.stereoView.stereo ?? fallbackStereoRef.current;
  const stereoRef = useRef(stereo);
  stereoRef.current = stereo;
  const resources = useMemo(createDistortionResources, []);
  const drawingSizeRef = useRef(new Vector2());
  const viewportRef = useRef(new Vector4());
  const scissorRef = useRef(new Vector4());
  const originalFovRef = useRef<number | null>(null);
  const stereoActiveRef = useRef(false);
  const profileRef = useRef(profile);
  const screensizeRef = useRef(screensize);
  profileRef.current = profile;
  screensizeRef.current = screensize;

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
      resources.target.dispose();
    },
    [resources],
  );

  useEffect(() => {
    const originalRender = gl.render.bind(gl);
    gl.render = (sceneToRender, cameraToRender) => {
      if (
        !stereoActiveRef.current ||
        !(cameraToRender instanceof PerspectiveCamera)
      ) {
        originalRender(sceneToRender, cameraToRender);
        return;
      }

      const currentProfile = profileRef.current;
      const currentScreensize = screensizeRef.current;
      if (originalFovRef.current === null) {
        originalFovRef.current = cameraToRender.fov;
      }
      const { eyeWidth, fullHeight } = syncStereoCameras(
        stereoRef.current,
        cameraToRender,
        currentProfile,
        currentScreensize,
        drawingSizeRef.current,
        gl,
      );

      const hasDistortion =
        currentProfile.k1 !== 0 || currentProfile.k2 !== 0;
      const previousTarget = gl.getRenderTarget();
      const previousAutoClear = gl.autoClear;
      const previousScissorTest = gl.getScissorTest();
      gl.getViewport(viewportRef.current);
      gl.getScissor(scissorRef.current);
      gl.autoClear = true;
      gl.setScissorTest(true);

      const renderEye = (
        eyeCamera: StereoCamera["cameraL"],
        offsetX: number,
      ) => {
        if (hasDistortion) {
          if (
            resources.target.width !== eyeWidth ||
            resources.target.height !== fullHeight
          ) {
            resources.target.setSize(eyeWidth, fullHeight);
          }
          gl.setRenderTarget(resources.target);
          gl.setViewport(0, 0, eyeWidth, fullHeight);
          gl.setScissor(0, 0, eyeWidth, fullHeight);
          originalRender(sceneToRender, eyeCamera);

          gl.setRenderTarget(null);
          gl.setViewport(offsetX, 0, eyeWidth, fullHeight);
          gl.setScissor(offsetX, 0, eyeWidth, fullHeight);
          resources.material.uniforms.distortion?.value.set(
            currentProfile.k1,
            currentProfile.k2,
          );
          originalRender(resources.scene, resources.camera);
          return;
        }
        gl.setRenderTarget(null);
        gl.setViewport(offsetX, 0, eyeWidth, fullHeight);
        gl.setScissor(offsetX, 0, eyeWidth, fullHeight);
        originalRender(sceneToRender, eyeCamera);
      };

      renderEye(stereoRef.current.cameraL, 0);
      renderEye(stereoRef.current.cameraR, eyeWidth);

      gl.setRenderTarget(previousTarget);
      gl.setViewport(viewportRef.current);
      gl.setScissor(scissorRef.current);
      gl.setScissorTest(previousScissorTest);
      gl.autoClear = previousAutoClear;
    };
    return () => {
      gl.render = originalRender;
    };
  }, [gl, resources]);

  useEffect(
    () => () => {
      if (runtime) {
        runtime.stereoView.active = false;
      }
    },
    [runtime],
  );

  useFrame(() => {
    const fallback = isFallbackStereoMode(mode);
    stereoActiveRef.current = fallback;
    if (runtime) {
      runtime.stereoView.active = fallback;
    }
    if (fallback && camera instanceof PerspectiveCamera) {
      syncStereoCameras(
        stereoRef.current,
        camera,
        profileRef.current,
        screensizeRef.current,
        drawingSizeRef.current,
        gl,
      );
      return;
    }
    if (
      originalFovRef.current !== null &&
      camera instanceof PerspectiveCamera
    ) {
      camera.fov = originalFovRef.current;
      camera.updateProjectionMatrix();
      originalFovRef.current = null;
    }
  });

  return null;
}
