import { Plane, Quaternion, Vector3, type Object3D, type Ray } from "three";

export function createSpatialPanelDrag(panel: Object3D, point: Vector3, ray: Ray) {
  const normal = new Vector3(0, 0, 1).applyQuaternion(panel.getWorldQuaternion(new Quaternion()));
  const plane = new Plane().setFromNormalAndCoplanarPoint(normal, point);
  const intersect = (ray: Ray, target: Vector3) => {
    // Nearly parallel rays can throw the panel far outside the reachable area.
    if (Math.abs(plane.normal.dot(ray.direction)) < 0.1) return false;
    return ray.intersectPlane(plane, target) !== null &&
      Number.isFinite(target.x) && Number.isFinite(target.y) && Number.isFinite(target.z);
  };
  const start = new Vector3();
  if (!intersect(ray, start)) return null;
  const offset = panel.getWorldPosition(new Vector3()).sub(start);
  const next = new Vector3();
  return (ray: Ray) => {
    if (!intersect(ray, next)) return;
    next.add(offset);
    if (panel.parent) panel.parent.worldToLocal(next);
    panel.position.copy(next);
    panel.updateWorldMatrix(false, true);
  };
}
