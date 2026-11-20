import { MathUtils } from "three";

const MAX_FRAME_SECONDS = 0.05;
const NEAR_START = 6;
const NEAR_END = 11;

export type WeatherParticle = {
  x: number;
  y: number;
  z: number;
  halfWidth: number;
  halfHeight: number;
  bottom: number;
  size: number;
  speed: number;
  phase: number;
  roll: number;
  swayRate: number;
  spinRate: number;
};

export function createWeatherParticles(count: number, random = Math.random): WeatherParticle[] {
  return Array.from({ length: count }, (_, index) => {
    // The inner volume makes distinct shapes visible even at lower densities.
    const near = index % 4 === 0;
    const halfWidth = near ? 21 : 48;
    const halfHeight = near ? 19 : 38;
    const x = (2 * random() - 1) * halfWidth;
    const y = (2 * random() - 1) * halfHeight;
    const z = (2 * random() - 1) * halfWidth;
    const phase = random() * Math.PI * 2;
    return {
      x,
      y,
      z,
      halfWidth,
      halfHeight,
      bottom: -halfHeight,
      size: random(),
      speed: random(),
      phase,
      roll: phase,
      swayRate: 0.95 + random() * 0.65,
      spinRate: (random() < 0.5 ? -1 : 1) * (0.55 + random() * 0.45),
    };
  });
}

export function setWeatherParticleGround(particle: WeatherParticle, groundY: number | undefined) {
  const { y, halfHeight, bottom } = particle;
  const nextBottom = groundY ?? -halfHeight;
  // Keep the same relative height when the volume is resized by a live control.
  particle.y = halfHeight - (halfHeight - y) * (halfHeight - nextBottom) / (halfHeight - bottom);
  particle.bottom = nextBottom;
}

export function weatherFrameStep(seconds: number, hidden: boolean) {
  return !hidden && Number.isFinite(seconds) ? MathUtils.clamp(seconds, 0, MAX_FRAME_SECONDS) : 0;
}

function wrap(value: number, halfExtent: number) {
  if (value >= halfExtent) return value - 2 * halfExtent;
  if (value < -halfExtent) return value + 2 * halfExtent;
  return value;
}

export function moveWeatherParticle(
  particle: WeatherParticle,
  seconds: number,
  time: number,
  fallSpeed: number,
  windX: number,
  windZ: number,
  sway: number,
) {
  let x = particle.x + windX * seconds;
  let z = particle.z + windZ * seconds;
  if (sway > 0) {
    const start = particle.phase + time * particle.swayRate;
    const end = start + seconds * particle.swayRate;
    x += sway * (Math.sin(end) - Math.sin(start));
    z += sway * 0.6 * (Math.cos(end) - Math.cos(start));
  }
  particle.x = wrap(x, particle.halfWidth);
  particle.y -= fallSpeed * seconds;
  if (particle.y < particle.bottom) particle.y += particle.halfHeight - particle.bottom;
  particle.z = wrap(z, particle.halfWidth);
}

export function weatherParticleScale(particle: WeatherParticle) {
  const { x, y, z, bottom, halfHeight, halfWidth } = particle;
  const borderDistance = Math.min(halfHeight - y, halfWidth - Math.max(Math.abs(x), Math.abs(z)));
  const distanceSquared = x * x + y * y + z * z;
  return MathUtils.smoothstep(borderDistance, 0, 3) *
    MathUtils.smoothstep(y - bottom, 0, 1) *
    MathUtils.smoothstep(distanceSquared, NEAR_START ** 2, NEAR_END ** 2);
}
