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
import {
  constrainDragPosition,
  integrateAxis,
  pushSample,
  resolveDragMotion,
  velocityFromSamples,
  type PanoDragMotion,
  type PointerSample,
} from "./drag-motion";

export type { PanoDragMotion };

export type PanoSceneMenuItem = {
  id: string;
  thumbnailUrl: string;
  title?: string;
};

export type PanoSceneMenuPlacement = "top" | "bottom" | "left" | "right";

export type PanoSceneMenuInset =
  | number
  | string
  | {
      top?: number | string;
      right?: number | string;
      bottom?: number | string;
      left?: number | string;
    };

export type PanoSceneMenuAppearance = {
  background?: string;
  padding?: number | string;
  itemWidth?: number;
  itemHeight?: number;
  gap?: number | string;
  borderRadius?: number | string;
  selectionColor?: string;
  selectionWidth?: number;
  labelBackground?: string;
  labelColor?: string;
  fontSize?: number | string;
  controlColor?: string;
  controlBackground?: string;
};

export type PanoSceneMenuProps = {
  items: readonly PanoSceneMenuItem[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Dock edge inside the viewer overlay. Defaults to `"bottom"`. */
  placement?: PanoSceneMenuPlacement;
  /**
   * Gap from the viewer edges. A single value applies to every side;
   * an object sets each side. Numbers are pixels. Defaults to `12`.
   */
  inset?: PanoSceneMenuInset;
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
};

const SCENE_MENU_DRAG_THRESHOLD_PX = 6;

export const DEFAULT_PANO_SCENE_MENU_APPEARANCE: Required<PanoSceneMenuAppearance> =
  {
    background: "rgba(16, 16, 16, 0.72)",
    padding: "8px 10px",
    itemWidth: 128,
    itemHeight: 80,
    gap: 8,
    borderRadius: 8,
    selectionColor: "#ffffff",
    selectionWidth: 2,
    labelBackground: "rgba(0, 0, 0, 0.55)",
    labelColor: "#ffffff",
    fontSize: 12,
    controlColor: "#ffffff",
    controlBackground: "rgba(255, 255, 255, 0.12)",
  };

const DEFAULT_INSET = 12;

function cssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

function resolveAppearance(
  appearance: PanoSceneMenuAppearance | undefined,
): Required<PanoSceneMenuAppearance> {
  return {
    ...DEFAULT_PANO_SCENE_MENU_APPEARANCE,
    ...appearance,
  };
}

function resolveInset(inset: PanoSceneMenuInset | undefined): {
  top: string;
  right: string;
  bottom: string;
  left: string;
} {
  if (inset === undefined) {
    const value = cssLength(DEFAULT_INSET);
    return { top: value, right: value, bottom: value, left: value };
  }
  if (typeof inset === "number" || typeof inset === "string") {
    const value = cssLength(inset);
    return { top: value, right: value, bottom: value, left: value };
  }
  return {
    top: cssLength(inset.top ?? DEFAULT_INSET),
    right: cssLength(inset.right ?? DEFAULT_INSET),
    bottom: cssLength(inset.bottom ?? DEFAULT_INSET),
    left: cssLength(inset.left ?? DEFAULT_INSET),
  };
}

function itemLabel(item: PanoSceneMenuItem): string {
  return item.title?.trim() || item.id;
}

function isHorizontal(placement: PanoSceneMenuPlacement): boolean {
  return placement === "top" || placement === "bottom";
}

function Chevron({
  direction,
  orientation,
}: {
  direction: "prev" | "next" | "expand" | "collapse";
  orientation: "horizontal" | "vertical";
}) {
  const path = (() => {
    switch (direction) {
      case "prev":
        return orientation === "horizontal" ? "M10 3 4 8l6 5" : "M3 10l5-6 5 6";
      case "next":
        return orientation === "horizontal" ? "M6 3l6 5-6 5" : "M3 6l5 6 5-6";
      case "expand":
        return orientation === "horizontal" ? "M3 6l5 6 5-6" : "M6 3l6 5-6 5";
      case "collapse":
        return orientation === "horizontal" ? "M3 10l5-6 5 6" : "M10 3 4 8l6 5";
      default: {
        const exhaustive: never = direction;
        void exhaustive;
        return "";
      }
    }
  })();
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

function ControlButton({
  className,
  disabled,
  label,
  onClick,
  children,
}: {
  className?: string;
  disabled?: boolean;
  label: string;
  onClick: () => void;
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
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function placementBoxStyle(
  placement: PanoSceneMenuPlacement,
  inset: ReturnType<typeof resolveInset>,
  width: number | string | undefined,
  height: number | string | undefined,
): CSSProperties {
  const widthValue = width === undefined ? undefined : cssLength(width);
  const heightValue = height === undefined ? undefined : cssLength(height);
  const maxWidth = `calc(100% - ${inset.left} - ${inset.right} - var(--pano-safe-left) - var(--pano-safe-right))`;
  const maxHeight = `calc(100% - ${inset.top} - ${inset.bottom} - var(--pano-safe-top) - var(--pano-safe-bottom))`;

  switch (placement) {
    case "top":
      return {
        top: `calc(${inset.top} + var(--pano-safe-top))`,
        right: widthValue
          ? "auto"
          : `calc(${inset.right} + var(--pano-safe-right))`,
        bottom: "auto",
        left: `calc(${inset.left} + var(--pano-safe-left))`,
        width: widthValue,
        maxWidth,
        height: heightValue,
        maxHeight,
      };
    case "bottom":
      return {
        top: "auto",
        right: widthValue
          ? "auto"
          : `calc(${inset.right} + var(--pano-safe-right))`,
        bottom: `calc(${inset.bottom} + var(--pano-safe-bottom))`,
        left: `calc(${inset.left} + var(--pano-safe-left))`,
        width: widthValue,
        maxWidth,
        height: heightValue,
        maxHeight,
      };
    case "left":
      return {
        top: `calc(${inset.top} + var(--pano-safe-top))`,
        right: "auto",
        bottom: heightValue
          ? "auto"
          : `calc(${inset.bottom} + var(--pano-safe-bottom))`,
        left: `calc(${inset.left} + var(--pano-safe-left))`,
        width: widthValue,
        maxWidth,
        height: heightValue,
        maxHeight,
      };
    case "right":
      return {
        top: `calc(${inset.top} + var(--pano-safe-top))`,
        right: `calc(${inset.right} + var(--pano-safe-right))`,
        bottom: heightValue
          ? "auto"
          : `calc(${inset.bottom} + var(--pano-safe-bottom))`,
        left: "auto",
        width: widthValue,
        maxWidth,
        height: heightValue,
        maxHeight,
      };
    default: {
      const exhaustive: never = placement;
      void exhaustive;
      return {};
    }
  }
}

export function PanoSceneMenu({
  items,
  activeId = null,
  onSelect,
  placement = "bottom",
  inset,
  width,
  height,
  collapsible = false,
  defaultExpanded = true,
  expanded: expandedProp,
  onExpandedChange,
  showArrows = false,
  dragMotion: dragMotionProp,
  appearance,
  className,
  style,
  label = "Scenes",
  previousLabel = "Previous scene",
  nextLabel = "Next scene",
  expandLabel = "Show scenes",
  collapseLabel = "Hide scenes",
}: PanoSceneMenuProps) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const resolved = resolveAppearance(appearance);
  const resolvedInset = resolveInset(inset);
  const horizontal = isHorizontal(placement);
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
    suppressClick: boolean;
  } | null>(null);
  const animRef = useRef<{
    raf: number | null;
    lastTime: number;
    position: number;
    velocity: number;
  } | null>(null);
  const maxOffset = Math.max(0, contentSize - viewportSize);

  offsetRef.current = offset;

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
        setOffset(clampOffset(current));
        return;
      }
      if (!dragMotion.inertia && !dragMotion.bounce) {
        setOffset(clampOffset(current));
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
        setOffset(next.position);
        if (next.settled) {
          setOffset(clampOffset(next.position));
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

  useEffect(() => () => cancelScrollAnimation(), [cancelScrollAnimation]);

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
    setOffset((previous) => Math.min(maxOffset, Math.max(0, previous)));
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
      setOffset(clampOffset(next));
      return;
    }
    const itemStart = itemRect.top - listRect.top + offsetRef.current;
    const itemEnd = itemStart + itemRect.height;
    let next = offsetRef.current;
    if (itemStart < next) next = itemStart;
    else if (itemEnd > next + listRect.height) next = itemEnd - listRect.height;
    cancelScrollAnimation();
    setOffset(clampOffset(next));
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
      "--pano-scene-menu-selection-width": cssLength(resolved.selectionWidth),
      "--pano-scene-menu-label-background": resolved.labelBackground,
      "--pano-scene-menu-label-color": resolved.labelColor,
      "--pano-scene-menu-font-size": cssLength(resolved.fontSize),
      "--pano-scene-menu-control-color": resolved.controlColor,
      "--pano-scene-menu-control-background": resolved.controlBackground,
    };
    // Collapsed chrome should shrink to the toggle; ignore configured size.
    const sizeWidth = expanded ? width : undefined;
    const sizeHeight = expanded ? height : undefined;
    return {
      ...vars,
      ...placementBoxStyle(placement, resolvedInset, sizeWidth, sizeHeight),
      ...style,
    };
  }, [expanded, height, placement, resolved, resolvedInset, style, width]);

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
      selectAt(Math.max(0, current - 1));
      return;
    }
    if (forward) {
      event.preventDefault();
      selectAt(Math.min(items.length - 1, current + 1));
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
      setOffset((previous) => clampOffset(previous + event.deltaY));
      return;
    }
    if (maxOffset <= 0 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    cancelScrollAnimation();
    setOffset((previous) => clampOffset(previous + event.deltaX));
  };

  const axisPoint = (event: { clientX: number; clientY: number }) =>
    horizontal ? event.clientX : event.clientY;

  const endSuppressClickRef = useRef(false);

  const beginListDrag = (
    event: ReactPointerEvent<Element>,
    captureTarget: HTMLElement,
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
      suppressClick: false,
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
    if (!drag.moved && Math.abs(delta) >= SCENE_MENU_DRAG_THRESHOLD_PX) {
      drag.moved = true;
      drag.suppressClick = true;
    }
    if (!drag.moved) return;
    // Content follows the finger: drag right/down decreases offset.
    const raw = drag.startOffset - delta;
    const now = performance.now();
    drag.samples = pushSample(drag.samples, { t: now, position: raw });
    setOffset(
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
    const suppress = drag.suppressClick;
    dragRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore release failures for synthetic pointers.
    }
    if (suppress) {
      endSuppressClickRef.current = true;
      queueMicrotask(() => {
        endSuppressClickRef.current = false;
      });
    }
    if (!drag.moved) return;
    if (event.type === "pointercancel") {
      setOffset(clampOffset(offsetRef.current));
      return;
    }
    startScrollAnimation(velocityFromSamples(drag.samples));
  };

  const onItemClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    if (endSuppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onSelect?.(id);
  };

  const canGoPrevious = items.length > 0 && activeIndex !== 0;
  const canGoNext = items.length > 0 && activeIndex !== items.length - 1;
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
      className={cn("pano-scene-menu", className)}
      data-collapsible={collapsible ? "true" : undefined}
      data-drag-motion={customDrag ? "custom" : "native"}
      data-expanded={expanded ? "true" : "false"}
      data-orientation={orientation}
      data-placement={placement}
      role="group"
      style={rootStyle}
    >
      {expanded ? (
        <div className="pano-scene-menu-body">
          {showArrows ? (
            <ControlButton
              className="pano-scene-menu-arrow"
              disabled={!canGoPrevious}
              label={previousLabel}
              onClick={() => selectRelative(-1)}
            >
              <Chevron direction="prev" orientation={orientation} />
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
                ? (event) => beginListDrag(event, event.currentTarget)
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
                return (
                  <button
                    aria-checked={selected}
                    className="pano-scene-menu-item"
                    data-active={selected ? "true" : undefined}
                    key={item.id}
                    onClick={(event) => onItemClick(event, item.id)}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      const list = listRef.current;
                      if (customDrag && list) {
                        beginListDrag(event, list);
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
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {showArrows ? (
            <ControlButton
              className="pano-scene-menu-arrow"
              disabled={!canGoNext}
              label={nextLabel}
              onClick={() => selectRelative(1)}
            >
              <Chevron direction="next" orientation={orientation} />
            </ControlButton>
          ) : null}
        </div>
      ) : null}
      {collapsible ? (
        <ControlButton
          className="pano-scene-menu-toggle"
          label={expanded ? collapseLabel : expandLabel}
          onClick={() => setExpanded(!expanded)}
        >
          <Chevron
            direction={expanded ? "collapse" : "expand"}
            orientation={orientation}
          />
        </ControlButton>
      ) : null}
    </div>
  );
}
