import { Block } from './blocks';
import { Chunk, CHUNK_HEIGHT, CHUNK_SIZE } from './chunk';
import { fbm, hash2 } from './noise';

const SAND_LEVEL = 22;
const STONE_LEVEL = 44;
const TREE_CHANCE = 0.012;

export class TerrainGenerator {
  constructor(readonly seed: number) {}

  /** Y of the topmost solid block in a column. */
  heightAt(wx: number, wz: number): number {
    const continent = fbm(wx * 0.008, wz * 0.008, this.seed, 4);
    const hills = fbm(wx * 0.035, wz * 0.035, this.seed + 7, 3);
    const h = 31 + continent * 15 + hills * 5;
    return Math.max(1, Math.min(CHUNK_HEIGHT - 12, Math.floor(h)));
  }

  /** Nearest grass column to (x, z), searched in growing rings. */
  findSpawn(x: number, z: number): [number, number] {
    for (let r = 0; r < 64; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const wx = x + dx, wz = z + dz;
          if (this.surfaceBlock(this.heightAt(wx, wz)) === Block.Grass && !this.hasTree(wx, wz)) return [wx, wz];
        }
      }
    }
    return [x, z];
  }

  private surfaceBlock(h: number): number {
    if (h <= SAND_LEVEL) return Block.Sand;
    if (h >= STONE_LEVEL) return Block.Stone;
    return Block.Grass;
  }

  private hasTree(wx: number, wz: number): boolean {
    return hash2(wx, wz, this.seed + 1337) < TREE_CHANCE && this.surfaceBlock(this.heightAt(wx, wz)) === Block.Grass;
  }

  generate(chunk: Chunk): void {
    const x0 = chunk.cx * CHUNK_SIZE;
    const z0 = chunk.cz * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const h = this.heightAt(x0 + x, z0 + z);
        const top = this.surfaceBlock(h);
        const filler = top === Block.Grass ? Block.Dirt : top;
        for (let y = 0; y <= h; y++) {
          let id: number = Block.Stone;
          if (y === h) id = top;
          else if (y > h - 4) id = filler;
          chunk.set(x, y, z, id);
        }
      }
    }

    // Trees whose canopy (radius 2) can reach into this chunk.
    for (let wx = x0 - 2; wx < x0 + CHUNK_SIZE + 2; wx++) {
      for (let wz = z0 - 2; wz < z0 + CHUNK_SIZE + 2; wz++) {
        if (this.hasTree(wx, wz)) this.placeTree(chunk, wx, wz);
      }
    }
  }

  private placeTree(chunk: Chunk, wx: number, wz: number): void {
    const base = this.heightAt(wx, wz) + 1;
    const trunk = 4 + Math.floor(hash2(wx, wz, this.seed + 99) * 3);
    const put = (x: number, y: number, z: number, id: number, overwrite: boolean) => {
      const lx = x - chunk.cx * CHUNK_SIZE;
      const lz = z - chunk.cz * CHUNK_SIZE;
      if (lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
      if (overwrite || chunk.get(lx, y, lz) === Block.Air) chunk.set(lx, y, lz, id);
    };

    for (let dy = trunk - 2; dy <= trunk + 1; dy++) {
      const r = dy >= trunk ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const corner = Math.abs(dx) === r && Math.abs(dz) === r;
          if (corner && (r === 1 ? dy === trunk + 1 : hash2(wx + dx, wz + dz + dy, this.seed) < 0.5)) continue;
          put(wx + dx, base + dy, wz + dz, Block.Leaves, false);
        }
      }
    }
    for (let dy = 0; dy < trunk; dy++) put(wx, base + dy, wz, Block.Wood, true);
  }
}
