import type { Node } from "three/webgpu";
import type { WebGPUShaderModules } from "./webgpu-frame";

type UV = Node<"vec2">;

export function createWebGPUShaderNoise({ dot, floor, fract, mix, vec2 }: WebGPUShaderModules["tsl"]) {
  function shaderHash(p: UV) {
    const base = fract(p.xyx.mul(0.1031));
    const h = base.add(dot(base, base.yzx.add(33.33)));
    return fract(h.x.add(h.y).mul(h.z));
  }

  function noise(p: UV) {
    const id = floor(p);
    const f = fract(p);
    const u = f.mul(f).mul(f.mul(-2).add(3));
    return mix(mix(shaderHash(id), shaderHash(id.add(vec2(1, 0))), u.x),
      mix(shaderHash(id.add(vec2(0, 1))), shaderHash(id.add(1)), u.x), u.y);
  }

  function shaderFbm(p: UV) {
    return noise(p).mul(0.5).add(noise(p.mul(2.13)).mul(0.25), noise(p.mul(4.17)).mul(0.125));
  }
  return { shaderHash, shaderFbm };
}
