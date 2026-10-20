import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Matrix4,
  Vector4,
  type Side,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { usePanoFilterSnapshot } from "./host";
import { injectPanoColorMatrixShader, injectPanoFilterShader } from "./shaders";
import type { PanoColorMatrix } from "./presets";

export type PanoBasicMaterialProps = {
  map?: Texture | null;
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
  const snapshot = usePanoFilterSnapshot();
  const preset =
    snapshot.enabled && target === "panorama" ? snapshot.preset : "none";
  const matrix =
    snapshot.enabled &&
    (target === "panorama" || snapshot.colorMatrixScope === "all")
      ? snapshot.colorMatrix
      : null;
  const hasMatrix = matrix !== null;
  const currentRef = useRef({ matrix, intensity: snapshot.intensity });
  currentRef.current = { matrix, intensity: snapshot.intensity };
  const shaderRef = useRef<WebGLProgramParametersWithUniforms | null>(null);
  const onBeforeCompile = useMemo(() => {
    const compile = (shader: WebGLProgramParametersWithUniforms) => {
      shaderRef.current = shader;
      if (preset !== "none") {
        injectPanoFilterShader(shader, preset);
        shader.uniforms.uPanoFilterIntensity!.value =
          currentRef.current.intensity;
      }
      if (hasMatrix && currentRef.current.matrix) {
        injectPanoColorMatrixShader(shader);
        const values = matrixUniforms(currentRef.current.matrix);
        shader.uniforms.uPanoColorMatrix = { value: values.matrix };
        shader.uniforms.uPanoColorOffset = { value: values.offset };
        shader.uniforms.uPanoColorMatrixIntensity = {
          value: currentRef.current.intensity,
        };
      }
    };
    compile.toString = () => `pano-filter:${preset}:matrix:${hasMatrix}`;
    return compile;
  }, [preset, hasMatrix]);
  useLayoutEffect(() => {
    const shader = shaderRef.current;
    if (!shader) return;
    if (shader.uniforms.uPanoFilterIntensity)
      shader.uniforms.uPanoFilterIntensity.value = snapshot.intensity;
    if (shader.uniforms.uPanoColorMatrix && matrix) {
      const values = matrixUniforms(matrix);
      shader.uniforms.uPanoColorMatrix.value = values.matrix;
      shader.uniforms.uPanoColorOffset!.value = values.offset;
      shader.uniforms.uPanoColorMatrixIntensity!.value = snapshot.intensity;
    }
  }, [matrix, snapshot.intensity]);
  return (
    <meshBasicMaterial
      key={`${preset}:${hasMatrix}`}
      toneMapped={false}
      {...props}
      onBeforeCompile={onBeforeCompile}
    />
  );
}
