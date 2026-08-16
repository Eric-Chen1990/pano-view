import { Canvas } from "@react-three/fiber";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ReactNode,
} from "react";
import { AutoRotate } from "./auto-rotate";
import {
  HotspotAccessibilityContext,
  useHotspotAccessibilityLayer,
} from "./hotspot/accessibility";
import type { PanoramaPointerEvent } from "./hotspot/types";
import {
  KeyboardControls,
  type KeyboardControlsProps,
} from "./keyboard-controls";
import { MouseControls } from "./mouse-controls";
import { PanoramaEventSurface } from "./panorama-event-surface";
import {
  DEFAULT_PANORAMA_CAMERA_FAR,
  DEFAULT_PANORAMA_CAMERA_NEAR,
} from "./panorama-radius";
import {
  PanoramaViewContext,
  PanoramaViewRuntime,
  type PanoramaViewRuntimeHandle,
} from "./panorama-view-runtime";
import { clampPanoPitch } from "./hotspot/coordinates";
import { TouchControls } from "./touch-controls";
import type {
  MouseControlsOptions,
  PanoramaControlsOptions,
  PanoViewHandle,
  PanoViewState,
  TouchControlsOptions,
} from "./types";

const DEFAULT_VIEW: PanoViewState = {
  yaw: 0,
  pitch: 0,
  fov: 75,
};

const DEFAULT_POINTER_ROTATE_SPEED = 0.35;
const DEFAULT_MOUSE_ZOOM_SPEED = 0.08;

const DEFAULT_CANVAS_STYLE: CSSProperties = {
  display: "block",
  height: "100%",
  width: "100%",
};

export type PanoViewProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "onChange"
> & {
  children?: ReactNode;
  initialView?: Partial<PanoViewState>;
  minFov?: number;
  maxFov?: number;
  controls?: boolean | PanoramaControlsOptions;
  onViewChange?: (view: PanoViewState) => void;
  onPanoramaClick?: (event: PanoramaPointerEvent) => void;
  onPanoramaDoubleClick?: (event: PanoramaPointerEvent) => void;
  onPanoramaPointerMove?: (event: PanoramaPointerEvent) => void;
  /** Canvas pixel ratio. Defaults to a capped range of 1–2. */
  dpr?: number | [number, number];
};

type ChannelMount<T> =
  | { mount: false }
  | { mount: true; props: T };

function resolveChannel<T extends { enabled?: boolean }>(
  value: boolean | T | undefined,
  defaults: T,
): ChannelMount<T> {
  if (value === false) {
    return { mount: false };
  }
  if (value === true || value === undefined) {
    return { mount: true, props: { ...defaults } };
  }
  return {
    mount: true,
    props: {
      ...defaults,
      ...value,
      enabled: value.enabled !== false,
    },
  };
}

