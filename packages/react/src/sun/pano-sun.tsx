import { useFrame } from "@react-three/fiber";
import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending, MathUtils, PerspectiveCamera, Quaternion, Vector3,
  type Group, type Mesh, type MeshBasicMaterial, type PlaneGeometry,
} from "three";
import { panoPositionToVector3 } from "../hotspot/coordinates";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import { WebVRRuntimeContext } from "../webvr/host";
import { projectSunFlare, resolveSun, type PanoSunProps } from "./sun-settings";
import { createSunTexture } from "./sun-texture";

const SUN_RADIUS = DEFAULT_PANORAMA_RADIUS - 2;
const SUN_RENDER_ORDER = -20;
const GHOST_DISTANCE = DEFAULT_PANORAMA_RADIUS * 0.85;
const GHOSTS = [
  { offset: 0.57, size: 0.052, strength: 0.31 },
  { offset: 0.27, size: 0.078, strength: 0.46 },
  { offset: -0.32, size: 0.045, strength: 0.28 },
  { offset: -0.76, size: 0.125, strength: 0.38 },
] as const;

function ignoreRaycast() {}

function SunLayer({ layer, diameter, color, opacity }: {
  layer: "disc" | "glow" | "rays";
  diameter: number;
  color: string;
  opacity: number;
}) {
  const geometry = useRef<PlaneGeometry>(null);
  const material = useRef<MeshBasicMaterial>(null);

  useLayoutEffect(() => {
    const plane = geometry.current!;
    const positions = plane.attributes.position;
    const uv = plane.attributes.uv;
    const extent = Math.tan(MathUtils.degToRad(diameter / 2));

    // Map the tangent plane to the inside of the panorama shell.
    for (let i = 0; i < positions.count; i++) {
      const x = (2 * uv.getX(i) - 1) * extent;
      const y = (2 * uv.getY(i) - 1) * extent;
      const scale = SUN_RADIUS / Math.hypot(x, y, 1);
      positions.setXYZ(i, x * scale, y * scale, -scale);
    }
    positions.needsUpdate = true;
    plane.computeBoundingSphere();
  }, [diameter]);

  useLayoutEffect(() => {
    const texture = createSunTexture(layer);
    const layerMaterial = material.current!;
    layerMaterial.map = texture;
    layerMaterial.needsUpdate = true;
    return () => texture.dispose();
  }, [layer]);

  return (
    <mesh raycast={ignoreRaycast} renderOrder={SUN_RENDER_ORDER}>
      <planeGeometry ref={geometry} args={[1, 1, 16, 16]} />
      <meshBasicMaterial
        ref={material}
        blending={AdditiveBlending}
        color={color}
        depthWrite={false}
        opacity={opacity}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

function SunFlare({ center, color, strength }: { center: Vector3; color: string; strength: number }) {
  const vr = useContext(WebVRRuntimeContext);
  const group = useRef<Group>(null);
  const scratch = useMemo(() => ({
    projected: new Vector3(),
    position: new Vector3(),
    rotation: new Quaternion(),
  }), []);

  useLayoutEffect(() => {
    const texture = createSunTexture("flare");
    for (const mesh of group.current!.children as Mesh<PlaneGeometry, MeshBasicMaterial>[]) {
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
    }
    return () => texture.dispose();
  }, []);

  useFrame(({ camera, gl }) => {
    const ghosts = group.current!;
    if (vr?.mode || vr?.stereoView.active || gl.xr.isPresenting || !(camera instanceof PerspectiveCamera)) {
      ghosts.visible = false;
      return;
    }

    const { projected, position, rotation } = scratch;
    const fade = projectSunFlare(center, camera, projected);
    ghosts.visible = fade > 0;
    if (!ghosts.visible) return;

    camera.getWorldQuaternion(rotation);
    const shortSide = Math.min(1, camera.aspect);
    const projectionScale = camera.projectionMatrix.elements[5];
    const meshes = ghosts.children as Mesh<PlaneGeometry, MeshBasicMaterial>[];
    for (let i = 0; i < GHOSTS.length; i++) {
      const ghost = GHOSTS[i];
      const mesh = meshes[i];
      // Back-project through the camera to keep the ghost round and on the
      // sun-to-center axis at any aspect ratio or zoom.
      position.set(projected.x * ghost.offset, projected.y * ghost.offset, 0.5)
        .applyMatrix4(camera.projectionMatrixInverse)
        .setLength(GHOST_DISTANCE);
      const size = ghost.size * shortSide * (-2 * position.z / projectionScale);
      mesh.position.copy(position).applyMatrix4(camera.matrixWorld);
      mesh.quaternion.copy(rotation);
      mesh.scale.set(size, size, 1);
      mesh.material.opacity = strength * fade * ghost.strength;
    }
  });

  return (
    <group ref={group} visible={false}>
      {GHOSTS.map(({ offset }) => (
        <mesh key={offset} raycast={ignoreRaycast} renderOrder={SUN_RENDER_ORDER}>
          <planeGeometry />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={color}
            depthWrite={false}
            toneMapped={false}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

/** Renders sunlight and lens flare inside a PanoViewer. */
export function PanoSun(props: PanoSunProps) {
  const sun = resolveSun(props);
  if (!sun) return null;

  const { position, angularSize, glowAngularSize, raysAngularSize, color, disc, glow, rays, flare } = sun;
  return (
    <>
      <group rotation={[
        MathUtils.degToRad(position.pitch), MathUtils.degToRad(-position.yaw), 0, "YXZ",
      ]}>
        {glow > 0 && <SunLayer layer="glow" diameter={glowAngularSize} color={color} opacity={glow} />}
        {rays > 0 && <SunLayer layer="rays" diameter={raysAngularSize} color={color} opacity={rays} />}
        {disc > 0 && <SunLayer layer="disc" diameter={angularSize} color="#fffdf6" opacity={disc} />}
      </group>
      {flare > 0 && <SunFlare center={panoPositionToVector3(position, SUN_RADIUS)} color={color} strength={flare} />}
    </>
  );
}
