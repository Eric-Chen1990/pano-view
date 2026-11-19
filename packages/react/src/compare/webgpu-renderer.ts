import type { RootState } from "@react-three/fiber";
import { Color, Vector2, type RenderTarget } from "three";
import {
  createWebGPUTarget, withWebGPUState, type WebGPUFramePasses,
} from "../webgpu-frame";
import type { PairGroups } from "./renderer";
import type { CompareFrameConfig, createCompareHost } from "./view";

export function createWebGPUComparison(passes: WebGPUFramePasses) {
  const renderer = passes.renderer;
  const { NodeMaterial, QuadMesh } = passes.modules.three;
  const { mix, screenUV, texture, uniform, vec4 } = passes.modules.tsl;
  const targets = [createWebGPUTarget(), createWebGPUTarget()] as const;
  const buffer = new Vector2();
  const captures: RenderTarget[] = [];
  let previous: RenderTarget | undefined;
  const before = texture(targets[0].texture, screenUV);
  const after = texture(targets[1].texture, screenUV);
  const old = texture(targets[0].texture, screenUV);
  const opacity = uniform(0);
  const split = uniform(0.5);
  const column = uniform(true);
  const dividerColor = uniform(new Color());
  const dividerWidth = uniform(0);
  const coordinate = column.select(screenUV.x, screenUV.y);
  const current = coordinate.lessThan(split).select(before, after);
  const withDivider = coordinate.sub(split).abs().lessThan(dividerWidth)
    .select(vec4(dividerColor, 1), current);
  const material = new NodeMaterial();
  material.setValues({ depthTest: false, depthWrite: false, toneMapped: false });
  material.fragmentNode = mix(withDivider, old, opacity);
  const quad = new QuadMesh(material);

  function render(
    { camera, scene, size }: RootState,
    host: ReturnType<typeof createCompareHost>,
    pair: PairGroups,
    config: CompareFrameConfig,
    fadeOpacity: number,
    captureMaxPixels?: number,
  ) {
    const dpr = renderer.getPixelRatio();
    const rects = host.getRects(size, dpr, config);
    renderer.getDrawingBufferSize(buffer);
    if (!rects || !buffer.x || !buffer.y) return;
    const beforeVisible = pair.before.visible;
    const afterVisible = pair.after.visible;
    try {
      withWebGPUState(renderer, () => {
        renderer.autoClear = true;
        renderer.setScissorTest(true);
        for (const [index, target] of targets.entries()) {
          const clip = rects[index];
          const side = index === 0 ? "before" : "after";
          const x = Math.round(clip.x * dpr);
          const y = Math.round(clip.y * dpr);
          const width = Math.min(buffer.x, Math.round((clip.x + clip.width) * dpr)) - x;
          const height = Math.min(buffer.y, Math.round((clip.y + clip.height) * dpr)) - y;
          if (width <= 0 || height <= 0) continue;
          target.setSize(buffer.x, buffer.y);
          const pane = host.getPane(camera, size, dpr, side, config);
          if (pane) {
            const rect = pane.rect;
            target.viewport.set(Math.round(rect.x * dpr), Math.round(rect.y * dpr),
              Math.min(buffer.x, Math.round((rect.x + rect.width) * dpr)) - Math.round(rect.x * dpr),
              Math.min(buffer.y, Math.round((rect.y + rect.height) * dpr)) - Math.round(rect.y * dpr));
          }
          target.scissor.set(x, y, width, height);
          pair.before.visible = index === 0;
          pair.after.visible = index === 1;
          renderer.setRenderTarget(target);
          passes.render(scene, pane?.camera ?? camera);
        }

        const horizontal = config.layout === "left-right";
        const edge = horizontal ? rects[0].width : rects[0].height;
        const extent = horizontal ? buffer.x : buffer.y;
        split.value = Math.min(extent, Math.round(edge * dpr)) / extent;
        column.value = horizontal;
        before.value = split.value === 0 ? targets[1].texture : targets[0].texture;
        after.value = split.value === 1 ? targets[0].texture : targets[1].texture;
        opacity.value = previous ? fadeOpacity : 0;
        old.value = previous?.texture ?? before.value;
        dividerWidth.value = 0;
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, size.width, size.height);
        renderer.setRenderTarget(null);

        if (captureMaxPixels) {
          const next = captures.find((target) => target !== previous) ?? createWebGPUTarget(false);
          if (!captures.includes(next)) captures.push(next);
          const scale = Math.min(1, Math.sqrt(captureMaxPixels / (buffer.x * buffer.y)));
          next.setSize(Math.max(1, Math.floor(buffer.x * scale)), Math.max(1, Math.floor(buffer.y * scale)));
          const divider = host.chrome?.querySelector(".pano-compare-divider");
          const style = divider && getComputedStyle(divider, "::before");
          // The DOM may already have the new layout. Use the configured line
          // thickness, since the pseudo-element's long axis has already flipped.
          const configuredWidth = host.getConfig()?.dividerWidth;
          const width = configuredWidth !== undefined && Number.isFinite(configuredWidth) && configuredWidth > 0
            ? configuredWidth : 2;
          dividerColor.value.setStyle(style?.backgroundColor ?? "white");
          dividerWidth.value = width * dpr / extent / 2;
          renderer.setRenderTarget(next);
          quad.render(renderer);
          previous = next;
        } else {
          quad.render(renderer);
        }
      });
    } finally {
      pair.before.visible = beforeVisible;
      pair.after.visible = afterVisible;
    }
  }

  return {
    render,
    clear() {
      previous = undefined;
      for (const capture of captures.splice(0)) capture.dispose();
    },
    dispose() {
      this.clear();
      for (const target of targets) target.dispose();
      material.dispose();
    },
  };
}
