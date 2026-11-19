import { useRef } from "react";
import {
  GraphicHotspot,
  getHotspotCornerCenter,
  getHotspotCornerRotation,
  getHotspotRotationHandle,
  rotateHotspotCorners,
  validateHotspotCorners,
  type HotspotCorners,
  type HotspotPosition,
} from "@ericchen1990/pano-view";
import type { Translate } from "./i18n";

export const cornerLabels = ["Top left", "Top right", "Bottom right", "Bottom left"] as const;

export function updateCorner(corners: HotspotCorners, index: number, position: HotspotPosition): HotspotCorners {
  const next: [...HotspotCorners] = [...corners];
  next[index] = position;
  return next;
}

export function CornerHandles({ id, corners, onChange, onBegin, onEnd, t }: {
  id: string;
  corners: HotspotCorners;
  onChange: (corners: HotspotCorners) => void;
  onBegin: () => void;
  onEnd: () => void;
  t: Translate;
}) {
  const rotationStart = useRef<{ corners: HotspotCorners; center: HotspotPosition } | null>(null);
  const center = getHotspotCornerCenter(corners);
  const rotateHandle = getHotspotRotationHandle(corners);
  if (!center || !rotateHandle) return null;
  const common = {
    width: 1.2,
    height: 1.2,
    distance: 8,
    renderOrder: 100,
    mode: "billboard",
    scaleMode: "fixed",
    draggable: true,
    cursor: "grab",
  } as const;

  return (
    <>
      {corners.map((corner, index) => (
        <GraphicHotspot
          {...common}
          key={index}
          id={`editor-${id}-corner-${index}`}
          ariaLabel={t(cornerLabels[index]!)}
          position={corner}
          graphic={{ kind: "circle", fill: "#ffffff", stroke: "#df6b42", strokeWidth: 14 }}
          onDragStart={onBegin}
          onDragEnd={onEnd}
          onPositionChange={({ position }) => {
            const next = updateCorner(corners, index, position);
            if (validateHotspotCorners(next)) onChange(next);
          }}
        />
      ))}
      <GraphicHotspot
        {...common}
        id={`editor-${id}-rotate`}
        ariaLabel={t("Rotate hotspot")}
        position={rotateHandle}
        width={1.5}
        height={1.5}
        graphic={{ kind: "diamond", fill: "#75cbd3", stroke: "#172d34", strokeWidth: 12 }}
        onDragStart={() => {
          rotationStart.current = { corners, center };
          onBegin();
        }}
        onPositionChange={({ startPosition, position }) => {
          const initial = rotationStart.current;
          if (!initial) return;
          const degrees = getHotspotCornerRotation(initial.center, startPosition, position);
          onChange(rotateHotspotCorners(initial.corners, degrees));
        }}
        onDragEnd={() => {
          rotationStart.current = null;
          onEnd();
        }}
      />
    </>
  );
}
