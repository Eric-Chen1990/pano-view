import { usePanoUiTranslation } from "../ui-translation";
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { canEnterViewerFullscreen } from "../ios-landscape-fullscreen";
import { type PanoContextMenuActionsApi } from "../pano-context-menu";
import { formatMediaTime, panoVideoTrackId } from "./format";
import {
  PanoVideoHostContext,
  useClaimPanoVideoControls,
} from "./host";
import {
  hlsQualityMenuItems,
  videoQualityButtonLabel,
  videoQualitySwitchStatus,
} from "./quality-label";
import type {
  PanoVideoController,
  PanoVideoControlsAppearance,
  PanoVideoControlsOptions,
} from "./types";

const DEFAULT_VIDEO_CONTROLS_FONT_FAMILY =
  "Inter, ui-sans-serif, system-ui, sans-serif";

export const DEFAULT_PANO_VIDEO_CONTROLS_APPEARANCE: Required<PanoVideoControlsAppearance> =
  {
    background: "rgba(16, 16, 16, 0.88)",
    color: "#f4f4f4",
    accent: "#75cbd3",
    borderRadius: 8,
    fontSize: 12,
    fontFamily: DEFAULT_VIDEO_CONTROLS_FONT_FAMILY,
    padding: "8px 10px",
  };

const IDLE_HIDE_MS = 2_500;
const COMPACT_CONTROLS_WIDTH = 560;
const NARROW_CONTROLS_WIDTH = 420;
const STACKED_VR_CONTROLS_WIDTH = 360;
const VOLUME_SLIDER_HEIGHT = 84;
const VOLUME_TRACK_WIDTH = 6;
const VOLUME_THUMB_SIZE = 14;
const CHROME_POPOVER_GAP = 12;
const VOLUME_POP_PADDING_X = 10;
const VOLUME_POP_FONT_SIZE = 11;
const VOLUME_POP_PADDING_TOP = 16;
const VOLUME_POP_PADDING_BOTTOM = 18;
const VOLUME_LABEL_TRACK_GAP = 14;
const VOLUME_STEP = 0.05;
const VOLUME_TRACK_GRADIENT =
  "linear-gradient(to top, #22c55e 0%, #14b8a6 52%, #7dd3fc 100%)";
const CAPTION_SIZE_OPTIONS = [
  { id: "sm", label: "Small", value: 12 },
  { id: "md", label: "Medium", value: 16 },
  { id: "lg", label: "Large", value: 20 },
  { id: "xl", label: "Extra large", value: 24 },
] as const;
const CAPTION_BACKGROUND_OPTIONS = [
  { id: "none", label: "None", value: "rgba(0, 0, 0, 0)" },
  { id: "dim", label: "Dim", value: "rgba(0, 0, 0, 0.35)" },
  { id: "default", label: "Default", value: "rgba(0, 0, 0, 0.55)" },
  { id: "solid", label: "Solid", value: "rgba(0, 0, 0, 0.85)" },
] as const;

function formatVolumePercent(volume: number): string {
  return `${Math.round(Math.max(0, Math.min(1, volume)) * 100)}%`;
}

type MenuId = "rate" | "variant" | "captions" | "more";
type CaptionsPanel = "tracks" | "settings";

type ChromeMenuItem = {
  id: string;
  label: string;
  active: boolean;
  onSelect: () => void;
};

export type PanoVideoControlsProps = {
  appearance?: PanoVideoControlsAppearance;
};

function resolveControlsAppearance(
  appearance: PanoVideoControlsAppearance | undefined,
): Required<PanoVideoControlsAppearance> {
  return {
    ...DEFAULT_PANO_VIDEO_CONTROLS_APPEARANCE,
    ...appearance,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "BUTTON" ||
    target.isContentEditable
  );
}

function hasFinePointerHover(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}

