import { RingGeometry } from "three";
/** Twenty-four dashes, with a matching index order for the dwell progress arc. */
export function createReticleRing(inner: number, outer: number) {
  const geometry = new RingGeometry(inner, outer, 96, 1, Math.PI / 2, -Math.PI * 2);
  const source = geometry.index!;
  const indices: number[] = [];
  for (let segment = 0; segment < 96; segment++) {
    if (segment % 4 >= 2) continue;
    for (let vertex = 0; vertex < 6; vertex++) indices.push(source.getX(segment * 6 + vertex));
  }
  geometry.setIndex(indices);
  return geometry;
}
