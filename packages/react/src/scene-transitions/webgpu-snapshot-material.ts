import type { Node } from "three/webgpu";
import { DoubleSide, Vector2, type Texture } from "three";
import { createWebGPUShaderNoise } from "../webgpu-noise";
import type { WebGPUShaderModules } from "../webgpu-frame";
import type { SceneTransitionPreset } from "./presets";
import { PARTICLE_GRID } from "./particle-overlay";

type UV = Node<"vec2">;

function rotation(p: UV, angle: Node<"float">, { cos, sin, vec2 }: WebGPUShaderModules["tsl"]) {
  const c = cos(angle);
  const s = sin(angle);
  return vec2(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c)));
}

export function createWebGPUSnapshotMaterial(
  modules: WebGPUShaderModules, preset: SceneTransitionPreset, source: Texture,
) {
  const { Fn, If, Loop, atan, attribute, clamp, cos, dot, float, floor, fract, length, max, min, mix,
    normalize, positionGeometry, sin, smoothstep, step, texture, uniform, uv, varying, vec2, vec3, vec4 } = modules.tsl;
  const { shaderFbm, shaderHash } = createWebGPUShaderNoise(modules.tsl);
  const material = new modules.three.NodeMaterial();
  material.setValues({
    transparent: true, depthTest: false, depthWrite: false, side: DoubleSide, toneMapped: false,
  });
  material.forceSinglePass = true;
  const map = texture(source);
  const progress = uniform(0);
  const resolution = uniform(new Vector2(1, 1));
  const distance = uniform(0.11);
  const point = uv();
  // Mesh UVs are bottom-up. Native WebGPU render target textures are top-down.
  const sample = (p: UV) => map.sample(vec2(p.x, p.y.oneMinus())).level(float(0));
  const t = clamp(progress, 0, 1);
  const cubic = t.mul(t).mul(t);
  const sine = cos(t.mul(Math.PI)).oneMinus().mul(0.5);

  if (preset === "particles") {
    const grid = vec2(PARTICLE_GRID);
    const id = attribute<"float">("instanceIndex", "float");
    const cell = vec2(id.mod(grid.x), floor(id.div(grid.x)));
    const center = cell.add(0.5).div(grid).sub(0.5);
    const h = shaderHash(cell);
    const random = normalize(vec2(h, shaderHash(cell.add(19.2))).mul(2).sub(1).add(0.00001));
    const direction = normalize(mix(random, normalize(center.add(0.00001)), 0.65));
    const delay = shaderHash(cell.add(7.7)).mul(0.28);
    const time = clamp(t.sub(delay).div(max(delay.oneMinus(), 0.001)), 0, 1);
    const explode = time.mul(time);
    const local = positionGeometry.xy.div(grid).mul(mix(1, 0.18, explode));
    const angle = h.mul(2).sub(1).mul(explode, 4.2);
    const scaled = center.add(direction.mul(explode, 0.9), rotation(local, angle, modules.tsl))
      .mul(2, distance.div(distance.add(explode.mul(0.14))));
    material.vertexNode = vec4(scaled, 0, 1);
    const particleUv = varying(cell.add(point).div(grid));
    const alpha = varying(explode.oneMinus());
    const old = sample(particleUv);
    material.fragmentNode = vec4(old.rgb.mul(alpha.oneMinus().mul(0.22).add(1)), old.a.mul(alpha));
    return { material, map, progress, resolution, distance };
  }

  material.vertexNode = vec4(positionGeometry.xy.mul(2), 0, 1);
  material.fragmentNode = Fn(() => {
    const old = sample(point).toVar();
    const alpha = float(1).toVar();
    const centered = point.sub(0.5);
    const aspect = resolution.x.div(max(resolution.y, 1));
    const grid = (rows: number) => vec2(max(8, floor(aspect.mul(rows))), rows);

    switch (preset) {
      case "none":
      case "crossfade":
        alpha.assign(cubic.oneMinus());
        break;
      case "zoom":
        old.assign(sample(centered.div(mix(1, 2, sine)).add(0.5)));
        alpha.assign(sine.oneMinus());
        break;
      case "blackout":
        old.rgb.assign(mix(old.rgb, vec3(0), sin(min(1, t.mul(2)).mul(Math.PI / 2))));
        alpha.assign(sin(max(0, t.sub(0.5).mul(2)).mul(Math.PI / 2)).oneMinus());
        break;
      case "whiteFlash":
        old.rgb.assign(mix(old.rgb, vec3(1), min(1, sin(t.mul(Math.PI)).mul(2))));
        alpha.assign(t.oneMinus());
        break;
      case "slideRightToLeft":
      case "slideTopToBottom":
      case "slideDiagonal": {
        const diagonal = normalize(vec2(-1, 1));
        const coordinate = preset === "slideRightToLeft" ? point.x :
          preset === "slideTopToBottom" ? point.y : dot(centered, diagonal).add(0.5);
        const feather = preset === "slideRightToLeft" ? 0.2 : preset === "slideTopToBottom" ? 0.01 : 0.4;
        alpha.assign(smoothstep(t.sub(feather), t.add(feather), coordinate));
        break;
      }
      case "circleOpen":
      case "verticalOpen":
      case "horizontalOpen":
      case "ellipticZoomOpen": {
        const scale = preset === "verticalOpen" ? vec2(4, 1) :
          preset === "horizontalOpen" ? vec2(1, 4) : vec2(1.35, 0.8);
        const radius = t.mul(preset === "verticalOpen" ? 1.1 : 1.45);
        const feather = preset === "ellipticZoomOpen" ? 0.3 : preset === "circleOpen" ? 0.2 : 0.1;
        alpha.assign(smoothstep(radius, radius.add(feather), length(centered.mul(scale))));
        if (preset === "ellipticZoomOpen") old.assign(sample(centered.div(t.mul(0.8).add(1)).add(0.5)));
        break;
      }
      case "pixelate": {
        const largest = max(8, min(resolution.x, resolution.y).mul(0.07));
        const p = min(1, t.div(0.72));
        const cell = mix(1, largest, p.mul(p, p));
        const cells = max(floor(resolution.div(max(cell, 1))), vec2(1));
        old.assign(sample(floor(point.mul(cells)).add(0.5).div(cells)));
        alpha.assign(smoothstep(0.58, 1, t).oneMinus());
        break;
      }
      case "gridWipe":
      case "gridWipeUp":
      case "gridWipeRight":
      case "gridWipeDiagonal":
      case "gridWipeCenter":
      case "gridWipeChecker": {
        const cells = grid(16);
        const id = floor(point.mul(cells));
        const p = id.add(0.5).div(cells);
        const spatial = {
          gridWipe: shaderHash(id), gridWipeUp: p.y, gridWipeRight: p.x,
          gridWipeDiagonal: p.x.add(p.y).mul(0.5), gridWipeCenter: length(p.sub(0.5)).mul(1.414),
          gridWipeChecker: id.x.add(id.y).mod(2).mul(0.48),
        }[preset];
        const order = mix(clamp(spatial, 0, 1), shaderHash(id), 0.12);
        const disappear = smoothstep(order, order.add(0.16), t);
        const local = fract(point.mul(cells)).sub(0.5).div(max(mix(1, 0.18, disappear), 0.001)).add(0.5);
        const inside = step(0, local.x).mul(step(local.x, 1), step(0, local.y), step(local.y, 1));
        alpha.assign(disappear.oneMinus().mul(inside));
        break;
      }
      case "dissolve": {
        const n = shaderFbm(point.mul(vec2(7, 5.5)).add(1.7));
        alpha.assign(smoothstep(n, n.add(0.14), t).oneMinus());
        break;
      }
      case "shatter": {
        const cells = grid(10);
        const origin = floor(point.mul(cells));
        old.assign(vec4(0));
        alpha.assign(0);
        Loop({ start: -2, end: 2, condition: "<=", type: "int" },
          { start: -2, end: 2, condition: "<=", type: "int" }, ({ i, j }) => {
            const cell = origin.add(vec2(float(j), float(i)));
            const center = cell.add(0.5).div(cells);
            const h = shaderHash(cell.add(0.13));
            const h2 = shaderHash(cell.add(4.1));
            const random = normalize(vec2(h, h2).mul(2).sub(1).add(0.00001));
            const direction = normalize(mix(random, normalize(center.sub(0.5).add(0.00001)), 0.55));
            const delay = shaderHash(cell.add(9.7)).mul(0.22);
            const localTime = clamp(t.sub(delay).div(max(delay.oneMinus(), 0.001)), 0, 1);
            const eased = localTime.mul(localTime, localTime);
            const fly = center.add(direction.mul(eased, 0.22));
            const local = point.sub(fly).mul(cells).div(mix(1, 0.12, eased)).add(0.5);
            If(local.x.greaterThanEqual(0).and(local.y.greaterThanEqual(0))
              .and(local.x.lessThanEqual(1)).and(local.y.lessThanEqual(1)), () => {
              old.assign(sample(cell.add(local).div(cells)));
              alpha.assign(eased.oneMinus());
            });
          });
        break;
      }
      case "glitch": {
        const line = shaderHash(vec2(floor(point.y.mul(54)), floor(t.mul(24))));
        const band = shaderHash(vec2(floor(point.y.mul(11)), floor(t.mul(9))));
        const slice = step(0.74, line).mul(band.mul(2).sub(1), 0.09, t.oneMinus());
        const block = shaderHash(floor(point.mul(vec2(14, 9)).add(t.mul(4))));
        const shift = step(0.86, block).mul(block.mul(2).sub(1), 0.07, sin(t.mul(42)));
        const p = point.add(vec2(slice.add(shift), 0));
        const aberration = vec2(sin(t.mul(28)).abs().mul(0.65).add(0.35).mul(0.014, t.oneMinus()), 0);
        old.assign(vec4(sample(p.add(aberration)).r, sample(p).g, sample(p.sub(aberration)).b, 1)
          .mul(sin(point.y.mul(resolution.y, 1.35)).mul(0.1).add(0.9)));
        alpha.assign(cubic.oneMinus());
        break;
      }
      case "swirl": {
        const twist = length(centered).negate().add(1.2).mul(sine, 2 * Math.PI);
        old.assign(sample(rotation(centered, twist, modules.tsl).div(mix(1, 1.5, sine)).add(0.5)));
        alpha.assign(cubic.oneMinus());
        break;
      }
      case "clockWipe": {
        const angle = fract(atan(centered.y, centered.x).div(2 * Math.PI).add(0.25));
        alpha.assign(smoothstep(angle, angle.add(0.045), t).oneMinus());
        break;
      }
      case "ripple": {
        const wave = sin(length(centered).mul(42).sub(t.mul(20))).mul(0.028, t.oneMinus());
        old.assign(sample(point.add(normalize(centered.add(0.00001)).mul(wave))));
        alpha.assign(cubic.oneMinus());
        break;
      }
      case "zoomBlur": {
        const acc = vec4(0).toVar();
        Loop(12, ({ i }) => {
          const f = float(i).div(11);
          acc.addAssign(sample(centered.mul(f.mul(cubic, 0.88).oneMinus()).add(0.5)));
        });
        old.assign(acc.div(12));
        alpha.assign(cubic.oneMinus());
        break;
      }
      case "hexDissolve": {
        const p = centered.mul(vec2(aspect, 1), 12);
        const q = p.x.mul(1.1547005);
        const r = p.x.mul(-0.5773503).add(p.y);
        const cube = vec3(q, q.add(r).negate(), r);
        const rounded = floor(cube.add(0.5)).toVar();
        const diff = rounded.sub(cube).abs();
        If(diff.x.greaterThan(diff.y).and(diff.x.greaterThan(diff.z)), () => {
          rounded.x.assign(rounded.y.add(rounded.z).negate());
        }).ElseIf(diff.y.greaterThan(diff.z), () => {
          rounded.y.assign(rounded.x.add(rounded.z).negate());
        }).Else(() => {
          rounded.z.assign(rounded.x.add(rounded.y).negate());
        });
        const order = shaderHash(rounded.xz);
        alpha.assign(smoothstep(order, order.add(0.14), t).oneMinus());
        break;
      }
      case "filmBurn": {
        const n = shaderFbm(point.mul(6).add(vec2(t.mul(1.4), t.mul(0.6))));
        const fuel = n.mul(0.62).add(length(centered.mul(vec2(1.1, 1))).mul(0.5));
        const burn = smoothstep(fuel, fuel.add(0.18), t.mul(1.15));
        const glow = smoothstep(0, 0.22, burn).mul(smoothstep(0.35, 1, burn).oneMinus());
        old.rgb.assign(mix(mix(old.rgb, vec3(1, 0.38, 0.08), glow), vec3(1, 0.92, 0.7), glow.mul(glow)));
        alpha.assign(burn.oneMinus());
        break;
      }
    }
    return vec4(old.rgb, old.a.mul(alpha));
  })();
  return { material, map, progress, resolution, distance };
}
