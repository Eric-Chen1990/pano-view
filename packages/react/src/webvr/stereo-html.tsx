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
import { CompareHostContext, useCompareSplitView, type PanoCompareSide } from "../compare/view";
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
  /** Map the CSS rectangle to the parent anchor’s unit quad. */
  worldSize?: readonly [number, number];
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
  compareSide,
  worldSize,
}: PanoHtmlProps & { stereoView?: WebVRStereoView; eye?: WebVRStereoEye; compareSide?: PanoCompareSide }) {
  const { camera, gl, events, size } = useThree();
  const group = useRef<Group>(null);
  const overlay = useRef<{ element: HTMLDivElement; root: Root } | null>(null);
  const scratch = useRef(new Vector3());
  const matrix = useRef(new Matrix4());
  const screen = useRef(new Matrix4());
  const compareHost = useContext(CompareHostContext);
  const paneTarget = useSyncExternalStore(
    compareHost?.subscribe ?? (() => () => {}),
    () => compareSide === "before" ? compareHost?.beforeHtml : compareHost?.afterHtml,
    () => null,
  );
  const target = compareSide ? paneTarget : events.connected || gl.domElement.parentElement;

  const updatePosition = () => {
    const anchor = group.current;
    const element = overlay.current?.element;
    if (!anchor || !element) return;
    const pane = compareSide && compareHost?.getPane(camera, size, gl.getPixelRatio(), compareSide);
    if (compareSide && !pane) return;
    const viewCamera =
      stereoView && eye
        ? eye === "left"
          ? stereoView.stereo.cameraL
          : stereoView.stereo.cameraR
        : (pane ? pane.camera : camera);
    anchor.updateWorldMatrix(true, false);
    const position = scratch.current.setFromMatrixPosition(anchor.matrixWorld);
    const distance = position.distanceTo(viewCamera.position);
    position.applyMatrix4(viewCamera.matrixWorldInverse);
    element.style.display = position.z < 0 ? "block" : "none";
    const width = pane ? pane.rect.width : stereoView ? size.width / 2 : size.width;
    const height = pane ? pane.rect.height : size.height;
    const world = worldSize
      ? matrix.current.copy(anchor.matrixWorld).scale(scratch.current.set(1 / worldSize[0], 1 / worldSize[1], 1))
      : tooltipWorldMatrix(matrix.current, anchor, viewCamera, height, mode, scaleMode, referenceFov);
    const eyeOffset = stereoView && eye === "right" ? width : 0;
    const paneOffsetX = pane ? pane.rect.x - pane.clip.x : 0;
    const paneOffsetY = pane ? pane.rect.y - pane.clip.y : 0;
    tooltipScreenMatrix(
      screen.current, world, viewCamera, width, height,
      eyeOffset + paneOffsetX + offset[0], paneOffsetY + offset[1],
    );
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
        aria-hidden={eye === "right" || (compareSide === "after" && !worldSize) || undefined}
        style={{ position: "absolute", pointerEvents, transform: worldSize ? "translate(-50%, -50%)" : undefined, ...style }}
      >
        {children}
      </div>,
    );
    updatePosition();
  });
  useFrame(updatePosition);
  return <group ref={group} />;
}

/** Project DOM content into each applicable viewport. */
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
  const splitView = useCompareSplitView();
  if (mode === "mobilevr" && portrait) {
    return null;
  }
  if (splitView) {
    return (
      <>
        <ProjectedHtml {...props} compareSide="before" />
        <ProjectedHtml {...props} compareSide="after" />
      </>
    );
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
