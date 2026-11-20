import { useFrame } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef } from "react";
import {
  BufferAttribute, BufferGeometry, DoubleSide, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera,
  Quaternion, Vector2, Vector3,
} from "three";
import { WebGPURuntimeContext } from "../pano-renderer";
import { isPerspectiveCamera, OVERLAY_RENDER_ORDER } from "../scene-transitions/overlay-utils";
import type { PanoViewerState } from "../types";
import type { PortalWindow } from "./portal-host";
import { portalCameraRotation, portalTargetSize, portalViewRotation, projectPortal, setPortalCameraProjection, type PortalAperture } from "./portal-projection";
import { createPortalTarget, renderPortalTarget } from "./portal-rendering";
import { portalFanIndices } from "./portal-geometry";

const screenQuad = [new Vector2(), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1)];

function overlayGeometry(count: number) {
  const geometry = new BufferGeometry();
  geometry.setIndex(portalFanIndices(count));
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(count * 2), 2));
  return geometry;
}

function placeOverlay(
  geometry: BufferGeometry, camera: PerspectiveCamera,
  toScreen: (point: Vector2) => Vector2, toTexture: (point: Vector2) => Vector2,
  corners: Vector2[], flipY: boolean,
) {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const world = new Vector3();
  corners.forEach((point, index) => {
    const screen = toScreen(point);
    const sample = toTexture(point);
    world.set(screen.x * 2 - 1, screen.y * 2 - 1, 0.5).unproject(camera);
    position.setXYZ(index, world.x, world.y, world.z);
    uv.setXY(index, sample.x, flipY ? 1 - sample.y : sample.y);
  });
  position.needsUpdate = true;
  uv.needsUpdate = true;
}

export function PortalEntry({ window, destination, maxPixels, onTakeover, onFinish }: {
  window: PortalWindow;
  destination: PanoViewerState;
  maxPixels: number;
  onTakeover: () => void;
  onFinish: () => void;
}) {
  const gpu = useContext(WebGPURuntimeContext)?.passes;
  const sourceMesh = useRef<Mesh>(null);
  const destinationMesh = useRef<Mesh>(null);
  const frame = useRef<{
    started: number; aperture: PortalAperture; rotation: Quaternion;
    takenOverAt?: number;
  } | null>(null);
  const done = useRef(false);
  const resources = useMemo(() => ({
    source: createPortalTarget(gpu), destination: createPortalTarget(gpu),
    camera: new PerspectiveCamera(), sourceQuad: overlayGeometry(4), apertureMesh: overlayGeometry(window.outline.length),
    landing: portalViewRotation(destination, new Quaternion()),
  }), [gpu, destination, window]);
  useEffect(() => () => {
    resources.source.dispose();
    resources.destination.dispose();
    resources.sourceQuad.dispose();
    resources.apertureMesh.dispose();
  }, [resources]);

  useFrame(({ gl, camera, scene, size, clock, invalidate }) => {
    if (done.current || !sourceMesh.current || !destinationMesh.current) return;
    const now = clock.elapsedTime;
    if (!isPerspectiveCamera(camera)) {
      done.current = true;
      onTakeover();
      onFinish();
      return;
    }
    camera.updateWorldMatrix(true, false);
    if (!frame.current) {
      const aperture = projectPortal(window.mesh, camera, window.outline);
      if (!aperture || !window.ready() || !window.visible() || size.width < 1 || size.height < 1) {
        done.current = true;
        onTakeover();
        onFinish();
        return;
      }

      const dpr = gl.getPixelRatio();
      const [width, height] = portalTargetSize(size.width * dpr, size.height * dpr, maxPixels);
      resources.source.setSize(width, height);
      resources.destination.setSize(width, height);
      renderPortalTarget(gl, gpu, resources.source, scene, camera);
      frame.current = {
        started: now, aperture,
        rotation: portalCameraRotation(camera.quaternion, window.position, destination, new Quaternion()),
      };
    }

    const { aperture, started, rotation, takenOverAt } = frame.current;
    const elapsed = now - started;
    const progress = Math.min(1, elapsed / 0.5);
    const eased = MathUtils.smootherstep(progress, 0, 1);
    const zoom = Math.pow(Math.max(1, aperture.zoom), eased);
    const focus = new Vector2(0.5, 0.5).lerp(aperture.focus, eased);
    const crop = (screen: Vector2) => screen.clone().addScalar(-0.5).divideScalar(zoom).add(focus);
    const expand = (point: Vector2) => point.clone().sub(focus).multiplyScalar(zoom).addScalar(0.5);

    if (takenOverAt === undefined) {
      const targetCamera = resources.camera;
      targetCamera.copy(camera, false);
      targetCamera.quaternion.copy(rotation).slerp(resources.landing, eased);
      setPortalCameraProjection(targetCamera, destination.fov, size);
      targetCamera.updateMatrixWorld(true);
      renderPortalTarget(gl, gpu, resources.destination, window.preview, targetCamera);
      placeOverlay(resources.sourceQuad, camera, point => point, crop, screenQuad, Boolean(gpu));
      placeOverlay(resources.apertureMesh, camera, expand, expand, aperture.corners, Boolean(gpu));
      sourceMesh.current.visible = progress < 1;
      destinationMesh.current.visible = true;
      if (progress === 1) {
        frame.current.takenOverAt = now;
        onTakeover();
      }
    } else {
      placeOverlay(resources.apertureMesh, camera, expand, expand, aperture.corners, Boolean(gpu));
      const material = destinationMesh.current.material as MeshBasicMaterial;
      material.opacity = 1 - Math.min(1, (now - takenOverAt) / 0.1);
      if (material.opacity === 0) {
        done.current = true;
        onFinish();
        return;
      }
    }
    invalidate();
  });

  return <>
    <mesh ref={sourceMesh} visible={false} geometry={resources.sourceQuad} frustumCulled={false} renderOrder={OVERLAY_RENDER_ORDER} raycast={() => {}}>
      <meshBasicMaterial map={resources.source.texture} toneMapped={false}
        depthTest={false} depthWrite={false} transparent side={DoubleSide} />
    </mesh>
    <mesh ref={destinationMesh} visible={false} geometry={resources.apertureMesh} frustumCulled={false} renderOrder={OVERLAY_RENDER_ORDER + 1} raycast={() => {}}>
      <meshBasicMaterial map={resources.destination.texture} toneMapped={false}
        depthTest={false} depthWrite={false} transparent side={DoubleSide} />
    </mesh>
  </>;
}