function volumeFromClientY(clientY: number, track: HTMLElement): number {
  const rect = track.getBoundingClientRect();
  if (rect.height <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
}

const SPEAKER_PATH = "M3 9h4l5-4v14l-5-4H3z";
const VIDEO_ICON_PATHS = {
  play: "M7 4v16l13-8z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
  volume: `${SPEAKER_PATH} M14 9a3.5 3.5 0 0 1 0 6v-2.1a1.5 1.5 0 0 0 0-1.8zM16.8 6a7 7 0 0 1 0 12l-1-1.7a5 5 0 0 0 0-8.6z`,
  muted: `${SPEAKER_PATH} M15.4 8.7l2.6 2.6 2.6-2.6L22 10l-2.6 2.6 2.6 2.6-1.4 1.4-2.6-2.6-2.6 2.6-1.4-1.4 2.6-2.6-2.6-2.6z`,
  captions: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h16V6zM7 9h4v1.5H8v3h3V15H7a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5zm6.5 0h4v1.5h-3v3h3V15h-4a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5z",
  settings: "M10 2H14L14.5 4.6 15.7 5.1 17.7 3.5 20.5 6.3 18.9 8.3 19.4 9.5 22 10V14L19.4 14.5 18.9 15.7 20.5 17.7 17.7 20.5 15.7 18.9 14.5 19.4 14 22H10L9.5 19.4 8.3 18.9 6.3 20.5 3.5 17.7 5.1 15.7 4.6 14.5 2 14V10L4.6 9.5 5.1 8.3 3.5 6.3 6.3 3.5 8.3 5.1 9.5 4.6zM15.3 12a3.3 3.3 0 1 1-6.6 0 3.3 3.3 0 1 1 6.6 0z",
  vr: "M5 5h14a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-3.5a2 2 0 0 1-1.6-.8L12 14.7l-1.9 2.5a2 2 0 0 1-1.6.8H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3.5l2.3-3a1.5 1.5 0 0 1 2.4 0l2.3 3H19a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm2.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  enterFullscreen: "M3 3h7v2.5H5.5V10H3zM14 3h7v7h-2.5V5.5H14zM3 14h2.5v4.5H10V21H3zM18.5 14H21v7h-7v-2.5h4.5z",
  exitFullscreen: "M7.5 3H10v7H3V7.5h4.5zM14 3h2.5v4.5H21V10h-7zM3 14h7v7H7.5v-4.5H3zM14 14h7v2.5h-4.5V21H14z",
} as const;

function Icon({ name }: { name: keyof typeof VIDEO_ICON_PATHS }) {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      fillRule="evenodd"
      focusable="false"
      height="24"
      viewBox="0 0 24 24"
      width="24"
    >
      <path d={VIDEO_ICON_PATHS[name]} />
    </svg>
  );
}

function ChromeButton({
  appearance,
  children,
  className,
  disabled,
  id,
  label,
  onClick,
}: {
  appearance: Required<PanoVideoControlsAppearance>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={className ? `pano-video-chrome-button ${className}` : "pano-video-chrome-button"}
      disabled={disabled}
      id={id}
      onClick={onClick}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        event.stopPropagation();
      }}
      style={{
        color: appearance.color,
      }}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function ChromeMenu({
  appearance,
  id,
  labelledBy,
  items,
}: {
  appearance: Required<PanoVideoControlsAppearance>;
  id: string;
  labelledBy: string;
  items: readonly ChromeMenuItem[];
}) {
  return (
    <ChromeMenuSurface
      appearance={appearance}
      id={id}
      labelledBy={labelledBy}
      role="menu"
    >
      {items.map((item) => (
        <ChromeMenuRadioItem
          active={item.active}
          appearance={appearance}
          key={item.id}
          label={item.label}
          onClick={item.onSelect}
        />
      ))}
    </ChromeMenuSurface>
  );
}

function ChromeMenuSurface({
  appearance,
  children,
  id,
  labelledBy,
  role,
}: {
  appearance: Required<PanoVideoControlsAppearance>;
  children: ReactNode;
  id: string;
  labelledBy: string;
  role: "menu" | "dialog";
}) {
  return (
    <div
      aria-labelledby={labelledBy}
      className="pano-video-chrome-menu"
      id={id}
      role={role}
      style={{
        background: appearance.background,
        bottom: `calc(100% + ${CHROME_POPOVER_GAP}px)`,
        borderRadius: appearance.borderRadius,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
        pointerEvents: "auto",
      }}
    >
      {children}
    </div>
  );
}

