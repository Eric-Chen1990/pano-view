import { Quaternion, Vector3 } from "three";

/** The audio listener tracks physical movement before the panorama is recentered. */
export function createXRAudioPose() {
  const position = new Vector3();
  const orientation = new Quaternion();
  const origin = new Vector3();
  let needsOrigin = true;

  return {
    position,
    orientation,
    valid: false,
    recenter() {
      needsOrigin = true;
      position.set(0, 0, 0);
    },
    update(transform: XRRigidTransform, worldRotation: Quaternion, emulated: boolean) {
      const point = transform.position;
      const rotation = transform.orientation;
      orientation.set(rotation.x, rotation.y, rotation.z, rotation.w).premultiply(worldRotation);
      this.valid = true;
      if (emulated) return;
      if (needsOrigin) {
        origin.set(point.x, point.y, point.z);
        needsOrigin = false;
      }
      position.set(point.x, point.y, point.z).sub(origin).applyQuaternion(worldRotation);
    },
  };
}

export type XRAudioPose = ReturnType<typeof createXRAudioPose>;
