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
      className="pointer-events-auto border border-white/20 px-3 py-2 font-semibold shadow-lg backdrop-blur-sm"
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
      className="pointer-events-auto absolute top-1/2 left-1/2 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 border border-white/20 p-5 text-center shadow-2xl backdrop-blur-md"
      role="dialog"
      style={panelStyle}
    >
      <h2 className="m-0 mb-5 text-2xl font-extrabold">
        {appearance.setupTitle ?? "MobileVR Setup"}
      </h2>
      <label className="mb-5 block font-semibold">
        Screen size (inch)
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            aria-label="Decrease screen size"
            className="text-2xl"
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
          <strong className="min-w-16 text-xl">
            {settings.screensize === "auto"
              ? "Auto"
              : settings.screensize.toFixed(1)}
          </strong>
          <button
            aria-label="Increase screen size"
            className="text-2xl"
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
      <fieldset className="m-0 mb-5 border-0 p-0">
        <legend className="mb-2 font-semibold">VR headset preset</legend>
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            aria-label="Previous headset preset"
            className="text-2xl"
            onClick={() => cycleProfile(-1)}
            type="button"
          >
            ‹
          </button>
          <strong className="min-w-32 text-xl">
            {WEBVR_PROFILES[settings.profileId].label}
          </strong>
          <button
            aria-label="Next headset preset"
            className="text-2xl"
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
      <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
        {mode ? (
          <div className="flex gap-2">
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
          className="pointer-events-none absolute inset-x-0 bottom-5 m-0 text-center text-xs font-semibold text-white drop-shadow"
          style={{ color: appearance.color }}
        >
          Simulated VR Mode · Use a VR headset or mobile device for real VR.
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
