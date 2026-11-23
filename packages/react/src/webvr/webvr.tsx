import { WebGPURuntimeContext } from "../pano-renderer";
import { connectWebGPUXR, endWebXRSession, handOffWebXRSession, requestWebVRSession } from "./webgpu-xr";
import { WebVRInputBridge } from "./input-bridge";
import { bindEmulatedXRViewport } from "./emulated-viewport";
import { useStore, useThree } from "@react-three/fiber";
import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Gyro } from "../gyro";
import type { GyroHandle } from "../gyro";
import { PanoEventBusContext } from "../pano-event-bus";
import { PanoramaViewContext } from "../panorama-view-runtime";
import { detectWebVRCapabilities } from "./detect";
import type { WebVRCapabilities } from "./detect";
import {
  resolveScreensizeFromDpdb,
  normalizeDatabaseUrl,
} from "./dpdb";
import {
  WebVRRuntimeContext,
  getWebVRState,
  subscribeWebVRHost,
  updateWebVRHost,
  type WebVRController,
} from "./host";
import {
  clearWebVRSettings,
  loadWebVRSettings,
  resolveInitialWebVRSettings,
  resolveWebVRProfile,
  saveWebVRSettings,
} from "./profiles";
import {
  enterWebVRPresentation,
  leaveWebVRPresentation,
  subscribeWebVRPresentationExit,
} from "./presentation";
import { DEFAULT_WEBVR_CURSOR_DWELL_MS, MOBILE_VR_RETICLE_SCALE, WebVRReticle } from "./reticle";
import { WebVRStereoRenderer } from "./stereo";
import { clampWebVROversampling } from "./stereo-layout";
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
import {
  applyWebVRFrameRate,
  clampWebVRFoveation,
} from "./xr-quality";

function initializeSettings(
  screensize: WebVRProps["screensize"],
  profile: WebVRProps["profile"],
  mode: "fake" | "mobilevr" = "fake",
): WebVRSettings {
  return resolveInitialWebVRSettings(screensize, profile, loadWebVRSettings(mode));
}

function getViewerElement(canvas: HTMLCanvasElement): Element {
  return canvas.closest("[data-pano-viewer]") ?? canvas.parentElement ?? canvas;
}

