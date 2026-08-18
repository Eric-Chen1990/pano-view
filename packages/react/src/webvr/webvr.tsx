import { useThree } from "@react-three/fiber";
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
import { Gyro } from "../gyro";
import type { GyroHandle } from "../gyro";
import {
  exitElementFullscreen,
  getFullscreenElement,
  requestElementFullscreen,
} from "../fullscreen";
import { PanoEventBusContext } from "../pano-event-bus";
import { PanoramaViewContext } from "../panorama-view-runtime";
import { detectWebVRCapabilities } from "./detect";
import type { WebVRCapabilities } from "./detect";
import {
  WebVRRuntimeContext,
  updateWebVRHost,
  type WebVRController,
} from "./host";
import {
  loadWebVRSettings,
  resolveWebVRProfile,
  saveWebVRSettings,
} from "./profiles";
import { DEFAULT_WEBVR_CURSOR_DWELL_MS, WebVRReticle } from "./reticle";
import { WebVRStereoRenderer } from "./stereo";
import type {
  WebVRHandle,
  WebVRMode,
  WebVRProps,
  WebVRSettings,
} from "./types";
import {
  exitWebVRPointerLock,
  requestWebVRPointerLock,
  useWebVRPointerLock,
} from "./pointerlock";
import {
  acquireWebVRWakeLock,
  releaseWebVRWakeLock,
  useWebVRWakeLock,
} from "./wakelock";

function initializeSettings(
  screensize: WebVRProps["screensize"],
  profile: WebVRProps["profile"],
): WebVRSettings {
  const stored = loadWebVRSettings();
  return {
    screensize: screensize ?? stored.screensize,
    profileId: typeof profile === "string" ? profile : stored.profileId,
  };
}

function getViewerElement(canvas: HTMLCanvasElement): Element {
  return canvas.closest("[data-pano-viewer]") ?? canvas.parentElement ?? canvas;
}

