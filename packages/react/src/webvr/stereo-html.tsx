import { Html } from "@react-three/drei";
import type { ComponentProps } from "react";
import { useContext, useSyncExternalStore } from "react";
import { subscribeWebVRHost, WebVRRuntimeContext } from "./host";
import {
  isFallbackStereoMode,
  projectStereoHtmlPosition,
  type WebVRStereoEye,
} from "./stereo-view";

type PanoHtmlProps = ComponentProps<typeof Html>;

function useFallbackStereoView() {
  const runtime = useContext(WebVRRuntimeContext);
  const host = runtime?.host ?? null;
  const fallback = useSyncExternalStore(
    (onStoreChange) =>
      host ? subscribeWebVRHost(host, onStoreChange) : () => undefined,
    () => isFallbackStereoMode(host?.snapshot.mode ?? null),
    () => false,
  );
  if (!fallback || !runtime) {
    return null;
  }
  return runtime.stereoView;
}

function stereoCalculatePosition(eye: WebVRStereoEye, stereoView: NonNullable<
  ReturnType<typeof useFallbackStereoView>
>): PanoHtmlProps["calculatePosition"] {
  return (el, _camera, size) =>
    projectStereoHtmlPosition(
      el,
      eye === "left" ? stereoView.stereo.cameraL : stereoView.stereo.cameraR,
      size,
      eye,
    );
}

/** drei Html that projects into both MobileVR / Simulated VR eye viewports. */
export function PanoHtml({ children, ...htmlProps }: PanoHtmlProps) {
  const stereoView = useFallbackStereoView();
  if (!stereoView) {
    return <Html {...htmlProps}>{children}</Html>;
  }
  return (
    <>
      <Html
        {...htmlProps}
        calculatePosition={stereoCalculatePosition("left", stereoView)}
      >
        {children}
      </Html>
      <Html
        {...htmlProps}
        aria-hidden
        calculatePosition={stereoCalculatePosition("right", stereoView)}
      >
        {children}
      </Html>
    </>
  );
}
