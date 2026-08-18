import { useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  subscribeWebVRHost,
  type WebVRHost,
} from "./host";
import { DEFAULT_WEBVR_CHROME_APPEARANCE } from "./appearance";
import { cycleWebVRProfileId, WEBVR_PROFILES } from "./profiles";
import type { WebVRChromeAppearance, WebVRSettings } from "./types";

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

function SetupPanel({
  appearance,
  host,
  settings,
}: {
  appearance: ReturnType<typeof resolveAppearance>;
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
            {settings.screensize === "auto"
              ? "Auto"
              : settings.screensize.toFixed(1)}
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

export function WebVRChromeBridge({ host }: { host: WebVRHost }) {
  useSyncExternalStore(
    (listener) => subscribeWebVRHost(host, listener),
    () => host.revision,
    () => host.revision,
  );
  const { available, chrome, mode, settings, setupOpen } = host.snapshot;
  if (chrome === false || !host.controller) {
    return null;
  }
  const appearance = resolveAppearance(chrome);

  return (
    <>
      <div className="pano-webvr-toolbar">
        {mode ? (
          <div className="pano-webvr-toolbar-actions">
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
        ) : (
          <ChromeButton
            appearance={appearance}
            onClick={() => void host.controller?.enterVR()}
          >
            {available ? "Enter VR" : "VR unavailable"}
          </ChromeButton>
        )}
      </div>
      {mode === "fake" ? (
        <p
          className="pano-webvr-hint"
          style={{ color: appearance.color }}
        >
          Simulated VR Mode · Click the view to lock the mouse, then move to
          look around. Use a headset or phone for real VR.
        </p>
      ) : null}
      {setupOpen ? (
        <SetupPanel
          appearance={appearance}
          host={host}
          settings={settings}
        />
      ) : null}
    </>
  );
}
