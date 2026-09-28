import * as THREE from 'three';
import { BLOCKS, Block, isSolid } from './blocks';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './chunk';
import { TILE_COUNT } from '../render/textures';

type Vec3 = [number, number, number];

interface Face {
  normal: Vec3;
  /** Corner offsets in CCW order seen from outside; first two are the bottom edge for side faces. */
  corners: Vec3[];
  group: 'top' | 'bottom' | 'side';
}

const FACES: Face[] = [
  { normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], group: 'side' },
  { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], group: 'side' },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], group: 'top' },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], group: 'bottom' },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], group: 'side' },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], group: 'side' },
];
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const AO_BRIGHTNESS = [0.45, 0.65, 0.82, 1];
/** Inset UVs slightly so nearest sampling never bleeds into a neighbouring tile. */
const UV_INSET = 0.001;

export type BlockLookup = (wx: number, wy: number, wz: number) => number;

/** Builds a face-culled, ambient-occluded mesh for one chunk. Returns null when empty. */
export function buildChunkGeometry(chunk: Chunk, lookup: BlockLookup): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const x0 = chunk.cx * CHUNK_SIZE;
  const z0 = chunk.cz * CHUNK_SIZE;
  const blockAt = (lx: number, y: number, lz: number): number => {
    if (y < 0 || y >= CHUNK_HEIGHT) return Block.Air;
    if (lx >= 0 && lz >= 0 && lx < CHUNK_SIZE && lz < CHUNK_SIZE) return chunk.get(lx, y, lz);
    return lookup(x0 + lx, y, z0 + lz);
  };
  const occ = (x: number, y: number, z: number) => (isSolid(blockAt(x, y, z)) ? 1 : 0);

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z);
        if (id === Block.Air) continue;
        const def = BLOCKS[id];

        for (const face of FACES) {
          const [nx, ny, nz] = face.normal;
          if (isSolid(blockAt(x + nx, y + ny, z + nz))) continue;

          const tile = def.tiles[face.group];
          const u0 = tile / TILE_COUNT + UV_INSET;
          const u1 = (tile + 1) / TILE_COUNT - UV_INSET;
          const base = positions.length / 3;
          const ao: number[] = [];

          face.corners.forEach((c, i) => {
            positions.push(x0 + x + c[0], y + c[1], z0 + z + c[2]);
            normals.push(nx, ny, nz);
            uvs.push(UVS[i][0] ? u1 : u0, UVS[i][1] ? 1 - UV_INSET : UV_INSET);

            // Classic voxel AO: sample the layer in front of the face around this corner.
            const ax = x + nx, ay = y + ny, az = z + nz;
            const d = [c[0] * 2 - 1, c[1] * 2 - 1, c[2] * 2 - 1];
            let s1: number, s2: number, corner: number;
            if (nx !== 0) {
              s1 = occ(ax, ay + d[1], az);
              s2 = occ(ax, ay, az + d[2]);
              corner = occ(ax, ay + d[1], az + d[2]);
            } else if (ny !== 0) {
              s1 = occ(ax + d[0], ay, az);
              s2 = occ(ax, ay, az + d[2]);
              corner = occ(ax + d[0], ay, az + d[2]);
            } else {
              s1 = occ(ax + d[0], ay, az);
              s2 = occ(ax, ay + d[1], az);
              corner = occ(ax + d[0], ay + d[1], az);
            }
            const level = s1 && s2 ? 0 : 3 - (s1 + s2 + corner);
            ao.push(level);
            const b = AO_BRIGHTNESS[level];
            colors.push(b, b, b);
          });

          // Flip the quad diagonal so AO interpolates without artifacts.
          if (ao[0] + ao[2] >= ao[1] + ao[3]) {
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          } else {
            indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
          }
        }
      }
    }
  }

  if (indices.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}
