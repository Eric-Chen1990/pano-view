import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

export function PanelSplitter({
  side,
  value,
  defaultValue,
  min,
  max,
  cssVar,
  label,
  onChange,
}: {
  side: "library" | "inspector";
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  cssVar: string;
  label: string;
  onChange: (width: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<
    { pointerId: number; startX: number; start: number } | undefined
  >(undefined);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const root = ref.current?.closest(".pne-workspace") as HTMLElement | null;
    root?.style.setProperty(cssVar, `${value}px`);
  }, [cssVar, value]);

  function clamp(width: number) {
    return Math.round(Math.min(max, Math.max(min, width)));
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      start: value,
    };
    setDragging(true);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const delta = event.clientX - current.startX;
    const next =
      side === "library"
        ? clamp(current.start + delta)
        : clamp(current.start - delta);
    const root = ref.current?.closest(".pne-workspace") as HTMLElement | null;
    root?.style.setProperty(cssVar, `${next}px`);
    onChange(next);
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = undefined;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 24 : 8;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onChange(clamp(value + (side === "library" ? -step : step)));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onChange(clamp(value + (side === "library" ? step : -step)));
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(min);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(max);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onChange(defaultValue);
    }
  }

  return (
    <div
      ref={ref}
      className="pne-splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-dragging={dragging ? "true" : undefined}
      data-side={side}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={onKeyDown}
    />
  );
}
