import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import {
  useContext, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  CanvasTexture, Euler, LinearFilter, MathUtils, Mesh, type MeshBasicMaterial,
  SRGBColorSpace, Vector3,
} from "three";
import { PanoModalHostContext } from "../overlay/pano-overlay";
import { canRunSpatialGaze } from "../spatial/gaze-action";
import { SpatialHostContext } from "../spatial/host";
import { SPATIAL_UI_LAYER } from "../spatial/render-layer";
import { PanoChromeOverlayContext } from "../video/chrome-overlay";
import { getWebVRHotspotView, subscribeWebVRHost, WebVRRuntimeContext } from "./host";
import { pointerInput, pointerStick } from "./input";
import {
  captureLookDownPanelPose, createLookDownGesture, LOOK_DOWN_DISTANCE,
  lookDownPanelDrop, lookDownPanelSize, lookDownPanelTransition, lookDownThreshold, vrEyeBounds,
} from "./look-down-layout";
import { sceneMenuView } from "./scene-menu-layout";
import { bindPanelGrip, hasPanelController } from "./panel-grip";
import type { WebVRInputState } from "./types";

const RAD = Math.PI / 180;

export function useLookDownPanelAvailable() {
  const vr = useContext(WebVRRuntimeContext);
  const spatial = useContext(SpatialHostContext);
  const modal = useContext(PanoModalHostContext);
  if (!vr || !spatial) throw new Error("The VR menu must be rendered inside PanoViewer.");
  const mode = useSyncExternalStore(
    (listener) => subscribeWebVRHost(vr.host, listener),
    () => vr.host.snapshot.setupOpen ? null : vr.host.snapshot.mode,
    () => null,
  );
  const blocked = useSyncExternalStore(
    spatial.subscribe,
    () => spatial.surfaces.size > 0 || spatial.openSceneMenus.size > 0,
    () => false,
  );
  const modalOpen = useSyncExternalStore(modal?.subscribe ?? emptySubscribe, modal?.getSnapshot ?? closed, closed);
  return mode !== null && !blocked && !modalOpen;
}

function emptySubscribe() { return () => {}; }
function closed() { return false; }

export function useVRPanelView() {
  const vr = useContext(WebVRRuntimeContext)!;
  const gl = useThree((state) => state.gl);
  return () => {
    const presenting = gl.xr.isPresenting;
    const view = getWebVRHotspotView(vr, presenting);
    if (!view?.projectionScaleY) return null;
    const eyes = presenting
      ? gl.xr.getCamera().cameras
      : [vr.stereoView.stereo.cameraL, vr.stereoView.stereo.cameraR];
    const bounds = vrEyeBounds(eyes, LOOK_DOWN_DISTANCE);
    return bounds ? { camera: view.camera, ...bounds } : null;
  };
}

export function useVRPanelTexture(width: number, height: number) {
  const resource = useMemo(() => {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 2048 / height);
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d")!;
    context.scale(canvas.width / width, canvas.height / height);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return { context, texture };
  }, [width, height]);
  useLayoutEffect(() => () => resource.texture.dispose(), [resource]);
  return resource;
}

export function spatialPanelLayer(mesh: Mesh) {
  mesh.layers.set(SPATIAL_UI_LAYER);
}

type LookDownPanelAction = { id: string; activate: () => void; dragTo?: (x: number) => void };
type LookDownPanelProps = {
  width: number;
  height: number;
  label: string;
  kind: "menu" | "video";
  accessibility: ReactNode;
  paintKey: string;
  paint: (context: CanvasRenderingContext2D, focused: string) => void;
  resolveAction: (x: number, y: number) => LookDownPanelAction | undefined;
  onHidden?: () => void;
};
type ActionId = { owner: object; id: string };

