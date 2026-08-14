import { Canvas } from "@react-three/fiber";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
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
      dpr = [1, 2],
      style,
      "aria-label": ariaLabel = "Panorama viewer",
      ...divProps
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<PanoramaControlsHandle>(null);
    const fallbackViewRef = useRef<PanoViewState>(DEFAULT_VIEW);
    const normalizedMinFov = Math.max(1, Math.min(minFov, maxFov - 1));
    const normalizedMaxFov = Math.min(
      179,
      Math.max(maxFov, normalizedMinFov + 1),
    );
    const normalizedInitialView = useMemo<PanoViewState>(
      () => ({
        yaw: initialView?.yaw ?? DEFAULT_VIEW.yaw,
        pitch: initialView?.pitch ?? DEFAULT_VIEW.pitch,
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
          controlsRef.current?.startAutoRotate();
        },
        stopAutoRotate: () => {
          controlsRef.current?.stopAutoRotate();
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
            far: 200,
            fov: normalizedInitialView.fov,
            near: 0.01,
            position: [0, 0, 0.01],
          }}
          dpr={dpr}
          gl={{
            antialias: false,
            powerPreference: "high-performance",
            stencil: false,
          }}
          style={{
            ...DEFAULT_CANVAS_STYLE,
            touchAction: controlsEnabled ? "none" : "auto",
          }}
          tabIndex={controlsEnabled ? 0 : undefined}
        >
          <PanoramaControls
            ref={controlsRef}
            enabled={controlsEnabled}
            initialView={normalizedInitialView}
            maxFov={normalizedMaxFov}
            minFov={normalizedMinFov}
            onViewChange={onViewChange}
            options={controlOptions}
          />
          {children}
        </Canvas>
      </div>
    );
  },
);
