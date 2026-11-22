import type { Vector4, WebGLProgramParametersWithUniforms } from "three";
import type { Node, UniformNode } from "three/webgpu";
import { CHROMA_BLUE, CHROMA_RED, CHROMA_TOLERANCE } from "../../../../shared/chroma-key";
import type { WebGPUShaderModules } from "../webgpu-frame";

export function injectChromaKey(
  shader: WebGLProgramParametersWithUniforms,
  uniform: { value: Vector4 },
) {
  shader.uniforms.uHotspotChromaKey = uniform;
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform vec4 uHotspotChromaKey;")
    .replace("#include <map_fragment>", `#include <map_fragment>
#ifdef USE_MAP
  vec3 keyRgb = sRGBTransferOETF(sampledDiffuseColor).rgb;
  vec2 keyChroma = vec2(dot(keyRgb, vec3(${CHROMA_BLUE.join(", ")})),
                       dot(keyRgb, vec3(${CHROMA_RED.join(", ")})));
  float keyDistance = distance(keyChroma, uHotspotChromaKey.xy);
  float keyThreshold = uHotspotChromaKey.z + ${CHROMA_TOLERANCE};
  float keyWidth = uHotspotChromaKey.w;
  float keyAlpha = keyWidth == 0.0
    ? (keyDistance > keyThreshold ? 1.0 : 0.0)
    : smoothstep(keyThreshold, keyThreshold + max(keyWidth, 0.000001), keyDistance);
  diffuseColor.a *= keyAlpha;
#endif`);
}

export function webGPUChromaKeyAlpha(
  tsl: WebGPUShaderModules["tsl"],
  rgba: Node<"vec4">,
  key: UniformNode<"vec4", Vector4>,
) {
  const { distance, dot, max, smoothstep, sRGBTransferOETF, vec2, vec3 } = tsl;
  const rgb = (sRGBTransferOETF(rgba) as Node<"vec4">).rgb;
  const chroma = vec2(
    dot(rgb, vec3(CHROMA_BLUE[0]!, CHROMA_BLUE[1]!, CHROMA_BLUE[2]!)),
    dot(rgb, vec3(CHROMA_RED[0]!, CHROMA_RED[1]!, CHROMA_RED[2]!)),
  );
  const delta = distance(chroma, key.xy);
  const threshold = key.z.add(CHROMA_TOLERANCE);
  return key.w.equal(0).select(
    delta.greaterThan(threshold).select(1, 0),
    smoothstep(threshold, threshold.add(max(key.w, 0.000001)), delta),
  );
}