export const WebVR = forwardRef<WebVRHandle, WebVRProps>(function WebVR(
  {
    chrome = true,
    mobileVr = true,
    desktopSupport = false,
    fakeSupport = true,
    screensize,
    profile,
    cursor = true,
    cursorDwellMs = DEFAULT_WEBVR_CURSOR_DWELL_MS,
    wakelock = true,
    mousePointerLock = true,
    onAvailable,
    onUnavailable,
    onEnterVR,
    onExitVR,
    onDenied,
    onUnknownDevice,
  },
  ref,
) {
  const runtime = useContext(WebVRRuntimeContext);
  const controlsRef = useContext(PanoramaViewContext);
  const eventBus = useContext(PanoEventBusContext);
  const gl = useThree((state) => state.gl);
  const gyroRef = useRef<GyroHandle>(null);
  const capabilitiesRef = useRef<WebVRCapabilities>({
    mobile: false,
    sensor: false,
    webxr: false,
  });
  const availableRef = useRef(false);
  const modeRef = useRef<WebVRMode | null>(null);
  const webXRSessionRef = useRef<XRSession | null>(null);
  const [mode, setMode] = useState<WebVRMode | null>(null);
  const [settings, setSettings] = useState(() =>
    initializeSettings(screensize, profile),
  );
  const callbacksRef = useRef({
    onAvailable,
    onDenied,
    onEnterVR,
    onExitVR,
    onUnavailable,
    onUnknownDevice,
  });
  callbacksRef.current = {
    onAvailable,
    onDenied,
    onEnterVR,
    onExitVR,
    onUnavailable,
    onUnknownDevice,
  };

  if (!runtime || !controlsRef || !eventBus) {
    throw new Error("<WebVR> must be rendered inside <PanoViewer>.");
  }

  const { host, xrStore } = runtime;
  const resolvedProfile = useMemo(
    () => resolveWebVRProfile(profile, settings.profileId),
    [profile, settings.profileId],
  );

  const reportDenied = useCallback(
    (error?: unknown) => {
      eventBus.emit("vrdenied", { error });
      callbacksRef.current.onDenied?.(error);
    },
    [eventBus],
  );

  const reportUnknownDevice = useCallback(() => {
    eventBus.emit("vrunknowndevice", undefined);
    callbacksRef.current.onUnknownDevice?.();
  }, [eventBus]);

  const activate = useCallback(
    (nextMode: WebVRMode) => {
      if (modeRef.current === nextMode) {
        return;
      }
      modeRef.current = nextMode;
      setMode(nextMode);
      if (nextMode === "fake") {
        controlsRef.current?.setGyroActive(true);
      }
      eventBus.emit("vrenter", { mode: nextMode });
      callbacksRef.current.onEnterVR?.(nextMode);
    },
    [controlsRef, eventBus],
  );

  const deactivate = useCallback(
    (expectedMode?: WebVRMode) => {
      const previousMode = modeRef.current;
      if (!previousMode || (expectedMode && previousMode !== expectedMode)) {
        return;
      }
      modeRef.current = null;
      setMode(null);
      if (previousMode === "fake") {
        controlsRef.current?.setGyroActive(false);
      }
      exitWebVRPointerLock(gl.domElement);
      eventBus.emit("vrexit", { mode: previousMode });
      callbacksRef.current.onExitVR?.(previousMode);
    },
    [controlsRef, eventBus, gl.domElement],
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    return (await gyroRef.current?.requestPermission()) ?? false;
  }, []);

  const enterVR = useCallback(async (): Promise<boolean> => {
    if (modeRef.current) {
      return true;
    }
    const capabilities = capabilitiesRef.current;
    if (capabilities.webxr) {
      try {
        await xrStore.enterVR();
        const session = xrStore.getState().session;
        if (!session) {
          throw new Error("The WebXR session did not start.");
        }
        webXRSessionRef.current = session;
        session.addEventListener(
          "end",
          () => {
            webXRSessionRef.current = null;
            deactivate("webxr");
          },
          { once: true },
        );
        activate("webxr");
        return true;
      } catch (error) {
        reportDenied(error);
        return false;
      }
    }

    const canUseMobileVR =
      mobileVr &&
      capabilities.sensor &&
      (capabilities.mobile || desktopSupport);
    if (canUseMobileVR) {
      if (wakelock) {
        void acquireWebVRWakeLock();
      }
      void requestElementFullscreen(getViewerElement(gl.domElement)).catch(
        () => {},
      );
      const granted = await requestPermission();
      if (!granted) {
        releaseWebVRWakeLock();
        if (getFullscreenElement()) {
          void exitElementFullscreen();
        }
        reportDenied();
        return false;
      }
      if (settings.screensize === "auto") {
        reportUnknownDevice();
      }
      activate("mobilevr");
      return true;
    }

    if (fakeSupport) {
      if (wakelock) {
        void acquireWebVRWakeLock();
      }
      try {
        await requestElementFullscreen(getViewerElement(gl.domElement));
      } catch {
        // Fullscreen is best-effort; pointer lock can still use the click.
      }
      if (mousePointerLock) {
        void requestWebVRPointerLock(gl.domElement);
      }
      activate("fake");
      return true;
    }

    callbacksRef.current.onUnavailable?.();
    eventBus.emit("vrunavailable", undefined);
    return false;
  }, [
    activate,
    deactivate,
    desktopSupport,
    eventBus,
    fakeSupport,
    gl.domElement,
    mobileVr,
    mousePointerLock,
    reportDenied,
    reportUnknownDevice,
    requestPermission,
    settings.screensize,
    wakelock,
    xrStore,
  ]);

  const exitVR = useCallback(async (): Promise<void> => {
    if (modeRef.current === "webxr") {
      const session =
        webXRSessionRef.current ?? xrStore.getState().session ?? null;
      if (session) {
        await session.end();
      } else {
        deactivate("webxr");
      }
      return;
    }
    deactivate();
    if (getFullscreenElement()) {
      await exitElementFullscreen();
    }
  }, [deactivate, xrStore]);

  const toggleVR = useCallback(async (): Promise<boolean> => {
    if (modeRef.current) {
      await exitVR();
      return false;
    }
    return enterVR();
  }, [enterVR, exitVR]);

  const updateSettings = useCallback((next: WebVRSettings) => {
    const normalized: WebVRSettings = {
      profileId: next.profileId,
      screensize:
        next.screensize === "auto"
          ? "auto"
          : Math.round(Math.max(3, Math.min(20, next.screensize)) * 10) / 10,
    };
    setSettings(normalized);
    saveWebVRSettings(normalized);
  }, []);

  const controller = useMemo<WebVRController>(
    () => ({
      closeSetup: () => updateWebVRHost(host, { setupOpen: false }),
      enterVR,
      exitVR,
      openSetup: () => updateWebVRHost(host, { setupOpen: true }),
      toggleVR,
      updateSettings,
    }),
    [enterVR, exitVR, host, toggleVR, updateSettings],
  );

  useImperativeHandle(
    ref,
    () => ({
      enterVR,
      exitVR,
      getMode: () => modeRef.current,
      isAvailable: () => availableRef.current,
      isEnabled: () => modeRef.current !== null,
      requestPermission,
      toggleVR,
    }),
    [enterVR, exitVR, requestPermission, toggleVR],
  );

  useEffect(() => {
    let active = true;
    void detectWebVRCapabilities().then((capabilities) => {
      if (!active) {
        return;
      }
      capabilitiesRef.current = capabilities;
      const available =
        capabilities.webxr ||
        (mobileVr &&
          capabilities.sensor &&
          (capabilities.mobile || desktopSupport)) ||
        fakeSupport;
      availableRef.current = available;
      updateWebVRHost(host, { available });
      if (available) {
        eventBus.emit("vravailable", undefined);
        callbacksRef.current.onAvailable?.();
      } else {
        eventBus.emit("vrunavailable", undefined);
        callbacksRef.current.onUnavailable?.();
      }
    });
    return () => {
      active = false;
    };
  }, [desktopSupport, eventBus, fakeSupport, host, mobileVr]);

  useEffect(() => {
    host.controller = controller;
    return () => {
      if (host.controller === controller) {
        host.controller = null;
        updateWebVRHost(host, { mode: null, setupOpen: false });
      }
    };
  }, [controller, host]);

  useEffect(() => {
    updateWebVRHost(host, { chrome, mode, settings });
  }, [chrome, host, mode, settings]);

  useEffect(() => {
    if (mode !== "fake") {
      return;
    }
    const onMouseMove = (event: MouseEvent) => {
      if (
        mousePointerLock &&
        document.pointerLockElement !== gl.domElement
      ) {
        return;
      }
      if (event.movementX === 0 && event.movementY === 0) {
        return;
      }
      controlsRef.current?.applyViewDelta(
        {
          pitch: -event.movementY * 0.1,
          yaw: event.movementX * 0.1,
        },
        { source: "mouse" },
      );
    };
    document.addEventListener("mousemove", onMouseMove);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [controlsRef, gl.domElement, mode, mousePointerLock]);

  useEffect(
    () => () => {
      const session = webXRSessionRef.current;
      if (session) {
        void session.end();
      }
      if (modeRef.current === "fake") {
        controlsRef.current?.setGyroActive(false);
      }
    },
    [controlsRef],
  );

  useWebVRPointerLock(
    mousePointerLock && mode === "fake",
    gl.domElement,
  );
  useWebVRWakeLock(
    wakelock && (mode === "mobilevr" || mode === "fake"),
  );

  return (
    <>
      <Gyro
        ref={gyroRef}
        desktopSupport={desktopSupport}
        enabled={mode === "mobilevr"}
        onDenied={() => {
          reportDenied();
          deactivate("mobilevr");
        }}
        softstart={0}
        touchMode="off"
      />
      <WebVRStereoRenderer
        mode={mode}
        profile={resolvedProfile}
        screensize={settings.screensize}
      />
      <WebVRReticle
        dwellMs={cursorDwellMs}
        visible={cursor && mode !== null}
      />
    </>
  );
});
