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
import { isFullscreenEnabled } from "../fullscreen";
import { type PanoContextMenuActionsApi } from "../pano-context-menu";
import { formatMediaTime, panoVideoTrackId } from "./format";
import {
  PanoVideoHostContext,
  useClaimPanoVideoControls,
} from "./host";
import type {
  PanoVideoController,
  PanoVideoControlsAppearance,
} from "./types";

export const DEFAULT_PANO_VIDEO_CONTROLS_APPEARANCE: Required<PanoVideoControlsAppearance> =
  {
    background: "rgba(16, 16, 16, 0.88)",
    color: "#f4f4f4",
    accent: "#75cbd3",
    borderRadius: 8,
    fontSize: 12,
    padding: "8px 10px",
  };

const IDLE_HIDE_MS = 2_500;
const COMPACT_CONTROLS_WIDTH = 560;
const NARROW_CONTROLS_WIDTH = 420;
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

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 16 16"
      width="16"
    >
      <path d={path} />
    </svg>
  );
}

function ChromeButton({
  appearance,
  children,
  disabled,
  id,
  label,
  onClick,
}: {
  appearance: Required<PanoVideoControlsAppearance>;
  children: ReactNode;
  disabled?: boolean;
  id?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex min-h-7 min-w-7 items-center justify-center rounded"
      disabled={disabled}
      id={id}
      onClick={onClick}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        event.stopPropagation();
      }}
      style={{
        alignItems: "center",
        background: "transparent",
        border: "none",
        borderRadius: 4,
        color: appearance.color,
        cursor: disabled ? "default" : "pointer",
        display: "inline-flex",
        height: 28,
        justifyContent: "center",
        minWidth: 28,
        opacity: disabled ? 0.45 : 1,
        padding: 4,
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
      className="absolute right-0 flex min-w-28 flex-col p-1"
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
      className="rounded px-2.5 py-1.5 text-left whitespace-nowrap"
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
      className="flex items-center justify-between gap-3 rounded px-2.5 py-1.5 text-left whitespace-nowrap"
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
    <div
      className="px-2.5 pt-2 pb-1 uppercase opacity-70"
      style={{ fontSize: 10, letterSpacing: "0.08em" }}
    >
      {children}
    </div>
  );
}

