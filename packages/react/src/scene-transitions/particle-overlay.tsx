import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { GLSL_COMMON } from "./glsl";
import {
  OVERLAY_RENDER_ORDER,
  isPerspectiveCamera,
  overlayProgress,
  placeFullscreenOverlay,
} from "./overlay-utils";
import type { OverlayProps } from "./overlay-utils";

export const PARTICLE_GRID = 48;

const PARTICLE_COUNT = PARTICLE_GRID * PARTICLE_GRID;

const PARTICLE_VERTEX_SHADER = `
  attribute float instanceIndex;
  uniform float progress;
  uniform vec2 grid;
  varying vec2 vUv;
  varying float vAlpha;
  ${GLSL_COMMON}

  void main() {
    float id = instanceIndex;
    float gx = mod(id, grid.x);
    float gy = floor(id / grid.x);
    vec2 cell = vec2(gx, gy);
    float h = hash(cell);
    float h2 = hash(cell + 19.2);
    float h3 = hash(cell + 7.7);
    vec2 randomDir = normalize(vec2(h, h2) * 2.0 - 1.0 + 1e-5);
    vec2 fromCenter = (cell + 0.5) / grid - 0.5 + 1e-5;
    vec2 dir = normalize(mix(randomDir, normalize(fromCenter), 0.65));
    float delay = h3 * 0.28;
    float lt = clamp((progress - delay) / max(1.0 - delay, 0.001), 0.0, 1.0);
    float explode = lt * lt;
    float scale = mix(1.0, 0.18, explode);
    float angle = (h * 2.0 - 1.0) * explode * 4.2;
    float ca = cos(angle);
    float sa = sin(angle);
    vec2 cellSize = 1.0 / grid;
    vec2 local = position.xy * cellSize * scale;
    vec2 rotated = vec2(local.x * ca - local.y * sa, local.x * sa + local.y * ca);
    vec2 planeCenter = (cell + 0.5) / grid - 0.5;
    vec2 exploded = planeCenter + dir * explode * 0.9;
    vec3 pos = vec3(exploded + rotated, -explode * 0.14);
    vUv = (cell + uv) / grid;
    vAlpha = 1.0 - explode;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const PARTICLE_FRAGMENT_SHADER = `
  uniform sampler2D map;
  varying vec2 vUv;
  varying float vAlpha;

  void main() {
    vec4 old = texture2D(map, vUv);
    old.rgb *= 1.0 + 0.22 * (1.0 - vAlpha);
    gl_FragColor = vec4(old.rgb, old.a * vAlpha);
    #include <colorspace_fragment>
  }
`;

function createParticleGeometry(): InstancedBufferGeometry {
  const quad = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  if (quad.index) {
    geometry.setIndex(quad.index.clone());
  }
  geometry.setAttribute("position", quad.attributes.position.clone());
  geometry.setAttribute("uv", quad.attributes.uv.clone());
  const indexes = new Float32Array(PARTICLE_COUNT);
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    indexes[i] = i;
  }
  geometry.setAttribute("instanceIndex", new InstancedBufferAttribute(indexes, 1));
  geometry.instanceCount = PARTICLE_COUNT;
  quad.dispose();
  return geometry;
}

export function ParticleOverlay({
  snapshot,
  transition,
  running,
  runId,
  onFinish,
}: OverlayProps) {
  const { camera } = useThree();
  const meshRef = useRef<Mesh>(null);
  const startRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const directionRef = useRef(new Vector3());
  const geometry = useMemo(() => createParticleGeometry(), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          map: { value: snapshot.texture },
          progress: { value: 0 },
          grid: { value: new Vector2(PARTICLE_GRID, PARTICLE_GRID) },
        },
        vertexShader: PARTICLE_VERTEX_SHADER,
        fragmentShader: PARTICLE_FRAGMENT_SHADER,
      }),
    [snapshot.texture],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    startRef.current = null;
    finishedRef.current = false;
    material.uniforms.progress.value = 0;
  }, [material, runId]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !isPerspectiveCamera(camera)) {
      return;
    }
    placeFullscreenOverlay(mesh, camera, directionRef.current);

    if (!running || finishedRef.current) {
      return;
    }
    const next = overlayProgress(state.clock.elapsedTime, transition.duration, startRef.current);
    startRef.current = next.startTime;
    material.uniforms.progress.value = next.progress;
    if (next.progress === 1) {
      finishedRef.current = true;
      onFinish();
    }
  });

  return (
    <mesh
      ref={meshRef}
      frustumCulled={false}
      geometry={geometry}
      material={material}
      renderOrder={OVERLAY_RENDER_ORDER}
    />
  );
}
