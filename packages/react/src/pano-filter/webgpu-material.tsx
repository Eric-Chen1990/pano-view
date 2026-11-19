import type { Node } from "three/webgpu";
import { useContext, useLayoutEffect, useMemo } from "react";
import { ArrayCamera, DataTexture, Matrix4, Vector2, Vector4, type Camera } from "three";
import type { WebGPUShaderModules } from "../webgpu-frame";
import { createWebGPUShaderNoise } from "../webgpu-noise";
import { PanoFilterHostContext, usePanoFilterSnapshot } from "./host";
import type { PanoBasicMaterialProps } from "./pano-basic-material";
import type { AppliedPanoFilterPreset, PanoColorMatrix } from "./presets";

const EMPTY = new DataTexture(new Uint8Array(4), 1, 1);
EMPTY.needsUpdate = true;

type RGB = Node<"vec3">;

function look(preset: AppliedPanoFilterPreset, color: RGB, tsl: WebGPUShaderModules["tsl"]) {
  const { asin, atan, clamp, dFdx, dFdy, dot, floor, length, max, mix,
    positionWorld, sin, smoothstep, vec2, vec3 } = tsl;
  const { shaderFbm } = createWebGPUShaderNoise(tsl);
  const weights = vec3(0.2126, 0.7152, 0.0722);
  const luma = dot(color, weights);
  const saturation = (c: RGB, amount: number) => mix(vec3(dot(c, weights)), c, amount);
  const quantize = (c: RGB, steps: number) => floor(c.mul(steps).add(0.5)).div(steps);
  const uv = vec2(atan(positionWorld.x, positionWorld.z),
    asin(clamp(positionWorld.y.div(max(length(positionWorld), 0.0001)), -1, 1)));
  const edge = length(vec2(dFdx(luma), dFdy(luma)));
  switch (preset) {
    case "grayscale":
      return vec3(luma);
    case "sepia":
      return vec3(dot(color, vec3(0.393, 0.769, 0.189)),
        dot(color, vec3(0.349, 0.686, 0.168)), dot(color, vec3(0.272, 0.534, 0.131)));
    case "vintage":
      return clamp(saturation(clamp(color.mul(vec3(1.06, 0.96, 0.84)).add(vec3(0.045, 0.02, 0)), 0, 1), 0.68)
        .add(shaderFbm(uv.mul(36)).sub(0.5).mul(0.09)), 0, 1);
    case "cool":
      return saturation(color.mul(vec3(0.88, 1.02, 1.18)), 1.08);
    case "warm":
      return saturation(color.mul(vec3(1.2, 1.04, 0.82)), 1.06);
    case "pencil":
      return vec3(smoothstep(0.008, 0.07, edge).oneMinus()
        .mul(mix(0.55, 1, luma), shaderFbm(uv.mul(28)).mul(0.2).add(0.8)));
    case "coloredPencil": {
      const paper = shaderFbm(uv.mul(24)).mul(0.14).add(0.86);
      return mix(vec3(paper), saturation(color, 1.2).mul(smoothstep(0.006, 0.065, edge).oneMinus(), paper), 0.9);
    }
    case "crayon": {
      const stroke = shaderFbm(uv.mul(16).add(vec2(luma.mul(5), 0)));
      return clamp(quantize(saturation(color, 1.38), 5).mul(mix(0.78, 1.16, stroke),
        smoothstep(0.03, 0.11, edge).mul(0.28).oneMinus()), 0, 1);
    }
    case "watercolor":
      return clamp(saturation(mix(color, quantize(color, 6), 0.62), 0.86)
        .mul(shaderFbm(uv.mul(11)).mul(0.12).add(0.88), smoothstep(0.015, 0.09, edge).mul(0.38).oneMinus()), 0, 1);
    case "cartoon": {
      const l = max(luma, 0.001);
      return color.mul(floor(l.mul(3).add(0.5)).div(3).div(l), smoothstep(0.018, 0.055, edge).oneMinus());
    }
    case "crosshatch": {
      const h1 = sin(uv.x.add(uv.y).mul(42 * Math.PI)).abs();
      const h2 = sin(uv.x.sub(uv.y).mul(42 * Math.PI)).abs();
      return vec3(mix(1, smoothstep(0.12, 0.58, h1), smoothstep(0.55, 0.85, luma).oneMinus())
        .mul(mix(1, smoothstep(0.12, 0.62, h2), smoothstep(0.32, 0.62, luma).oneMinus()),
          mix(1, smoothstep(0.08, 0.42, h1.mul(h2)), smoothstep(0.12, 0.34, luma).oneMinus()),
          smoothstep(0.025, 0.08, edge).oneMinus()));
    }
  }
}

function matrixValues(matrix: PanoColorMatrix, out: Matrix4, offset: Vector4) {
  out.set(
    matrix[0], matrix[1], matrix[2], matrix[3],
    matrix[5], matrix[6], matrix[7], matrix[8],
    matrix[10], matrix[11], matrix[12], matrix[13],
    matrix[15], matrix[16], matrix[17], matrix[18],
  );
  offset.set(matrix[4], matrix[9], matrix[14], matrix[19]);
}

