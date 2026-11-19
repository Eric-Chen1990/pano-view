import type { RootState } from "@react-three/fiber";
import { createContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CanvasTarget, WebGPURenderer } from "three/webgpu";
import type { Line2 } from "three/addons/lines/webgpu/Line2.js";
import type { PanoRendererBackend } from "./types";
import { endWebXRSession, hasWebGPUXRBinding } from "./webvr/webgpu-xr";
import { createWebGPUFramePasses, type WebGPUFramePasses } from "./webgpu-frame";
import { getWebGPUDevice, isWebGPURenderer } from "./renderer-capabilities";

const WEBGL_OPTIONS = {
  antialias: true,
  powerPreference: "high-performance",
  stencil: false,
} as const;

type PreparedRenderer = {
  renderer: WebGPURenderer;
  CanvasTarget: typeof CanvasTarget;
  passes: WebGPUFramePasses;
  nativeXR: boolean;
  Line2: typeof Line2;
};

type WebGPURuntime = {
  passes: WebGPUFramePasses;
  nativeXR: boolean;
  Line2: typeof Line2;
  fallback: () => void;
};

export const WebGPURuntimeContext = createContext<WebGPURuntime | null>(null);

function releaseRenderer(renderer: WebGPURenderer) {
  renderer.onDeviceLost = () => {};
  if (!renderer.hasInitialized()) return;
  const session = renderer.xr.getSession();
  if (session) void endWebXRSession(session).catch(() => {}).finally(() => renderer.dispose());
  else renderer.dispose();
}

export function usePanoRenderer(preference: "auto" | "webgl", beforeReplace: () => void) {
  const [forcedWebGL, setForcedWebGL] = useState(false);
  const [prepared, setPrepared] = useState<PreparedRenderer | null>(null);
  const [backend, setBackend] = useState<PanoRendererBackend | null>(null);
  const actual = useRef<PanoRendererBackend | null>(null);
  const recovered = useRef(false);
  const beforeReplaceRef = useRef(beforeReplace);
  beforeReplaceRef.current = beforeReplace;
  const attemptWebGPU = preference === "auto" && !forcedWebGL;

  const publish = useCallback((value: PanoRendererBackend | null) => {
    actual.current = value;
    setBackend(value);
  }, []);
  const fallback = useCallback(() => {
    if (recovered.current) return;
    recovered.current = true;
    if (actual.current === "webgpu") beforeReplaceRef.current();
    publish(null);
    setForcedWebGL(true);
  }, [publish]);

  useEffect(() => {
    if (!attemptWebGPU) return;
    if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) {
      fallback();
      return;
    }
    let cancelled = false;
    let renderer: WebGPURenderer | undefined;
    let preparing = true;
    let lost = false;

    async function prepare() {
      try {
        const [three, tsl, { Line2 }] = await Promise.all([
          import("three/webgpu"),
          import("three/tsl"),
          import("three/addons/lines/webgpu/Line2.js"),
        ]);
        if (cancelled) return;
        const { WebGPURenderer, CanvasTarget } = three;
        function makeRenderer(nativeXR: boolean) {
          const candidate = new WebGPURenderer({
            ...WEBGL_OPTIONS,
            alpha: true,
            canvas: document.createElement("canvas"),
          });
          candidate.xr.enabled = nativeXR;
          const reportDeviceLoss = candidate.onDeviceLost.bind(candidate);
          candidate.onDeviceLost = (info) => {
            if (cancelled) return;
            lost = true;
            reportDeviceLoss(info);
            fallback();
          };
          return candidate;
        }

        let nativeXR = hasWebGPUXRBinding();
        renderer = makeRenderer(nativeXR);
        await renderer.init();
        if (cancelled || lost) return;
        if (nativeXR && !("isWebGPUBackend" in renderer.backend)) {
          releaseRenderer(renderer);
          nativeXR = false;
          renderer = makeRenderer(false);
          await renderer.init();
          if (cancelled || lost) return;
        }
        if (!("isWebGPUBackend" in renderer.backend)) {
          fallback();
          return;
        }
        setPrepared({ renderer, CanvasTarget, Line2, nativeXR, passes: createWebGPUFramePasses(renderer, { three, tsl }) });
      } catch {
        if (!cancelled) fallback();
      } finally {
        preparing = false;
        if (cancelled && renderer) releaseRenderer(renderer);
      }
    }

    void prepare();
    return () => {
      cancelled = true;
      setPrepared(null);
      if (preparing || !renderer) return;
      const retired = renderer;
      // R3F v9 unmounts the scene from Canvas's passive cleanup.
      setTimeout(() => releaseRenderer(retired), 0);
    };
  }, [attemptWebGPU, fallback]);

  const gpu = attemptWebGPU ? prepared : null;
  const [validated, setValidated] = useState<WebGPURenderer | null>(null);
  const [configured, setConfigured] = useState<WebGPURenderer | null>(null);
  const ready = gpu !== null && validated === gpu.renderer && configured === gpu.renderer;

  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !gpu || gpu.renderer.domElement === canvas) return;
    const { renderer, CanvasTarget } = gpu;
    const device = getWebGPUDevice(renderer);
    const originalTarget = renderer.getCanvasTarget();
    renderer.setCanvasTarget(new CanvasTarget(canvas));
    originalTarget.dispose();

    device.pushErrorScope("validation");
    let valid = false;
    try {
      const context = renderer.getContext() as { getCurrentTexture(): unknown };
      context.getCurrentTexture();
      valid = true;
    } catch {
      fallback();
    }
    void device.popErrorScope().then((error) => {
      if (renderer.domElement !== canvas || !canvas.isConnected || recovered.current) return;
      if (error || !valid) fallback();
      else setValidated(renderer);
    }, fallback);
  }, [fallback, gpu]);

  const onCreated = useCallback(({ gl, xr }: RootState) => {
    // WebGPU's Canvas initially runs without children or a frame loop until its
    // real context has been validated. WebGL is ready as soon as R3F creates it.
    if (isWebGPURenderer(gl)) {
      xr.disconnect();
      setConfigured(gl);
    } else publish("webgl");
  }, [publish]);

  useLayoutEffect(() => {
    if (ready && !recovered.current) publish("webgpu");
  }, [publish, ready]);

  const key = attemptWebGPU ? "webgpu" : "webgl";
  const previousKey = useRef(key);
  useLayoutEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;
    if (actual.current === "webgpu" || actual.current === "webgl") {
      beforeReplaceRef.current();
      publish(null);
    }
  }, [key, publish]);

  return {
    backend,
    getBackend: useCallback(() => actual.current, []),
    key,
    mountCanvas: !attemptWebGPU || gpu !== null,
    renderChildren: !attemptWebGPU || ready,
    gl: gpu?.renderer ?? WEBGL_OPTIONS,
    attachCanvas,
    onCreated,
    runtime: useMemo(() => gpu ? { Line2: gpu.Line2, passes: gpu.passes, nativeXR: gpu.nativeXR, fallback } : null, [gpu, fallback]),
  };
}
