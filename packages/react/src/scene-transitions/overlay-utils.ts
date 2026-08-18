import type { Camera, Object3D, Texture } from "three";
import { PerspectiveCamera, PlaneGeometry, Vector3 } from "three";
import type { TransitionDefinition } from "./presets";

export const OVERLAY_RENDER_ORDER = 10_000;

export const FULLSCREEN_PLANE = new PlaneGeometry(1, 1);

export type Snapshot = {
  texture: Texture;
  dispose: () => void;
};

export type OverlayProps = {
  snapshot: Snapshot;
  transition: TransitionDefinition;
  running: boolean;
  runId: number;
  onFinish: () => void;
};

export function isPerspectiveCamera(camera: Camera): camera is PerspectiveCamera {
  return (camera as PerspectiveCamera).isPerspectiveCamera === true;
}

export function placeFullscreenOverlay(
  mesh: Object3D,
  camera: PerspectiveCamera,
  direction: Vector3,
): void {
  const distance = Math.max(camera.near * 1.1, 0.11);
  camera.getWorldDirection(direction);
  mesh.position.copy(camera.position).addScaledVector(direction, distance);
  mesh.quaternion.copy(camera.quaternion);
  const height = 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
  mesh.scale.set(height * camera.aspect, height, 1);
}

export function overlayProgress(
  elapsedTime: number,
  duration: number,
  startTime: number | null,
): { startTime: number; progress: number } {
  const started = startTime ?? elapsedTime;
  const progress = duration === 0 ? 1 : Math.min(1, (elapsedTime - started) / duration);
  return { startTime: started, progress };
}
