import type * as THREE from 'three';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;

export class Chunk {
  readonly data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
  mesh: THREE.Mesh | null = null;
  dirty = true;

  constructor(
    readonly cx: number,
    readonly cz: number,
  ) {}

  static index(x: number, y: number, z: number): number {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  get(x: number, y: number, z: number): number {
    return this.data[Chunk.index(x, y, z)];
  }

  set(x: number, y: number, z: number, id: number): void {
    this.data[Chunk.index(x, y, z)] = id;
  }
}
