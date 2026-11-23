import { useEffect, useRef } from "react";
import { GraphicHotspot, type PortalHotspotDefinition } from "@ericchen1990/pano-view";
import {
  cornerGraphic,
  hotspotHandleProps,
  rotationGraphic,
  rotationHandleSize,
  rotationIcon,
} from "./corner-handles";
import type { HotspotGeometryPatch } from "./document";
import type { Translate } from "./i18n";
import { portalTransform } from "./portal-transform";

export function PortalHandles({ portal, viewportHeight, onChange, onBegin, onEnd, t }: {
  portal: PortalHotspotDefinition;
  viewportHeight: number;
  onChange: (patch: HotspotGeometryPatch) => void;
  onBegin: () => void;
  onEnd: () => void;
  t: Translate;
}) {
  const drag = useRef<ReturnType<typeof portalTransform>["drag"]>(null);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => () => {
    if (drag.current) end.current();
  }, []);

  const gap = Math.max(2, 36 * 75 / viewportHeight);
  const transform = portalTransform(portal, gap);
  const common = hotspotHandleProps(viewportHeight);
  const circle = portal.shape === "circle";
  const handles = [
    { key: "width", label: circle ? "Resize portal diameter" : "Resize portal width" },
    { key: "height", label: "Resize portal height" },
    { key: "rotation", label: "Rotate portal" },
  ] as const;

  return <>
    {handles.map(({ key, label }) => {
      if (circle && key === "height") return null;
      const rotating = key === "rotation";
      return <GraphicHotspot
        {...common}
        key={key}
        id={`editor-${portal.id}-${key}`}
        ariaLabel={t(label)}
        position={transform[key]}
        {...(rotating ? { width: rotationHandleSize, height: rotationHandleSize } : {})}
        graphic={rotating ? rotationGraphic : cornerGraphic}
        onDragStart={() => {
          drag.current = transform.drag;
          onBegin();
        }}
        onPositionChange={({ startPosition, position }) => {
          const patch = drag.current?.(key, startPosition, position);
          if (patch) onChange(patch);
        }}
        onDragEnd={() => {
          drag.current = null;
          onEnd();
        }}
      />;
    })}
    <GraphicHotspot
      id={`editor-${portal.id}-rotation-icon`}
      position={transform.rotation}
      width={rotationHandleSize}
      height={rotationHandleSize}
      referenceFov={common.referenceFov}
      distance={7.99}
      mode="billboard"
      scaleMode="fixed"
      renderOrder={101}
      interactive={false}
      graphic={rotationIcon}
    />
  </>;
}
