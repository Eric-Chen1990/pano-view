import type { ResolvedChromaKey } from "../../../../shared/chroma-key";
import { injectChromaKey } from "./chroma-key-shader";
import { WebGPUPanoBasicMaterial } from "./webgpu-material";
import { WebGPURuntimeContext } from "../pano-renderer";
import { useContext, useLayoutEffect, useMemo } from "react";
import {
  Matrix4,
  Vector2,
  Vector4,
  type MeshBasicMaterial,
  type Side,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { markPanoClaritySource } from "./clarity-pass";
import { PanoFilterHostContext, usePanoFilterSnapshot } from "./host";
import {
  injectPanoColorAdjustmentsShader,
  injectPanoColorMatrixShader,
  injectPanoFilterShader,
} from "./shaders";
import type { PanoColorMatrix } from "./presets";

export type PanoBasicMaterialProps = {
  map?: Texture | null;
  chromaKey?: ResolvedChromaKey;
  side?: Side;
  depthTest?: boolean;
  depthWrite?: boolean;
  toneMapped?: boolean;
  target?: "panorama" | "hotspot";
  alphaTest?: number;
  alphaToCoverage?: boolean;
  opacity?: number;
  transparent?: boolean;
};

const EMPTY_VIEWPORT = new Vector4(0, 0, 0, 0);
const EMPTY_TEXEL = new Vector2();

function matrixUniforms(matrix: PanoColorMatrix) {
  return {
    matrix: new Matrix4().set(
      matrix[0],
      matrix[1],
      matrix[2],
      matrix[3],
      matrix[5],
      matrix[6],
      matrix[7],
      matrix[8],
      matrix[10],
      matrix[11],
      matrix[12],
      matrix[13],
      matrix[15],
      matrix[16],
      matrix[17],
      matrix[18],
    ),
    offset: new Vector4(matrix[4], matrix[9], matrix[14], matrix[19]),
  };
}

/** Artistic presets affect panoramas; display-space matrices can also affect hotspot textures. */
export function PanoBasicMaterial({
  target = "panorama",
  ...props
}: PanoBasicMaterialProps) {
  const gpu = useContext(WebGPURuntimeContext);
  return gpu
    ? <WebGPUPanoBasicMaterial modules={gpu.passes.modules} target={target} {...props} />
    : <WebGLPanoBasicMaterial target={target} {...props} />;
}

function WebGLPanoBasicMaterial({
  target,
  chromaKey,
  ...props
}: PanoBasicMaterialProps) {
  const host = useContext(PanoFilterHostContext);
  const snapshot = usePanoFilterSnapshot();
  const preset =
    snapshot.enabled && target === "panorama" ? snapshot.preset : "none";
  const matrix =
    snapshot.enabled &&
    (target === "panorama" || snapshot.colorMatrixScope === "all")
      ? snapshot.colorMatrix
      : null;
  const hasMatrix = matrix !== null;
  const adjustments = snapshot.enabled && target === "panorama"
    ? snapshot.adjustments
    : null;
  const hasAdjustments = adjustments !== null;
  const hasChromaKey = Boolean(chromaKey);
  const keyUniform = useMemo(() => ({ value: new Vector4() }), []);
  const intensityUniform = useMemo(() => ({ value: 1 }), []);
  const matrixUniform = useMemo(() => ({ value: new Matrix4() }), []);
  const offsetUniform = useMemo(() => ({ value: new Vector4() }), []);
  const adjustmentUniforms = useMemo(() => hasAdjustments ? {
    uPanoAdjustments: { value: new Vector4(0, 0, 0, 0) },
    uPanoClarityMap: { value: null as Texture | null },
    uPanoClarityViewport: { value: EMPTY_VIEWPORT },
    uPanoClarityTexel: { value: EMPTY_TEXEL },
  } : null, [hasAdjustments]);
  const onBeforeCompile = useMemo(() => {
    const compile = (shader: WebGLProgramParametersWithUniforms) => {
      if (hasChromaKey) injectChromaKey(shader, keyUniform);
      if (preset !== "none") {
        injectPanoFilterShader(shader, preset);
        shader.uniforms.uPanoFilterIntensity = intensityUniform;
      }
      if (adjustmentUniforms) {
        injectPanoColorAdjustmentsShader(shader);
        Object.assign(shader.uniforms, adjustmentUniforms);
      }
      if (hasMatrix) {
        injectPanoColorMatrixShader(shader);
        shader.uniforms.uPanoColorMatrix = matrixUniform;
        shader.uniforms.uPanoColorOffset = offsetUniform;
        shader.uniforms.uPanoColorMatrixIntensity = intensityUniform;
      }
    };
    compile.toString = () => `pano-filter:${preset}:matrix:${hasMatrix}:adjustments:${hasAdjustments}:chromaKey:${hasChromaKey}`;
    return compile;
  }, [hasChromaKey, keyUniform, preset, hasMatrix, hasAdjustments, intensityUniform, matrixUniform, offsetUniform, adjustmentUniforms]);
  useLayoutEffect(() => {
    if (chromaKey) keyUniform.value.set(chromaKey.cb, chromaKey.cr, chromaKey.threshold, chromaKey.smoothing);
    intensityUniform.value = snapshot.intensity;
    if (matrix) {
      const values = matrixUniforms(matrix);
      matrixUniform.value = values.matrix;
      offsetUniform.value = values.offset;
    }
    if (adjustments && adjustmentUniforms) {
      adjustmentUniforms.uPanoAdjustments.value.set(
        adjustments.exposure, adjustments.saturation, adjustments.contrast, adjustments.clarity,
      );
    }
  }, [chromaKey, keyUniform, matrix, snapshot.intensity, adjustments, intensityUniform, matrixUniform, offsetUniform, adjustmentUniforms]);
  const bindClarity = useMemo<MeshBasicMaterial["onBeforeRender"] | undefined>(() => {
    if (!adjustmentUniforms || !host) return undefined;
    const viewport = new Vector4();
    return (renderer, _scene, camera) => {
      const view = host.clarityViews.get(camera);
      const active = view && view.output === renderer.getRenderTarget() &&
        view.viewport.equals(renderer.getCurrentViewport(viewport));
      adjustmentUniforms.uPanoClarityMap.value = active ? view.target.texture : null;
      adjustmentUniforms.uPanoClarityViewport.value = active ? view.viewport : EMPTY_VIEWPORT;
      adjustmentUniforms.uPanoClarityTexel.value = active ? view.texel : EMPTY_TEXEL;
    };
  }, [host, adjustmentUniforms]);
  return (
    <meshBasicMaterial
      key={`${preset}:${hasMatrix}:${hasAdjustments}:${hasChromaKey}`}
      toneMapped={false}
      {...props}
      ref={target === "panorama" ? markPanoClaritySource : undefined}
      onBeforeCompile={onBeforeCompile}
      onBeforeRender={bindClarity}
    />
  );
}
