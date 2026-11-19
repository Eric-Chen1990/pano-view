import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, type Texture } from "three";
import { fitHotspotCorners, moveHotspotCorners } from "./corners";
import { vector3ToPanoPosition } from "./coordinates";
import { createSurfaceQuaternion, HotspotAnchor } from "./hotspot-anchor";
import { HotspotPlane } from "./hotspot-plane";
import { HotspotStrokeLine, type HotspotStrokePoint } from "./hotspot-stroke-line";
import type { HotspotCommonProps, HotspotCornerProps, HotspotCorners } from "./types";

type Props = HotspotCommonProps & HotspotCornerProps & {
  width: number;
  height: number;
  map: Texture | null;
};

export function createCornerMediaQuad(corners: HotspotCorners) {
  const fit = fitHotspotCorners(corners);
  if (!fit) return null;
  const position = vector3ToPanoPosition(fit.center);
  const inverseRotation = createSurfaceQuaternion(position).invert();
  const vertices = fit.vertices.map((vertex) => vertex.sub(fit.center).applyQuaternion(inverseRotation));
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices.flatMap((vertex) => vertex.toArray()), 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  const outline: HotspotStrokePoint[] = [...vertices, vertices[0]!].map(({ x, y, z }) => [x, y, z]);
  return { position, distance: fit.center.length(), geometry, outline };
}

export function HotspotMediaPlane({ corners, onCornersChange, opacity, map, ...anchorProps }: Props) {
  if (corners) {
    return <CornerMediaPlane {...anchorProps} corners={corners} onCornersChange={onCornersChange} opacity={opacity} map={map} />;
  }
  return (
    <HotspotAnchor {...anchorProps} captureRectangle>
      <HotspotPlane map={map} opacity={opacity} />
    </HotspotAnchor>
  );
}

function CornerMediaPlane({
  corners,
  onCornersChange,
  onDragStart,
  onDragEnd,
  onPositionChange,
  opacity,
  map,
  renderOrder = 0,
  ...anchorProps
}: Props & { corners: HotspotCorners }) {
  const quad = useMemo(() => createCornerMediaQuad(corners), [corners]);
  const startCorners = useRef<HotspotCorners | null>(null);
  useEffect(() => () => quad?.geometry.dispose(), [quad]);
  if (!quad) return null;

  return (
    <HotspotAnchor
      {...anchorProps}
      position={quad.position}
      width={1}
      height={1}
      distance={quad.distance}
      internalPlacement="floating"
      internalOrientation="surface"
      useAngularScale={false}
      scaleMode="fov"
      rotation={0}
      renderOrder={renderOrder}
      focusContent={<HotspotStrokeLine points={quad.outline} color="#f5fbfc" opacity={1} lineWidth={5} renderOrder={renderOrder + 2} hitTest={false} />}
      selectionContent={<HotspotStrokeLine points={quad.outline} color="#a06bff" opacity={1} lineWidth={2} renderOrder={renderOrder + 1} hitTest={false} />}
      onDragStart={(event) => {
        startCorners.current = corners;
        onDragStart?.(event);
      }}
      onPositionChange={(event) => {
        const initial = startCorners.current ?? corners;
        onCornersChange?.({
          ...event,
          startCorners: initial,
          corners: moveHotspotCorners(initial, event.startPosition, event.position),
        });
        onPositionChange?.(event);
      }}
      onDragEnd={(event) => {
        startCorners.current = null;
        onDragEnd?.(event);
      }}
    >
      <HotspotPlane geometry={quad.geometry} map={map} opacity={opacity} />
    </HotspotAnchor>
  );
}
