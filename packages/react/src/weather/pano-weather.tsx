import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { DoubleSide, DynamicDrawUsage, MathUtils, Matrix4, Vector3 } from "three";
import type { InstancedMesh, MeshBasicMaterial } from "three";
import {
  createWeatherParticles,
  moveWeatherParticle,
  setWeatherParticleGround,
  weatherFrameStep,
  weatherParticleScale,
} from "./particles";
import {
  normalizeWeatherValue,
  resolveSnowGroundY,
  resolveSnowSizeRange,
  resolveWeatherStyle,
  WEATHER_CAPACITY,
  weatherParticleCount,
  type PanoWeatherProps,
  type WeatherStyle,
} from "./presets";
import { createWeatherTexture } from "./texture";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const WORLD_UP = new Vector3(0, 1, 0);
const WORLD_FORWARD = new Vector3(0, 0, 1);
const RAIN_WIND_RATIO = 0.66;

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function prefersReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION).matches ?? false;
}

function ignoreRaycast() {}

function WeatherParticles({ type, style, intensity, windX, windZ, widthRange, groundY }: {
  type: PanoWeatherProps["type"];
  style: WeatherStyle;
  intensity: number;
  windX: number;
  windZ: number;
  widthRange: WeatherStyle["width"];
  groundY?: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const time = useRef(0);
  const capacity = WEATHER_CAPACITY[type];
  const particles = useMemo(() => createWeatherParticles(capacity), [capacity]);
  const scratch = useMemo(() => ({
    matrix: new Matrix4(),
    rotation: new Matrix4(),
    normal: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    size: new Vector3(),
  }), []);
  const rain = type === "rain";
  const shape = style.shape;

  useLayoutEffect(() => {
    meshRef.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useLayoutEffect(() => {
    for (const particle of particles) setWeatherParticleGround(particle, groundY);
  }, [groundY, particles]);

  useLayoutEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    const texture = createWeatherTexture(shape);
    material.map = texture;
    material.needsUpdate = true;
    return () => texture.dispose();
  }, [shape]);

  useFrame(({ gl }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const session = gl.xr.getSession();
    const hidden = session ? session.visibilityState === "hidden" : gl.domElement.ownerDocument.hidden;
    const seconds = weatherFrameStep(delta, hidden);
    if (seconds === 0) return;

    const { matrix, rotation, normal, right, up, size } = scratch;
    const count = weatherParticleCount(style.count, intensity);
    if (rain) up.set(-RAIN_WIND_RATIO * windX, 1, -RAIN_WIND_RATIO * windZ).normalize();
    let visibleCount = 0;
    for (let i = 0; i < count; i++) {
      const particle = particles[i];
      const fallSpeed = MathUtils.lerp(...style.fallSpeed, particle.speed);
      const windSpeed = rain ? RAIN_WIND_RATIO * fallSpeed : 2.6;
      const dx = windX * windSpeed;
      const dz = windZ * windSpeed;
      moveWeatherParticle(particle, seconds, time.current, fallSpeed, dx, dz, style.sway);
      particle.roll += seconds * particle.spinRate * style.spin;
      const fade = weatherParticleScale(particle);
      if (fade === 0) continue;

      const { x, y, z } = particle;
      normal.set(-x, -y, -z).normalize();
      right.crossVectors(rain ? up : WORLD_UP, normal);
      if (right.lengthSq() < 1e-8) {
        right.crossVectors(rain ? up : normal, WORLD_FORWARD);
      }
      right.normalize();
      if (rain) normal.crossVectors(right, up);
      else up.crossVectors(normal, right);
      matrix.makeBasis(right, up, normal);
      if (!rain) {
        matrix.multiply(rotation.makeRotationZ(particle.roll));
      }

      const width = MathUtils.lerp(...widthRange, particle.size);
      const height = style.height ? MathUtils.lerp(...style.height, particle.size) : width;
      matrix.scale(size.set(width * fade, height * fade, 1)).setPosition(x, y, z);
      mesh.setMatrixAt(visibleCount++, matrix);
    }
    time.current += seconds;
    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
  }, -1);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      count={0}
      frustumCulled={false}
      raycast={ignoreRaycast}
      renderOrder={-10}
    >
      <planeGeometry />
      <meshBasicMaterial
        ref={materialRef}
        color={rain ? "#d6e6f5" : "#ffffff"}
        depthWrite={false}
        forceSinglePass
        opacity={style.opacity}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </instancedMesh>
  );
}

/** Renders world-space precipitation inside a PanoViewer. */
export function PanoWeather(props: PanoWeatherProps) {
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => true);
  const intensity = normalizeWeatherValue(props.intensity, 0, 0.6);
  if (props.enabled === false || intensity === 0 || reduceMotion) return null;
  const style = resolveWeatherStyle(props);

  return (
    <WeatherParticles
      key={props.type}
      type={props.type}
      style={style}
      intensity={intensity}
      windX={normalizeWeatherValue(props.wind?.[0], -1, 0)}
      windZ={normalizeWeatherValue(props.wind?.[1], -1, 0)}
      widthRange={props.type === "snow" ? resolveSnowSizeRange(props.sizeRange, style.width) : style.width}
      groundY={props.type === "snow" ? resolveSnowGroundY(props.groundY) : undefined}
    />
  );
}
