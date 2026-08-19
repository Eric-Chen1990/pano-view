import { Canvas } from "@react-three/fiber";
import { createXRStore, XR } from "@react-three/xr";
import {
  forwardRef,
  useCallback,
  useContext,
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
  BackgroundAudioHostContext,
  createBackgroundAudioHost,
  subscribeBackgroundAudioHost,
} from "./background-audio-host";
import { cn } from "./cn";
import { AutoRotate } from "./auto-rotate";
import {
  ControlClaimsContext,
  DefaultControlChannelContext,
  createControlClaims,
  resetControlClaims,
} from "./control-claims";
import {
  exitElementFullscreen,
  getFullscreenElement,
  requestElementFullscreen,
  subscribeFullscreenChange,
} from "./fullscreen";
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
import {
  createPanoFilterHost,
  PanoFilterHostContext,
} from "./pano-filter/host";
import {
  PanoContextMenu,
  PanoContextMenuActionsContext,
  PanoContextMenuOverlayContext,
  usePanoContextMenuOverlay,
  type PanoContextMenuProps,
} from "./pano-context-menu";
import {
  createPanoEventBus,
  PanoEventBusContext,
} from "./pano-event-bus";
import {
  PanoCursorController,
  resolvePanoCursors,
  type PanoCursors,
} from "./pano-cursor";
import { PanoEvents } from "./pano-events";
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
import {
  createScenesHost,
  ScenesHostContext,
} from "./scenes-host";
import { TouchControls } from "./touch-controls";
import {
  PanoChromeOverlayContext,
  usePanoChromeOverlay,
} from "./video/chrome-overlay";
import {
  createPanoVideoHost,
  PanoVideoHostContext,
  subscribePanoVideoHost,
} from "./video/host";
import { PanoVideoChromeBridge } from "./video/pano-video-chrome-bridge";
import { WebVRChromeBridge } from "./webvr/chrome";
import {
  createWebVRHost,
  subscribeWebVRHost,
  WebVRRuntimeContext,
} from "./webvr/host";
import { createWebVRStereoView } from "./webvr/stereo-view";
import { PanoramaXROrigin } from "./webvr/xr-origin";
import type {
  MouseControlsOptions,
  PanoramaControlsOptions,
  PanoViewerHandle,
  PanoViewerState,
  TouchControlsOptions,
} from "./types";

