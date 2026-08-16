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
import {
  PanoramaControls,
  type PanoramaControlsHandle,
} from "./panorama-controls";
import { AutoRotate, PanoramaControlsContext } from "./auto-rotate";
import {
  HotspotAccessibilityContext,
  useHotspotAccessibilityLayer,
} from "./hotspot/accessibility";
import type { PanoramaPointerEvent } from "./hotspot/types";
import { KeyboardControls } from "./keyboard-controls";
import { PanoramaEventSurface } from "./panorama-event-surface";
import {
  DEFAULT_PANORAMA_CAMERA_FAR,
  DEFAULT_PANORAMA_CAMERA_NEAR,
} from "./panorama-radius";
import { clampPanoPitch } from "./hotspot/coordinates";
import type {
  PanoramaControlsOptions,
  PanoViewHandle,
  PanoViewState,
} from "./types";

const DEFAULT_VIEW: PanoViewState = {
  yaw: 0,
  pitch: 0,
  fov: 75,
};

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
    const controlsRef = useRef<PanoramaControlsHandle>(null);
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
    const keyboardEnabled = controlsEnabled && controlOptions.keyboard !== false;
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
            touchAction: controlsEnabled ? "none" : "auto",
          }}
          tabIndex={controlsEnabled ? 0 : undefined}
        >
          <HotspotAccessibilityContext.Provider value={registry}>
            <PanoramaControlsContext.Provider value={controlsRef}>
              <PanoramaControls
                ref={controlsRef}
                enabled={controlsEnabled}
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
              {keyboardEnabled ? <KeyboardControls /> : null}
              <PanoramaEventSurface
                onClick={onPanoramaClick}
                onDoubleClick={onPanoramaDoubleClick}
                onPointerMove={onPanoramaPointerMove}
              />
              {children}
            </PanoramaControlsContext.Provider>
          </HotspotAccessibilityContext.Provider>
        </Canvas>
        {hotspotAccessibilityControls}
      </div>
    );
  },
);