function ChromeMenuDivider() {
  return <div className="my-1 h-px bg-white/10" />;
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
  return (
    <ChromeMenuSurface
      appearance={appearance}
      id={id}
      labelledBy={labelledBy}
      role="menu"
    >
      {panel === "tracks" ? (
        <>
          <div className="flex max-h-48 flex-col overflow-y-auto">
            <ChromeMenuRadioItem
              active={snapshot.trackId === null}
              appearance={appearance}
              label="Off"
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
            label="Settings"
            onClick={onOpenSettings}
            secondary={<span aria-hidden>›</span>}
          />
        </>
      ) : (
        <>
          <ChromeMenuActionItem
            appearance={appearance}
            label="Back"
            onClick={onShowTracks}
            secondary={<span aria-hidden>‹</span>}
          />
          <ChromeMenuDivider />
          <ChromeMenuSectionLabel>Font size</ChromeMenuSectionLabel>
          {CAPTION_SIZE_OPTIONS.map((option) => (
            <ChromeMenuRadioItem
              active={Number(snapshot.captionAppearance.fontSize) === option.value}
              appearance={appearance}
              key={option.id}
              label={option.label}
              onClick={() => {
                onSetCaptionAppearance({ fontSize: option.value });
              }}
            />
          ))}
          <ChromeMenuDivider />
          <ChromeMenuSectionLabel>Background</ChromeMenuSectionLabel>
          {CAPTION_BACKGROUND_OPTIONS.map((option) => (
            <ChromeMenuRadioItem
              active={snapshot.captionAppearance.background === option.value}
              appearance={appearance}
              key={option.id}
              label={option.label}
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
      className="absolute left-1/2 flex min-w-11 -translate-x-1/2 flex-col items-center rounded-[14px]"
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
        className="mb-3.5 font-bold leading-none [font-variant-numeric:tabular-nums]"
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
          aria-label="Volume"
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
          className="relative cursor-pointer rounded-[999px]"
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const displayVolume = muted ? 0 : volume;
  const mutedOrSilent = muted || volume === 0;

  useEffect(() => {
    onOpenChange(open);
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
        label={mutedOrSilent ? "Unmute" : "Mute"}
        onClick={onToggleMuted}
      >
        {mutedOrSilent ? (
          <Icon path="M3 6.5h2.2L8.5 4v8L5.2 9.5H3zM10.2 6.2l3.2 3.6M13.4 6.2l-3.2 3.6" />
        ) : (
          <Icon path="M3 6.5h2.2L8.5 4v8L5.2 9.5H3zM10.5 5.5a3 3 0 0 1 0 5" />
        )}
      </ChromeButton>
    );
  }

  return (
    <div
      data-pano-video-volume=""
      className="relative"
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
        label={mutedOrSilent ? "Unmute" : "Mute"}
        onClick={() => {
          if (!hasFinePointerHover()) {
            setOpen(true);
          }
          onToggleMuted();
        }}
      >
        {mutedOrSilent ? (
          <Icon path="M3 6.5h2.2L8.5 4v8L5.2 9.5H3zM10.2 6.2l3.2 3.6M13.4 6.2l-3.2 3.6" />
        ) : (
          <Icon path="M3 6.5h2.2L8.5 4v8L5.2 9.5H3zM10.5 5.5a3 3 0 0 1 0 5" />
        )}
      </ChromeButton>
    </div>
  );
}

export function PanoVideoControlsHud({
  appearance,
  controller,
  fullscreen,
  overlayElement,
}: {
  appearance?: PanoVideoControlsAppearance;
  controller: PanoVideoController;
  fullscreen: PanoContextMenuActionsApi | null;
  overlayElement: HTMLDivElement;
}) {
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
  const showFullscreen = isFullscreenEnabled();

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
    if (!compact && menu === "more") {
      setMenu(null);
    }
  }, [compact, menu]);

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
  const canSwitchVariant = snapshot.variants.length > 1;
  const showCaptionsMenu = snapshot.captionsEnabled && snapshot.tracks.length > 0;

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
  switch (menu) {
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
    case "variant":
      menuNode = (
        <ChromeMenu
          appearance={resolved}
          id={variantMenuId}
          items={snapshot.variants.map((variant) => ({
            id: variant.id,
            label: variant.label,
            active: snapshot.variantId === variant.id,
            onSelect: () => {
              controller.setVariantId(variant.id);
              closeMenu();
            },
          }))}
          labelledBy={variantLabelledBy}
        />
      );
      break;
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
            {
              id: "rate",
              label: "Speed",
              active: false,
              onSelect: () => {
                setMenu("rate");
              },
            },
            ...(canSwitchVariant
              ? [
                  {
                    id: "variant",
                    label: "Quality",
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
                    label: "Captions",
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
      const exhaustive: never = menu;
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
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: resolved.fontSize,
    gap: 8,
    left: 10,
    opacity: showBar ? 1 : 0,
    padding: resolved.padding,
    pointerEvents: showBar ? "auto" : "none",
    position: "absolute",
    right: 10,
    transition: "opacity 160ms ease",
    zIndex: 2,
  };

  const rateButton = (
    <div className="relative" data-pano-video-menu="rate">
      {!compact && menu === "rate" ? menuNode : null}
      <ChromeButton
        appearance={resolved}
        label="Playback speed"
        onClick={() => {
          toggleMenu("rate");
        }}
      >
        <span className="px-0.5 text-[11px]" id={`${barId}-rate-btn`}>
          {snapshot.playbackRate === 1 ? "1x" : `${snapshot.playbackRate}x`}
        </span>
      </ChromeButton>
    </div>
  );

  const variantButton = canSwitchVariant ? (
    <div className="relative" data-pano-video-menu="variant">
      {!compact && menu === "variant" ? menuNode : null}
      <ChromeButton
        appearance={resolved}
        label="Resolution"
        onClick={() => {
          toggleMenu("variant");
        }}
      >
        <span className="px-0.5 text-[11px]" id={`${barId}-variant-btn`}>
          {snapshot.variants.find((variant) => variant.id === snapshot.variantId)
            ?.label ?? "Quality"}
        </span>
      </ChromeButton>
    </div>
  ) : null;

  const captionsButton = showCaptionsMenu ? (
    <div className="relative" data-pano-video-menu="captions">
      {!compact && menu === "captions" ? menuNode : null}
      <ChromeButton
        appearance={resolved}
        label="Captions"
        onClick={() => {
          toggleMenu("captions");
        }}
      >
        <span id={`${barId}-captions-btn`}>
          <Icon path="M2.5 4.5h11v7h-11zM5 7.2h2.4M5 9.2h5.5" />
        </span>
      </ChromeButton>
    </div>
  ) : null;

  return (
    <div
      className="absolute right-2.5 bottom-2.5 left-2.5 z-2 flex items-center gap-2 transition-opacity"
      data-pano-video-controls=""
      style={barStyle}
    >
      <ChromeButton
        appearance={resolved}
        label={snapshot.playing ? "Pause" : "Play"}
        onClick={() => {
          controller.togglePlay();
        }}
      >
        {snapshot.playing ? (
          <Icon path="M5 3.5h2.2v9H5zM8.8 3.5H11v9H8.8z" />
        ) : (
          <Icon path="M5 3.2v9.6L13 8z" />
        )}
      </ChromeButton>
      {hideTime ? null : (
        <span className="min-w-8.5 opacity-[0.85] [font-variant-numeric:tabular-nums]">
          {formatMediaTime(snapshot.currentTime)}
        </span>
      )}
      <input
        aria-label="Seek"
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
          flex: 1,
          minWidth: 64,
        }}
        type="range"
        value={duration > 0 ? snapshot.currentTime : 0}
      />
      {hideTime ? null : (
        <span className="min-w-8.5 opacity-[0.85]">
          {formatMediaTime(duration)}
        </span>
      )}
      <VolumeControl
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
      />
      {compact ? (
        <div className="relative" data-pano-video-menu="more">
          {menu !== null ? menuNode : null}
          <ChromeButton
            appearance={resolved}
            id={`${barId}-more-btn`}
            label="More"
            onClick={() => {
              toggleMenu("more");
            }}
          >
            <Icon path="M3 8a1 1 0 1 0 2 0 1 1 0 1 0-2 0M7 8a1 1 0 1 0 2 0 1 1 0 1 0-2 0M11 8a1 1 0 1 0 2 0 1 1 0 1 0-2 0" />
          </ChromeButton>
        </div>
      ) : (
        <>
          {rateButton}
          {variantButton}
          {captionsButton}
        </>
      )}
      {showFullscreen ? (
        <ChromeButton
          appearance={resolved}
          label={fullscreen?.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={() => {
            fullscreen?.toggleFullscreen();
          }}
        >
          {fullscreen?.isFullscreen ? (
            <Icon path="M6 3.5H3.5V6M10 3.5h2.5V6M6 12.5H3.5V10M10 12.5h2.5V10" />
          ) : (
            <Icon path="M3.5 6V3.5H6M10 3.5h2.5V6M3.5 10v2.5H6M10 12.5h2.5V10" />
          )}
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
