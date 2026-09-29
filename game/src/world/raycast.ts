import * as THREE from 'three';
import type { World } from './world';

export interface RayHit {
  block: [number, number, number];
  normal: [number, number, number];
}

/** Voxel traversal (Amanatides & Woo) returning the first solid block hit. */
export function raycastVoxels(world: World, origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RayHit | null {
  const pos = [Math.floor(origin.x), Math.floor(origin.y), Math.floor(origin.z)];
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  const step = [0, 0, 0];
  const tMax = [Infinity, Infinity, Infinity];
  const tDelta = [Infinity, Infinity, Infinity];

  for (let i = 0; i < 3; i++) {
    if (d[i] > 0) {
      step[i] = 1;
      tDelta[i] = 1 / d[i];
      tMax[i] = (pos[i] + 1 - o[i]) * tDelta[i];
    } else if (d[i] < 0) {
      step[i] = -1;
      tDelta[i] = -1 / d[i];
      tMax[i] = (o[i] - pos[i]) * tDelta[i];
    }
  }

  const normal: [number, number, number] = [0, 0, 0];
  let t = 0;
  while (t <= maxDist) {
    if (world.isSolidAt(pos[0], pos[1], pos[2])) {
      return { block: [pos[0], pos[1], pos[2]], normal: [...normal] };
    }
    const axis = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2;
    t = tMax[axis];
    pos[axis] += step[axis];
    tMax[axis] += tDelta[axis];
    normal[0] = normal[1] = normal[2] = 0;
    normal[axis] = -step[axis];
  }
  return null;
}
