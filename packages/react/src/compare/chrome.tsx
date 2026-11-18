import { useCallback, useEffect, useRef, useSyncExternalStore, type PointerEvent } from "react";
import type { createCompareHost } from "./view";

export function CompareChrome({ host }: { host: ReturnType<typeof createCompareHost> }) {
  const config = useSyncExternalStore(host.subscribe, host.getConfig, () => null);
  const hasPaneViews = useSyncExternalStore(host.subscribe, host.hasPaneViews, () => false);
  const slider = useRef<HTMLInputElement>(null);
  const drag = useRef<{ pointerId: number; offset: number } | null>(null);
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
  useEffect(() => {
    drag.current = null;
  }, [config?.layout, config?.presentation]);
  if (!config) return null;

  const horizontal = config.layout === "left-right";
  const wipe = config.presentation === "wipe";
  const split = wipe ? config.split : 0.5;
  const position = `var(--pano-compare-motion-divider, ${split * 100}%)`;
  const dividerStyle = horizontal ? { left: position } : { top: position };
  const pointerPosition = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = host.chrome?.getBoundingClientRect();
    if (!bounds) return null;
    const length = horizontal ? bounds.width : bounds.height;
    if (length <= 0) return null;
    return horizontal
      ? (event.clientX - bounds.left) / length
      : (event.clientY - bounds.top) / length;
  };
  return (
    <div className="pano-compare-chrome" ref={setChrome} data-layout={config.layout}>
      {hasPaneViews && (
        <>
          <div className="pano-compare-html" data-side="before" ref={setBefore} />
          <div className="pano-compare-html" data-side="after" ref={setAfter} />
        </>
      )}
      {wipe ? (
        <div className="pano-compare-divider pano-compare-divider-draggable"
          style={dividerStyle}
          onPointerDown={(event) => {
            if (event.button !== 0 || drag.current !== null) return;
            const at = pointerPosition(event);
            if (at === null) return;
            event.preventDefault();
            drag.current = { pointerId: event.pointerId, offset: at - split };
            event.currentTarget.setPointerCapture(event.pointerId);
            slider.current?.focus({ preventScroll: true });
          }}
          onPointerMove={(event) => {
            const active = drag.current;
            if (active?.pointerId !== event.pointerId) return;
            const at = pointerPosition(event);
            if (at !== null) config.changeSplit(at <= 0 || at >= 1 ? at : at - active.offset);
          }}
          onLostPointerCapture={(event) => {
            if (drag.current?.pointerId === event.pointerId) drag.current = null;
          }}
        >
          <input type="range" min={0} max={100} step={1}
            ref={slider} value={Math.round(split * 100)}
            aria-label="Comparison divider" aria-orientation={horizontal ? "horizontal" : "vertical"}
            onChange={(event) => config.changeSplit(event.currentTarget.valueAsNumber / 100)}
            onKeyDown={(event) => {
              if (horizontal || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
              event.preventDefault();
              config.changeSplit(split + (event.key === "ArrowDown" ? 0.01 : -0.01));
            }}
          />
        </div>
      ) : (
        <div className="pano-compare-divider" aria-hidden="true" style={dividerStyle} />
      )}
      <div className="pano-compare-transition" aria-hidden="true" ref={setTransitionLayer} />
    </div>
  );
}
