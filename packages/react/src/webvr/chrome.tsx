import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  subscribeWebVRHost,
  type WebVRHost,
} from "./host";
import { DEFAULT_WEBVR_CHROME_APPEARANCE } from "./appearance";
import { usePortraitOrientation } from "./orientation";
import { cycleWebVRProfileId, WEBVR_PROFILES } from "./profiles";
import type { WebVRChromeAppearance, WebVRSettings } from "./types";

const SESSION_CHROME_IDLE_MS = 3_000;

function resolveAppearance(
  value: WebVRHost["snapshot"]["chrome"],
): Required<Omit<WebVRChromeAppearance, "setupTitle">> &
  Pick<WebVRChromeAppearance, "setupTitle"> {
  return {
    ...DEFAULT_WEBVR_CHROME_APPEARANCE,
    ...(typeof value === "object" ? value : {}),
  };
}

function ChromeButton({
  appearance,
  children,
  onClick,
}: {
  appearance: ReturnType<typeof resolveAppearance>;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="pano-webvr-button"
      onClick={onClick}
      style={{
        background: appearance.background,
        borderRadius: appearance.borderRadius,
        color: appearance.color,
        fontSize: appearance.fontSize,
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function formatScreensizeLabel(
  settings: WebVRSettings,
  detectedScreensize: number | null,
): string {
  if (settings.screensize === "auto") {
    return detectedScreensize === null
      ? "Auto"
      : `Auto · ${detectedScreensize.toFixed(1)}`;
  }
  return settings.screensize.toFixed(1);
}

function SetupPanel({
  appearance,
  detectedScreensize,
  host,
  settings,
}: {
  appearance: ReturnType<typeof resolveAppearance>;
  detectedScreensize: number | null;
  host: WebVRHost;
  settings: WebVRSettings;
}) {
  const controller = host.controller;
  const setScreensize = (value: number | "auto") => {
    controller?.updateSettings({ ...settings, screensize: value });
  };
  const cycleProfile = (step: -1 | 1) => {
    controller?.updateSettings({
      ...settings,
      profileId: cycleWebVRProfileId(settings.profileId, step),
    });
  };
  const panelStyle: CSSProperties = {
    background: appearance.background,
    borderRadius: appearance.borderRadius,
    color: appearance.color,
    fontSize: appearance.fontSize,
  };
  return (
    <div
      aria-label="Mobile VR setup"
      className="pano-webvr-setup"
      role="dialog"
      style={panelStyle}
    >
      <h2 className="pano-webvr-setup-title">
        {appearance.setupTitle ?? "MobileVR Setup"}
      </h2>
      <label className="pano-webvr-setup-field">
        Screen size (inch)
        <div className="pano-webvr-setup-row">
          <button
            aria-label="Decrease screen size"
            className="pano-webvr-setup-stepper"
            onClick={() =>
              setScreensize(
                settings.screensize === "auto"
                  ? 5
                  : Math.max(3, settings.screensize - 0.1),
              )
            }
            type="button"
          >
            ‹
          </button>
          <strong className="pano-webvr-setup-value">
            {formatScreensizeLabel(settings, detectedScreensize)}
          </strong>
          <button
            aria-label="Increase screen size"
            className="pano-webvr-setup-stepper"
            onClick={() =>
              setScreensize(
                settings.screensize === "auto"
                  ? 5
                  : Math.min(20, settings.screensize + 0.1),
              )
            }
            type="button"
          >
            ›
          </button>
        </div>
      </label>
      <fieldset className="pano-webvr-setup-fieldset">
        <legend className="pano-webvr-setup-legend">VR headset preset</legend>
        <div className="pano-webvr-setup-row">
          <button
            aria-label="Previous headset preset"
            className="pano-webvr-setup-stepper"
            onClick={() => cycleProfile(-1)}
            type="button"
          >
            ‹
          </button>
          <strong className="pano-webvr-setup-value-wide">
            {WEBVR_PROFILES[settings.profileId].label}
          </strong>
          <button
            aria-label="Next headset preset"
            className="pano-webvr-setup-stepper"
            onClick={() => cycleProfile(1)}
            type="button"
          >
            ›
          </button>
        </div>
      </fieldset>
      <ChromeButton
        appearance={appearance}
        onClick={() => controller?.closeSetup()}
      >
        Close
      </ChromeButton>
    </div>
  );
}

function SessionActions({
  appearance,
  host,
  mode,
  visible,
}: {
  appearance: ReturnType<typeof resolveAppearance>;
  host: WebVRHost;
  mode: NonNullable<WebVRHost["snapshot"]["mode"]>;
  visible: boolean;
}) {
  return (
    <div
      aria-hidden={!visible}
      className={
        visible
          ? "pano-webvr-toolbar-actions"
          : "pano-webvr-toolbar-actions pano-webvr-toolbar-actions-hidden"
      }
      inert={!visible ? true : undefined}
    >
      {mode !== "webxr" ? (
        <ChromeButton
          appearance={appearance}
          onClick={() => host.controller?.openSetup()}
        >
          VR Setup
        </ChromeButton>
      ) : null}
      <ChromeButton
        appearance={appearance}
        onClick={() => void host.controller?.exitVR()}
      >
        Exit VR
      </ChromeButton>
    </div>
  );
}

function RotatePhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      className="pano-webvr-portrait-icon"
      fill="none"
      height="48"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 48 48"
      width="48"
    >
      <rect height="28" rx="3" width="18" x="15" y="6" />
      <path d="M10 34c-3-3-4-7-3-11" />
      <path d="M8 36l2-2 2 2" />
      <path d="M38 14c3 3 4 7 3 11" />
      <path d="M40 12l-2 2-2-2" />
    </svg>
  );
}

function PortraitPrompt() {
  return (
    <div className="pano-webvr-portrait-prompt" role="status">
      <RotatePhoneIcon />
      <p className="pano-webvr-portrait-text">Rotate your phone to landscape</p>
    </div>
  );
}

function useSessionChromeVisibility(
  active: boolean,
  keepVisible: boolean,
  viewer: Element | null,
): boolean {
  const [visible, setVisible] = useState(true);
  const idleTimerRef = useRef(0);

  const bump = useCallback(() => {
    setVisible(true);
    window.clearTimeout(idleTimerRef.current);
    if (!active || keepVisible) {
      return;
    }
    idleTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, SESSION_CHROME_IDLE_MS);
  }, [active, keepVisible]);

  useEffect(() => {
    if (!active) {
      window.clearTimeout(idleTimerRef.current);
      setVisible(true);
      return;
    }
    bump();
  }, [active, bump, keepVisible]);

  useEffect(() => {
    if (!active || !viewer) {
      return;
    }

    const reveal = () => {
      bump();
    };

    viewer.addEventListener("pointerdown", reveal);
    viewer.addEventListener("wheel", reveal, { passive: true });
    viewer.addEventListener("keydown", reveal);
    return () => {
      viewer.removeEventListener("pointerdown", reveal);
      viewer.removeEventListener("wheel", reveal);
      viewer.removeEventListener("keydown", reveal);
    };
  }, [active, bump, viewer]);

  useEffect(
    () => () => {
      window.clearTimeout(idleTimerRef.current);
    },
    [],
  );

  return keepVisible || visible;
}

export function WebVRChromeBridge({ host }: { host: WebVRHost }) {
  useSyncExternalStore(
    (listener) => subscribeWebVRHost(host, listener),
    () => host.revision,
    () => host.revision,
  );
  const portrait = usePortraitOrientation();
  const {
    chrome,
    detectedScreensize,
    mode,
    settings,
    setupOpen,
  } = host.snapshot;
  const [mounted, setMounted] = useState(false);
  const [viewer, setViewer] = useState<Element | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const node =
      toolbarRef.current?.closest("[data-pano-viewer]") ?? null;
    setViewer(node);
  }, [mode]);

  const sessionActive = mode !== null;
  const chromeVisible = useSessionChromeVisibility(
    sessionActive,
    setupOpen,
    viewer,
  );

  if (chrome === false || !host.controller) {
    return null;
  }
  const appearance = resolveAppearance(chrome);
  const showPortraitPrompt = mode === "mobilevr" && mounted && portrait;

  if (showPortraitPrompt) {
    return <PortraitPrompt />;
  }

  if (!mode) {
    return null;
  }

  return (
    <>
      <div className="pano-webvr-toolbar" ref={toolbarRef}>
        <SessionActions
          appearance={appearance}
          host={host}
          mode={mode}
          visible={chromeVisible}
        />
      </div>
      {mode === "fake" && chromeVisible ? (
        <p className="pano-webvr-hint" style={{ color: appearance.color }}>
          Simulated VR Mode · Click the view to lock the mouse, then move to
          look around. Use a headset or phone for real VR.
        </p>
      ) : null}
      {setupOpen ? (
        <SetupPanel
          appearance={appearance}
          detectedScreensize={detectedScreensize}
          host={host}
          settings={settings}
        />
      ) : null}
    </>
  );
}
