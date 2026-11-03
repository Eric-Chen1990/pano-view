import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef } from "react";
import {
  Matrix4,
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
import {
  computeStereoLensCenters,
  type StereoLensCenter,
} from "./lens-center";
import {
  panoramaStereoHalfAngle,
  panoramaStereoToeInYaw,
} from "./stereo-disparity";
import {
  clampWebVROversampling,
  computeStereoLayout,
  type StereoLayout,
} from "./stereo-layout";
import { isFallbackStereoMode } from "./stereo-view";
import type { WebVRMode, WebVRProfile } from "./types";

const TOE_IN = new Matrix4();

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
uniform vec2 lensCenter;
varying vec2 vUv;
void main() {
  vec2 centered = vUv * 2.0 - 1.0 - lensCenter;
  float radius2 = dot(centered, centered);
  float scale = 1.0 + distortion.x * radius2 + distortion.y * radius2 * radius2;
  vec2 sourceUv = (centered * scale + lensCenter) * 0.5 + 0.5;
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
      lensCenter: { value: new Vector2() },
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

function applyEyeViewOffset(
  eyeCamera: PerspectiveCamera,
  eye: StereoEyeViewportLike,
  center: StereoLensCenter,
): void {
  // setViewOffset shifts the projection frustum so the optical axis lands on
  // the lens center instead of the half-screen center.
  const fullWidth = eye.width;
  const fullHeight = eye.height;
  const offsetX = ((center.x + 1) / 2 - 0.5) * fullWidth;
  const offsetY = (0.5 - (center.y + 1) / 2) * fullHeight;
  eyeCamera.setViewOffset(
    fullWidth,
    fullHeight,
    offsetX,
    offsetY,
    fullWidth,
    fullHeight,
  );
}

type StereoEyeViewportLike = StereoLayout["left"];

function syncStereoCameras(
  stereo: StereoCamera,
  camera: PerspectiveCamera,
  profile: WebVRProfile,
  screensize: number | "auto",
  oversampling: number,
  size: Vector2,
  gl: WebGLRenderer,
): { layout: StereoLayout; centers: ReturnType<typeof computeStereoLensCenters> } {
  gl.getSize(size);
  const layout = computeStereoLayout(
    size.x,
    size.y,
    gl.getPixelRatio(),
    oversampling,
  );
  const screenToLensMm = profile.screenToLensMm ?? 42;
  const displayAspect = layout.fullWidth / layout.fullHeight;
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
  camera.updateMatrixWorld();
  stereo.aspect = layout.stereoAspect;
  // Keep both eyes on the panorama center. A metric IPD is invisible on the
  // radius-1000 shell; the toe-in below is the disparity the headset fuses.
  stereo.eyeSep = 0;
  stereo.update(camera);
  const halfAngle = panoramaStereoHalfAngle(profile.ipdMm);
  TOE_IN.makeRotationY(panoramaStereoToeInYaw("left", halfAngle));
  stereo.cameraL.matrix.multiply(TOE_IN);
  stereo.cameraL.matrixWorldNeedsUpdate = true;
  TOE_IN.makeRotationY(panoramaStereoToeInYaw("right", halfAngle));
  stereo.cameraR.matrix.multiply(TOE_IN);
  stereo.cameraR.matrixWorldNeedsUpdate = true;

  const centers = computeStereoLensCenters(profile, screensize, displayAspect);
  applyEyeViewOffset(stereo.cameraL, layout.left, centers.left);
  applyEyeViewOffset(stereo.cameraR, layout.right, centers.right);
  stereo.cameraL.updateMatrixWorld(true);
  stereo.cameraR.updateMatrixWorld(true);
  return { layout, centers };
}

export function WebVRStereoRenderer({
  mode,
  oversampling = 1,
  profile,
  screensize,
}: {
  mode: WebVRMode | null;
  oversampling?: number;
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
  const sizeRef = useRef(new Vector2());
  const viewportRef = useRef(new Vector4());
  const scissorRef = useRef(new Vector4());
  const originalFovRef = useRef<number | null>(null);
  const stereoActiveRef = useRef(false);
  const profileRef = useRef(profile);
  const screensizeRef = useRef(screensize);
  const oversamplingRef = useRef(clampWebVROversampling(oversampling));
  profileRef.current = profile;
  screensizeRef.current = screensize;
  oversamplingRef.current = clampWebVROversampling(oversampling);

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
      const { layout, centers } = syncStereoCameras(
        stereoRef.current,
        cameraToRender,
        currentProfile,
        currentScreensize,
        oversamplingRef.current,
        sizeRef.current,
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
        eye: StereoLayout["left"],
        center: StereoLensCenter,
      ) => {
        if (hasDistortion) {
          if (
            resources.target.width !== layout.renderTargetWidth ||
            resources.target.height !== layout.renderTargetHeight
          ) {
            resources.target.setSize(
              layout.renderTargetWidth,
              layout.renderTargetHeight,
            );
          }
          // setRenderTarget already applies the target's physical viewport;
          // do not call setViewport with physical sizes (pixelRatio would
          // multiply again).
          gl.setRenderTarget(resources.target);
          originalRender(sceneToRender, eyeCamera);

          gl.setRenderTarget(null);
          gl.setViewport(eye.offsetX, 0, eye.width, eye.height);
          gl.setScissor(eye.offsetX, 0, eye.width, eye.height);
          resources.material.uniforms.distortion?.value.set(
            currentProfile.k1,
            currentProfile.k2,
          );
          resources.material.uniforms.lensCenter?.value.set(center.x, center.y);
          originalRender(resources.scene, resources.camera);
          return;
        }
        gl.setRenderTarget(null);
        gl.setViewport(eye.offsetX, 0, eye.width, eye.height);
        gl.setScissor(eye.offsetX, 0, eye.width, eye.height);
        originalRender(sceneToRender, eyeCamera);
      };

      renderEye(stereoRef.current.cameraL, layout.left, centers.left);
      renderEye(stereoRef.current.cameraR, layout.right, centers.right);

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
        oversamplingRef.current,
        sizeRef.current,
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