function ChromeMenuRadioItem({
  active,
  appearance,
  label,
  onClick,
}: {
  active: boolean;
  appearance: Required<PanoVideoControlsAppearance>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-checked={active}
      className="pano-video-chrome-menu-item"
      onClick={onClick}
      role="menuitemradio"
      style={{
        background: active ? "rgba(255, 255, 255, 0.1)" : "transparent",
        border: "none",
        color: appearance.color,
        cursor: "pointer",
        fontSize: appearance.fontSize,
      }}
      type="button"
    >
      {label}
    </button>
  );
}

function ChromeMenuActionItem({
  appearance,
  label,
  onClick,
  secondary,
}: {
  appearance: Required<PanoVideoControlsAppearance>;
  label: string;
  onClick: () => void;
  secondary?: ReactNode;
}) {
  return (
    <button
      className="pano-video-chrome-menu-action"
      onClick={onClick}
      role="menuitem"
      style={{
        background: "transparent",
        border: "none",
        color: appearance.color,
        cursor: "pointer",
        fontSize: appearance.fontSize,
      }}
      type="button"
    >
      <span>{label}</span>
      {secondary}
    </button>
  );
}

function ChromeMenuSectionLabel({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="pano-video-chrome-menu-label">
      {children}
    </div>
  );
}

function ChromeMenuDivider() {
  return <div className="pano-video-chrome-menu-divider" />;
}

function CaptionsMenu({
  appearance,
  id,
  labelledBy,
  onOpenSettings,
  onSelectTrack,
  onSetCaptionAppearance,
  onShowTracks,
  panel,
  snapshot,
}: {
  appearance: Required<PanoVideoControlsAppearance>;
  id: string;
  labelledBy: string;
  onOpenSettings: () => void;
  onSelectTrack: (trackId: string | null) => void;
  onSetCaptionAppearance: (appearance: {
    background?: string;
    fontSize?: number;
  }) => void;
  onShowTracks: () => void;
  panel: CaptionsPanel;
  snapshot: ReturnType<PanoVideoController["getSnapshot"]>;
}) {
  const t = usePanoUiTranslation();
  return (
    <ChromeMenuSurface
      appearance={appearance}
      id={id}
      labelledBy={labelledBy}
      role="menu"
    >
      {panel === "tracks" ? (
        <>
          <div className="pano-video-chrome-menu-list">
            <ChromeMenuRadioItem
              active={snapshot.trackId === null}
              appearance={appearance}
              label={t("Off")}
              onClick={() => {
                onSelectTrack(null);
              }}
            />
            {snapshot.tracks.map((track) => {
              const trackItemId = panoVideoTrackId(track);
              return (
                <ChromeMenuRadioItem
                  active={snapshot.trackId === trackItemId}
                  appearance={appearance}
                  key={trackItemId}
                  label={track.label}
                  onClick={() => {
                    onSelectTrack(trackItemId);
                  }}
                />
              );
            })}
          </div>
          <ChromeMenuDivider />
          <ChromeMenuActionItem
            appearance={appearance}
            label={t("Settings")}
            onClick={onOpenSettings}
            secondary={<span aria-hidden>›</span>}
          />
        </>
      ) : (
        <>
          <ChromeMenuActionItem
            appearance={appearance}
            label={t("Back")}
            onClick={onShowTracks}
            secondary={<span aria-hidden>‹</span>}
          />
          <ChromeMenuDivider />
          <ChromeMenuSectionLabel>{t("Font size")}</ChromeMenuSectionLabel>
          {CAPTION_SIZE_OPTIONS.map((option) => (
            <ChromeMenuRadioItem
              active={Number(snapshot.captionAppearance.fontSize) === option.value}
              appearance={appearance}
              key={option.id}
              label={t(option.label)}
              onClick={() => {
                onSetCaptionAppearance({ fontSize: option.value });
              }}
            />
          ))}
          <ChromeMenuDivider />
          <ChromeMenuSectionLabel>{t("Background")}</ChromeMenuSectionLabel>
          {CAPTION_BACKGROUND_OPTIONS.map((option) => (
            <ChromeMenuRadioItem
              active={snapshot.captionAppearance.background === option.value}
              appearance={appearance}
              key={option.id}
              label={t(option.label)}
              onClick={() => {
                onSetCaptionAppearance({ background: option.value });
              }}
            />
          ))}
        </>
      )}
    </ChromeMenuSurface>
  );
}

