import { useFrame, useThree, type RootState } from "@react-three/fiber";
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Vector4, type Group } from "three";
import { CompareHostContext, type CompareFrameConfig, type createCompareHost } from "./view";

import { WebGPURuntimeContext } from "../pano-renderer";
import { createWebGPUComparison } from "./webgpu-renderer";
import { ScreenshotContext } from "../screenshot";

const LAYOUT_FADE_MS = 240;
const SEPARATION_MS = 360;
const MAX_SNAPSHOT_PIXELS = 2_073_600;

export type PairGroups = { before: Group; after: Group };

function renderComparison(
  { gl, camera, scene, size }: RootState,
  host: ReturnType<typeof createCompareHost>,
  pair: PairGroups,
  config: CompareFrameConfig,
  viewport: Vector4,
  scissor: Vector4,
) {
  const dpr = gl.getPixelRatio();
  const rects = host.getRects(size, dpr, config);
  if (!rects) return;
  const scissorTest = gl.getScissorTest();
  const autoClear = gl.autoClear;
  const beforeVisible = pair.before.visible;
  const afterVisible = pair.after.visible;
  gl.getViewport(viewport);
  gl.getScissor(scissor);
  gl.autoClear = true;
  gl.setScissorTest(true);
  try {
    for (const side of ["before", "after"] as const) {
      const rect = rects[side === "before" ? 0 : 1];
      if (rect.width <= 0 || rect.height <= 0) continue;
      // Convert both edges to physical pixels first so adjacent scissors share an edge.
      const x = Math.round(rect.x * dpr);
      const y = Math.round((size.height - rect.y - rect.height) * dpr);
      const width = Math.round((rect.x + rect.width) * dpr) - x;
      const height = Math.round((size.height - rect.y) * dpr) - y;
      if (width <= 0 || height <= 0) continue;
      const pane = host.getPane(camera, size, dpr, side, config);
      if (pane) {
        const projection = pane.rect;
        gl.setViewport(
          projection.x, size.height - projection.y - projection.height,
          projection.width, projection.height,
        );
      } else {
        gl.setViewport(viewport);
      }
      gl.setScissor(x / dpr, y / dpr, width / dpr, height / dpr);
      pair.before.visible = side === "before";
      pair.after.visible = side === "after";
      gl.render(scene, pane?.camera ?? camera);
    }
  } finally {
    pair.before.visible = beforeVisible;
    pair.after.visible = afterVisible;
    gl.setViewport(viewport);
    gl.setScissor(scissor);
    gl.setScissorTest(scissorTest);
    gl.autoClear = autoClear;
  }
}

type Frame = {
  config: CompareFrameConfig;
  pair: PairGroups;
  width: number;
  height: number;
};

type Fade = { canvas: HTMLCanvasElement; animation: Animation };
type Separation = { from: number; to: number; start: number };