export function LookDownPanel({
  width, height, label, kind, accessibility, paintKey, paint, resolveAction, onHidden,
}: LookDownPanelProps) {
  const spatial = useContext(SpatialHostContext)!;
  const container = useContext(PanoChromeOverlayContext)?.overlayElement;
  const gl = useThree((state) => state.gl);
  const session = useXR((xr) => xr.session);
  const readView = useVRPanelView();
  const { context, texture } = useVRPanelTexture(width, height);
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const a11y = useRef<{ root: Root; element: HTMLDivElement } | null>(null);
  const reducedMotion = useRef(false);
  const grip = useRef<ReturnType<typeof bindPanelGrip>>(null);
  const painted = useRef<{ texture: CanvasTexture; key: string; focused: string }>(null);
  const state = useMemo(() => ({
    yaw: 0,
    referencePitch: null as number | null,
    halfWidth: 0,
    below: 0,
    position: new Vector3(),
    direction: new Vector3(),
    offset: new Vector3(),
    rotation: new Euler(0, 0, 0, "YXZ"),
    lookingDown: false,
    controllerOpen: false,
    gripMode: false,
    available: false,
    interrupted: false,
    inputMode: null as WebVRInputState["mode"],
    gesture: createLookDownGesture(),
    progress: 0,
    interactive: false,
    hover: "",
    press: null as {
      pointerId: number;
      action: ActionId;
      lastSeekX: number;
      lastSeekAt: number;
      dragTo?: (x: number) => void;
      dragged: boolean;
    } | null,
    owner: {},
    ids: new Map<string, ActionId>(),
  }), []);

  const clearInput = () => {
    state.hover = "";
    state.press = null;
    state.ids.clear();
    if ((spatial.action?.id as ActionId | undefined)?.owner === state.owner) {
      spatial.action = null;
    }
  };

  const blurCompanion = () => {
    const element = a11y.current?.element;
    const active = element?.ownerDocument.activeElement;
    if (active instanceof HTMLElement && element?.contains(active)) active.blur();
  };

  useLayoutEffect(() => {
    const interrupt = () => {
      state.interrupted = true;
      state.interactive = false;
      clearInput();
    };
    if (!session) {
      const doc = gl.domElement.ownerDocument;
      const visibilityChanged = () => { if (doc.hidden) interrupt(); };
      doc.addEventListener("visibilitychange", visibilityChanged);
      return () => doc.removeEventListener("visibilitychange", visibilityChanged);
    }
    const binding = bindPanelGrip(
      session,
      () => state.available && !state.interrupted && state.gripMode &&
        spatial.input.getSnapshot().mode === "pointer" && session.visibilityState === "visible",
      () => {
        state.controllerOpen = !state.controllerOpen;
        if (!state.controllerOpen) {
          state.interactive = false;
          clearInput();
          blurCompanion();
        }
      },
      interrupt,
    );
    grip.current = binding;
    return () => {
      binding.dispose();
      grip.current = null;
      state.interrupted = true;
      state.interactive = false;
    };
  }, [session, gl, spatial, state]);

  useLayoutEffect(() => {
    const unsubscribe = spatial.input.onCancel(clearInput);
    return () => {
      unsubscribe();
      state.interactive = false;
      clearInput();
    };
  }, [spatial, state]);

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = media.matches; };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    if (!container) return;
    const element = container.ownerDocument.createElement("div");
    if (kind === "video") element.dataset.panoVrVideoControls = "";
    else element.dataset.panoVrMenu = "";
    element.inert = true;
    container.append(element);
    const root = createRoot(element);
    a11y.current = { root, element };
    return () => {
      a11y.current = null;
      element.remove();
      // Fiber can unmount during the outer DOM root's commit.
      queueMicrotask(() => root.unmount());
    };
  }, [container, kind]);

  useLayoutEffect(() => {
    a11y.current?.root.render(<div role="group" aria-label={label}>{accessibility}</div>);
  });

  const resolve = (uv: { x: number; y: number }) => {
    if (!state.interactive) return null;
    const action = resolveAction(uv.x * width, (1 - uv.y) * height);
    if (!action) return null;
    let id = state.ids.get(action.id);
    if (!id) {
      id = { owner: state.owner, id: action.id };
      state.ids.set(action.id, id);
    }
    return { ...action, id };
  };

  useFrame((_, delta) => {
    const panel = mesh.current;
    if (!panel || !material.current) return;
    const view = readView();
    const doc = gl.domElement.ownerDocument;
    const inputMode = spatial.input.getSnapshot().mode;
    const gripMode = inputMode === "pointer" && Boolean(session && hasPanelController(session.inputSources));
    const inputChanged = inputMode !== state.inputMode || gripMode !== state.gripMode;
    const available = Boolean(view && inputMode !== "paused" &&
      canRunSpatialGaze(doc.hidden, session?.visibilityState, 0, performance.now()));
    const companion = a11y.current?.element;
    if (companion && companion.inert !== !available) companion.inert = !available;
    state.available = available;
    if (state.interrupted || inputChanged || !available) {
      if (state.progress > 0) onHidden?.();
      panel.visible = false;
      state.progress = 0;
      state.interactive = false;
      state.lookingDown = false;
      state.controllerOpen = false;
      state.referencePitch = null;
      state.gesture.reset();
      grip.current?.reset();
      clearInput();
      blurCompanion();
      state.inputMode = inputMode;
      state.gripMode = gripMode;
      state.interrupted = false;
    }
    if (!view || !available) return;

    const active = doc.activeElement;
    const keyboardFocus = active instanceof HTMLElement && companion?.contains(active)
      ? active.dataset.panoVrAction : "";
    const gaze = spatial.action?.id as ActionId | undefined;
    const focused = keyboardFocus || state.hover || (gaze?.owner === state.owner ? gaze.id : "") || "";
    const drop = lookDownPanelDrop(view.below, gripMode);
    const { yaw, pitch } = sceneMenuView(view.camera.getWorldDirection(state.direction), state.yaw);
    state.yaw = yaw;
    const referencePitch = state.referencePitch ??= MathUtils.clamp(pitch, -10, 10);
    const panelPitch = referencePitch - Math.atan2(drop, LOOK_DOWN_DISTANCE) / RAD;
    if (!gripMode) {
      const gesture = state.gesture.update(pitch, referencePitch, panelPitch, delta);
      state.lookingDown = state.lookingDown ? lookDownThreshold(pitch, referencePitch, panelPitch, true) : gesture;
    }
    const show = (gripMode ? state.controllerOpen : state.lookingDown) || Boolean(keyboardFocus);
    const previous = state.progress;
    const transition = lookDownPanelTransition(previous, show, delta, reducedMotion.current);
    state.progress = transition.progress;
    state.interactive = transition.interactive;
    material.current.opacity = transition.opacity;
    panel.visible = state.progress > 0;
    if (!show && previous > 0) clearInput();
    if (!panel.visible) {
      if (previous > 0) onHidden?.();
      return;
    }
    // Keep the captured pose through the entire fade, including a reversal.
    if (previous === 0) {
      state.halfWidth = view.halfWidth;
      state.below = view.below;
      captureLookDownPanelPose(state.position, state.rotation, view.camera.position, yaw, pitch, gripMode ? pitch : referencePitch, drop);
      panel.rotation.copy(state.rotation);
    }
    const size = lookDownPanelSize(state.halfWidth, state.below, height / width, gripMode);
    panel.scale.set(size.width, size.height, 1);
    state.offset.set(0, -size.height * 0.55 * (1 - transition.opacity), 0).applyQuaternion(panel.quaternion);
    panel.position.copy(state.position).add(state.offset);
    panel.updateWorldMatrix(true, false);

    if (painted.current?.texture === texture && painted.current.key === paintKey && painted.current.focused === focused) return;
    painted.current = { texture, key: paintKey, focused };
    context.clearRect(0, 0, width, height);
    paint(context, focused);
    texture.needsUpdate = true;
  }, -0.5);

  return (
    <mesh
      ref={mesh}
      name={kind === "video" ? "VR video controls" : "VR menu"}
      onUpdate={spatialPanelLayer}
      visible={false}
      renderOrder={89_001}
      pointerEventsOrder={9}
      userData={{ panoGazeResolve: resolve }}
      raycast={function (this: Mesh, raycaster, intersections) {
        if (this.visible && state.interactive) Mesh.prototype.raycast.call(this, raycaster, intersections);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        const target = event.uv && resolve(event.uv);
        const input = pointerInput(event);
        if (!spatial.input.accept(input, "down", Boolean(pointerStick(input))) || !target || !event.uv) return;
        state.press = {
          pointerId: input.pointerId,
          action: target.id,
          lastSeekX: event.uv.x * width,
          lastSeekAt: 0,
          dragTo: target.dragTo,
          dragged: false,
        };
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        const input = pointerInput(event);
        if (!spatial.input.accept(input, "hover", Boolean(pointerStick(input))) || !event.uv) return;
        const target = resolve(event.uv);
        const press = state.press;
        const x = event.uv.x * width;
        if (press?.pointerId === input.pointerId && press.dragTo && Math.abs(x - press.lastSeekX) > 4) {
          const now = performance.now();
          press.dragged = true;
          if (now - press.lastSeekAt >= 65) {
            press.lastSeekAt = now;
            press.lastSeekX = x;
            press.dragTo(x);
          }
        }
        state.hover = target?.id.id ?? (press?.dragged ? press.action.id : "");
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        const press = state.press;
        if (!press || press.pointerId !== event.pointerId || !press.dragged) return;
        state.press = null;
        if (state.interactive && event.uv && spatial.input.accept(pointerInput(event), "up")) {
          const x = event.uv.x * width;
          if (Math.abs(x - press.lastSeekX) > 0.25) press.dragTo?.(x);
        }
      }}
      onPointerOut={(event) => {
        state.hover = "";
        if (state.press?.pointerId === event.pointerId) state.press = null;
      }}
      onPointerCancel={(event) => {
        if (state.press?.pointerId === event.pointerId) state.press = null;
        state.hover = "";
      }}
      onClick={(event) => {
        event.stopPropagation();
        const target = event.uv && resolve(event.uv);
        const input = pointerInput(event);
        const press = state.press;
        if (!spatial.input.accept(input, "click") || press?.pointerId !== input.pointerId) return;
        state.press = null;
        if (!press.dragged && target && press.action === target.id) target.activate();
      }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={material} map={texture} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
