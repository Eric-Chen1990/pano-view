import { useLayoutEffect, useMemo, useRef } from "react";
import {
  MeshBasicMaterial,
  type Side,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { usePanoFilterSnapshot } from "./host";
import { isPanoFilterActive } from "./presets";
import { injectPanoFilterShader } from "./shaders";

export type PanoBasicMaterialProps = {
  map?: Texture | null;
  side?: Side;
  depthTest?: boolean;
  depthWrite?: boolean;
  toneMapped?: boolean;
};

type FilterIntensityUniform = { value: number };

/**
 * Panorama `meshBasicMaterial` that applies the active PanoFilter preset.
 * Hotspots should keep using plain `meshBasicMaterial`.
 */
export function PanoBasicMaterial({
  map,
  side,
  depthTest,
  depthWrite,
  toneMapped = false,
}: PanoBasicMaterialProps) {
  const snapshot = usePanoFilterSnapshot();
  const materialRef = useRef<MeshBasicMaterial>(null);
  const intensityRef = useRef(snapshot.intensity);
  const intensityUniformRef = useRef<FilterIntensityUniform | null>(null);
  intensityRef.current = snapshot.intensity;
  const active = isPanoFilterActive(snapshot);
  const preset = snapshot.preset;

  const onBeforeCompile = useMemo(() => {
    if (!active || preset === "none") {
      return undefined;
    }

    const compile = (shader: WebGLProgramParametersWithUniforms) => {
      injectPanoFilterShader(shader, preset);
      const intensityUniform = shader.uniforms.uPanoFilterIntensity!;
      intensityUniform.value = intensityRef.current;
      intensityUniformRef.current = intensityUniform;
      const material = materialRef.current;
      if (material) {
        material.userData.uPanoFilterIntensity = intensityUniform;
      }
    };
    compile.toString = () => `pano-filter:${preset}`;
    return compile;
  }, [active, preset]);

  useLayoutEffect(() => {
    if (!active) {
      intensityUniformRef.current = null;
    }
    const material = materialRef.current;
    if (!material) {
      return;
    }
    material.needsUpdate = true;
  }, [active, preset]);

  useLayoutEffect(() => {
    if (intensityUniformRef.current) {
      intensityUniformRef.current.value = snapshot.intensity;
    }
  }, [snapshot.intensity]);

  return (
    <meshBasicMaterial
      key={active ? preset : "none"}
      ref={materialRef}
      depthTest={depthTest}
      depthWrite={depthWrite}
      map={map}
      onBeforeCompile={onBeforeCompile}
      side={side}
      toneMapped={toneMapped}
    />
  );
}
