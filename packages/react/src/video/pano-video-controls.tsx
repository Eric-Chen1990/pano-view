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
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
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

type MenuId = "rate" | "variant" | "captions";

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
  label,
  onClick,
}: {
  appearance: Required<PanoVideoControlsAppearance>;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
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
  items: readonly {
    id: string;
    label: string;
    active: boolean;
    onSelect: () => void;
  }[];
}) {
  return (
    <div
      aria-labelledby={labelledBy}
      id={id}
      role="menu"
      style={{
        background: appearance.background,
        borderRadius: appearance.borderRadius,
        bottom: "calc(100% + 6px)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
        display: "flex",
        flexDirection: "column",
        minWidth: 112,
        padding: 4,
        pointerEvents: "auto",
        position: "absolute",
        right: 0,
      }}
    >
      {items.map((item) => (
        <button
          aria-checked={item.active}
          key={item.id}
          onClick={item.onSelect}
          role="menuitemradio"
          style={{
            background: item.active ? "rgba(255, 255, 255, 0.1)" : "transparent",
            border: "none",
            borderRadius: 4,
            color: appearance.color,
            cursor: "pointer",
            fontSize: appearance.fontSize,
            padding: "6px 10px",
            textAlign: "left",
            whiteSpace: "nowrap",
          }}
          type="button"
        >
          {item.label}
        </button>
      ))}
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
  const [visible, setVisible] = useState(true);
  const idleTimerRef = useRef(0);
  const barId = useId();
  const rateMenuId = `${barId}-rate`;
  const variantMenuId = `${barId}-variant`;
  const captionsMenuId = `${barId}-captions`;

  const bumpVisibility = useCallback(
    (playing: boolean) => {
      setVisible(true);
      window.clearTimeout(idleTimerRef.current);
      if (!playing || menu) {
        return;
      }
      idleTimerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, IDLE_HIDE_MS);
    },
    [menu],
  );

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
      if (snapshot.playing && !menu) {
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
  }, [bumpVisibility, controller, menu, overlayElement, snapshot.playing]);

  useEffect(
    () => () => {
      window.clearTimeout(idleTimerRef.current);
    },
    [],
  );

  const duration = snapshot.duration > 0 ? snapshot.duration : 0;
  const showBar = visible || !snapshot.playing || menu !== null;
  const canSwitchVariant = snapshot.variants.length > 1;
  const showCaptionsMenu = snapshot.captionsEnabled && snapshot.tracks.length > 0;

  const closeMenu = () => {
    setMenu(null);
  };

  const toggleMenu = (id: MenuId) => {
    setMenu((current) => (current === id ? null : id));
    setVisible(true);
  };

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
          labelledBy={`${barId}-rate-btn`}
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
          labelledBy={`${barId}-variant-btn`}
        />
      );
      break;
    case "captions":
      menuNode = (
        <ChromeMenu
          appearance={resolved}
          id={captionsMenuId}
          items={[
            {
              id: "off",
              label: "Off",
              active: snapshot.trackId === null,
              onSelect: () => {
                controller.setTrackId(null);
                closeMenu();
              },
            },
            ...snapshot.tracks.map((track) => {
              const id = panoVideoTrackId(track);
              return {
                id,
                label: track.label,
                active: snapshot.trackId === id,
                onSelect: () => {
                  controller.setTrackId(id);
                  closeMenu();
                },
              };
            }),
          ]}
          labelledBy={`${barId}-captions-btn`}
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

  return (
    <div data-pano-video-controls="" style={barStyle}>
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
      <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 34, opacity: 0.85 }}>
        {formatMediaTime(snapshot.currentTime)}
      </span>
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
      <span style={{ minWidth: 34, opacity: 0.85 }}>
        {formatMediaTime(duration)}
      </span>
      <ChromeButton
        appearance={resolved}
        label={snapshot.muted || snapshot.volume === 0 ? "Unmute" : "Mute"}
        onClick={() => {
          controller.toggleMuted();
        }}
      >
        {snapshot.muted || snapshot.volume === 0 ? (
          <Icon path="M3 6.5h2.2L8.5 4v8L5.2 9.5H3zM10.2 6.2l3.2 3.6M13.4 6.2l-3.2 3.6" />
        ) : (
          <Icon path="M3 6.5h2.2L8.5 4v8L5.2 9.5H3zM10.5 5.5a3 3 0 0 1 0 5" />
        )}
      </ChromeButton>
      <input
        aria-label="Volume"
        max={1}
        min={0}
        onChange={(event) => {
          controller.setVolume(Number(event.currentTarget.value));
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        step={0.05}
        style={{
          accentColor: resolved.accent,
          width: 72,
        }}
        type="range"
        value={snapshot.muted ? 0 : snapshot.volume}
      />
      <div data-pano-video-menu="rate" style={{ position: "relative" }}>
        {menu === "rate" ? menuNode : null}
        <ChromeButton
          appearance={resolved}
          label="Playback speed"
          onClick={() => {
            toggleMenu("rate");
          }}
        >
          <span id={`${barId}-rate-btn`} style={{ fontSize: 11, padding: "0 2px" }}>
            {snapshot.playbackRate === 1 ? "1x" : `${snapshot.playbackRate}x`}
          </span>
        </ChromeButton>
      </div>
      {canSwitchVariant ? (
        <div data-pano-video-menu="variant" style={{ position: "relative" }}>
          {menu === "variant" ? menuNode : null}
          <ChromeButton
            appearance={resolved}
            label="Resolution"
            onClick={() => {
              toggleMenu("variant");
            }}
          >
            <span id={`${barId}-variant-btn`} style={{ fontSize: 11, padding: "0 2px" }}>
              {snapshot.variants.find((variant) => variant.id === snapshot.variantId)
                ?.label ?? "Quality"}
            </span>
          </ChromeButton>
        </div>
      ) : null}
      {showCaptionsMenu ? (
        <div data-pano-video-menu="captions" style={{ position: "relative" }}>
          {menu === "captions" ? menuNode : null}
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
      ) : null}
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