function VerticalVolumeSlider({
  appearance,
  onVolume,
  volume,
}: {
  appearance: Required<PanoVideoControlsAppearance>;
  onVolume: (volume: number) => void;
  volume: number;
}) {
  const t = usePanoUiTranslation();
  const trackRef = useRef<HTMLDivElement>(null);

  const applyPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    onVolume(volumeFromClientY(event.clientY, track));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      event.preventDefault();
      onVolume(Math.min(1, volume + VOLUME_STEP));
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      event.preventDefault();
      onVolume(Math.max(0, volume - VOLUME_STEP));
    }
  };

  const percentLabel = formatVolumePercent(volume);

  return (
    <div
      className="pano-video-volume-popover"
      style={{
        background: "rgba(12, 12, 12, 0.92)",
        bottom: `calc(100% + ${CHROME_POPOVER_GAP}px)`,
        borderRadius: 14,
        boxShadow: "0 10px 28px rgba(0, 0, 0, 0.5)",
        minWidth: 44,
        padding: `${VOLUME_POP_PADDING_TOP}px ${VOLUME_POP_PADDING_X}px ${VOLUME_POP_PADDING_BOTTOM}px`,
        pointerEvents: "auto",
      }}
    >
      <span
        aria-hidden
        className="pano-video-volume-percent"
        style={{
          color: appearance.color,
          fontSize: VOLUME_POP_FONT_SIZE,
        }}
      >
        {percentLabel}
      </span>
      <div
        style={{
          paddingBottom: VOLUME_THUMB_SIZE / 2,
          paddingTop: VOLUME_THUMB_SIZE / 2,
        }}
      >
        <div
          aria-label={t("Volume")}
          aria-valuemax={1}
          aria-valuemin={0}
          aria-valuenow={volume}
          aria-valuetext={percentLabel}
          onKeyDown={handleKeyDown}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            applyPointer(event);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
              return;
            }
            event.stopPropagation();
            applyPointer(event);
          }}
          ref={trackRef}
          role="slider"
          className="pano-video-volume-track"
          style={{
            background: "rgba(255, 255, 255, 0.14)",
            borderRadius: 999,
            height: VOLUME_SLIDER_HEIGHT,
            width: VOLUME_TRACK_WIDTH,
          }}
          tabIndex={0}
        >
          <div
            style={{
              background: VOLUME_TRACK_GRADIENT,
              borderRadius: 999,
              bottom: 0,
              left: 0,
              pointerEvents: "none",
              position: "absolute",
              right: 0,
              top: `${(1 - volume) * 100}%`,
            }}
          />
          <div
            style={{
              background: appearance.color,
              borderRadius: "50%",
              boxShadow: `0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 10px ${appearance.accent}, 0 0 18px color-mix(in srgb, ${appearance.accent} 55%, transparent)`,
              height: VOLUME_THUMB_SIZE,
              left: "50%",
              pointerEvents: "none",
              position: "absolute",
              top: `${(1 - volume) * 100}%`,
              transform: "translate(-50%, -50%)",
              width: VOLUME_THUMB_SIZE,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function VolumeControl({
  appearance,
  muted,
  onOpenChange,
  onToggleMuted,
  onVolume,
  volume,
  volumeAdjustable,
}: {
  appearance: Required<PanoVideoControlsAppearance>;
  muted: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleMuted: () => void;
  onVolume: (volume: number) => void;
  volume: number;
  volumeAdjustable: boolean;
}) {
  const t = usePanoUiTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const displayVolume = muted ? 0 : volume;
  const mutedOrSilent = muted || volume === 0;
  const volumeIcon = mutedOrSilent ? "muted" : "volume";

  useEffect(() => {
    onOpenChange(open);
    return () => onOpenChange(false);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open || !volumeAdjustable || hasFinePointerHover()) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open, volumeAdjustable]);

  if (!volumeAdjustable) {
    return (
      <ChromeButton
        appearance={appearance}
        label={mutedOrSilent ? t("Unmute") : t("Mute")}
        onClick={onToggleMuted}
      >
        <Icon name={volumeIcon} />
      </ChromeButton>
    );
  }

  return (
    <div
      data-pano-video-volume=""
      className="pano-video-volume"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) {
          return;
        }
        if (hasFinePointerHover()) {
          setOpen(false);
        }
      }}
      onFocus={() => {
        setOpen(true);
      }}
      onPointerEnter={() => {
        if (hasFinePointerHover()) {
          setOpen(true);
        }
      }}
      onPointerLeave={() => {
        if (hasFinePointerHover()) {
          setOpen(false);
        }
      }}
      ref={rootRef}
    >
      {open ? (
        <VerticalVolumeSlider
          appearance={appearance}
          onVolume={onVolume}
          volume={displayVolume}
        />
      ) : null}
      <ChromeButton
        appearance={appearance}
        label={mutedOrSilent ? t("Unmute") : t("Mute")}
        onClick={() => {
          if (!hasFinePointerHover()) {
            setOpen(true);
          }
          onToggleMuted();
        }}
      >
        <Icon name={volumeIcon} />
      </ChromeButton>
    </div>
  );
}