export function WebGPUPanoBasicMaterial({ target, modules, ...props }: PanoBasicMaterialProps & {
  modules: WebGPUShaderModules;
}) {
  const host = useContext(PanoFilterHostContext);
  const { enabled, preset, intensity, adjustments, colorMatrix, colorMatrixScope } = usePanoFilterSnapshot();
  const panorama = target === "panorama";
  const artistic = enabled && panorama ? preset : "none";
  const adjust = enabled && panorama ? adjustments : null;
  const matrix = enabled && (panorama || colorMatrixScope === "all") ? colorMatrix : null;
  const hasMatrix = Boolean(matrix);
  const hasAdjustments = Boolean(adjust);
  const hasClarity = Boolean(adjust?.clarity);

  const material = useMemo(() => {
    const { Fn, If, cameraIndex, clamp, dot, exp2, float, max, mix, output, screenCoordinate,
      sRGBTransferEOTF, sRGBTransferOETF, texture, uniform, vec2, vec3, vec4 } = modules.tsl;
    const lumaWeights = vec3(0.2126, 0.7152, 0.0722);
    const material = new modules.three.MeshBasicNodeMaterial({ toneMapped: false });
    const strength = uniform(1);
    const values = uniform(new Vector4());
    const transform = uniform(new Matrix4());
    const offset = uniform(new Vector4());
    // A mapped materialColor includes texture alpha at runtime in r185.
    const rgba = modules.tsl.materialColor as unknown as Node<"vec4">;
    let color = rgba.rgb;

    if (hasClarity) {
      const eyeSamples = [0, 1].map((index) => {
        const lumaMap = texture(EMPTY);
        const texel = uniform(new Vector2());
        const viewport = uniform(new Vector4(0, 0, 1, 1)).onObjectUpdate(({ camera }) => {
          const rendered = camera as Camera | null;
          const eye = rendered instanceof ArrayCamera ? rendered.cameras[index] : rendered;
          const view = eye && host?.webgpuClarityViews.get(eye);
          lumaMap.value = view?.target.texture ?? EMPTY;
          if (view) texel.value.copy(view.texel);
          return view?.viewport;
        });
        const uv = screenCoordinate.sub(viewport.xy).div(viewport.zw);
        return () => {
          const sample = (x: number, y: number) =>
            lumaMap.sample(uv.add(texel.mul(vec2(x, y)))).level(float(0));
          return sample(-2, -2).add(sample(2, -2), sample(-2, 2), sample(2, 2));
        };
      });
      const neighbors = Fn(() => {
        const samples = vec4(0).toVar();
        If(cameraIndex.equal(1), () => { samples.assign(eyeSamples[1]()); })
          .Else(() => { samples.assign(eyeSamples[0]()); });
        return samples;
      })() as Node<"vec4">;
      const linear = dot(color, lumaWeights);
      const luma = (sRGBTransferOETF(vec4(vec3(linear), 1)) as Node<"vec4">).r;
      const delta = clamp(luma.sub(neighbors.r.div(max(neighbors.a, 0.001))), -0.15, 0.15);
      const adjusted = clamp(luma.add(values.w.mul(4, luma, luma.oneMinus(), delta)), 0, 1);
      const ratio = (sRGBTransferEOTF(vec4(vec3(adjusted), 1)) as Node<"vec4">).r.div(max(linear, 0.0001));
      color = color.mul(neighbors.a.greaterThanEqual(0.001).and(linear.greaterThan(0.0001)).select(ratio, 1));
    }

    if (hasAdjustments) {
      const exposed = color.mul(exp2(values.x));
      const display = (sRGBTransferOETF(vec4(exposed, 1)) as Node<"vec4">).rgb;
      const saturated = mix(vec3(dot(display, lumaWeights)), display, values.y.add(1));
      const contrast = clamp(mix(vec3(0.5), saturated, values.z.add(1)), 0, 1);
      color = values.y.notEqual(0).or(values.z.notEqual(0))
        .select((sRGBTransferEOTF(vec4(contrast, 1)) as Node<"vec4">).rgb, clamp(exposed, 0, 1));
    }
    if (artistic !== "none") color = mix(color, look(artistic, color, modules.tsl), strength);
    if (artistic !== "none" || hasAdjustments) material.colorNode = vec4(color, rgba.a);
    if (hasMatrix) {
      const display = sRGBTransferOETF(output) as Node<"vec4">;
      material.outputNode = sRGBTransferEOTF(mix(display, clamp(transform.mul(display).add(offset), 0, 1), strength));
    }
    return { material, strength, values, transform, offset };
  }, [artistic, hasAdjustments, hasClarity, hasMatrix, host, modules]);

  useLayoutEffect(() => {
    // The node pipeline uses a different binding for an absent map, a poster, and a video texture.
    material.material.needsUpdate = true;
  }, [material, props.map]);

  useLayoutEffect(() => {
    material.strength.value = intensity;
    if (adjust) material.values.value.set(adjust.exposure, adjust.saturation, adjust.contrast, adjust.clarity);
    if (matrix) matrixValues(matrix, material.transform.value, material.offset.value);
  }, [adjust, intensity, material, matrix]);

  useLayoutEffect(() => {
    if (panorama) host?.webgpuClaritySources.add(material.material);
    return () => material.material.dispose();
  }, [host, material, panorama]);

  return <primitive object={material.material} attach="material" toneMapped={false} {...props} />;
}
