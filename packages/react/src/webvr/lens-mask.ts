/** Shared by panorama distortion and the final aperture mask. */
export const stereoLensMappingGlsl = `
vec2 stereoLensSourceUv(vec2 uv, vec2 distortion, vec2 lensCenter) {
  vec2 centered = uv * 2.0 - 1.0 - lensCenter;
  float radius2 = dot(centered, centered);
  float scale = 1.0 + distortion.x * radius2 + distortion.y * radius2 * radius2;
  return (centered * scale + lensCenter) * 0.5 + 0.5;
}
`;

export function isInsideStereoLens(
  u: number,
  v: number,
  distortion: { x: number; y: number },
  center: { x: number; y: number }
): boolean {
  const x = u * 2 - 1 - center.x,
    y = v * 2 - 1 - center.y;
  const r2 = x * x + y * y;
  const scale = 1 + distortion.x * r2 + distortion.y * r2 * r2;
  const sx = (x * scale + center.x + 1) / 2;
  const sy = (y * scale + center.y + 1) / 2;
  return sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1;
}

export const stereoLensMaskFragmentShader = `
uniform vec2 distortion;
uniform vec2 lensCenter;
varying vec2 vUv;
${stereoLensMappingGlsl}
void main() {
  vec2 uv = stereoLensSourceUv(vUv, distortion, lensCenter);
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;
