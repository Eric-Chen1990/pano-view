import { usePanoUiTranslation } from "../ui-translation";
import { useCallback, useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import type { CompareConfig, createCompareHost } from "./view";

export function CompareChrome({ host }: { host: ReturnType<typeof createCompareHost> }) {
  const config = useSyncExternalStore(host.subscribe, host.getConfig, () => null);
  const hasPaneViews = useSyncExternalStore(host.subscribe, host.hasPaneViews, () => false);
  const setBefore = useCallback((node: HTMLDivElement | null) => {
    host.beforeHtml = node;
    host.notify();
  }, [host]);
  const setAfter = useCallback((node: HTMLDivElement | null) => {
    host.afterHtml = node;
    host.notify();
  }, [host]);
  const setTransitionLayer = useCallback((node: HTMLDivElement | null) => {
    host.transitionLayer = node;
  }, [host]);
  const setChrome = useCallback((node: HTMLDivElement | null) => {
    host.chrome = node;
  }, [host]);
  if (!config) return null;
  return (
    <div className="pano-compare-chrome" ref={setChrome} data-layout={config.layout}>
      {hasPaneViews && (
        <>
          <div className="pano-compare-html" data-side="before" ref={setBefore} />
          <div className="pano-compare-html" data-side="after" ref={setAfter} />
        </>
      )}
      <CompareDivider {...config} />
      <div className="pano-compare-transition" aria-hidden="true" ref={setTransitionLayer} />
    </div>
  );
}

type DividerDrag = {
  element: HTMLDivElement;
  container: HTMLElement;
  pointerId: number;
  offset: number;
  coordinate: number;
  latest: number;
  frame: number | null;
};

function stopDrag(drag: DividerDrag) {
  if (drag.frame !== null) cancelAnimationFrame(drag.frame);
  if (drag.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
}

export function CompareDivider({ layout, presentation, split, dividerColor, dividerWidth }: CompareConfig) {
  const t = usePanoUiTranslation();
  const slider = useRef<HTMLInputElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<DividerDrag | null>(null);
  const horizontal = layout === "left-right";
  const wipe = presentation === "wipe";
  const style = {
    "--pano-compare-divider-color": dividerColor,
    "--pano-compare-divider-width": dividerWidth !== undefined && Number.isFinite(dividerWidth) && dividerWidth > 0
      ? `${dividerWidth}px` : undefined,
  } as CSSProperties;

  useLayoutEffect(() => {
    const input = slider.current;
    if (!input) return;
    const sync = (value: number) => { input.value = String(Math.round(value * 100)); };
    sync(split.get());
    return split.subscribe(sync);
  }, [split, wipe]);

  useLayoutEffect(() => () => {
    const active = drag.current;
    drag.current = null;
    if (active) stopDrag(active);
  }, [layout, presentation]);

  function fractionAt(container: HTMLElement, coordinate: number) {
    const bounds = container.getBoundingClientRect();
    const length = horizontal ? bounds.width : bounds.height;
    if (length <= 0) return null;
    return (coordinate - (horizontal ? bounds.left : bounds.top)) / length;
  }

  function applyDrag(active: DividerDrag) {
    const at = fractionAt(active.container, active.latest);
    active.coordinate = active.latest;
    if (at !== null) split.change(at <= 0 || at >= 1 ? at : at - active.offset);
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (active?.pointerId !== event.pointerId) return;
    drag.current = null;
    stopDrag(active);
    if (event.type !== "pointerup") return;
    active.latest = horizontal ? event.clientX : event.clientY;
    if (active.latest !== active.coordinate || active.frame !== null) applyDrag(active);
  }

  return (
    <div ref={track} className="pano-compare-divider-track" data-presentation={presentation} style={style}>
      {wipe ? (
        <div className="pano-compare-divider pano-compare-divider-draggable"
          onPointerDown={(event) => {
            const container = track.current?.parentElement;
            if (event.button !== 0 || drag.current || !container) return;
            const coordinate = horizontal ? event.clientX : event.clientY;
            const at = fractionAt(container, coordinate);
            if (at === null) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              element: event.currentTarget, container, pointerId: event.pointerId,
              offset: at - split.get(), coordinate, latest: coordinate, frame: null,
            };
            slider.current?.focus({ preventScroll: true });
          }}
          onPointerMove={(event) => {
            const active = drag.current;
            if (active?.pointerId !== event.pointerId) return;
            active.latest = horizontal ? event.clientX : event.clientY;
            if (active.frame !== null) return;
            active.frame = requestAnimationFrame(() => {
              active.frame = null;
              applyDrag(active);
            });
          }}
          onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
        >
          <input type="range" min={0} max={100} step={1}
            ref={slider} defaultValue={Math.round(split.get() * 100)}
            aria-label={t("Comparison divider")} aria-orientation={horizontal ? "horizontal" : "vertical"}
            onChange={(event) => {
              const input = event.currentTarget;
              split.change(input.valueAsNumber / 100);
              input.value = String(Math.round(split.get() * 100));
            }}
            onKeyDown={(event) => {
              if (horizontal || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
              event.preventDefault();
              split.change(split.get() + (event.key === "ArrowDown" ? 0.01 : -0.01));
            }}
          />
        </div>
      ) : <div className="pano-compare-divider" aria-hidden="true" />}
    </div>
  );
}
