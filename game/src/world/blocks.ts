import { Tile } from '../render/textures';

export const Block = {
  Air: 0,
  Grass: 1,
  Dirt: 2,
  Stone: 3,
  Sand: 4,
  Wood: 5,
  Leaves: 6,
} as const;

export type BlockId = (typeof Block)[keyof typeof Block];

export interface BlockDef {
  name: string;
  solid: boolean;
  /** Atlas tile per face group. */
  tiles: { top: number; bottom: number; side: number };
}

const same = (t: number) => ({ top: t, bottom: t, side: t });

export const BLOCKS: Record<number, BlockDef> = {
  [Block.Air]: { name: 'Air', solid: false, tiles: same(0) },
  [Block.Grass]: { name: 'Grass', solid: true, tiles: { top: Tile.GrassTop, bottom: Tile.Dirt, side: Tile.GrassSide } },
  [Block.Dirt]: { name: 'Dirt', solid: true, tiles: same(Tile.Dirt) },
  [Block.Stone]: { name: 'Stone', solid: true, tiles: same(Tile.Stone) },
  [Block.Sand]: { name: 'Sand', solid: true, tiles: same(Tile.Sand) },
  [Block.Wood]: { name: 'Wood', solid: true, tiles: { top: Tile.LogTop, bottom: Tile.LogTop, side: Tile.LogSide } },
  [Block.Leaves]: { name: 'Leaves', solid: true, tiles: same(Tile.Leaves) },
};

export const isSolid = (id: number): boolean => id !== Block.Air && BLOCKS[id].solid;

/** Blocks available in the hotbar, in slot order. */
export const HOTBAR: BlockId[] = [Block.Grass, Block.Dirt, Block.Stone, Block.Sand, Block.Wood, Block.Leaves];
