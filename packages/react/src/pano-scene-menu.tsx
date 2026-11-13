import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { cn } from "./cn";
import { useVisitedSceneIds } from "./scenes-host";
import {
  constrainDragPosition,
  integrateAxis,
  pushSample,
  resolveDragMotion,
  velocityFromSamples,
  type PanoDragMotion,
  type PointerSample,
} from "./drag-motion";
import {
  cssLength,
  overlayBoxStyle,
  overlayChevron,
  resolveOverlayAnchor,
  type PanoOverlayAnchor,
} from "./overlay/align";
import {
  resolveOverlayToggleIcon,
  type PanoOverlayToggle,
} from "./overlay/toggle";

export type { PanoDragMotion };

export type PanoSceneMenuItem = {
  id: string;
  thumbnailUrl: string;
  title?: string;
};

export type PanoSceneMenuLabelAlign = "start" | "center" | "end";

export type PanoSceneMenuAppearance = {
  background?: string;
  padding?: number | string;
  itemWidth?: number;
  itemHeight?: number;
  gap?: number | string;
  borderRadius?: number | string;
  selectionColor?: string;
  /** Hover and keyboard-focus border color. Defaults to `"#7dd3fc"`. */
  focusColor?: string;
  /** Shared active/hover/focus border width in pixels. Defaults to 2. */
  selectionWidth?: number;
  labelBackground?: string;
  labelColor?: string;
  /** Scene title alignment on the thumbnail. Defaults to `"start"`. */
  labelAlign?: PanoSceneMenuLabelAlign;
  fontSize?: number | string;
  controlColor?: string;
  controlBackground?: string;
};

export type PanoSceneMenuProps = {
  items: readonly PanoSceneMenuItem[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Show an icon for scenes successfully displayed by this viewer. Defaults to false. */
  showVisited?: boolean;
  /** Accessible description for visited scenes; never rendered as visible text. */
  visitedLabel?: string;
  /**
   * Screen anchor. Defaults to bottom, centered on that edge, with a 12px inset.
   * Corner `axis` chooses a horizontal or vertical strip.
   */
  anchor?: PanoOverlayAnchor;
  /** Menu width. Numbers are pixels; strings may be `%`, `rem`, etc. */
  width?: number | string;
  /** Menu height. Numbers are pixels; strings may be `%`, `rem`, etc. */
  height?: number | string;
  /**
   * When `false` (default), the menu stays expanded.
   * When `true`, a toggle shows or hides the scene list.
   */
  collapsible?: boolean;
  /** Uncontrolled expanded state when `collapsible` is true. Defaults to `true`. */
  defaultExpanded?: boolean;
  /** Controlled expanded state when `collapsible` is true. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Show previous/next controls at both ends of the list. Defaults to `false`. */
  showArrows?: boolean;
  /**
   * When `true`, previous/next arrows and arrow keys wrap from the last item
   * to the first and vice versa. Defaults to `false` (stop at the ends).
   */
  loop?: boolean;
  /**
   * Scroll drag inertia and edge bounce.
   * Omit for both on (custom pointer scrolling). Set `false` for native overflow scroll.
   */
  dragMotion?: PanoDragMotion | false;
  appearance?: PanoSceneMenuAppearance;
  className?: string;
  style?: CSSProperties;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
  /** Edge-tab icon and chrome. Omit to keep the default chevron. */
  toggle?: PanoOverlayToggle;
};

/** Scroll-axis travel that turns a press into a drag. Below this, release selects. */
const SCENE_MENU_DRAG_THRESHOLD_PX = 10;

export const DEFAULT_PANO_SCENE_MENU_APPEARANCE: Required<PanoSceneMenuAppearance> =
  {
    background: "rgba(16, 16, 16, 0.72)",
    padding: "8px 10px",
    itemWidth: 128,
    itemHeight: 80,
    gap: 8,
    borderRadius: 8,
    selectionColor: "#ffffff",
    focusColor: "#7dd3fc",
    selectionWidth: 2,
    labelBackground: "rgba(0, 0, 0, 0.55)",
    labelColor: "#ffffff",
    labelAlign: "start",
    fontSize: 12,
    controlColor: "#ffffff",
    controlBackground: "rgba(255, 255, 255, 0.12)",
  };

const DEFAULT_INSET = 12;

function resolveAppearance(
  appearance: PanoSceneMenuAppearance | undefined,
): Required<PanoSceneMenuAppearance> {
  return {
    ...DEFAULT_PANO_SCENE_MENU_APPEARANCE,
    ...appearance,
  };
}

function itemLabel(item: PanoSceneMenuItem): string {
  return item.title?.trim() || item.id;
}

type ChevronArrow = "up" | "down" | "left" | "right";

const CHEVRON_PATHS: Record<ChevronArrow, string> = {
  // Keep glyphs optically centered in the 16×16 viewBox.
  up: "M3 11l5-6 5 6",
  down: "M3 5l5 6 5-6",
  left: "M11 3 5 8l6 5",
  right: "M5 3l6 5-6 5",
};

function arrowChevron(
  direction: "prev" | "next",
  orientation: "horizontal" | "vertical",
): ChevronArrow {
  if (direction === "prev") {
    return orientation === "horizontal" ? "left" : "up";
  }
  return orientation === "horizontal" ? "right" : "down";
}

function Chevron({ arrow }: { arrow: ChevronArrow }) {
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
      <path d={CHEVRON_PATHS[arrow]} />
    </svg>
  );
}