const DEFAULT_VIEW: PanoViewerState = {
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

export type PanoViewerProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "onChange" | "contextMenu"
> & {
  children?: ReactNode;
  initialView?: Partial<PanoViewerState>;
  minFov?: number;
  maxFov?: number;
  controls?: boolean | PanoramaControlsOptions;
  /**
   * Canvas cursor. `true` / omit uses grab / grabbing / pointer / move;
   * `false` leaves the canvas cursor unchanged; an object merges with the
   * defaults (`default`, `dragging`, `hotspot`, `hotspotDragging`).
   */
  cursors?: boolean | PanoCursors;
  /**
   * Default context menu. `true` / omit mounts Reset view + Fullscreen;
   * `false` skips the default instance; an object merges appearance and
   * may use `items` (full replace, supports preset ids), or `prepend` /
   * `append` to keep the defaults and add entries. The browser's native
   * context menu is always suppressed on the viewer, including overlays.
   */
  contextMenu?: boolean | PanoContextMenuProps;
  onViewChange?: (view: PanoViewerState) => void;
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

function resolveContextMenuChannel(
  value: boolean | PanoContextMenuProps | undefined,
): ChannelMount<PanoContextMenuProps> {
  if (value === false) {
    return { mount: false };
  }
  if (value === true || value === undefined) {
    return { mount: true, props: {} };
  }
  return { mount: true, props: { ...value } };
}

function PanoCursorTree({
  cursors,
  children,
}: {
  cursors: ReturnType<typeof resolvePanoCursors>;
  children: ReactNode;
}) {
  if (!cursors) {
    return children;
  }
  return (
    <PanoCursorController cursors={cursors}>{children}</PanoCursorController>
  );
}

function PanoVideoHostReset() {
  const host = useContext(PanoVideoHostContext);
  if (host) {
    host.controlClaims = 0;
  }
  return null;
}

function DefaultControlChannels({
  userControlsEnabled,
  mouseChannel,
  touchChannel,
  keyboardChannel,
  fovSpeed,
}: {
  userControlsEnabled: boolean;
  mouseChannel: ChannelMount<MouseControlsOptions>;
  touchChannel: ChannelMount<TouchControlsOptions>;
  keyboardChannel: ChannelMount<KeyboardControlsProps>;
  fovSpeed: number | undefined;
}) {
  const claims = useContext(ControlClaimsContext);
  if (!claims) {
    return null;
  }

  return (
    <DefaultControlChannelContext.Provider value={true}>
      {userControlsEnabled && mouseChannel.mount && claims.mouse === 0 ? (
        <MouseControls {...mouseChannel.props} fovSpeed={fovSpeed} />
      ) : null}
      {userControlsEnabled && touchChannel.mount && claims.touch === 0 ? (
        <TouchControls {...touchChannel.props} />
      ) : null}
      {userControlsEnabled &&
      keyboardChannel.mount &&
      claims.keyboard === 0 ? (
        <KeyboardControls
          {...keyboardChannel.props}
          fovSpeed={keyboardChannel.props.fovSpeed ?? fovSpeed}
        />
      ) : null}
    </DefaultControlChannelContext.Provider>
  );
}

export const PanoViewer = forwardRef<PanoViewerHandle, PanoViewerProps>(
  function PanoViewer(
    {
      children,
      initialView,
      minFov = 30,
      maxFov = 100,
      controls = true,
      cursors,
      contextMenu = true,
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
    const eventBus = useMemo(() => createPanoEventBus(), []);
    const { controls: hotspotAccessibilityControls, registry } =
      useHotspotAccessibilityLayer();
    const { api: contextMenuOverlayApi, overlay: contextMenuOverlay } =
      usePanoContextMenuOverlay();
    const { api: chromeOverlayApi, setOverlayNode, overlayElement } =
      usePanoChromeOverlay();
    const videoHost = useMemo(() => createPanoVideoHost(), []);
    const filterHost = useMemo(() => createPanoFilterHost(), []);
    const webVRHost = useMemo(() => createWebVRHost(), []);
    const scenesHost = useMemo(() => createScenesHost(), []);
    const bgmHost = useMemo(() => createBackgroundAudioHost(), []);
    const stereoView = useMemo(() => createWebVRStereoView(), []);
    const xrStore = useMemo(
      () =>
        createXRStore({
          anchors: false,
          bodyTracking: false,
          depthSensing: false,
          domOverlay: false,
          emulate: false,
          enterGrantedSession: false,
          hitTest: false,
          layers: false,
          meshDetection: false,
          offerSession: false,
          planeDetection: false,
        }),
      [],
    );
    const fallbackViewRef = useRef<PanoViewerState>(DEFAULT_VIEW);
    const normalizedMinFov = Math.max(1, Math.min(minFov, maxFov - 1));
    const normalizedMaxFov = Math.min(
      179,
      Math.max(maxFov, normalizedMinFov + 1),
    );
    const normalizedInitialView = useMemo<PanoViewerState>(
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

    const controlClaims = useMemo(() => createControlClaims(), []);
    resetControlClaims(controlClaims);

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

    const enterFullscreen = useCallback(async () => {
      if (typeof document === "undefined") {
        return;
      }
      if (getFullscreenElement()) {
        return;
      }
      const root = rootRef.current;
      if (!root) {
        return;
      }
      await requestElementFullscreen(root);
    }, []);

    const exitFullscreen = useCallback(async () => {
      if (typeof document === "undefined") {
        return;
      }
      if (!getFullscreenElement()) {
        return;
      }
      await exitElementFullscreen();
    }, []);

    const toggleFullscreen = useCallback(async () => {
      if (typeof document === "undefined") {
        return;
      }
      if (getFullscreenElement()) {
        await exitElementFullscreen();
        return;
      }
      const root = rootRef.current;
      if (!root) {
        return;
      }
      await requestElementFullscreen(root);
    }, []);

    const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);

    useEffect(() => {
      if (typeof document === "undefined") {
        return;
      }

      const syncFullscreen = () => {
        const fullscreenElement = getFullscreenElement();
        const root = rootRef.current;
        if (!fullscreenElement || !root) {
          setIsViewerFullscreen(false);
          return;
        }
        setIsViewerFullscreen(
          fullscreenElement === root ||
            fullscreenElement.contains(root) ||
            root.contains(fullscreenElement),
        );
      };

      syncFullscreen();
      return subscribeFullscreenChange(syncFullscreen);
    }, []);

    useEffect(() => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const suppressNativeContextMenu = (event: Event) => {
        event.preventDefault();
      };

      root.addEventListener("contextmenu", suppressNativeContextMenu, true);
      return () => {
        root.removeEventListener("contextmenu", suppressNativeContextMenu, true);
      };
    }, []);

    const contextMenuActions = useMemo(
      () => ({
        reset: () => {
          controlsRef.current?.reset();
        },
        toggleFullscreen: () => {
          void toggleFullscreen();
        },
        isFullscreen: isViewerFullscreen,
      }),
      [isViewerFullscreen, toggleFullscreen],
    );

    const contextMenuChannel = useMemo(
      () => resolveContextMenuChannel(contextMenu),
      [contextMenu],
    );
    const resolvedCursors = useMemo(
      () => resolvePanoCursors(cursors),
      [cursors],
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

    const isFullscreenRef = useRef(false);
    isFullscreenRef.current = isViewerFullscreen;

    useImperativeHandle(
      ref,
      () => ({
        // -- View --
        getView: () =>
          controlsRef.current?.getView() ?? { ...fallbackViewRef.current },
        setView: (view, options) => {
          controlsRef.current?.setView(view, options);
        },
        reset: () => {
          controlsRef.current?.reset();
        },

        // -- Fullscreen --
        enterFullscreen,
        exitFullscreen,
        toggleFullscreen,
        isFullscreen: () => isFullscreenRef.current,

        // -- Scenes --
        setScene: (id) => scenesHost.controller?.setScene(id) ?? false,
        nextScene: () => scenesHost.controller?.nextScene() ?? false,
        previousScene: () => scenesHost.controller?.previousScene() ?? false,
        getActiveSceneId: () =>
          scenesHost.controller?.getActiveSceneId() ?? null,
        getSceneIds: () => scenesHost.controller?.getSceneIds() ?? [],
        isSceneTransitioning: () =>
          scenesHost.controller?.isTransitioning() ?? false,

        // -- WebVR --
        enterVR: () =>
          webVRHost.controller?.enterVR() ?? Promise.resolve(false),
        exitVR: () =>
          webVRHost.controller?.exitVR() ?? Promise.resolve(),
        toggleVR: () =>
          webVRHost.controller?.toggleVR() ?? Promise.resolve(false),
        isVRAvailable: () => webVRHost.snapshot.available,
        isVREnabled: () => webVRHost.snapshot.mode !== null,
        getVRMode: () => webVRHost.snapshot.mode,
        requestVRPermission: () =>
          webVRHost.controller?.requestPermission() ??
          Promise.resolve(false),

        // -- Video --
        getVideo: () => videoHost.controller,
        subscribeVideo: (onStoreChange) =>
          subscribePanoVideoHost(videoHost, onStoreChange),
        playVideo: () =>
          videoHost.controller?.play() ?? Promise.resolve(),
        pauseVideo: () => videoHost.controller?.pause(),
        toggleVideo: () => videoHost.controller?.togglePlay(),
        seekVideo: (time) => videoHost.controller?.seek(time),
        setVideoVolume: (vol) => videoHost.controller?.setVolume(vol),
        setVideoMuted: (m) => videoHost.controller?.setMuted(m),
        toggleVideoMuted: () => videoHost.controller?.toggleMuted(),

        // -- Background Audio --
        getBackgroundAudio: () => bgmHost.controller,
        subscribeBackgroundAudio: (onStoreChange) =>
          subscribeBackgroundAudioHost(bgmHost, onStoreChange),
        playBackgroundAudio: () => {
          bgmHost.controller?.play();
          return Promise.resolve();
        },
        pauseBackgroundAudio: () => bgmHost.controller?.pause(),
        toggleBackgroundAudio: () => bgmHost.controller?.togglePlay(),
        setBackgroundAudioVolume: (vol) =>
          bgmHost.controller?.setVolume(vol),
        setBackgroundAudioMuted: (m) => bgmHost.controller?.setMuted(m),
        toggleBackgroundAudioMuted: () =>
          bgmHost.controller?.toggleMuted(),

        // -- Deprecated --
        startAutoRotate: () => {
          setLegacyAutoRotate(true);
        },
        stopAutoRotate: () => {
          setLegacyAutoRotate(false);
        },
      }),
      [
        bgmHost,
        enterFullscreen,
        exitFullscreen,
        scenesHost,
        toggleFullscreen,
        videoHost,
        webVRHost,
      ],
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
        className={cn("pano-viewer", divProps.className)}
        data-pano-viewer=""
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
        >
          <XR store={xrStore}>
          <WebVRRuntimeContext.Provider
            value={{ host: webVRHost, xrStore, stereoView }}
          >
          <PanoramaXROrigin />
          <HotspotAccessibilityContext.Provider value={registry}>
            <PanoEventBusContext.Provider value={eventBus}>
              <PanoCursorTree cursors={resolvedCursors}>
              <PanoramaViewContext.Provider value={controlsRef}>
                <PanoContextMenuOverlayContext.Provider
                  value={contextMenuOverlayApi}
                >
                  <PanoChromeOverlayContext.Provider value={chromeOverlayApi}>
                  <PanoVideoHostContext.Provider value={videoHost}>
                  <PanoFilterHostContext.Provider value={filterHost}>
                  <PanoContextMenuActionsContext.Provider
                    value={contextMenuActions}
                  >
                  <ScenesHostContext.Provider value={scenesHost}>
                  <BackgroundAudioHostContext.Provider value={bgmHost}>
                  <PanoVideoHostReset />
                  <PanoramaViewRuntime
                    ref={controlsRef}
                    eventBus={eventBus}
                    initialView={normalizedInitialView}
                    maxFov={normalizedMaxFov}
                    minFov={normalizedMinFov}
                    options={controlOptions}
                  />
                  {(onViewChange ||
                    onPanoramaClick ||
                    onPanoramaDoubleClick ||
                    onPanoramaPointerMove) && (
                    <PanoEvents
                      onViewChange={onViewChange}
                      onClick={onPanoramaClick}
                      onDoubleClick={onPanoramaDoubleClick}
                      onPointerMove={onPanoramaPointerMove}
                    />
                  )}
                  <AutoRotate
                    enabled={legacyAutoRotate}
                    speed={legacyAutoRotateOptions.autoRotateSpeed}
                  />
                  <PanoramaEventSurface />
                  {contextMenuChannel.mount ? (
                    <PanoContextMenu {...contextMenuChannel.props} />
                  ) : null}
                  <ControlClaimsContext.Provider value={controlClaims}>
                    {children}
                    <DefaultControlChannels
                      fovSpeed={controlOptions.fovSpeed}
                      keyboardChannel={keyboardChannel}
                      mouseChannel={mouseChannel}
                      touchChannel={touchChannel}
                      userControlsEnabled={userControlsEnabled}
                    />
                  </ControlClaimsContext.Provider>
                  </BackgroundAudioHostContext.Provider>
                  </ScenesHostContext.Provider>
                  </PanoContextMenuActionsContext.Provider>
                  </PanoFilterHostContext.Provider>
                  </PanoVideoHostContext.Provider>
                  </PanoChromeOverlayContext.Provider>
                </PanoContextMenuOverlayContext.Provider>
              </PanoramaViewContext.Provider>
              </PanoCursorTree>
            </PanoEventBusContext.Provider>
          </HotspotAccessibilityContext.Provider>
          </WebVRRuntimeContext.Provider>
          </XR>
        </Canvas>
        <div
          className="pano-chrome-overlay"
          data-pano-chrome-overlay=""
          ref={setOverlayNode}
        >
          <PanoVideoChromeBridge
            fullscreen={contextMenuActions}
            host={videoHost}
            overlayElement={overlayElement}
          />
          <WebVRChromeBridge host={webVRHost} />
        </div>
        {contextMenuOverlay}
        {hotspotAccessibilityControls}
      </div>
    );
  },
);
