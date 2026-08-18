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

vec2 gridCellId() {
  return floor(vUv * aspectGrid(16.0));
}

vec2 gridCellUv() {
  vec2 cells = aspectGrid(16.0);
  return (floor(vUv * cells) + 0.5) / cells;
}

float gridWipeAlpha(float spatialOrder, float t) {
  vec2 cells = aspectGrid(16.0);
  vec2 id = floor(vUv * cells);
  vec2 local = fract(vUv * cells);
  float order = mix(clamp(spatialOrder, 0.0, 1.0), hash(id), 0.12);
  float disappear = smoothstep(order, order + 0.16, t);
  float sc = mix(1.0, 0.18, disappear);
  vec2 scaled = 0.5 + (local - 0.5) / max(sc, 0.001);
  float inside = step(0.0, scaled.x) * step(scaled.x, 1.0) * step(0.0, scaled.y) * step(scaled.y, 1.0);
  return inside * (1.0 - disappear);
}

float hexRound(float x) {
  return floor(x + 0.5);
}

vec2 hexCellId(vec2 uv) {
  float aspect = resolution.x / max(resolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 12.0;
  float q = 1.1547005 * p.x;
  float r = -0.5773503 * p.x + p.y;
  vec3 cube = vec3(q, -q - r, r);
  vec3 rounded = vec3(hexRound(cube.x), hexRound(cube.y), hexRound(cube.z));
  vec3 diff = abs(rounded - cube);
  if (diff.x > diff.y && diff.x > diff.z) {
    rounded.x = -rounded.y - rounded.z;
  } else if (diff.y > diff.z) {
    rounded.y = -rounded.x - rounded.z;
  }
  return rounded.xz;
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
    alpha = gridWipeAlpha(hash(gridCellId()), t);
  `),

  gridWipeUp: snapshotShader(`
    alpha = gridWipeAlpha(gridCellUv().y, t);
  `),

  gridWipeRight: snapshotShader(`
    alpha = gridWipeAlpha(gridCellUv().x, t);
  `),

  gridWipeDiagonal: snapshotShader(`
    vec2 uv01 = gridCellUv();
    alpha = gridWipeAlpha((uv01.x + uv01.y) * 0.5, t);
  `),

  gridWipeCenter: snapshotShader(`
    alpha = gridWipeAlpha(length(gridCellUv() - 0.5) * 1.414, t);
  `),

  gridWipeChecker: snapshotShader(`
    vec2 id = gridCellId();
    float spatial = mix(0.0, 0.48, mod(id.x + id.y, 2.0));
    alpha = gridWipeAlpha(spatial, t);
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

  clockWipe: snapshotShader(`
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float a = fract(angle / 6.28318530718 + 0.25);
    alpha = 1.0 - smoothstep(a, a + 0.045, t);
  `),

  ripple: snapshotShader(`
    vec2 p = vUv - 0.5;
    float dist = length(p);
    float wave = sin(dist * 42.0 - t * 20.0) * 0.028 * (1.0 - t);
    uv = vUv + normalize(p + 1e-5) * wave;
    old = texture2D(map, uv);
    alpha = 1.0 - easeInCubic(t);
  `),

  zoomBlur: snapshotShader(`
    vec2 dir = vUv - 0.5;
    vec4 acc = vec4(0.0);
    for (int i = 0; i < 12; i++) {
      float f = float(i) / 11.0;
      acc += texture2D(map, 0.5 + dir * (1.0 - f * easeInCubic(t) * 0.88));
    }
    old = acc / 12.0;
    alpha = 1.0 - easeInCubic(t);
  `),

  hexDissolve: snapshotShader(`
    float order = hash(hexCellId(vUv));
    alpha = 1.0 - smoothstep(order, order + 0.14, t);
  `),

  filmBurn: snapshotShader(`
    float n = fbm(vUv * 6.0 + vec2(t * 1.4, t * 0.6));
    float edge = length((vUv - 0.5) * vec2(1.1, 1.0));
    float fuel = n * 0.62 + edge * 0.5;
    float burn = smoothstep(fuel, fuel + 0.18, t * 1.15);
    float glow = smoothstep(0.0, 0.22, burn) * (1.0 - smoothstep(0.35, 1.0, burn));
    old.rgb = mix(old.rgb, vec3(1.0, 0.38, 0.08), glow);
    old.rgb = mix(old.rgb, vec3(1.0, 0.92, 0.7), glow * glow);
    alpha = 1.0 - burn;
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
