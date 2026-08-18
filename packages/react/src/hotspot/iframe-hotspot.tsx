import { Html } from "@react-three/drei";
import type { IframeHTMLAttributes } from "react";
import { DoubleSide } from "three";
import { HotspotAnchor } from "./hotspot-anchor";
import {
  acceptsHotspotPointerEvents,
  type HotspotCommonProps,
} from "./types";

const IFRAME_LONG_SIDE = 800;
/** drei Html transform uses `1 / ((distanceFactor || 10) / 400)`. 400 keeps 1 world unit = 1 CSS pixel. */
const CSS3D_DISTANCE_FACTOR = 400;
const DEFAULT_SANDBOX = "allow-scripts allow-popups allow-forms";

export type IframePointerPolicy = "hotspot" | "content";

export type IframeHotspotProps = HotspotCommonProps & {
  src: string;
  /** Accessible iframe title. Falls back to ariaLabel. */
  title?: string;
  sandbox?: string;
  allow?: string;
  referrerPolicy?: IframeHTMLAttributes<HTMLIFrameElement>["referrerPolicy"];
  loading?: "eager" | "lazy";
  /**
   * `hotspot` lets panorama pointer events hit the WebGL plane.
   * `content` makes the embedded page interactive.
   */
  pointerPolicy?: IframePointerPolicy;
  background?: string;
  onLoad?: () => void;
  onError?: (error: unknown) => void;
};

function clampOpacity(opacity: number | undefined): number {
  if (!Number.isFinite(opacity)) {
    return 1;
  }
  return Math.max(0, Math.min(opacity!, 1));
}

function resolvePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! > 0 ? value! : fallback;
}

function iframeCssSize(
  width: number,
  height: number,
): { cssWidth: number; cssHeight: number } {
  const safeWidth = resolvePositive(width, 1);
  const safeHeight = resolvePositive(height, 1);
  if (safeWidth >= safeHeight) {
    return {
      cssWidth: IFRAME_LONG_SIDE,
      cssHeight: Math.max(
        1,
        Math.round(IFRAME_LONG_SIDE * (safeHeight / safeWidth)),
      ),
    };
  }
  return {
    cssWidth: Math.max(
      1,
      Math.round(IFRAME_LONG_SIDE * (safeWidth / safeHeight)),
    ),
    cssHeight: IFRAME_LONG_SIDE,
  };
}

export function IframeHotspot({
  src,
  title,
  sandbox = DEFAULT_SANDBOX,
  allow,
  referrerPolicy = "strict-origin-when-cross-origin",
  loading,
  pointerPolicy = "hotspot",
  background,
  opacity,
  width = 18,
  height = 12,
  onLoad,
  onError,
  interactive = true,
  pointerEvents = "auto",
  ...anchorProps
}: IframeHotspotProps) {
  const { cssWidth, cssHeight } = iframeCssSize(width, height);
  const iframeTitle = title ?? anchorProps.ariaLabel;
  const acceptsPointer = acceptsHotspotPointerEvents(
    interactive,
    pointerEvents,
  );

  return (
    <HotspotAnchor
      {...anchorProps}
      height={height}
      interactive={interactive}
      pointerEvents={pointerEvents}
      width={width}
    >
      <mesh>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          // Empty hit target: skip depth writes so this rectangle cannot hide
          // polygons or other hotspots behind it.
          depthWrite={false}
          opacity={0}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <Html
        distanceFactor={CSS3D_DISTANCE_FACTOR}
        pointerEvents={
          acceptsPointer && pointerPolicy === "content" ? "auto" : "none"
        }
        scale={[1 / cssWidth, 1 / cssHeight, 1]}
        style={{
          background: background ?? "transparent",
          height: cssHeight,
          opacity: clampOpacity(opacity),
          overflow: "hidden",
          width: cssWidth,
        }}
        transform
        zIndexRange={[10, 0]}
      >
        <iframe
          allow={allow}
          className="block h-full w-full border-0"
          loading={loading}
          onError={(event) => onError?.(event.nativeEvent)}
          onLoad={onLoad}
          referrerPolicy={referrerPolicy}
          sandbox={sandbox}
          src={src}
          title={iframeTitle}
        />
      </Html>
    </HotspotAnchor>
  );
}
