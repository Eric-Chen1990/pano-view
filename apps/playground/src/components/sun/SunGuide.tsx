import { usePlaygroundLanguage } from "../../i18n/language";
import {
  GraphicHotspot, PolylineHotspot, panoPositionToVector3, vector3ToPanoPosition,
  type HotspotPosition,
} from "@ericchen1990/pano-view";
import { useMemo } from "react";
import { MathUtils, Vector3 } from "three";

const CENTER_MARKER = {
  kind: "circle",
  fill: "rgba(8, 22, 25, 0.28)",
  stroke: "#fff4de",
  strokeWidth: 36,
} as const;

export function SunGuide({ position, angularSize, onMove }: {
  position: HotspotPosition;
  angularSize: number;
  onMove: (position: HotspotPosition) => void;
}) {
  const { t } = usePlaygroundLanguage();
  const outline = useMemo(() => {
    const center = panoPositionToVector3(position);
    const yaw = MathUtils.degToRad(position.yaw);
    const right = new Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const up = new Vector3().crossVectors(right, center);
    const radius = MathUtils.degToRad(angularSize / 2);
    const point = new Vector3();
    const segments = 48;
    return Array.from({ length: segments + 1 }, (_, i) => {
      const angle = 2 * Math.PI * i / segments;
      point.copy(center).multiplyScalar(Math.cos(radius))
        .addScaledVector(right, Math.sin(radius) * Math.cos(angle))
        .addScaledVector(up, Math.sin(radius) * Math.sin(angle));
      return vector3ToPanoPosition(point);
    });
  }, [position, angularSize]);

  return (
    <>
      <PolylineHotspot id="sun-disc-outline-shadow" vertices={outline} interactive={false}
        stroke="#081619" strokeWidth={4} strokeOpacity={0.9} />
      <PolylineHotspot id="sun-disc-outline" vertices={outline} interactive={false}
        renderOrder={11} stroke="#fff4de" strokeWidth={2} strokeDashSize={3} strokeGapSize={3} />
      <GraphicHotspot id="sun-center-marker" ariaLabel={t("Drag sun center")} graphic={CENTER_MARKER}
        position={position} width={3.8} height={3.8} cursor="move" draggable
        onPositionChange={({ position: next }) => onMove(next)} />
    </>
  );
}
