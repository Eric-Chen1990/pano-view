import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
} from "react";
import type { PanoramaPointerEvent } from "./hotspot/types";
import { PanoEventBusContext } from "./pano-event-bus";
import { PanoramaViewContext } from "./panorama-view-runtime";
import type { PanoViewerState } from "./types";

const DEFAULT_ICON_SIZE = 16;
const MENU_EDGE_PADDING = 8;

/** Lowest allowed `appearance.opacity` (background only). */
export const MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY = 0.4;

export type PanoContextMenuSelectContext = {
  position: PanoramaPointerEvent["position"];
  view: PanoViewerState;
  nativeEvent: MouseEvent | PointerEvent;
  close: () => void;
};

export type PanoContextMenuActionItem = {
  type?: "item";
  id: string;
  label: string;
  /** React icon node (inline SVG, icon library component, emoji, etc.). */
  icon?: ReactNode;
  /** Image URL; ignored when `icon` is set. */
  image?: string;
  imageAlt?: string;
  disabled?: boolean;
  hidden?: boolean;
  className?: string;
  style?: CSSProperties;
  onSelect: (context: PanoContextMenuSelectContext) => void;
};

export type PanoContextMenuSeparatorItem = {
  type: "separator";
  id?: string;
  className?: string;
  style?: CSSProperties;
};

export type PanoContextMenuItem =
  | PanoContextMenuActionItem
  | PanoContextMenuSeparatorItem;

/** Built-in menu entries hosts can reuse without reimplementing behavior. */
export type PanoContextMenuPresetId =
  | "resetView"
  | "fullscreen"
  | "separator";

/**
 * Reference a built-in preset, optionally overriding presentation fields.
 * Action wiring (reset / fullscreen toggle and enter/exit label) stays built-in.
 */
export type PanoContextMenuPresetRef = {
  preset: PanoContextMenuPresetId;
  id?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  hidden?: boolean;
};

/** A custom action item, a preset id string, or a preset ref with overrides. */
export type PanoContextMenuEntry =
  | PanoContextMenuActionItem
  | PanoContextMenuPresetId
  | PanoContextMenuPresetRef;

export type PanoContextMenuAppearance = {
  background?: string;
  color?: string;
  border?: string;
  borderRadius?: number | string;
  shadow?: string;
  /**
   * Background-only opacity from {@link MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY}
   * to 1. Defaults to 1. Text and icons stay fully opaque.
   */
  opacity?: number;
  fontSize?: number | string;
  minWidth?: number | string;
  padding?: number | string;
  iconSize?: number;
  itemPadding?: string;
  itemHoverBackground?: string;
  itemDisabledColor?: string;
  separatorColor?: string;
  separatorMargin?: string;
};

export type PanoContextMenuRenderProps = {
  event: PanoramaPointerEvent;
  view: PanoViewerState;
  close: () => void;
};

export type PanoContextMenuProps = {
  /**
   * Menu entries. May mix concrete items with built-in presets
   * (`"resetView"`, `"fullscreen"`, `"separator"`). When omitted, the
   * default Reset view / Fullscreen list is used (see also `prepend` /
   * `append`).
   */
  items?: readonly PanoContextMenuEntry[];
  /**
   * Entries placed before the default menu when `items` is omitted.
   * Ignored when `items` is provided.
   */
  prepend?: readonly PanoContextMenuEntry[];
  /**
   * Entries placed after the default menu when `items` is omitted.
   * Ignored when `items` is provided.
   */
  append?: readonly PanoContextMenuEntry[];
  appearance?: PanoContextMenuAppearance;
  className?: string;
  style?: CSSProperties;
  itemClassName?: string;
  separatorClassName?: string;
  /**
   * Fully custom menu content. When provided, takes precedence over `items`.
   * Opening, closing, and positioning remain handled by PanoContextMenu.
   */
  children?: (props: PanoContextMenuRenderProps) => ReactNode;
};

type ContextMenuSession = {
  key: string;
  event: PanoramaPointerEvent;
  view: PanoViewerState;
  render: () => ReactNode;
};

type ContextMenuOverlayApi = {
  setSession: (session: ContextMenuSession | null) => void;
  overlayRef: { current: HTMLDivElement | null };
};

export const PanoContextMenuOverlayContext =
  createContext<ContextMenuOverlayApi | null>(null);

const DEFAULT_APPEARANCE: Required<
  Pick<
    PanoContextMenuAppearance,
    | "background"
    | "color"
    | "border"
    | "borderRadius"
    | "shadow"
    | "opacity"
    | "fontSize"
    | "minWidth"
    | "padding"
    | "iconSize"
    | "itemPadding"
    | "itemHoverBackground"
    | "itemDisabledColor"
    | "separatorColor"
    | "separatorMargin"
  >