export const PanoView = forwardRef<PanoViewHandle, PanoViewProps>(
  function PanoView(
    {
      children,
      initialView,
      minFov = 30,
      maxFov = 100,
      controls = true,
      onViewChange,
      onPanoramaClick,
      onPanoramaDoubleClick,
      onPanoramaPointerMove,
      dpr = [1, 2],
      style,
      "aria-label": ariaLabel = "Panorama viewer",
      ...divProps
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<PanoramaViewRuntimeHandle>(null);
    const { controls: hotspotAccessibilityControls, registry } =
      useHotspotAccessibilityLayer();
    const fallbackViewRef = useRef<PanoViewState>(DEFAULT_VIEW);
    const normalizedMinFov = Math.max(1, Math.min(minFov, maxFov - 1));
    const normalizedMaxFov = Math.min(
      179,
      Math.max(maxFov, normalizedMinFov + 1),
    );
    const normalizedInitialView = useMemo<PanoViewState>(
      () => ({
        yaw: initialView?.yaw ?? DEFAULT_VIEW.yaw,
        pitch: clampPanoPitch(initialView?.pitch ?? DEFAULT_VIEW.pitch),
        fov: Math.max(
          normalizedMinFov,
          Math.min(initialView?.fov ?? DEFAULT_VIEW.fov, normalizedMaxFov),
        ),
      }),
      [
        initialView?.fov,
        initialView?.pitch,
        initialView?.yaw,
        normalizedMaxFov,
        normalizedMinFov,
      ],
    );
    fallbackViewRef.current = normalizedInitialView;

    const controlsEnabled = controls !== false;
    const controlOptions = useMemo<PanoramaControlsOptions>(
      () => (typeof controls === "object" ? controls : {}),
      [controls],
    );
    const userControlsEnabled =
      controlsEnabled && controlOptions.enabled !== false;

    const allModeInvert = controlOptions.invert === true;
    const topRotateSpeed =
      controlOptions.rotateSpeed ?? DEFAULT_POINTER_ROTATE_SPEED;
    const topZoomSpeed = controlOptions.zoomSpeed ?? DEFAULT_MOUSE_ZOOM_SPEED;

    const mouseChannel = useMemo(
      () =>
        resolveChannel<MouseControlsOptions>(controlOptions.mouse, {
          enabled: true,
          rotateSpeed: topRotateSpeed,
          zoomSpeed: topZoomSpeed,
          wheel: true,
          invert: allModeInvert,
          buttons: ["left"],
        }),
      [
        allModeInvert,
        controlOptions.mouse,
        topRotateSpeed,
        topZoomSpeed,
      ],
    );
    const touchChannel = useMemo(
      () =>
        resolveChannel<TouchControlsOptions>(controlOptions.touch, {
          enabled: true,
          rotateSpeed: topRotateSpeed,
          invert: allModeInvert,
          pinchZoom: true,
        }),
      [allModeInvert, controlOptions.touch, topRotateSpeed],
    );
    const keyboardChannel = useMemo(
      () =>
        resolveChannel<KeyboardControlsProps>(controlOptions.keyboard, {
          enabled: true,
        }),
      [controlOptions.keyboard],
    );

    // Bridge deprecated controls.autoRotate / autoRotateSpeed without
    // surfacing @deprecated diagnostics on this compatibility path.
    const legacyAutoRotateOptions = controlOptions as {
      autoRotate?: boolean;
      autoRotateSpeed?: number;
    };
    const [legacyAutoRotate, setLegacyAutoRotate] = useState(
      legacyAutoRotateOptions.autoRotate ?? false,
    );

    useEffect(() => {
      setLegacyAutoRotate(legacyAutoRotateOptions.autoRotate ?? false);
    }, [legacyAutoRotateOptions.autoRotate]);

    useImperativeHandle(
      ref,
      () => ({
        getView: () =>
          controlsRef.current?.getView() ?? { ...fallbackViewRef.current },
        setView: (view, options) => {
          controlsRef.current?.setView(view, options);
        },
        reset: () => {
          controlsRef.current?.reset();
        },
        startAutoRotate: () => {
          setLegacyAutoRotate(true);
        },
        stopAutoRotate: () => {
          setLegacyAutoRotate(false);
        },
        toggleFullscreen: async () => {
          if (typeof document === "undefined") {
            return;
          }
          if (document.fullscreenElement) {
            await document.exitFullscreen?.();
            return;
          }
          await rootRef.current?.requestFullscreen?.();
        },
      }),
      [],
    );

    const rootStyle = useMemo<CSSProperties>(
      () => ({
        overflow: "hidden",
        position: "relative",
        ...style,
      }),
      [style],
    );

    return (
      <div
        {...divProps}
        ref={rootRef}
        aria-label={ariaLabel}
        style={rootStyle}
      >
        <Canvas
          aria-label={`${ariaLabel} canvas`}
          camera={{
            far: DEFAULT_PANORAMA_CAMERA_FAR,
            fov: normalizedInitialView.fov,
            near: DEFAULT_PANORAMA_CAMERA_NEAR,
            position: [0, 0, 0.01],
          }}
          dpr={dpr}
          gl={{
            // Hotspots contain transparent textures and curved outlines. Keep
            // the canvas multisampled so their visible edges are smoothed.
            antialias: true,
            powerPreference: "high-performance",
            stencil: false,
          }}
          style={{
            ...DEFAULT_CANVAS_STYLE,
            touchAction: userControlsEnabled ? "none" : "auto",
          }}
          tabIndex={userControlsEnabled ? 0 : undefined}
        >
          <HotspotAccessibilityContext.Provider value={registry}>
            <PanoramaViewContext.Provider value={controlsRef}>
              <PanoramaViewRuntime
                ref={controlsRef}
                initialView={normalizedInitialView}
                maxFov={normalizedMaxFov}
                minFov={normalizedMinFov}
                onViewChange={onViewChange}
                options={controlOptions}
              />
              <AutoRotate
                enabled={legacyAutoRotate}
                speed={legacyAutoRotateOptions.autoRotateSpeed}
              />
              {userControlsEnabled && mouseChannel.mount ? (
                <MouseControls
                  {...mouseChannel.props}
                  fovSpeed={controlOptions.fovSpeed}
                />
              ) : null}
              {userControlsEnabled && touchChannel.mount ? (
                <TouchControls {...touchChannel.props} />
              ) : null}
              {userControlsEnabled && keyboardChannel.mount ? (
                <KeyboardControls
                  {...keyboardChannel.props}
                  fovSpeed={
                    keyboardChannel.props.fovSpeed ?? controlOptions.fovSpeed
                  }
                />
              ) : null}
              <PanoramaEventSurface
                onClick={onPanoramaClick}
                onDoubleClick={onPanoramaDoubleClick}
                onPointerMove={onPanoramaPointerMove}
              />
              {children}
            </PanoramaViewContext.Provider>
          </HotspotAccessibilityContext.Provider>
        </Canvas>
        {hotspotAccessibilityControls}
      </div>
    );
  },
);
