import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import {
  configureRendererInfoForAggregation,
  getRendererFrameStats,
  resetRendererFrameStats,
} from "../renderer-capabilities";
import type { PanoPerformanceFrameloop, PanoPerformanceHost } from "./host";

const FRAME_BEGIN_PRIORITY = -1_000_000;

function readFrameloop(value: unknown): PanoPerformanceFrameloop {
  switch (value) {
    case "always":
    case "demand":
    case "never":
      return value;
    default:
      return "always";
  }
}

function ActiveCollector({ host }: { host: PanoPerformanceHost }) {
  const gl = useThree((state) => state.gl);
  const started = useRef(false);
  const startedAt = useRef(0);
  const frameloop = useRef<PanoPerformanceFrameloop>("always");

  useLayoutEffect(() => configureRendererInfoForAggregation(gl), [gl]);

  useFrame((state) => {
    resetRendererFrameStats(state.gl);
    startedAt.current = performance.now();
    frameloop.current = readFrameloop(state.frameloop);
    started.current = true;
  }, FRAME_BEGIN_PRIORITY);

  useEffect(() => {
    return addAfterEffect(() => {
      if (!started.current) return;
      started.current = false;
      const now = performance.now();
      const stats = getRendererFrameStats(gl);
      host.recordFrame({
        now,
        cpuMs: Math.max(0, now - startedAt.current),
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
        geometries: stats.geometries,
        textures: stats.textures,
        dpr: gl.getPixelRatio(),
        canvasWidth: gl.domElement.width,
        canvasHeight: gl.domElement.height,
        frameloop: frameloop.current,
        hidden: typeof document !== "undefined" && document.hidden,
      });
    });
  }, [gl, host]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      host.setHidden(document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [host]);

  return null;
}

/** Samples renderer stats into the performance host while a monitor is mounted. */
export function PanoPerformanceCollector({ host }: { host: PanoPerformanceHost }) {
  const active = useSyncExternalStore(
    host.subscribeActive,
    host.isActive,
    () => false,
  );
  if (!active) return null;
  return <ActiveCollector host={host} />;
}