function ControlButton({
  className,
  disabled,
  label,
  onClick,
  style,
  children,
}: {
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn("pano-scene-menu-control", className)}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      style={style}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

export function PanoSceneMenu({
  items,
  activeId = null,
  onSelect,
  showVisited = false,
  visitedLabel = "Visited",
  anchor,
  width,
  height,
  collapsible = false,
  defaultExpanded = true,
  expanded: expandedProp,
  onExpandedChange,
  showArrows = false,
  loop = false,
  dragMotion: dragMotionProp,
  appearance,
  className,
  style,
  label = "Scenes",
  previousLabel = "Previous scene",
  nextLabel = "Next scene",
  expandLabel = "Show scenes",
  collapseLabel = "Hide scenes",
  toggle,
}: PanoSceneMenuProps) {
  const visitedSceneIds = useVisitedSceneIds(showVisited);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const resolved = resolveAppearance(appearance);
  const resolvedAnchor = resolveOverlayAnchor(anchor, {
    align: "bottom",
    inset: DEFAULT_INSET,
  });
  const horizontal = resolvedAnchor.axis === "horizontal";
  const customDrag = dragMotionProp !== false;
  const dragMotion = resolveDragMotion(
    dragMotionProp === false ? false : dragMotionProp,
  );
  const isExpandedControlled = expandedProp !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = collapsible
    ? isExpandedControlled
      ? expandedProp
      : internalExpanded
    : true;
  const [offset, setOffset] = useState(0);
  const [viewportSize, setViewportSize] = useState(0);
  const [contentSize, setContentSize] = useState(0);
  const offsetRef = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    origin: number;
    startOffset: number;
    samples: PointerSample[];
    moved: boolean;
    pressItemId: string | null;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef(0);
  const animRef = useRef<{
    raf: number | null;
    lastTime: number;
    position: number;
    velocity: number;
  } | null>(null);
  const maxOffset = Math.max(0, contentSize - viewportSize);

  offsetRef.current = offset;

  const applyOffset = (value: number | ((previous: number) => number)) => {
    const next = typeof value === "function" ? value(offsetRef.current) : value;
    // Publish before the next render so a pointerup in this same turn does not
    // restart inertia from the pre-drag offset and discard the gesture.
    offsetRef.current = next;
    setOffset(next);
  };

  const activeIndex = useMemo(() => {
    if (activeId == null) {
      return -1;
    }
    return items.findIndex((item) => item.id === activeId);
  }, [activeId, items]);

  const cancelScrollAnimation = useCallback(() => {
    const anim = animRef.current;
    if (anim?.raf != null) {
      cancelAnimationFrame(anim.raf);
    }
    animRef.current = null;
  }, []);

  const clampOffset = useCallback(
    (value: number) => Math.min(maxOffset, Math.max(0, value)),
    [maxOffset],
  );

  const startScrollAnimation = useCallback(
    (velocity: number) => {
      cancelScrollAnimation();
      const current = offsetRef.current;
      const needsSpring =
        dragMotion.bounce && (current < 0 || current > maxOffset);
      const nextVelocity = dragMotion.inertia ? velocity : 0;
      if (!needsSpring && Math.abs(nextVelocity) < 1) {
        applyOffset(clampOffset(current));
        return;
      }
      if (!dragMotion.inertia && !dragMotion.bounce) {
        applyOffset(clampOffset(current));
        return;
      }
      const anim = {
        raf: null as number | null,
        lastTime: performance.now(),
        position: current,
        velocity: nextVelocity,
      };
      animRef.current = anim;
      const tick = (now: number) => {
        if (animRef.current !== anim) return;
        const dt = Math.min(0.064, Math.max(0, (now - anim.lastTime) / 1000));
        anim.lastTime = now;
        const next = integrateAxis(
          { position: anim.position, velocity: anim.velocity },
          dt,
          {
            min: 0,
            max: maxOffset,
            inertia: dragMotion.inertia,
            bounce: dragMotion.bounce,
          },
        );
        anim.position = next.position;
        anim.velocity = next.velocity;
        applyOffset(next.position);
        if (next.settled) {
          applyOffset(clampOffset(next.position));
          animRef.current = null;
          return;
        }
        anim.raf = requestAnimationFrame(tick);
      };
      anim.raf = requestAnimationFrame(tick);
    },
    [
      cancelScrollAnimation,
      clampOffset,
      dragMotion.bounce,
      dragMotion.inertia,
      maxOffset,
    ],
  );

  useEffect(
    () => () => {
      cancelScrollAnimation();
      window.clearTimeout(suppressClickTimerRef.current);
    },
    [cancelScrollAnimation],
  );

  useLayoutEffect(() => {
    if (!customDrag || !expanded) return;
    const list = listRef.current;
    const track = trackRef.current;
    if (!list || !track) return;
    const measure = () => {
      const nextViewport = horizontal ? list.clientWidth : list.clientHeight;
      const nextContent = horizontal ? track.scrollWidth : track.scrollHeight;
      setViewportSize((previous) =>
        previous === nextViewport ? previous : nextViewport,
      );
      setContentSize((previous) =>
        previous === nextContent ? previous : nextContent,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(track);
    return () => observer.disconnect();
  }, [customDrag, expanded, horizontal, items]);

  useEffect(() => {
    if (!customDrag) return;
    // Do not fight an active drag or coast/spring animation.
    if (dragRef.current || animRef.current) return;
    applyOffset((previous) => Math.min(maxOffset, Math.max(0, previous)));
  }, [customDrag, maxOffset]);

  useEffect(() => {
    if (!expanded || activeId == null) {
      return;
    }
    const node = itemRefs.current.get(activeId);
    if (!node) return;
    if (!customDrag) {
      node.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      return;
    }
    const list = listRef.current;
    if (!list) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = node.getBoundingClientRect();
    // itemRect is already transformed; convert to content coordinates via offset.
    if (horizontal) {
      const itemStart = itemRect.left - listRect.left + offsetRef.current;
      const itemEnd = itemStart + itemRect.width;
      let next = offsetRef.current;
      if (itemStart < next) next = itemStart;
      else if (itemEnd > next + listRect.width) next = itemEnd - listRect.width;
      cancelScrollAnimation();
      applyOffset(clampOffset(next));
      return;
    }
    const itemStart = itemRect.top - listRect.top + offsetRef.current;
    const itemEnd = itemStart + itemRect.height;
    let next = offsetRef.current;
    if (itemStart < next) next = itemStart;
    else if (itemEnd > next + listRect.height) next = itemEnd - listRect.height;
    cancelScrollAnimation();
    applyOffset(clampOffset(next));
  }, [
    activeId,
    cancelScrollAnimation,
    clampOffset,
    customDrag,
    expanded,
    horizontal,
  ]);

  const rootStyle = useMemo((): CSSProperties => {
    const vars: CSSProperties & Record<`--pano-scene-menu-${string}`, string> = {
      "--pano-scene-menu-background": resolved.background,
      "--pano-scene-menu-padding": cssLength(resolved.padding),
      "--pano-scene-menu-item-width": cssLength(resolved.itemWidth),
      "--pano-scene-menu-item-height": cssLength(resolved.itemHeight),
      "--pano-scene-menu-gap": cssLength(resolved.gap),
      "--pano-scene-menu-radius": cssLength(resolved.borderRadius),
      "--pano-scene-menu-selection-color": resolved.selectionColor,
      "--pano-scene-menu-focus-color": resolved.focusColor,
      "--pano-scene-menu-selection-width": cssLength(resolved.selectionWidth),
      "--pano-scene-menu-label-background": resolved.labelBackground,
      "--pano-scene-menu-label-color": resolved.labelColor,
      "--pano-scene-menu-label-align": resolved.labelAlign,
      "--pano-scene-menu-font-size": cssLength(resolved.fontSize),
      "--pano-scene-menu-control-color": resolved.controlColor,
      "--pano-scene-menu-control-background": resolved.controlBackground,
    };
    return {
      ...vars,
      ["--pano-overlay-dock-inset" as string]: resolvedAnchor.dockInset,
      ...overlayBoxStyle(resolvedAnchor.align, resolvedAnchor.inset, width, height),
      ...style,
    };
  }, [height, resolved, resolvedAnchor, style, width]);

  const setExpanded = (next: boolean) => {
    if (!collapsible) {
      return;
    }
    if (!isExpandedControlled) {
      setInternalExpanded(next);
    }
    onExpandedChange?.(next);
  };

  const selectAt = (index: number) => {
    const item = items[index];
    if (!item) {
      return;
    }
    onSelect?.(item.id);
    itemRefs.current.get(item.id)?.focus({ preventScroll: true });
  };

  const selectRelative = (delta: number) => {
    if (items.length === 0) {
      return;
    }
    const current = activeIndex >= 0 ? activeIndex : 0;
    if (loop) {
      const next =
        ((current + delta) % items.length + items.length) % items.length;
      selectAt(next);
      return;
    }
    selectAt(Math.max(0, Math.min(items.length - 1, current + delta)));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0 || !expanded) {
      return;
    }
    const current =
      activeIndex >= 0
        ? activeIndex
        : Math.max(
            0,
            items.findIndex(
              (item) => itemRefs.current.get(item.id) === event.target,
            ),
          );
    const backward = horizontal
      ? event.key === "ArrowLeft"
      : event.key === "ArrowUp";
    const forward = horizontal
      ? event.key === "ArrowRight"
      : event.key === "ArrowDown";
    if (backward) {
      event.preventDefault();
      if (loop) {
        selectAt((current - 1 + items.length) % items.length);
      } else {
        selectAt(Math.max(0, current - 1));
      }
      return;
    }
    if (forward) {
      event.preventDefault();
      if (loop) {
        selectAt((current + 1) % items.length);
      } else {
        selectAt(Math.min(items.length - 1, current + 1));
      }
      return;
    }
    switch (event.key) {
      case "Home": {
        event.preventDefault();
        selectAt(0);
        break;
      }
      case "End": {
        event.preventDefault();
        selectAt(items.length - 1);
        break;
      }
      default:
        break;
    }
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    if (!customDrag) {
      if (horizontal) {
        const canScroll = list.scrollWidth > list.clientWidth + 1;
        if (!canScroll || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        list.scrollLeft += event.deltaY;
        return;
      }
      const canScroll = list.scrollHeight > list.clientHeight + 1;
      if (!canScroll || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      list.scrollTop += event.deltaX;
      return;
    }

    if (horizontal) {
      if (maxOffset <= 0 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      cancelScrollAnimation();
      applyOffset((previous) => clampOffset(previous + event.deltaY));
      return;
    }
    if (maxOffset <= 0 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    cancelScrollAnimation();
    applyOffset((previous) => clampOffset(previous + event.deltaX));
  };

  const axisPoint = (event: { clientX: number; clientY: number }) =>
    horizontal ? event.clientX : event.clientY;

  const armClickSuppression = () => {
    // The trailing click is dispatched in this task, after pointerup. A
    // microtask can run before that click and drop the guard too early.
    suppressClickRef.current = true;
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const beginListDrag = (
    event: ReactPointerEvent<Element>,
    captureTarget: HTMLElement,
    pressItemId: string | null,
  ) => {
    if (!customDrag || event.button !== 0) return;
    cancelScrollAnimation();
    const now = performance.now();
    const origin = axisPoint(event);
    dragRef.current = {
      pointerId: event.pointerId,
      origin,
      startOffset: offsetRef.current,
      samples: [{ t: now, position: offsetRef.current }],
      moved: false,
      pressItemId,
    };
    try {
      captureTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic or already-released pointers may reject capture.
    }
  };

  const onListPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = axisPoint(event);
    const delta = point - drag.origin;
    // A strip that already fits has nothing to scroll. Keep the press a tap
    // so edge bounce cannot swallow the scene change.
    if (
      !drag.moved &&
      maxOffset > 0 &&
      Math.abs(delta) >= SCENE_MENU_DRAG_THRESHOLD_PX
    ) {
      drag.moved = true;
      armClickSuppression();
    }
    if (!drag.moved) return;
    // Content follows the finger: drag right/down decreases offset.
    const raw = drag.startOffset - delta;
    const now = performance.now();
    drag.samples = pushSample(drag.samples, { t: now, position: raw });
    applyOffset(
      constrainDragPosition(
        raw,
        0,
        maxOffset,
        Math.max(1, viewportSize),
        dragMotion.bounce,
      ),
    );
    event.preventDefault();
  };

  const finishPointerWithClickGuard = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved;
    const pressItemId = drag.pressItemId;
    dragRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore release failures for synthetic pointers.
    }
    const travel = Math.abs(offsetRef.current - drag.startOffset);
    const dragged = moved && travel >= SCENE_MENU_DRAG_THRESHOLD_PX;
    if (event.type === "pointercancel") {
      if (moved) {
        armClickSuppression();
        applyOffset(clampOffset(drag.startOffset));
      }
      return;
    }
    if (dragged) {
      armClickSuppression();
      startScrollAnimation(velocityFromSamples(drag.samples));
      return;
    }
    if (moved) {
      applyOffset(clampOffset(drag.startOffset));
    }
    if (!pressItemId) return;
    // Capture retargets pointerup to the list, so the button click often
    // never reaches the thumbnail. Select the pressed item on release.
    armClickSuppression();
    onSelect?.(pressItemId);
    // Keep the pressed thumbnail in the tab sequence without the keyboard ring.
    // Script focus otherwise matches :focus-visible and stacks a square outline
    // on the rounded selection border until the next click elsewhere.
    itemRefs.current.get(pressItemId)?.focus({
      preventScroll: true,
      focusVisible: false,
    } as FocusOptions);
  };

  const onItemClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onSelect?.(id);
  };

  const canStep = items.length > 1;
  const canGoPrevious =
    canStep && (loop || activeIndex !== 0);
  const canGoNext =
    canStep && (loop || activeIndex !== items.length - 1);
  const orientation = horizontal ? "horizontal" : "vertical";
  const trackStyle: CSSProperties | undefined = customDrag
    ? {
        transform: horizontal
          ? `translate3d(${-offset}px, 0, 0)`
          : `translate3d(0, ${-offset}px, 0)`,
        willChange: "transform",
      }
    : undefined;

  return (
    <div
      aria-label={label}
      className={cn("pano-overlay-anchor", "pano-scene-menu", className)}
      data-align={resolvedAnchor.contentAlign}
      data-collapse-edge={resolvedAnchor.collapseEdge}
      data-collapsed={collapsible && !expanded ? "true" : "false"}
      data-collapsible={collapsible ? "true" : undefined}
      data-drag-motion={customDrag ? "custom" : "native"}
      data-orientation={orientation}
      role="group"
      style={rootStyle}
    >
      <div
        aria-hidden={expanded ? undefined : true}
        className="pano-scene-menu-body"
        {...(!expanded ? ({ inert: true } as { inert: boolean }) : null)}
      >
        {showArrows ? (
          <ControlButton
            className="pano-scene-menu-arrow"
            disabled={!canGoPrevious || !expanded}
            label={previousLabel}
            onClick={() => selectRelative(-1)}
          >
            <Chevron arrow={arrowChevron("prev", orientation)} />
          </ControlButton>
        ) : null}
        <div
          aria-label={label}
          className="pano-scene-menu-list"
          id={listId}
          onKeyDown={onKeyDown}
          onPointerCancel={
            customDrag ? finishPointerWithClickGuard : undefined
          }
          onPointerDown={
            customDrag
              ? (event) => beginListDrag(event, event.currentTarget, null)
              : undefined
          }
          onPointerMove={customDrag ? onListPointerMove : undefined}
          onPointerUp={customDrag ? finishPointerWithClickGuard : undefined}
          onWheel={onWheel}
          ref={listRef}
          role="radiogroup"
        >
          <div
            className="pano-scene-menu-track"
            ref={trackRef}
            style={trackStyle}
          >
            {items.map((item) => {
              const name = itemLabel(item);
              const selected = item.id === activeId;
              const visited = visitedSceneIds.has(item.id);
              return (
                <button
                  aria-checked={selected}
                  aria-description={visited ? visitedLabel : undefined}
                  className="pano-scene-menu-item"
                  data-active={selected ? "true" : undefined}
                  data-visited={visited ? "true" : undefined}
                  key={item.id}
                  onClick={(event) => onItemClick(event, item.id)}
                  onMouseDown={
                    customDrag
                      ? (event) => {
                          if (event.button === 0) {
                            // Focus would scroll the untransformed layout box
                            // and slide the thumbnail out from under the pointer.
                            event.preventDefault();
                          }
                        }
                      : undefined
                  }
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    const list = listRef.current;
                    if (customDrag && list) {
                      beginListDrag(event, list, item.id);
                    }
                  }}
                  ref={(node) => {
                    if (node) {
                      itemRefs.current.set(item.id, node);
                    } else {
                      itemRefs.current.delete(item.id);
                    }
                  }}
                  role="radio"
                  tabIndex={
                    selected || (activeId == null && item === items[0])
                      ? 0
                      : -1
                  }
                  title={name}
                  type="button"
                >
                  <span className="pano-scene-menu-thumb">
                    <img
                      alt=""
                      decoding="async"
                      draggable={false}
                      src={item.thumbnailUrl}
                    />
                    <span className="pano-scene-menu-label">{name}</span>
                    {visited ? (
                      <svg
                        aria-hidden="true"
                        className="pano-scene-menu-visited"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="12" fill="rgba(0, 0, 0, 0.78)" />
                        <path
                          d="m6.5 12 3.5 3.5 7.5-7.5"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {showArrows ? (
          <ControlButton
            className="pano-scene-menu-arrow"
            disabled={!canGoNext || !expanded}
            label={nextLabel}
            onClick={() => selectRelative(1)}
          >
            <Chevron arrow={arrowChevron("next", orientation)} />
          </ControlButton>
        ) : null}
      </div>
      {collapsible ? (
        <ControlButton
          className={cn(
            "pano-scene-menu-toggle pano-overlay-anchor-toggle",
            toggle?.className,
          )}
          label={expanded ? collapseLabel : expandLabel}
          onClick={() => setExpanded(!expanded)}
          style={toggle?.style}
        >
          {toggle?.icon === undefined ? (
            <Chevron
              arrow={overlayChevron(resolvedAnchor.collapseEdge, !expanded)}
            />
          ) : (
            resolveOverlayToggleIcon(toggle.icon, !expanded)
          )}
        </ControlButton>
      ) : null}
    </div>
  );
}
