import {
  getHotspotCornerRotation,
  normalizePanoPosition,
  panoPositionToVector3,
  vector3ToPanoPosition,
  type HotspotPosition,
  type PortalHotspotDefinition,
} from "@ericchen1990/pano-view";

const radians = Math.PI / 180;
const effectiveAngle = (angle: number) => Math.min(179, Math.max(0.01, angle));
type Handle = "width" | "height" | "rotation";

export function portalTransform(portal: PortalHotspotDefinition, rotationGap: number) {
  const center = normalizePanoPosition(portal.position);
  const outward = panoPositionToVector3(center);
  const rotation = portal.rotation ?? 0;
  const right = panoPositionToVector3({ yaw: center.yaw + 90, pitch: 0 })
    .applyAxisAngle(outward, (rotation % 360) * radians);
  const up = right.clone().cross(outward);
  const circle = portal.shape === "circle";
  const width = portal.width ?? (circle ? portal.height ?? 10 : 10);
  const height = circle ? width : portal.height ?? 16;
  const scale = portal.scale ?? 1;
  const halfWidth = effectiveAngle(width * scale) * radians / 2;
  const halfHeight = effectiveAngle(height * scale) * radians / 2;
  const position = (x: number, y: number) => vector3ToPanoPosition(
    outward.clone().addScaledVector(right, x).addScaledVector(up, y),
  );
  // Express the tangent plane at unit distance. Both sides of the intersection
  // scale with the rendered distance of the hotspot, which cancels out.
  const extent = (point: HotspotPosition, axis: typeof right) => {
    const ray = panoPositionToVector3(point);
    const depth = ray.dot(outward);
    return depth > 1e-6 ? ray.dot(axis) / depth : undefined;
  };
  return {
    width: position(Math.tan(halfWidth), 0),
    height: position(0, Math.tan(halfHeight)),
    rotation: position(0, -Math.tan(Math.min(halfHeight + rotationGap * radians, 89.9 * radians))),
    drag(handle: Handle, start: HotspotPosition, point: HotspotPosition) {
      if (handle === "rotation") {
        const delta = getHotspotCornerRotation(center, start, point);
        return { rotation: Math.abs(delta) < 1e-7 ? portal.rotation : rotation % 360 + delta };
      }
      const axis = handle === "width" ? right : up;
      const startExtent = extent(start, axis);
      const currentExtent = extent(point, axis);
      if (startExtent === undefined || currentExtent === undefined) return;
      const delta = currentExtent - startExtent;
      if (Math.abs(delta) < 1e-7) return { [handle]: portal[handle] };
      const initialExtent = Math.tan(handle === "width" ? halfWidth : halfHeight);
      const angle = effectiveAngle(2 * Math.atan(initialExtent + delta) / radians);
      return { [handle]: angle / scale };
    },
  };
}
