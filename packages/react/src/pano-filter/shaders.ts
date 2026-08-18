import type { WebGLProgramParametersWithUniforms } from "three";
import type { AppliedPanoFilterPreset } from "./presets";

const GLSL_FILTER_COMMON = `
float panoHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float panoNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = panoHash(i);
  float b = panoHash(i + vec2(1.0, 0.0));
  float c = panoHash(i + vec2(0.0, 1.0));
  float d = panoHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float panoFbm(vec2 p) {
  return 0.5 * panoNoise(p)
    + 0.25 * panoNoise(p * 2.13)
    + 0.125 * panoNoise(p * 4.17);
}

float panoLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 panoSaturate(vec3 c, float amount) {
  return mix(vec3(panoLuma(c)), c, amount);
}

vec2 panoWorldUv(vec3 p) {
  float len = max(length(p), 0.0001);
  return vec2(atan(p.x, p.z), asin(clamp(p.y / len, -1.0, 1.0)));
}

float panoEdge(vec3 c) {
  float l = panoLuma(c);
  return length(vec2(dFdx(l), dFdy(l)));
}

vec3 panoQuantize(vec3 c, float steps) {
  return floor(c * steps + 0.5) / max(steps, 1.0);
}
`;

function applyPanoFilterFunction(body: string): string {
  return `vec3 applyPanoFilter(vec3 color) {
${body}
}`;
}

function panoFilterBody(preset: AppliedPanoFilterPreset): string {
  switch (preset) {
    case "grayscale":
      return `  return vec3(panoLuma(color));`;
    case "sepia":
      return `  return vec3(
    dot(color, vec3(0.393, 0.769, 0.189)),
    dot(color, vec3(0.349, 0.686, 0.168)),
    dot(color, vec3(0.272, 0.534, 0.131))
  );`;
    case "vintage":
      return `  vec3 lifted = color * vec3(1.06, 0.96, 0.84) + vec3(0.045, 0.02, 0.0);
  lifted = panoSaturate(clamp(lifted, 0.0, 1.0), 0.68);
  float grain = (panoFbm(panoWorldUv(vPanoWorldPos) * 36.0) - 0.5) * 0.09;
  return clamp(lifted + grain, 0.0, 1.0);`;
    case "cool":
      return `  vec3 cooled = color * vec3(0.88, 1.02, 1.18);
  return panoSaturate(cooled, 1.08);`;
    case "warm":
      return `  vec3 warmed = color * vec3(1.2, 1.04, 0.82);
  return panoSaturate(warmed, 1.06);`;
    case "pencil":
      return `  float l = panoLuma(color);
  float line = 1.0 - smoothstep(0.008, 0.07, panoEdge(color));
  float paper = 0.8 + 0.2 * panoFbm(panoWorldUv(vPanoWorldPos) * 28.0);
  float tone = mix(0.55, 1.0, l);
  return vec3(line * tone * paper);`;
    case "coloredPencil":
      return `  float line = 1.0 - smoothstep(0.006, 0.065, panoEdge(color));
  float paper = 0.86 + 0.14 * panoFbm(panoWorldUv(vPanoWorldPos) * 24.0);
  vec3 tinted = panoSaturate(color, 1.2) * line;
  return mix(vec3(paper), tinted * paper, 0.9);`;
    case "crayon":
      return `  vec3 wax = panoQuantize(panoSaturate(color, 1.38), 5.0);
  vec2 uv = panoWorldUv(vPanoWorldPos);
  float stroke = panoFbm(uv * 16.0 + vec2(panoLuma(color) * 5.0, 0.0));
  wax *= mix(0.78, 1.16, stroke);
  wax *= 1.0 - smoothstep(0.03, 0.11, panoEdge(color)) * 0.28;
  return clamp(wax, 0.0, 1.0);`;
    case "watercolor":
      return `  vec3 wash = mix(color, panoQuantize(color, 6.0), 0.62);
  wash = panoSaturate(wash, 0.86);
  float paper = 0.88 + 0.12 * panoFbm(panoWorldUv(vPanoWorldPos) * 11.0);
  wash *= paper;
  wash *= 1.0 - smoothstep(0.015, 0.09, panoEdge(color)) * 0.38;
  return clamp(wash, 0.0, 1.0);`;
    case "cartoon":
      return `  float l = max(panoLuma(color), 0.001);
  float bands = floor(l * 3.0 + 0.5) / 3.0;
  vec3 cel = color * (bands / l);
  float outline = 1.0 - smoothstep(0.018, 0.055, panoEdge(color));
  return cel * outline;`;
    case "crosshatch":
      return `  float l = panoLuma(color);
  vec2 uv = panoWorldUv(vPanoWorldPos) * 42.0;
  float h1 = abs(sin((uv.x + uv.y) * 3.14159265));
  float h2 = abs(sin((uv.x - uv.y) * 3.14159265));
  float hatch = 1.0;
  hatch *= mix(1.0, smoothstep(0.12, 0.58, h1), 1.0 - smoothstep(0.55, 0.85, l));
  hatch *= mix(1.0, smoothstep(0.12, 0.58, h2), 1.0 - smoothstep(0.32, 0.62, l));
  hatch *= mix(1.0, smoothstep(0.08, 0.42, h1 * h2), 1.0 - smoothstep(0.12, 0.34, l));
  float outline = 1.0 - smoothstep(0.025, 0.08, panoEdge(color));
  return vec3(hatch * outline);`;
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export function injectPanoFilterShader(
  shader: WebGLProgramParametersWithUniforms,
  preset: AppliedPanoFilterPreset,
): void {
  shader.uniforms.uPanoFilterIntensity = shader.uniforms.uPanoFilterIntensity ?? {
    value: 1,
  };

  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec3 vPanoWorldPos;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vPanoWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
uniform float uPanoFilterIntensity;
varying vec3 vPanoWorldPos;
${GLSL_FILTER_COMMON}
${applyPanoFilterFunction(panoFilterBody(preset))}`,
    )
    .replace(
      "#include <map_fragment>",
      `#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, applyPanoFilter(diffuseColor.rgb), clamp(uPanoFilterIntensity, 0.0, 1.0));`,
    );
}
