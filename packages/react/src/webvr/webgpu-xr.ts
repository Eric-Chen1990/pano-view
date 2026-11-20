import { advance, type RootState } from "@react-three/fiber";
import type { WebGPURenderer } from "three/webgpu";
import type { WebVRHost } from "./host";

export function hasWebGPUXRBinding() {
  return typeof (globalThis as { XRGPUBinding?: unknown }).XRGPUBinding === "function";
}

export function requestWebVRSession(webgpu: boolean): Promise<XRSession> {
  if (!navigator.xr) return Promise.reject(new Error("WebXR is unavailable."));
  return navigator.xr.requestSession("immersive-vr", {
    requiredFeatures: webgpu ? ["local-floor", "webgpu"] : ["local-floor"],
    optionalFeatures: navigator.userAgent.includes("Macintosh") ? [] : ["hand-tracking"],
  });
}

const closingSessions = new WeakMap<XRSession, Promise<void>>();

export function endWebXRSession(session: XRSession): Promise<void> {
  const closing = closingSessions.get(session);
  if (closing) return closing;
  const end = session.end().catch((error: unknown) => {
    closingSessions.delete(session);
    throw error;
  });
  closingSessions.set(session, end);
  return end;
}

export async function connectWebGPUXR(
  renderer: WebGPURenderer,
  session: XRSession,
  getState: () => RootState,
): Promise<void> {
  // r185 forwards the callback installed before setSession after it updates the
  // XR eye cameras and projection textures. Its XRManager has no setAnimationLoop.
  const previousLoop = renderer.getAnimationLoop();
  const restore = () => { void renderer.setAnimationLoop(previousLoop); };
  try {
    await renderer.setAnimationLoop((time, frame) => {
      const state = getState();
      if (frame && renderer.xr.isPresenting && state.frameloop !== "never") {
        advance(time, true, state, frame);
      }
    });
    renderer.xr.enabled = true;
    await renderer.xr.setSession(session);
    // Register after three.js so its end handler restores the non-XR loop first.
    session.addEventListener("end", restore, { once: true });
  } catch (error) {
    await endWebXRSession(session).catch(() => {});
    restore();
    throw error;
  }
}

/** Keep the user-activated session alive while the viewer replaces the canvas. */
export function handOffWebXRSession(host: WebVRHost, session: XRSession, fallback: () => void) {
  return new Promise<boolean>((resolve) => {
    const cancelled = () => finish(false);
    const timer = setTimeout(cancelled, 10_000);
    let settled = false;
    function finish(entered: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      session.removeEventListener("end", cancelled);
      if (host.pendingXR?.session === session) host.pendingXR = null;
      if (!entered) void endWebXRSession(session).catch(() => {});
      resolve(entered);
    }
    host.pendingXR = { session, finish, connecting: false };
    session.addEventListener("end", cancelled, { once: true });
    fallback();
  });
}