export function PanoVideoControlsHud({
  appearance,
  buttons,
  controller,
  fullscreen,
  overlayElement,
  vrEntry,
}: {
  appearance?: PanoVideoControlsAppearance;
  buttons?: PanoVideoControlsOptions["buttons"];
  controller: PanoVideoController;
  fullscreen: PanoContextMenuActionsApi | null;
  overlayElement: HTMLDivElement;
  vrEntry?: { disabled: boolean; onEnter: () => void };
}) {
  const t = usePanoUiTranslation();
  const resolved = useMemo(
    () => resolveControlsAppearance(appearance),
    [appearance],
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [menu, setMenu] = useState<MenuId | null>(null);
  const [captionsPanel, setCaptionsPanel] = useState<CaptionsPanel>("tracks");
  const [visible, setVisible] = useState(true);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [overlayWidth, setOverlayWidth] = useState(
    () => overlayElement.clientWidth,
  );
  const idleTimerRef = useRef(0);
  const barId = useId();
  const rateMenuId = `${barId}-rate`;
  const variantMenuId = `${barId}-variant`;
  const captionsMenuId = `${barId}-captions`;
  const moreMenuId = `${barId}-more`;
  const compact = overlayWidth < COMPACT_CONTROLS_WIDTH;
  const hideTime = overlayWidth < NARROW_CONTROLS_WIDTH;
  const showFullscreen = buttons?.fullscreen !== false && fullscreen !== null && canEnterViewerFullscreen();
  const showVR = buttons?.vr !== false && vrEntry !== undefined;
  const stackSeek = showVR && overlayWidth < STACKED_VR_CONTROLS_WIDTH;

  const bumpVisibility = useCallback(
    (playing: boolean) => {
      setVisible(true);
      window.clearTimeout(idleTimerRef.current);
      if (!playing || menu || volumeOpen) {
        return;
      }
      idleTimerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, IDLE_HIDE_MS);
    },
    [menu, volumeOpen],
  );

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === "number") {
        setOverlayWidth(width);
      }
    });
    observer.observe(overlayElement);
    return () => {
      observer.disconnect();
    };
  }, [overlayElement]);

  useEffect(() => {
    bumpVisibility(snapshot.playing);
  }, [bumpVisibility, snapshot.playing]);

  useEffect(() => {
    const root = overlayElement.parentElement;
    if (!root) {
      return;
    }

    const handlePointerMove = () => {
      bumpVisibility(snapshot.playing);
    };
    const handlePointerLeave = () => {
      if (snapshot.playing && !menu && !volumeOpen) {
        setVisible(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (!root.contains(event.target as Node) && event.target !== document.body) {
        return;
      }
      event.preventDefault();
      controller.togglePlay();
      bumpVisibility(true);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (menu === null) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && overlayElement.contains(target)) {
        const menus = overlayElement.querySelectorAll('[role="menu"]');
        for (const node of menus) {
          if (node.contains(target)) {
            return;
          }
        }
        const toggles = overlayElement.querySelectorAll("[data-pano-video-menu]");
        for (const node of toggles) {
          if (node.contains(target)) {
            return;
          }
        }
      }
      setMenu(null);
    };

    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("pointerleave", handlePointerLeave);
    root.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerleave", handlePointerLeave);
      root.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [bumpVisibility, controller, menu, overlayElement, snapshot.playing, volumeOpen]);

  useEffect(
    () => () => {
      window.clearTimeout(idleTimerRef.current);
    },
    [],
  );

  const duration = snapshot.duration > 0 ? snapshot.duration : 0;
  const showBar = visible || !snapshot.playing || menu !== null || volumeOpen;
  const { hlsQuality, qualitySwitch } = snapshot;
  const explicitVariants = snapshot.variants.length > 1;
  const showRate = buttons?.playbackRate !== false;
  const showQuality = buttons?.quality !== false;
  const canSwitchVariant = showQuality && (explicitVariants ||
    (hlsQuality?.levels.length ?? 0) > 1 ||
    Boolean(hlsQuality && typeof hlsQuality.selectedLevel === "number"));
  const qualityLabel = videoQualityButtonLabel({
    variantId: snapshot.variantId,
    variants: snapshot.variants,
    hlsQuality,
    qualitySwitch,
  }, t);
  const switchLabel = qualitySwitch ? t(videoQualitySwitchStatus(qualitySwitch.state)) : undefined;
  const showCaptionsMenu = buttons?.captions !== false &&
    snapshot.captionsEnabled && snapshot.tracks.length > 0;
  const showMore = compact && (showRate || canSwitchVariant || showCaptionsMenu);
  const availableMenus = {
    rate: showRate,
    variant: canSwitchVariant,
    captions: showCaptionsMenu,
    more: showMore,
  };
  const activeMenu = menu && availableMenus[menu] ? menu : null;

  useEffect(() => {
    if (menu !== activeMenu) {
      setMenu(null);
      setCaptionsPanel("tracks");
    }
  }, [activeMenu, menu]);

  const closeMenu = () => {
    setMenu(null);
    setCaptionsPanel("tracks");
  };

  const toggleMenu = (id: MenuId) => {
    setMenu((current) => (current === id ? null : id));
    if (id === "captions") {
      setCaptionsPanel("tracks");
    }
    setVisible(true);
  };

  const rateLabelledBy = compact ? `${barId}-more-btn` : `${barId}-rate-btn`;
  const variantLabelledBy = compact
    ? `${barId}-more-btn`
    : `${barId}-variant-btn`;
  const captionsLabelledBy = compact
    ? `${barId}-more-btn`
    : `${barId}-captions-btn`;

  let menuNode: ReactNode = null;
  switch (activeMenu) {
    case "rate":
      menuNode = (
        <ChromeMenu
          appearance={resolved}
          id={rateMenuId}
          items={snapshot.playbackRates.map((rate) => ({
            id: String(rate),
            label: rate === 1 ? "1x" : `${rate}x`,
            active: snapshot.playbackRate === rate,
            onSelect: () => {
              controller.setPlaybackRate(rate);
              closeMenu();
            },
          }))}
          labelledBy={rateLabelledBy}
        />
      );
      break;
    case "variant": {
      const pendingTarget = qualitySwitch?.target;
      const pendingVariant = pendingTarget && "variantId" in pendingTarget ? pendingTarget.variantId : undefined;
      const items: ChromeMenuItem[] = explicitVariants
        ? snapshot.variants.map((variant) => ({
            id: variant.id,
            label: pendingVariant === variant.id && switchLabel
              ? `${variant.label} · ${switchLabel}`
              : variant.label,
            active: (pendingVariant ?? snapshot.variantId) === variant.id,
            onSelect: () => {
              controller.setVariantId(variant.id);
              closeMenu();
            },
          }))
        : hlsQualityMenuItems(
            hlsQuality ?? { levels: [], selectedLevel: "auto", activeLevel: null },
            qualitySwitch,
          ).map((item) => ({
            id: item.id,
            label: item.label,
            active: item.active,
            onSelect: () => {
              controller.setHlsLevel?.(item.id === "auto" ? "auto" : Number(item.id));
              closeMenu();
            },
          }));
      menuNode = (
        <ChromeMenu
          appearance={resolved}
          id={variantMenuId}
          items={items}
          labelledBy={variantLabelledBy}
        />
      );
      break;
    }
    case "captions":
      menuNode = (
        <CaptionsMenu
          appearance={resolved}
          id={captionsMenuId}
          labelledBy={captionsLabelledBy}
          onOpenSettings={() => {
            setCaptionsPanel("settings");
          }}
          onSelectTrack={(id) => {
            controller.setTrackId(id);
          }}
          onSetCaptionAppearance={(appearancePatch) => {
            controller.setCaptionAppearance(appearancePatch);
          }}
          onShowTracks={() => {
            setCaptionsPanel("tracks");
          }}
          panel={captionsPanel}
          snapshot={snapshot}
        />
      );
      break;
    case "more":
      menuNode = (
        <ChromeMenu
          appearance={resolved}
          id={moreMenuId}
          items={[
            ...(showRate ? [{
              id: "rate",
              label: t("Speed"),
              active: false,
              onSelect: () => {
                setMenu("rate");
              },
            }] : []),
            ...(canSwitchVariant
              ? [
                  {
                    id: "variant",
                    label: `${t("Quality")} · ${qualityLabel}`,
                    active: false,
                    onSelect: () => {
                      setMenu("variant");
                    },
                  },
                ]
              : []),
            ...(showCaptionsMenu
              ? [
                  {
                    id: "captions",
                    label: t("Captions"),
                    active: false,
                    onSelect: () => {
                      setMenu("captions");
                    },
                  },
                ]
              : []),
          ]}
          labelledBy={`${barId}-more-btn`}
        />
      );
      break;
    case null:
      menuNode = null;
      break;
    default: {
      const exhaustive: never = activeMenu;
      return exhaustive;
    }
  }

  const barStyle: CSSProperties = {
    alignItems: "center",
    background: resolved.background,
    borderRadius: resolved.borderRadius,
    bottom: 10,
    color: resolved.color,
    display: "flex",
    fontFamily: resolved.fontFamily,
    fontSize: resolved.fontSize,
    flexWrap: stackSeek ? "wrap" : undefined,
    left: 10,
    padding: resolved.padding,
    position: "absolute",
    right: 10,
    transition: "opacity 160ms ease",
    zIndex: 2,
  };

  const rateButton = showRate ? (
    <div className="pano-video-menu" data-pano-video-menu="rate">
      {!compact && menu === "rate" ? menuNode : null}
      <ChromeButton
        appearance={resolved}
        label={t("Playback speed")}
        onClick={() => {
          toggleMenu("rate");
        }}
      >
        <span className="pano-video-chrome-label" id={`${barId}-rate-btn`}>
          {snapshot.playbackRate === 1 ? "1x" : `${snapshot.playbackRate}x`}
        </span>
      </ChromeButton>
    </div>
  ) : null;

  const variantButton = canSwitchVariant ? (
    <div className="pano-video-menu" data-pano-video-menu="variant">
      {!compact && menu === "variant" ? menuNode : null}
      <ChromeButton
        appearance={resolved}
        label={switchLabel ? `${t("Resolution")}, ${qualityLabel}` : t("Resolution")}
        onClick={() => {
          toggleMenu("variant");
        }}
      >
        <span className="pano-video-chrome-label" id={`${barId}-variant-btn`}>
          {qualityLabel}
        </span>
      </ChromeButton>
    </div>
  ) : showQuality && hlsQuality && !compact ? (
    <span className="pano-video-chrome-label">{qualityLabel}</span>
  ) : null;

  const captionsButton = showCaptionsMenu ? (
    <div className="pano-video-menu" data-pano-video-menu="captions">
      {!compact && menu === "captions" ? menuNode : null}
      <ChromeButton
        appearance={resolved}
        id={`${barId}-captions-btn`}
        label={t("Captions")}
        onClick={() => {
          toggleMenu("captions");
        }}
      >
        <Icon name="captions" />
      </ChromeButton>
    </div>
  ) : null;

  const seek = (
    <input
      aria-label={t("Seek")}
      max={duration || 1}
      min={0}
      onChange={(event) => {
        controller.seek(Number(event.currentTarget.value));
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      step="any"
      style={{
        accentColor: resolved.accent,
        flex: stackSeek ? "1 0 100%" : 1,
        minWidth: hideTime ? 0 : 64,
      }}
      type="range"
      value={duration > 0 ? snapshot.currentTime : 0}
    />
  );

  return (
    <div
      aria-label={t("Video controls")}
      className="pano-video-controls"
      data-idle={showBar ? undefined : ""}
      data-pano-video-controls=""
      data-stacked-seek={stackSeek ? "" : undefined}
      data-vr-entry={showVR ? "" : undefined}
      role="group"
      style={barStyle}
    >
      {stackSeek ? seek : null}
      {buttons?.play !== false ? (
        <ChromeButton
          appearance={resolved}
          label={snapshot.playing ? t("Pause") : t("Play")}
          onClick={() => {
            controller.togglePlay();
          }}
        >
          <Icon name={snapshot.playing ? "pause" : "play"} />
        </ChromeButton>
      ) : null}
      {hideTime ? null : (
        <span className="pano-video-time">
          {formatMediaTime(snapshot.currentTime)}
        </span>
      )}
      {stackSeek ? null : seek}
      {hideTime ? null : (
        <span className="pano-video-time">
          {formatMediaTime(duration)}
        </span>
      )}
      {buttons?.volume === false || snapshot.hasAudio === false ? null : <VolumeControl
        appearance={resolved}
        muted={snapshot.muted}
        onOpenChange={setVolumeOpen}
        onToggleMuted={() => {
          controller.toggleMuted();
        }}
        onVolume={(nextVolume) => {
          controller.setVolume(nextVolume);
        }}
        volume={snapshot.volume}
        volumeAdjustable={snapshot.volumeAdjustable}
      />}
      {showMore ? (
        <div className="pano-video-menu" data-pano-video-menu="more">
          {menuNode}
          <ChromeButton
            appearance={resolved}
            id={`${barId}-more-btn`}
            label={t("More")}
            onClick={() => {
              toggleMenu("more");
            }}
          >
            <Icon name="settings" />
          </ChromeButton>
        </div>
      ) : !compact ? (
        <>
          {rateButton}
          {variantButton}
          {captionsButton}
        </>
      ) : null}
      {showVR ? (
        <ChromeButton
          appearance={resolved}
          className="pano-video-vr-button"
          disabled={vrEntry.disabled}
          label={t("Enter VR")}
          onClick={vrEntry.onEnter}
        >
          <Icon name="vr" />
        </ChromeButton>
      ) : null}
      {showFullscreen ? (
        <ChromeButton
          appearance={resolved}
          label={fullscreen?.isFullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
          onClick={() => {
            fullscreen?.toggleFullscreen();
          }}
        >
          <Icon name={fullscreen?.isFullscreen ? "exitFullscreen" : "enterFullscreen"} />
        </ChromeButton>
      ) : null}
    </div>
  );
}

/**
 * Claims the default playback chrome slot for a custom replacement.
 * Render inside PanoViewer when overriding the built-in controls.
 */
export function PanoVideoControls({ appearance }: PanoVideoControlsProps) {
  useClaimPanoVideoControls();
  const host = useContext(PanoVideoHostContext);
  if (host && appearance) {
    host.controls = appearance;
  }
  return null;
}
