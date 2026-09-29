import * as THREE from 'three';
import { Block, isSolid } from './blocks';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './chunk';
import { TerrainGenerator } from './generator';
import { buildChunkGeometry } from './mesher';

const key = (cx: number, cz: number) => `${cx},${cz}`;

export class World {
  /** Chunk data is kept once generated so player edits persist while walking around. */
  private readonly chunks = new Map<string, Chunk>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly material: THREE.Material,
    readonly generator: TerrainGenerator,
    public renderDistance = 5,
  ) {}

  private getOrCreateChunk(cx: number, cz: number): Chunk {
    let chunk = this.chunks.get(key(cx, cz));
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.generator.generate(chunk);
      this.chunks.set(key(cx, cz), chunk);
    }
    return chunk;
  }

  getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0) return Block.Stone; // Unbreakable floor below the world.
    if (wy >= CHUNK_HEIGHT) return Block.Air;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(key(cx, cz));
    if (!chunk) return Block.Air;
    return chunk.get(wx - cx * CHUNK_SIZE, wy, wz - cz * CHUNK_SIZE);
  }

  isSolidAt(wx: number, wy: number, wz: number): boolean {
    return isSolid(this.getBlock(wx, wy, wz));
  }

  setBlock(wx: number, wy: number, wz: number, id: number): boolean {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(key(cx, cz));
    if (!chunk) return false;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    chunk.set(lx, wy, lz, id);
    chunk.dirty = true;
    // Neighbours share faces / AO samples along the border.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const nearX = dx === 0 || (dx < 0 ? lx === 0 : lx === CHUNK_SIZE - 1);
        const nearZ = dz === 0 || (dz < 0 ? lz === 0 : lz === CHUNK_SIZE - 1);
        const n = nearX && nearZ ? this.chunks.get(key(cx + dx, cz + dz)) : undefined;
        if (n) n.dirty = true;
      }
    }
    // Edits are rare; rebuild immediately so feedback is instant.
    this.rebuildDirty(Infinity, cx, cz, 1);
    return true;
  }

  /**
   * Generates chunk data around the player and (re)meshes up to `budget` chunks per call,
   * nearest first. Meshes outside the render distance are dropped.
   */
  update(px: number, pz: number, budget = 2): void {
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const r = this.renderDistance;

    for (const chunk of this.chunks.values()) {
      if (chunk.mesh && (Math.abs(chunk.cx - pcx) > r + 1 || Math.abs(chunk.cz - pcz) > r + 1)) {
        this.disposeMesh(chunk);
        chunk.dirty = true;
      }
    }
    this.rebuildDirty(budget, pcx, pcz, r);
  }

  private rebuildDirty(budget: number, pcx: number, pcz: number, r: number): void {
    const candidates: Chunk[] = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        // Data is needed one ring further out so border faces and AO are correct.
        const chunk = this.getOrCreateChunk(pcx + dx, pcz + dz);
        if (chunk.dirty) candidates.push(chunk);
      }
    }
    candidates.sort((a, b) => Math.hypot(a.cx - pcx, a.cz - pcz) - Math.hypot(b.cx - pcx, b.cz - pcz));
    for (const chunk of candidates.slice(0, budget)) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.getOrCreateChunk(chunk.cx + dx, chunk.cz + dz);
      this.remesh(chunk);
    }
  }

  private remesh(chunk: Chunk): void {
    this.disposeMesh(chunk);
    chunk.dirty = false;
    const geo = buildChunkGeometry(chunk, (x, y, z) => this.getBlock(x, y, z));
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
    chunk.mesh = mesh;
  }

  private disposeMesh(chunk: Chunk): void {
    if (!chunk.mesh) return;
    this.scene.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
    chunk.mesh = null;
  }

  pendingCount(px: number, pz: number): number {
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    let n = 0;
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        const c = this.chunks.get(key(pcx + dx, pcz + dz));
        if (!c || c.dirty) n++;
      }
    }
    return n;
  }
}
