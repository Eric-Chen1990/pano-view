import { useRef } from "react";
import {
  GraphicHotspot,
  getHotspotCornerCenter,
  getHotspotCornerRotation,
  getHotspotRotationHandle,
  rotateHotspotCorners,
  validateHotspotCorners,
  type GraphicDefinition,
  type HotspotCorners,
  type HotspotPosition,
} from "@ericchen1990/pano-view";
import type { Translate } from "./i18n";

const referenceHeight = 768;
const cornerDiameter = 18;
const rotationDiameter = 32;
const rotationOffset = 36;
const cornerGraphic = { kind: "circle", fill: "#ffffff", stroke: "#8a8f9a", strokeWidth: 27 } as const;
const rotationGraphic = { ...cornerGraphic, strokeWidth: 16 };
const rotationIcon: GraphicDefinition = {
  kind: "path",
  path: "M23 14a7 7 0 0 0-12-3l-2 2m0-5v5h5 M9 18a7 7 0 0 0 12 3l2-2m0 5v-5h-5",
  viewBox: [0, 0, 32, 32],
  stroke: "#252936",
  strokeWidth: 1.7,
};

function fixedAngle(pixels: number): number {
  return 2 * Math.atan(pixels / referenceHeight) * 180 / Math.PI;
}

export const cornerLabels = ["Top left", "Top right", "Bottom right", "Bottom left"] as const;

export function updateCorner(corners: HotspotCorners, index: number, position: HotspotPosition): HotspotCorners {
  const next: [...HotspotCorners] = [...corners];
  next[index] = position;
  return next;
}

export function CornerHandles({ id, corners, viewportHeight, onChange, onBegin, onEnd, t }: {
  id: string;
  corners: HotspotCorners;
  viewportHeight: number;
  onChange: (corners: HotspotCorners) => void;
  onBegin: () => void;
  onEnd: () => void;
  t: Translate;
}) {
  const rotationStart = useRef<{ corners: HotspotCorners; center: HotspotPosition } | null>(null);
  const center = getHotspotCornerCenter(corners);
  const minimumGap = Math.atan(2 * rotationOffset * Math.tan(75 * Math.PI / 360) / viewportHeight) * 180 / Math.PI;
  const rotateHandle = getHotspotRotationHandle(corners, "bottom", minimumGap);
  if (!center || !rotateHandle) return null;
  const common = {
    width: fixedAngle(cornerDiameter),
    height: fixedAngle(cornerDiameter),
    distance: 8,
    renderOrder: 100,
    mode: "billboard",
    scaleMode: "fixed",
    referenceFov: fixedAngle(viewportHeight),
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
          graphic={cornerGraphic}
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
        width={fixedAngle(rotationDiameter)}
        height={fixedAngle(rotationDiameter)}
        graphic={rotationGraphic}
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
      <GraphicHotspot
        id={`editor-${id}-rotate-icon`}
        position={rotateHandle}
        width={fixedAngle(rotationDiameter)}
        height={fixedAngle(rotationDiameter)}
        referenceFov={common.referenceFov}
        distance={7.99}
        mode="billboard"
        scaleMode="fixed"
        renderOrder={101}
        interactive={false}
        graphic={rotationIcon}
      />
    </>
  );
}