> = {
  background: "#161616",
  color: "#f4f4f4",
  border: "1px solid #2e2e2e",
  borderRadius: 8,
  shadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
  opacity: 1,
  fontSize: 13,
  minWidth: 180,
  padding: 4,
  iconSize: DEFAULT_ICON_SIZE,
  itemPadding: "6px 10px",
  itemHoverBackground: "#2a2a2a",
  itemDisabledColor: "#777777",
  separatorColor: "#333333",
  separatorMargin: "4px 6px",
};

function clampBackgroundOpacity(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_APPEARANCE.opacity;
  }
  return Math.min(
    1,
    Math.max(MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY, value!),
  );
}

function isActionItem(
  item: PanoContextMenuItem,
): item is PanoContextMenuActionItem {
  return item.type !== "separator";
}

function DefaultContextMenuPanel({
  items,
  appearance,
  className,
  style,
  itemClassName,
  separatorClassName,
  selectContext,
  onRequestClose,
}: {
  items: readonly PanoContextMenuItem[];
  appearance?: PanoContextMenuAppearance;
  className?: string;
  style?: CSSProperties;
  itemClassName?: string;
  separatorClassName?: string;
  selectContext: PanoContextMenuSelectContext;
  onRequestClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const resolved = { ...DEFAULT_APPEARANCE, ...appearance };
  const iconSize = Number.isFinite(resolved.iconSize)
    ? Math.max(0, resolved.iconSize!)
    : DEFAULT_ICON_SIZE;

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (!isActionItem(item)) {
          return true;
        }
        return !item.hidden;
      }),
    [items],
  );

  const focusableIndices = useMemo(() => {
    const indices: number[] = [];
    visibleItems.forEach((item, index) => {
      if (isActionItem(item) && !item.disabled) {
        indices.push(index);
      }
    });
    return indices;
  }, [visibleItems]);

  useEffect(() => {
    const first = focusableIndices[0];
    setActiveIndex(first ?? 0);
    const frame = requestAnimationFrame(() => {
      const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      );
      buttons?.[0]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusableIndices]);

  const activateItem = useCallback(
    (item: PanoContextMenuActionItem) => {
      if (item.disabled) {
        return;
      }
      item.onSelect(selectContext);
      onRequestClose();
    },
    [onRequestClose, selectContext],
  );

  const moveFocus = (direction: 1 | -1) => {
    if (focusableIndices.length === 0) {
      return;
    }
    const currentSlot = focusableIndices.indexOf(activeIndex);
    const nextSlot =
      currentSlot === -1
        ? 0
        : (currentSlot + direction + focusableIndices.length) %
          focusableIndices.length;
    const nextIndex = focusableIndices[nextSlot]!;
    setActiveIndex(nextIndex);
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]',
    );
    buttons?.[nextIndex]?.focus();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "Home": {
        event.preventDefault();
        const first = focusableIndices[0];
        if (first !== undefined) {
          setActiveIndex(first);
          const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]',
          );
          buttons?.[first]?.focus();
        }
        break;
      }
      case "End": {
        event.preventDefault();
        const last = focusableIndices[focusableIndices.length - 1];
        if (last !== undefined) {
          setActiveIndex(last);
          const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]',
          );
          buttons?.[last]?.focus();
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        onRequestClose();
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const item = visibleItems[activeIndex];
        if (item && isActionItem(item)) {
          activateItem(item);
        }
        break;
      }
      default: {
        break;
      }
    }
  };

  const backgroundOpacity = clampBackgroundOpacity(resolved.opacity);
  const panelStyle: CSSProperties = {
    color: resolved.color,
    border: resolved.border,
    borderRadius: resolved.borderRadius,
    boxShadow: resolved.shadow,
    fontSize: resolved.fontSize,
    minWidth: resolved.minWidth,
    padding: resolved.padding,
    pointerEvents: "auto",
    position: "relative",
    userSelect: "none",
    ...style,
  };

  return (
    <div
      ref={menuRef}
      aria-label="Panorama context menu"
      className={className}
      onKeyDown={handleKeyDown}
      role="menu"
      style={panelStyle}
      tabIndex={-1}
    >
      <div
        aria-hidden
        style={{
          background: resolved.background,
          borderRadius: resolved.borderRadius,
          inset: 0,
          opacity: backgroundOpacity,
          pointerEvents: "none",
          position: "absolute",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
      {visibleItems.map((item, index) => {
        if (!isActionItem(item)) {
          return (
            <div
              aria-hidden
              className={[separatorClassName, item.className]
                .filter(Boolean)
                .join(" ") || undefined}
              key={item.id ?? `separator-${index}`}
              role="separator"
              style={{
                background: resolved.separatorColor,
                height: 1,
                margin: resolved.separatorMargin,
                ...item.style,
              }}
            />
          );
        }

        const disabled = item.disabled === true;
        const iconNode = item.icon ?? (
          item.image ? (
            <img
              alt={item.imageAlt ?? ""}
              draggable={false}
              src={item.image}
              style={{
                display: "block",
                height: iconSize,
                objectFit: "contain",
                width: iconSize,
              }}
            />
          ) : null
        );

        return (
          <button
            aria-disabled={disabled || undefined}
            className={[itemClassName, item.className]
              .filter(Boolean)
              .join(" ") || undefined}
            disabled={disabled}
            key={item.id}
            onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
              event.preventDefault();
              event.stopPropagation();
              activateItem(item);
            }}
            onMouseEnter={(event) => {
              if (!disabled) {
                setActiveIndex(index);
                event.currentTarget.focus();
              }
            }}
            role="menuitem"
            style={{
              alignItems: "center",
              background:
                !disabled && activeIndex === index
                  ? resolved.itemHoverBackground
                  : "transparent",
              border: "none",
              borderRadius: 4,
              color: disabled ? resolved.itemDisabledColor : "inherit",
              cursor: disabled ? "default" : "pointer",
              display: "flex",
              font: "inherit",
              gap: 8,
              padding: resolved.itemPadding,
              textAlign: "left",
              width: "100%",
              ...item.style,
            }}
            tabIndex={disabled ? -1 : activeIndex === index ? 0 : -1}
            type="button"
          >
            <span
              aria-hidden
              style={{
                alignItems: "center",
                display: "inline-flex",
                flexShrink: 0,
                height: iconSize,
                justifyContent: "center",
                width: iconSize,
              }}
            >
              {iconNode}
            </span>
            <span style={{ flex: 1 }}>{item.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function PositionedMenuShell({
  clientX,
  clientY,
  overlayElement,
  children,
}: {
  clientX: number;
  clientY: number;
  overlayElement: HTMLDivElement | null;
  children: ReactNode;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!overlayElement || !shell) {
      return;
    }

    const overlayRect = overlayElement.getBoundingClientRect();
    const menuRect = shell.getBoundingClientRect();
    const rawLeft = clientX - overlayRect.left;
    const rawTop = clientY - overlayRect.top;
    const maxLeft = Math.max(
      MENU_EDGE_PADDING,
      overlayRect.width - menuRect.width - MENU_EDGE_PADDING,
    );
    const maxTop = Math.max(
      MENU_EDGE_PADDING,
      overlayRect.height - menuRect.height - MENU_EDGE_PADDING,
    );

    setOffset({
      left: Math.min(Math.max(rawLeft, MENU_EDGE_PADDING), maxLeft),
      top: Math.min(Math.max(rawTop, MENU_EDGE_PADDING), maxTop),
    });
  }, [clientX, clientY, overlayElement, children]);

  return (
    <div
      ref={shellRef}
      style={{
        left: offset.left,
        position: "absolute",
        top: offset.top,
        zIndex: 20,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Creates a shared context-menu overlay API for PanoViewer. Provide `api`
 * inside the Canvas (R3F does not inherit outer React context) and render
 * `overlay` as a DOM sibling of the Canvas.
 */
export function usePanoContextMenuOverlay(): {
  api: ContextMenuOverlayApi;
  overlay: ReactElement;
} {
  const [session, setSession] = useState<ContextMenuSession | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(
    null,
  );
  const api = useMemo<ContextMenuOverlayApi>(
    () => ({ setSession, overlayRef }),
    [],
  );

  const setOverlayNode = useCallback((node: HTMLDivElement | null) => {
    overlayRef.current = node;
    setOverlayElement(node);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const overlay = overlayRef.current;
      if (!overlay) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && overlay.contains(target)) {
        const menuRoot = overlay.querySelector(
          '[role="menu"], [data-pano-context-menu]',
        );
        if (menuRoot && menuRoot.contains(target)) {
          return;
        }
      }
      setSession(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSession(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [session]);

  const overlay = (
    <div
      ref={setOverlayNode}
      aria-hidden={session ? undefined : true}
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        zIndex: 20,
      }}
    >
      {session ? (
        <PositionedMenuShell
          clientX={session.event.clientX}
          clientY={session.event.clientY}
          key={session.key}
          overlayElement={overlayElement}
        >
          {session.render()}
        </PositionedMenuShell>
      ) : null}
    </div>
  );

  return { api, overlay };
}

/**
 * Custom panorama context menu. Must render inside PanoViewer. Prefer
 * PanoViewer's `contextMenu` prop for the default menu; use this component
 * when replacing the default instance (`contextMenu={false}`).
 */
export function PanoContextMenu({
  items,
  prepend,
  append,
  appearance,
  className,
  style,
  itemClassName,
  separatorClassName,
  children,
}: PanoContextMenuProps): null {
  const eventBus = useContext(PanoEventBusContext);
  const controlsRef = useContext(PanoramaViewContext);
  const overlayApi = useContext(PanoContextMenuOverlayContext);
  const actions = useContext(PanoContextMenuActionsContext);
  const instanceId = useId();
  const sessionKeyRef = useRef(0);
  const propsRef = useRef({
    items,
    prepend,
    append,
    appearance,
    className,
    style,
    itemClassName,
    separatorClassName,
    children,
  });
  propsRef.current = {
    items,
    prepend,
    append,
    appearance,
    className,
    style,
    itemClassName,
    separatorClassName,
    children,
  };

  if (!eventBus || !controlsRef) {
    throw new Error("<PanoContextMenu> must be rendered inside <PanoViewer>.");
  }
  if (!overlayApi) {
    throw new Error(
      "<PanoContextMenu> requires the PanoViewer context-menu overlay host.",
    );
  }

  const close = useCallback(() => {
    overlayApi.setSession(null);
  }, [overlayApi]);

  const openMenu = useCallback(
    (event: PanoramaPointerEvent) => {
      event.nativeEvent.preventDefault();
      const view = controlsRef.current?.getView() ?? {
        yaw: 0,
        pitch: 0,
        fov: 75,
      };
      const selectContext: PanoContextMenuSelectContext = {
        position: event.position,
        view,
        nativeEvent: event.nativeEvent,
        close,
      };
      const current = propsRef.current;
      sessionKeyRef.current += 1;
      const key = `${instanceId}-${sessionKeyRef.current}`;

      const hasCustomChildren = typeof current.children === "function";
      const presets = actions
        ? createPanoContextMenuPresets(actions)
        : null;
      const resolvedItems = presets
        ? composePanoContextMenuItems(current, presets)
        : current.items?.filter(isActionEntry) ?? [];

      if (!hasCustomChildren && resolvedItems.length === 0) {
        return;
      }

      overlayApi.setSession({
        key,
        event,
        view,
        render: () => {
          if (hasCustomChildren && current.children) {
            return (
              <div data-pano-context-menu style={{ pointerEvents: "auto" }}>
                {current.children({ event, view, close })}
              </div>
            );
          }
          return (
            <DefaultContextMenuPanel
              appearance={current.appearance}
              className={current.className}
              itemClassName={current.itemClassName}
              items={resolvedItems}
              onRequestClose={close}
              selectContext={selectContext}
              separatorClassName={current.separatorClassName}
              style={current.style}
            />
          );
        },
      });
    },
    [actions, close, controlsRef, instanceId, overlayApi],
  );

  useEffect(() => {
    const unsubscribeContextMenu = eventBus.subscribe(
      "contextmenu",
      openMenu,
    );
    const unsubscribeInteraction = eventBus.subscribe(
      "viewinteractionstart",
      () => {
        close();
      },
    );
    return () => {
      unsubscribeContextMenu();
      unsubscribeInteraction();
      close();
    };
  }, [close, eventBus, openMenu]);

  return null;
}

function ResetViewIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="100%"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 16 16"
      width="100%"
    >
      <path d="M3.5 6.5A4.5 4.5 0 1 1 4 10" />
      <path d="M3.5 3.5v3h3" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="100%"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 16 16"
      width="100%"
    >
      <path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="100%"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 16 16"
      width="100%"
    >
      <path d="M6 3v3H3M10 3v3h3M3 10h3v3M10 10h3v3" />
    </svg>
  );
}

export type PanoContextMenuPresetActions = {
  reset: () => void;
  toggleFullscreen: () => void;
  /** When true, the fullscreen preset shows Exit fullscreen. */
  isFullscreen?: boolean;
};

export type PanoContextMenuPresets = {
  resetView: PanoContextMenuActionItem;
  fullscreen: PanoContextMenuActionItem;
  separator: (id?: string) => PanoContextMenuSeparatorItem;
  /** Default menu: Reset view, separator, Enter/Exit fullscreen. */
  defaults: PanoContextMenuItem[];
};

/**
 * Builds reusable built-in context-menu items. Prefer preset id strings
 * (`"resetView"`, `"fullscreen"`) in `items` / `append` / `prepend` when
 * configuring `PanoViewer`; use this helper when assembling items manually.
 */
export function createPanoContextMenuPresets(
  actions: PanoContextMenuPresetActions,
): PanoContextMenuPresets {
  const isFullscreen = actions.isFullscreen === true;
  const resetView: PanoContextMenuActionItem = {
    id: "pano-reset-view",
    label: "Reset view",
    icon: <ResetViewIcon />,
    onSelect: () => {
      actions.reset();
    },
  };
  const fullscreen: PanoContextMenuActionItem = {
    id: "pano-fullscreen",
    label: isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
    icon: isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />,
    onSelect: () => {
      actions.toggleFullscreen();
    },
  };
  const separator = (id = "pano-separator"): PanoContextMenuSeparatorItem => ({
    type: "separator",
    id,
  });

  return {
    resetView,
    fullscreen,
    separator,
    defaults: [resetView, separator("pano-default-separator"), fullscreen],
  };
}

/** Alias for `createPanoContextMenuPresets(actions).defaults`. */
export function createDefaultPanoContextMenuItems(
  actions: PanoContextMenuPresetActions,
): PanoContextMenuItem[] {
  return createPanoContextMenuPresets(actions).defaults;
}

function isPresetId(value: unknown): value is PanoContextMenuPresetId {
  return (
    value === "resetView" || value === "fullscreen" || value === "separator"
  );
}

function isPresetRef(value: unknown): value is PanoContextMenuPresetRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "preset" in value &&
    isPresetId((value as PanoContextMenuPresetRef).preset)
  );
}

function isActionEntry(
  value: PanoContextMenuEntry,
): value is PanoContextMenuActionItem {
  if (typeof value === "string") {
    return false;
  }
  if (isPresetRef(value)) {
    return false;
  }
  return true;
}

function applyPresetOverrides(
  item: PanoContextMenuItem,
  overrides: Omit<PanoContextMenuPresetRef, "preset">,
): PanoContextMenuItem {
  if (item.type === "separator") {
    return {
      ...item,
      id: overrides.id ?? item.id,
      className: overrides.className ?? item.className,
      style: overrides.style ?? item.style,
    };
  }
  return {
    ...item,
    id: overrides.id ?? item.id,
    label: overrides.label ?? item.label,
    className: overrides.className ?? item.className,
    style: overrides.style ?? item.style,
    disabled: overrides.disabled ?? item.disabled,
    hidden: overrides.hidden ?? item.hidden,
  };
}

function resolvePresetEntry(
  entry: PanoContextMenuPresetId | PanoContextMenuPresetRef,
  presets: PanoContextMenuPresets,
): PanoContextMenuItem {
  const presetId = typeof entry === "string" ? entry : entry.preset;
  const overrides: Omit<PanoContextMenuPresetRef, "preset"> =
    typeof entry === "string" ? {} : entry;
  switch (presetId) {
    case "resetView":
      return applyPresetOverrides(presets.resetView, overrides);
    case "fullscreen":
      return applyPresetOverrides(presets.fullscreen, overrides);
    case "separator":
      return applyPresetOverrides(
        presets.separator(overrides.id ?? "pano-separator"),
        overrides,
      );
    default: {
      const _exhaustive: never = presetId;
      return _exhaustive;
    }
  }
}

/**
 * Expands preset ids / refs into concrete menu items using the given presets.
 */
export function resolvePanoContextMenuEntries(
  entries: readonly PanoContextMenuEntry[],
  presets: PanoContextMenuPresets,
): PanoContextMenuItem[] {
  const resolved: PanoContextMenuItem[] = [];
  for (const entry of entries) {
    if (isActionEntry(entry)) {
      resolved.push(entry);
      continue;
    }
    resolved.push(resolvePresetEntry(entry, presets));
  }
  return resolved;
}

/**
 * Resolves `items`, or `prepend` + defaults + `append` when `items` is omitted.
 */
export function composePanoContextMenuItems(
  props: Pick<PanoContextMenuProps, "items" | "prepend" | "append">,
  presets: PanoContextMenuPresets,
): PanoContextMenuItem[] {
  if (props.items) {
    return resolvePanoContextMenuEntries(props.items, presets);
  }
  return [
    ...resolvePanoContextMenuEntries(props.prepend ?? [], presets),
    ...presets.defaults,
    ...resolvePanoContextMenuEntries(props.append ?? [], presets),
  ];
}

export type PanoContextMenuActionsApi = PanoContextMenuPresetActions;

export const PanoContextMenuActionsContext =
  createContext<PanoContextMenuActionsApi | null>(null);
