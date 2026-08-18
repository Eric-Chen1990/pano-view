import { DoubleSide, ShaderMaterial, Vector2 } from "three";
import type { Texture } from "three";
import { GLSL_COMMON } from "./glsl";
import type { SnapshotTransitionPreset } from "./presets";

export const SNAPSHOT_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HEADER = `
uniform sampler2D map;
uniform float progress;
uniform vec2 resolution;
varying vec2 vUv;
${GLSL_COMMON}

vec2 aspectGrid(float rows) {
  float aspect = resolution.x / max(resolution.y, 1.0);
  return vec2(max(8.0, floor(rows * aspect)), rows);
}
`;

const FOOTER = `
  gl_FragColor = vec4(old.rgb, old.a * alpha);
  #include <colorspace_fragment>
}
`;

function snapshotShader(body: string): string {
  return `${HEADER}
void main() {
  float t = clamp(progress, 0.0, 1.0);
  vec2 uv = vUv;
  vec4 old = texture2D(map, uv);
  float alpha = 1.0;
${body}
${FOOTER}`;
}

export const SNAPSHOT_FRAGMENT_SHADERS: Record<SnapshotTransitionPreset, string> = {
  crossfade: snapshotShader(`
    alpha = 1.0 - easeInCubic(t);
  `),

  zoom: snapshotShader(`
    float eased = easeInOutSine(t);
    uv = 0.5 + (vUv - 0.5) / mix(1.0, 2.0, eased);
    old = texture2D(map, uv);
    alpha = 1.0 - eased;
  `),

  blackout: snapshotShader(`
    float blackout = easeOutSine(min(1.0, t * 2.0));
    float reveal = easeOutSine(max(0.0, (t - 0.5) * 2.0));
    old.rgb = mix(old.rgb, vec3(0.0), blackout);
    alpha = 1.0 - reveal;
  `),

  whiteFlash: snapshotShader(`
    float flash = min(1.0, 2.0 * sin(t * 3.14159265359));
    old.rgb = mix(old.rgb, vec3(1.0), flash);
    alpha = 1.0 - t;
  `),

  slideRightToLeft: snapshotShader(`
    float coordinate = dot(vUv - 0.5, vec2(1.0, 0.0)) + 0.5;
    alpha = smoothstep(t - 0.2, t + 0.2, coordinate);
  `),

  slideTopToBottom: snapshotShader(`
    float coordinate = dot(vUv - 0.5, vec2(0.0, 1.0)) + 0.5;
    alpha = smoothstep(t - 0.01, t + 0.01, coordinate);
  `),

  slideDiagonal: snapshotShader(`
    float coordinate = dot(vUv - 0.5, normalize(vec2(-1.0, 1.0))) + 0.5;
    alpha = smoothstep(t - 0.4, t + 0.4, coordinate);
  `),

  circleOpen: snapshotShader(`
    float distanceFromCenter = length((vUv - 0.5) * vec2(1.35, 0.8));
    float radius = t * 1.45;
    alpha = smoothstep(radius, radius + 0.2, distanceFromCenter);
  `),

  verticalOpen: snapshotShader(`
    float distanceFromCenter = length((vUv - 0.5) * vec2(4.0, 1.0));
    float radius = t * 1.1;
    alpha = smoothstep(radius, radius + 0.1, distanceFromCenter);
  `),

  horizontalOpen: snapshotShader(`
    float distanceFromCenter = length((vUv - 0.5) * vec2(1.0, 4.0));
    float radius = t * 1.45;
    alpha = smoothstep(radius, radius + 0.3, distanceFromCenter);
  `),

  ellipticZoomOpen: snapshotShader(`
    vec2 point = vUv - 0.5;
    float distanceFromCenter = length(point * vec2(1.35, 0.8));
    float radius = t * 1.45;
    alpha = smoothstep(radius, radius + 0.3, distanceFromCenter);
    old = texture2D(map, 0.5 + point / (1.0 + 0.8 * t));
  `),

  pixelate: snapshotShader(`
    float maxCell = max(8.0, min(resolution.x, resolution.y) * 0.07);
    float cell = mix(1.0, maxCell, easeInCubic(min(1.0, t / 0.72)));
    vec2 grid = max(floor(resolution / max(cell, 1.0)), vec2(1.0));
    uv = (floor(vUv * grid) + 0.5) / grid;
    old = texture2D(map, uv);
    alpha = 1.0 - smoothstep(0.58, 1.0, t);
  `),

  gridWipe: snapshotShader(`
    vec2 cells = aspectGrid(16.0);
    vec2 id = floor(vUv * cells);
    float order = hash(id);
    alpha = 1.0 - smoothstep(order, order + 0.18, t);
  `),

  dissolve: snapshotShader(`
    float n = fbm(vUv * vec2(7.0, 5.5) + 1.7);
    alpha = 1.0 - smoothstep(n, n + 0.14, t);
  `),

  shatter: snapshotShader(`
    vec2 grid = aspectGrid(10.0);
    vec2 originCell = floor(vUv * grid);
    old = vec4(0.0);
    alpha = 0.0;
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        vec2 cell = originCell + vec2(float(i), float(j));
        float h = hash(cell + 0.13);
        float h2 = hash(cell + 4.1);
        float h3 = hash(cell + 9.7);
        vec2 randomDir = normalize(vec2(h, h2) * 2.0 - 1.0 + 1e-5);
        vec2 fromCenter = normalize((cell + 0.5) / grid - 0.5 + 1e-5);
        vec2 dir = normalize(mix(randomDir, fromCenter, 0.55));
        float delay = h3 * 0.22;
        float lt = clamp((t - delay) / max(1.0 - delay, 0.001), 0.0, 1.0);
        lt = easeInCubic(lt);
        float sc = mix(1.0, 0.12, lt);
        vec2 center = (cell + 0.5) / grid;
        vec2 flyCenter = center + dir * lt * 0.22;
        vec2 cellSize = (1.0 / grid) * sc;
        vec2 local = (vUv - flyCenter) / cellSize + 0.5;
        if (local.x >= 0.0 && local.x <= 1.0 && local.y >= 0.0 && local.y <= 1.0) {
          old = texture2D(map, (cell + local) / grid);
          alpha = 1.0 - lt;
        }
      }
    }
  `),

  glitch: snapshotShader(`
    float line = hash(vec2(floor(vUv.y * 54.0), floor(t * 24.0)));
    float band = hash(vec2(floor(vUv.y * 11.0), floor(t * 9.0)));
    float slice = step(0.74, line) * (band * 2.0 - 1.0) * 0.09 * (1.0 - t);
    vec2 blockId = floor(vUv * vec2(14.0, 9.0) + t * 4.0);
    float block = hash(blockId);
    float blockShift = step(0.86, block) * (block * 2.0 - 1.0) * 0.07 * sin(t * 42.0);
    uv = vUv + vec2(slice + blockShift, 0.0);
    float aberration = 0.014 * (1.0 - t) * (0.35 + 0.65 * abs(sin(t * 28.0)));
    float r = texture2D(map, uv + vec2(aberration, 0.0)).r;
    float g = texture2D(map, uv).g;
    float b = texture2D(map, uv - vec2(aberration, 0.0)).b;
    float scan = 0.9 + 0.1 * sin(vUv.y * resolution.y * 1.35);
    old = vec4(r, g, b, 1.0) * scan;
    alpha = 1.0 - easeInCubic(t);
  `),

  swirl: snapshotShader(`
    vec2 p = vUv - 0.5;
    float dist = length(p);
    float eased = easeInOutSine(t);
    float twist = eased * 6.28318530718 * (1.2 - dist);
    float ca = cos(twist);
    float sa = sin(twist);
    vec2 rotated = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    uv = rotated / mix(1.0, 1.5, eased) + 0.5;
    old = texture2D(map, uv);
    alpha = 1.0 - easeInCubic(t);
  `),
};

export function createSnapshotMaterial(preset: SnapshotTransitionPreset, texture: Texture): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      map: { value: texture },
      progress: { value: 0 },
      resolution: { value: new Vector2(1, 1) },
    },
    vertexShader: SNAPSHOT_VERTEX_SHADER,
    fragmentShader: SNAPSHOT_FRAGMENT_SHADERS[preset],
  });
}