export const WebVR = forwardRef<WebVRHandle, WebVRProps>(function WebVR(
  {
    interactionMode = "auto",
    chrome = true,
    mobileVr = true,
    desktopSupport = false,
    fakeSupport = true,
    screensize,
    databaseUrl,
    profile,
    absolute = false,
    north = 0,
    friction = 0,
    touchSupport = false,
    oversampling = 1,
    foveation,
    frameRate,
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
  const gpu = useContext(WebGPURuntimeContext);
  const store = useStore();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
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
  const dpdbRequestIdRef = useRef(0);
  const databaseUrlRef = useRef(databaseUrl);
  databaseUrlRef.current = databaseUrl;
  const oversamplingRef = useRef(clampWebVROversampling(oversampling));
  oversamplingRef.current = clampWebVROversampling(oversampling);
  const screensizePropRef = useRef(screensize);
  screensizePropRef.current = screensize;
  const profilePropRef = useRef(profile);
  profilePropRef.current = profile;
  const [mode, setMode] = useState<WebVRMode | null>(null);
  const [storedSettings, setSettings] = useState(() =>
    initializeSettings(screensize, profile),
  );
  const settings = {
    ...storedSettings,
    screensize: screensize ?? storedSettings.screensize,
    profileId: typeof profile === "string" ? profile : storedSettings.profileId,
  };
  const [detectedScreensize, setDetectedScreensize] = useState<number | null>(
    null,
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
  const setupOpen = useSyncExternalStore(
    (listener) => subscribeWebVRHost(host, listener),
    () => host.snapshot.setupOpen,
    () => false,
  );
  const resolvedProfile = useMemo(
    () => resolveWebVRProfile(profile, settings.profileId),
    [profile, settings.profileId],
  );
  const effectiveScreensize =
    settings.screensize === "auto"
      ? (detectedScreensize ?? "auto")
      : settings.screensize;
  const resolvedOversampling = clampWebVROversampling(oversampling);

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

  const clearDetectedScreensize = useCallback(() => {
    dpdbRequestIdRef.current += 1;
    setDetectedScreensize(null);
    updateWebVRHost(host, { detectedScreensize: null, screensizeStatus: "idle" });
  }, [host]);

  const resolveAutoScreensize = useCallback(() => {
    const requestId = ++dpdbRequestIdRef.current;
    const url = normalizeDatabaseUrl(databaseUrlRef.current);
    updateWebVRHost(host, { detectedScreensize: null, screensizeStatus: "loading" });
    setDetectedScreensize(null);
    if (!url) {
      updateWebVRHost(host, { screensizeStatus: "unknown" });
      reportUnknownDevice();
      return;
    }
    void resolveScreensizeFromDpdb(url).then((inches) => {
      if (requestId !== dpdbRequestIdRef.current) {
        return;
      }
      if (inches === null) {
        updateWebVRHost(host, { screensizeStatus: "unknown" });
        reportUnknownDevice();
        return;
      }
      setDetectedScreensize(inches);
      updateWebVRHost(host, { detectedScreensize: inches, screensizeStatus: "detected" });
    });
  }, [host, reportUnknownDevice]);

  useEffect(() => {
    if (mode === "mobilevr" && settings.screensize === "auto") resolveAutoScreensize();
    else clearDetectedScreensize();
  }, [screensize, databaseUrl, clearDetectedScreensize, resolveAutoScreensize]);

  const activate = useCallback(
    (nextMode: WebVRMode) => {
      if (modeRef.current === nextMode) {
        return;
      }
      if (nextMode !== "webxr") {
        setSettings(initializeSettings(screensizePropRef.current, profilePropRef.current, nextMode));
      }
      modeRef.current = nextMode;
      setMode(nextMode);
      updateWebVRHost(host, { mode: nextMode });
      if (nextMode === "fake") {
        controlsRef.current?.setGyroActive(true);
      }
      eventBus.emit("vrenter", { mode: nextMode });
      callbacksRef.current.onEnterVR?.(nextMode);
    },
    [controlsRef, eventBus, host],
  );

  const deactivate = useCallback(
    (expectedMode?: WebVRMode) => {
      const previousMode = modeRef.current;
      if (!previousMode || (expectedMode && previousMode !== expectedMode)) {
        return;
      }
      modeRef.current = null;
      setMode(null);
      clearDetectedScreensize();
      updateWebVRHost(host, { mode: null, setupOpen: false, pointerLocked: false });
      if (previousMode === "fake") {
        controlsRef.current?.setGyroActive(false);
      }
      exitWebVRPointerLock(gl.domElement);
      eventBus.emit("vrexit", { mode: previousMode });
      callbacksRef.current.onExitVR?.(previousMode);
    },
    [clearDetectedScreensize, controlsRef, eventBus, gl.domElement, host],
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    return (await gyroRef.current?.requestPermission()) ?? false;
  }, []);

  const activateXR = useCallback((session: XRSession) => {
    if (!mounted.current || xrStore.getState().session !== session || !gl.xr.isPresenting) {
      throw new Error("The WebXR session did not start.");
    }
    webXRSessionRef.current = session;
    session.addEventListener("end", () => {
      webXRSessionRef.current = null;
      deactivate("webxr");
    }, { once: true });
    activate("webxr");
  }, [activate, deactivate, gl.xr, xrStore]);

  useEffect(() => {
    const pending = host.pendingXR;
    if (gpu || !pending || pending.connecting) return;
    pending.connecting = true;
    void (async () => {
      try {
        gl.xr.setFramebufferScaleFactor(oversamplingRef.current);
        await gl.xr.setSession(pending.session);
        if (host.pendingXR !== pending) return;
        activateXR(pending.session);
        pending.finish(true);
      } catch (error) {
        pending.finish(false);
        if (mounted.current) reportDenied(error);
      }
    })();
  }, [activateXR, gl.xr, gpu, host, reportDenied]);

  const startVR = useCallback(async (): Promise<boolean> => {
    const capabilities = capabilitiesRef.current;
    host.hotspotReferenceHeight = Math.max(1, store.getState().size.height);
    if (capabilities.webxr) {
      let session: XRSession | null = null;
      try {
        if (!gpu) {
          gl.xr.setFramebufferScaleFactor(oversamplingRef.current);
          session = (await xrStore.enterVR()) ?? null;
        } else {
          session = await requestWebVRSession(gpu.nativeXR);
          if (!mounted.current) {
            await endWebXRSession(session);
            return false;
          }
          if (!gpu.nativeXR) return await handOffWebXRSession(host, session, gpu.fallback);
          await connectWebGPUXR(gpu.passes.renderer, session, store.getState);
        }
        if (!session) throw new Error("The WebXR session did not start.");
        activateXR(session);
        return true;
      } catch (error) {
        const installed = gl.xr.getSession();
        if (installed && (!session || installed === session)) await endWebXRSession(installed).catch(() => {});
        if (!mounted.current) return false;
        if (gpu?.nativeXR && (session || (error instanceof DOMException && error.name === "NotSupportedError"))) {
          reportDenied(Object.assign(new Error("WebGPU XR could not start. Select Enter VR again to use WebGL."), { cause: error }));
          gpu.fallback();
        } else reportDenied(error);
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
      const viewer = getViewerElement(gl.domElement);
      // Ask while the activation gesture is still available, before fullscreen can consume it.
      const permission = requestPermission();
      await enterWebVRPresentation(viewer);
      const granted = await permission;
      if (!mounted.current || !granted) {
        releaseWebVRWakeLock();
        leaveWebVRPresentation();
        if (mounted.current) reportDenied();
        return false;
      }
      activate("mobilevr");
      if (initializeSettings(screensizePropRef.current, profilePropRef.current, "mobilevr").screensize === "auto") {
        resolveAutoScreensize();
      }
      return true;
    }

    if (fakeSupport) {
      if (wakelock) {
        void acquireWebVRWakeLock();
      }
      if (mousePointerLock) {
        void requestWebVRPointerLock(gl.domElement);
      }
      await enterWebVRPresentation(getViewerElement(gl.domElement));
      if (!mounted.current) {
        releaseWebVRWakeLock();
        leaveWebVRPresentation();
        return false;
      }
      activate("fake");
      return true;
    }

    callbacksRef.current.onUnavailable?.();
    eventBus.emit("vrunavailable", undefined);
    return false;
  }, [
    activate,
    activateXR,
    desktopSupport,
    eventBus,
    fakeSupport,
    gl.domElement,
    gl.xr,
    gpu,
    host,
    mobileVr,
    mousePointerLock,
    reportDenied,
    requestPermission,
    resolveAutoScreensize,
    store,
    wakelock,
    xrStore,
  ]);

  const enterVR = useCallback(async (): Promise<boolean> => {
    if (modeRef.current) return true;
    if (host.snapshot.entering || host.pendingXR) return false;
    updateWebVRHost(host, { entering: true });
    try {
      return await startVR();
    } catch (error) {
      if (mounted.current) reportDenied(error);
      return false;
    } finally {
      updateWebVRHost(host, { entering: false });
    }
  }, [host, reportDenied, startVR]);

  const exitVR = useCallback(async (): Promise<void> => {
    if (modeRef.current === "webxr") {
      const session =
        webXRSessionRef.current ?? xrStore.getState().session ?? null;
      if (session) {
        await endWebXRSession(session);
      } else {
        deactivate("webxr");
      }
      return;
    }
    deactivate();
    leaveWebVRPresentation();
  }, [deactivate, xrStore]);

  const toggleVR = useCallback(async (): Promise<boolean> => {
    if (modeRef.current) {
      await exitVR();
      return false;
    }
    return enterVR();
  }, [enterVR, exitVR]);

  const updateSettings = useCallback(
    (next: WebVRSettings) => {
      const normalized: WebVRSettings = {
        profileId: typeof profilePropRef.current === "string" ? profilePropRef.current : next.profileId,
        screensize:
          screensizePropRef.current ?? (next.screensize === "auto"
            ? "auto"
            : Math.round(Math.max(3, Math.min(20, next.screensize)) * 10) / 10),
      };
      setSettings(normalized);
      saveWebVRSettings(normalized, modeRef.current === "mobilevr" ? "mobilevr" : "fake");
      if (normalized.screensize === "auto") {
        if (modeRef.current === "mobilevr") {
          setDetectedScreensize(null);
          updateWebVRHost(host, { detectedScreensize: null, screensizeStatus: "idle" });
          resolveAutoScreensize();
        }
      } else {
        clearDetectedScreensize();
      }
    },
    [clearDetectedScreensize, host, resolveAutoScreensize],
  );

  const resetSettings = useCallback(() => {
    clearWebVRSettings(modeRef.current === "fake" || modeRef.current === "mobilevr" ? modeRef.current : undefined);
    const next = resolveInitialWebVRSettings(
      screensizePropRef.current,
      profilePropRef.current,
    );
    setSettings(next);
    if (next.screensize === "auto") {
      if (modeRef.current === "mobilevr") {
        setDetectedScreensize(null);
        updateWebVRHost(host, { detectedScreensize: null, screensizeStatus: "idle" });
        resolveAutoScreensize();
      } else {
        clearDetectedScreensize();
      }
    } else {
      clearDetectedScreensize();
    }
  }, [clearDetectedScreensize, host, resolveAutoScreensize]);

  const controller = useMemo<WebVRController>(
    () => ({
      closeSetup: () => updateWebVRHost(host, { setupOpen: false }),
      enterVR,
      exitVR,
      openSetup: () => {
        if (modeRef.current === "fake") exitWebVRPointerLock(gl.domElement);
        updateWebVRHost(host, { setupOpen: true });
      },
      requestPermission,
      resetSettings,
      toggleVR,
      updateSettings,
    }),
    [
      enterVR,
      exitVR,
      gl.domElement,
      host,
      requestPermission,
      resetSettings,
      toggleVR,
      updateSettings,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      enterVR,
      exitVR,
      getMode: () => modeRef.current,
      getState: () => getWebVRState(host),
      isAvailable: () => availableRef.current,
      isEnabled: () => modeRef.current !== null,
      requestPermission,
      resetSettings,
      subscribe: (onStoreChange) => subscribeWebVRHost(host, onStoreChange),
      toggleVR,
    }),
    [enterVR, exitVR, host, requestPermission, resetSettings, toggleVR],
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
  }, [controller, host]);

  useEffect(() => () => {
    host.controller = null;
    dpdbRequestIdRef.current += 1;
    updateWebVRHost(host, { available: false, detectedScreensize: null, screensizeStatus: "idle", pointerLocked: false, mode: null, setupOpen: false });
  }, [host]);

  useEffect(() => {
    updateWebVRHost(host, {
      chrome,
      detectedScreensize,
      settings,
      screensizeManaged: screensize !== undefined,
      profileManaged: profile !== undefined,
      profileLabel: resolvedProfile.label ?? resolvedProfile.id ?? "Custom lens profile",
    });
  }, [chrome, detectedScreensize, host, settings.screensize, settings.profileId, screensize, profile, resolvedProfile]);

  useEffect(() => {
    if (mode !== "fake" || setupOpen) {
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
  }, [controlsRef, gl.domElement, mode, mousePointerLock, setupOpen]);

  useEffect(
    () => () => {
      const session = webXRSessionRef.current;
      if (session) {
        void endWebXRSession(session).catch(() => {});
      }
      if (modeRef.current === "fake") {
        controlsRef.current?.setGyroActive(false);
      }
      if (modeRef.current === "mobilevr" || modeRef.current === "fake") {
        leaveWebVRPresentation();
      }
    },
    [controlsRef],
  );

  useEffect(() => {
    if (mode !== "mobilevr" && mode !== "fake") {
      return;
    }
    const viewer = getViewerElement(gl.domElement);
    return subscribeWebVRPresentationExit(viewer, () => {
      void exitVR();
    });
  }, [exitVR, gl.domElement, mode]);

  useEffect(() => {
    if (mode === "webxr") return bindEmulatedXRViewport(gl.domElement);
  }, [gl.domElement, mode]);

  useEffect(() => {
    const session = webXRSessionRef.current;
    if (mode === "webxr" && session && gl.xr.getSession() === session) {
      void applyWebVRFrameRate(session, frameRate);
    }
  }, [frameRate, gl.xr, mode]);

  useEffect(() => {
    const nextFoveation = clampWebVRFoveation(foveation);
    if (mode === "webxr" && nextFoveation !== undefined && typeof gl.xr.setFoveation === "function") {
      gl.xr.setFoveation(nextFoveation);
    }
  }, [foveation, gl.xr, mode]);

  const pointerLocked = useWebVRPointerLock(
    mousePointerLock && mode === "fake" && !setupOpen,
    gl.domElement,
  );
  useEffect(() => {
    updateWebVRHost(host, { pointerLocked });
  }, [host, pointerLocked]);
  useWebVRWakeLock(
    wakelock && (mode === "mobilevr" || mode === "fake"),
  );

  return (
    <>
      <Gyro
        ref={gyroRef}
        absolute={absolute}
        desktopSupport={desktopSupport}
        enabled={mode === "mobilevr"}
        friction={friction}
        north={north}
        onDenied={() => {
          reportDenied();
          deactivate("mobilevr");
        }}
        softstart={0}
        touchMode={touchSupport ? "horizontaloffset" : "off"}
      />
      <WebVRStereoRenderer
        mode={mode}
        oversampling={resolvedOversampling}
        profile={resolvedProfile}
        screensize={effectiveScreensize}
      />
      <WebVRInputBridge mode={mode} policy={interactionMode} chrome={chrome} gazeEnabled={cursor && cursorDwellMs > 0} />
      <WebVRReticle
        dwellMs={cursorDwellMs}
        scale={mode === "mobilevr" ? MOBILE_VR_RETICLE_SCALE : mode === "fake" ? 0.6 : 1}
        visible={cursor && !setupOpen && mode !== null && (mode !== "fake" || !mousePointerLock || pointerLocked)}
      />
    </>
  );
});
