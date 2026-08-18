/** Shared GLSL helpers inlined into snapshot and particle shaders. */
export const GLSL_COMMON = `
float easeInCubic(float t) { return t * t * t; }
float easeOutSine(float t) { return sin(t * 1.57079632679); }
float easeInOutSine(float t) { return -(cos(3.14159265359 * t) - 1.0) * 0.5; }

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  return 0.5 * valueNoise(p)
    + 0.25 * valueNoise(p * 2.13)
    + 0.125 * valueNoise(p * 4.17);
}
`;
