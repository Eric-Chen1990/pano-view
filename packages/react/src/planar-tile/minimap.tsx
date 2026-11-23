import { usePanoUiTranslation } from "../ui-translation";
import { useEffect, useRef } from "react";
import { containRect, type MapPoint, type MapRect } from "../map/geometry";
import { visibleImageRect } from "./geometry";
import type { Size } from "./manifest";
import type { PlanarControls } from "./runtime";

const MAX_SIZE = 144;
const VIEWPORT_FRACTION = 0.3;
const KEYBOARD_STEP = 48;

export function PlanarMinimap({ source, controls }: { source: Size; controls: PlanarControls }) {
  const t = usePanoUiTranslation();
  const minimap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rectangle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = minimap.current!;
    const preview = canvas.current!;
    const handle = rectangle.current!;
    const context = preview.getContext("2d");
    if (!context) return;

    const controller = new AbortController();
    const { signal } = controller;
    let drag: { pointerId: number; offset: MapPoint } | undefined;
    let image: MapRect | undefined;
    let mapSize: Size = { width: 0, height: 0 };
    let drawnPreview: ImageBitmap | undefined;

    const unsubscribe = controls.subscribeOverview((viewport, imageRect, bitmap) => {
      image = imageRect;
      const size = containRect(
        Math.min(MAX_SIZE, viewport.width * VIEWPORT_FRACTION),
        Math.min(MAX_SIZE, viewport.height * VIEWPORT_FRACTION),
        source.width, source.height,
      );
      if (mapSize.width !== size.width || mapSize.height !== size.height) {
        mapSize = size;
        element.style.width = `${size.width}px`;
        element.style.height = `${size.height}px`;
      }
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(size.width * ratio));
      const height = Math.max(1, Math.round(size.height * ratio));
      if (drawnPreview !== bitmap || preview.width !== width || preview.height !== height) {
        preview.width = width;
        preview.height = height;
        context.drawImage(bitmap, 0, 0, width, height);
        drawnPreview = bitmap;
      }
      const rect = visibleImageRect(imageRect, viewport);
      handle.style.left = `${rect.left * 100}%`;
      handle.style.top = `${rect.top * 100}%`;
      handle.style.width = `${rect.width * 100}%`;
      handle.style.height = `${rect.height * 100}%`;
      element.hidden = false;
    });

    function imagePoint(event: MouseEvent): MapPoint {
      const rect = element.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
    }

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || drag) return;
      const point = imagePoint(event);
      controls.panTo(controls.getView().center);
      const { center } = controls.getView();
      drag = { pointerId: event.pointerId, offset: { x: center.x - point.x, y: center.y - point.y } };
      element.focus({ preventScroll: true });
      element.setPointerCapture(event.pointerId);
      element.dataset.dragging = "";
    }, { signal });

    element.addEventListener("pointermove", (event) => {
      if (drag?.pointerId !== event.pointerId) return;
      const point = imagePoint(event);
      controls.panTo({ x: point.x + drag.offset.x, y: point.y + drag.offset.y });
    }, { signal });

    function releasePointer(pointerId: number) {
      if (drag?.pointerId !== pointerId) return;
      drag = undefined;
      delete element.dataset.dragging;
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    }
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
      element.addEventListener(type, (event) => releasePointer(event.pointerId), { signal });
    }

    element.addEventListener("wheel", (event) => {
      if (!drag) controls.zoomWithWheel(event, imagePoint(event));
    }, { passive: false, signal });

    element.addEventListener("keydown", (event) => {
      if (!image || event.altKey || event.ctrlKey || event.metaKey) return;
      const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (!dx && !dy) return;
      event.preventDefault();
      const { center } = controls.getView();
      controls.panTo({ x: center.x + dx * KEYBOARD_STEP / image.width, y: center.y + dy * KEYBOARD_STEP / image.height });
    }, { signal });

    return () => {
      unsubscribe();
      controller.abort();
      if (drag) releasePointer(drag.pointerId);
      element.hidden = true;
    };
  }, [source, controls]);

  return (
    <div ref={minimap} className="pano-planar-minimap" role="region" aria-label={t("Image minimap")}
      aria-description="Use the arrow keys to pan." tabIndex={0} hidden>
      <canvas ref={canvas} aria-hidden="true" />
      <div ref={rectangle} className="pano-planar-minimap-rectangle" aria-hidden="true" />
    </div>
  );
}