function captureComparison(
  layer: HTMLDivElement,
  source: HTMLCanvasElement,
  previous: Frame,
  outgoing: Fade | null,
  separation: number | undefined,
) {
  const canvas = layer.ownerDocument.createElement("canvas");
  if (!canvas.animate || source.width === 0 || source.height === 0) return null;
  const scale = Math.min(1, Math.sqrt(MAX_SNAPSHOT_PIXELS / (source.width * source.height)));
  canvas.width = Math.max(1, Math.floor(source.width * scale));
  canvas.height = Math.max(1, Math.floor(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Take the snapshot in the same frame as the WebGL draws, before the browser
  // can discard the drawing buffer. No snapshot work runs during normal viewing.
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const { config } = previous;
  const split = separation === undefined
    ? config.presentation === "wipe" ? config.split : 0.5
    : config.split + (0.5 - config.split) * separation;
  const divider = layer.parentElement?.querySelector(".pano-compare-divider");
  const horizontal = layer.parentElement?.dataset.layout === "top-bottom";
  const line = divider && getComputedStyle(divider, "::before");
  const width = line ? Number.parseFloat(horizontal ? line.height : line.width) : 2;
  ctx.fillStyle = line ? line.backgroundColor : "white";
  if (config.layout === "left-right") {
    const thickness = width * canvas.width / previous.width;
    ctx.fillRect(split * canvas.width - thickness / 2, 0, thickness, canvas.height);
  } else {
    const thickness = width * canvas.height / previous.height;
    ctx.fillRect(0, split * canvas.height - thickness / 2, canvas.width, thickness);
  }
  if (outgoing?.canvas.isConnected) {
    // Start an interrupted transition from the blend currently on screen.
    ctx.globalAlpha = Number(getComputedStyle(outgoing.canvas).opacity);
    ctx.drawImage(outgoing.canvas, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

export function CompareRenderer({ groups }: { groups: RefObject<PairGroups | null> }) {
  const host = useContext(CompareHostContext);
  const screenshot = useContext(ScreenshotContext);
  const gpu = useContext(WebGPURuntimeContext)?.passes;
  const gpuCompare = useMemo(() => gpu && createWebGPUComparison(gpu), [gpu]);
  const gpuFadeStart = useRef<number | null>(null);
  useEffect(() => () => gpuCompare?.dispose(), [gpuCompare]);
  const element = useThree((state) => state.gl.domElement);
  const viewport = useMemo(() => new Vector4(), []);
  const scissor = useMemo(() => new Vector4(), []);
  const lastFrame = useRef<Frame | null>(null);
  const dividerChrome = useRef<HTMLDivElement | null>(null);
  const fade = useRef<Fade | null>(null);
  const separation = useRef<Separation | null>(null);
  const clearFade = useCallback(() => {
    gpuFadeStart.current = null;
    gpuCompare?.clear();
    const current = fade.current;
    if (!current) return;
    fade.current = null;
    current.animation.cancel();
    current.canvas.remove();
  }, [gpuCompare]);
  const clearSeparation = useCallback(() => {
    if (!separation.current) return;
    separation.current = null;
    host?.setMotion(null);
  }, [host]);

  useEffect(() => {
    const reset = () => {
      lastFrame.current = null;
      clearFade();
      clearSeparation();
    };
    element.addEventListener("webglcontextlost", reset);
    return () => {
      element.removeEventListener("webglcontextlost", reset);
      reset();
    };
  }, [clearFade, clearSeparation, element]);

  const renderFrame = (state: RootState) => {
    const { gl, camera, scene, size } = state;
    const config = host?.getFrameConfig();
    const pair = groups.current;
    if (!config || !pair || !host || gl.xr.isPresenting) {
      lastFrame.current = null;
      clearFade();
      clearSeparation();
      if (gpu) gpu.render(scene, camera);
      else gl.render(scene, camera);
      return;
    }

    const previous = lastFrame.current;
    const sameFrameSize = previous?.width === size.width && previous.height === size.height;
    const samePair = previous?.pair === pair;
    const layoutChanged = previous && previous.config.layout !== config.layout;
    const presentationChanged = previous && previous.config.presentation !== config.presentation;
    const layer = host.transitionLayer;
    const now = performance.now();
    const reducedMotion = (layoutChanged || presentationChanged) &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!samePair || !sameFrameSize || reducedMotion) {
      clearFade();
      clearSeparation();
    } else if (layoutChanged && gpuCompare) {
      gpuCompare.render(state, host, pair, previous.config, fadeOpacity(now), MAX_SNAPSHOT_PIXELS);
      clearSeparation();
      gpuFadeStart.current = now;
    } else if (layoutChanged) {
      if (layer) {
        renderComparison(state, host, pair, previous.config, viewport, scissor);
      }
      const canvas = layer && captureComparison(
        layer, gl.domElement, previous, fade.current, host.motion?.separation,
      );
      clearFade();
      clearSeparation();
      if (layer && canvas) {
        layer.appendChild(canvas);
        const animation = canvas.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: LAYOUT_FADE_MS,
          easing: "ease-out",
          fill: "forwards",
        });
        fade.current = { canvas, animation };
        animation.onfinish = () => {
          if (fade.current?.animation === animation) clearFade();
        };
      }
    } else if (presentationChanged) {
      clearFade();
      separation.current = {
        from: host.motion?.separation ?? (previous.config.presentation === "wipe" ? 0 : 1),
        to: config.presentation === "wipe" ? 0 : 1,
        start: now,
      };
    } else if (config.presentation === "wipe" && previous?.config.split !== config.split) {
      clearFade();
    }

    const motion = separation.current;
    if (motion) {
      const duration = SEPARATION_MS * Math.abs(motion.to - motion.from);
      const progress = duration ? Math.min(1, (now - motion.start) / duration) : 1;
      if (progress === 1) {
        clearSeparation();
      } else {
        const eased = progress * progress * (3 - 2 * progress);
        host.setMotion({
          layout: config.layout,
          separation: motion.from + (motion.to - motion.from) * eased,
        });
      }
    }

    const opacity = gpuCompare ? fadeOpacity(now) : 0;
    if (opacity === 0 && gpuFadeStart.current !== null) clearFade();
    const stable = !host.motion && !fade.current && opacity === 0;
    if (stable) {
      screenshot?.beforeDraw(gl.domElement, scene, () => {
        if (gpuCompare) gpuCompare.render(state, host, pair, config, 0);
        else renderComparison(state, host, pair, config, viewport, scissor);
      });
    }
    if (gpuCompare) {
      gpuCompare.render(state, host, pair, config, opacity);
    } else renderComparison(state, host, pair, config, viewport, scissor);
    const chrome = host.chrome;
    if (chrome && (chrome !== dividerChrome.current || config.split !== previous?.config.split)) {
      chrome.style.setProperty("--pano-compare-split", `${config.split * 100}%`);
    }
    dividerChrome.current = chrome;
    if (previous?.config !== config || !samePair || !sameFrameSize) {
      lastFrame.current = { config, pair, width: size.width, height: size.height };
    }
    if (stable) screenshot?.afterDraw(gl.domElement);
  };
  const latest = useRef(renderFrame);
  latest.current = renderFrame;
  function fadeOpacity(now: number) {
    return gpuFadeStart.current === null ? 0 :
      Math.max(0, 1 - (now - gpuFadeStart.current) / LAYOUT_FADE_MS) ** 2;
  }
  useLayoutEffect(() => {
    if (!gpu) return;
    gpu.compare = (state) => latest.current(state);
    return () => { delete gpu.compare; };
  }, [gpu]);
  useFrame((state) => { if (!gpu) renderFrame(state); }, gpu ? 0 : 1);
  return null;
}
