import { useFrame, useThree } from "@react-three/fiber";
import {
  useContext,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Group, Matrix4, Vector3 } from "three";
import { subscribeWebVRHost, WebVRRuntimeContext } from "./host";
import { usePortraitOrientation } from "./orientation";
import {
  isFallbackStereoMode,
  type WebVRStereoEye,
  type WebVRStereoView,
} from "./stereo-view";

import { tooltipWorldMatrix, tooltipScreenMatrix } from "../hotspot/tooltip-transform";
import type { HotspotMode, HotspotScaleMode } from "../hotspot/types";

type PanoHtmlProps = {
  mode?: HotspotMode;
  scaleMode?: HotspotScaleMode;
  referenceFov?: number;
  offset?: readonly [number, number];
  children: ReactNode;
  pointerEvents?: CSSProperties["pointerEvents"];
  style?: CSSProperties;
  zIndexRange?: [number, number];
};

function useFallbackStereoView() {
  const runtime = useContext(WebVRRuntimeContext);
  const host = runtime?.host ?? null;
  const fallback = useSyncExternalStore(
    (onStoreChange) =>
      host ? subscribeWebVRHost(host, onStoreChange) : () => undefined,
    () => isFallbackStereoMode(host?.snapshot.mode ?? null),
    () => false,
  );
  return fallback && runtime ? runtime.stereoView : null;
}

/** A projected label owns a DOM root separate from Fiber's scene root. */
function ProjectedHtml({
  children,
  mode = "billboard",
  scaleMode = "fixed",
  referenceFov = 75,
  offset = [0, 0],
  pointerEvents = "auto",
  style,
  zIndexRange = [16777271, 0],
  stereoView,
  eye,
}: PanoHtmlProps & { stereoView?: WebVRStereoView; eye?: WebVRStereoEye }) {
  const { camera, gl, events, size } = useThree();
  const group = useRef<Group>(null);
  const overlay = useRef<{ element: HTMLDivElement; root: Root } | null>(null);
  const scratch = useRef(new Vector3());
  const matrix = useRef(new Matrix4());
  const screen = useRef(new Matrix4());
  const target = events.connected || gl.domElement.parentElement;

  const updatePosition = () => {
    const anchor = group.current;
    const element = overlay.current?.element;
    if (!anchor || !element) return;
    const viewCamera =
      stereoView && eye
        ? eye === "left"
          ? stereoView.stereo.cameraL
          : stereoView.stereo.cameraR
        : camera;
    anchor.updateWorldMatrix(true, false);
    const position = scratch.current.setFromMatrixPosition(anchor.matrixWorld);
    const distance = position.distanceTo(viewCamera.position);
    position.applyMatrix4(viewCamera.matrixWorldInverse);
    element.style.display = position.z < 0 ? "block" : "none";
    const world = tooltipWorldMatrix(matrix.current, anchor, viewCamera, size.height, mode, scaleMode, referenceFov);
    const eyeWidth = stereoView ? size.width / 2 : size.width;
    const eyeOffset = stereoView && eye === "right" ? eyeWidth : 0;
    tooltipScreenMatrix(screen.current, world, viewCamera, eyeWidth, size.height, eyeOffset + offset[0], offset[1]);
    element.style.transform = `matrix3d(${screen.current.elements.join(",")})`;
    element.style.zIndex = String(
      Math.round(
        zIndexRange[0] +
          ((zIndexRange[1] - zIndexRange[0]) * (distance - viewCamera.near)) /
            (viewCamera.far - viewCamera.near),
      ),
    );
  };

  useLayoutEffect(() => {
    if (!target) return;
    // Each setup needs a fresh container, including Strict Mode's replay.
    const element = document.createElement("div");
    Object.assign(element.style, {
      position: "absolute",
      top: "0",
      left: "0",
      transformOrigin: "0 0",
    });
    const root = createRoot(element);
    overlay.current = { element, root };
    target.appendChild(element);
    return () => {
      overlay.current = null;
      element.remove();
      // Never synchronously unmount a second root during Fiber's commit.
      queueMicrotask(() => root.unmount());
    };
  }, [target]);

  useLayoutEffect(() => {
    overlay.current?.root.render(
      <div
        aria-hidden={eye === "right" || undefined}
        style={{ position: "absolute", pointerEvents, ...style }}
      >
        {children}
      </div>,
    );
    updatePosition();
  });
  useFrame(updatePosition);
  return <group ref={group} />;
}

/** Labels project into both eye viewports in MobileVR / Simulated VR. */
export function PanoHtml(props: PanoHtmlProps) {
  const runtime = useContext(WebVRRuntimeContext);
  const host = runtime?.host ?? null;
  const mode = useSyncExternalStore(
    (onStoreChange) =>
      host ? subscribeWebVRHost(host, onStoreChange) : () => undefined,
    () => host?.snapshot.mode ?? null,
    () => null,
  );
  const portrait = usePortraitOrientation();
  const stereoView = useFallbackStereoView();
  if (mode === "mobilevr" && portrait) {
    return null;
  }
  return stereoView ? (
    <>
      <ProjectedHtml {...props} stereoView={stereoView} eye="left" />
      <ProjectedHtml {...props} stereoView={stereoView} eye="right" />
    </>
  ) : (
    <ProjectedHtml {...props} />
  );
}
