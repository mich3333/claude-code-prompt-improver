import * as THREE from 'three';

/** Procedurally painted 16x16 tiles packed into a single-row atlas. */
export const Tile = {
  GrassTop: 0,
  GrassSide: 1,
  Dirt: 2,
  Stone: 3,
  Sand: 4,
  LogSide: 5,
  LogTop: 6,
  Leaves: 7,
} as const;

export const TILE_SIZE = 16;
export const TILE_COUNT = Object.keys(Tile).length;

type RGB = [number, number, number];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintTile(ctx: CanvasRenderingContext2D, tile: number, pixel: (x: number, y: number, r: () => number) => RGB) {
  const rand = mulberry32(tile * 9973 + 17);
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const [r, g, b] = pixel(x, y, rand);
      const i = (y * TILE_SIZE + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, tile * TILE_SIZE, 0);
}

const jitter = (c: RGB, amount: number, r: () => number): RGB => {
  const k = 1 + (r() - 0.5) * amount;
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
};

const GRASS: RGB = [98, 168, 60];
const DIRT: RGB = [134, 96, 67];
const STONE: RGB = [128, 128, 128];
const SAND: RGB = [219, 207, 142];
const BARK: RGB = [104, 78, 47];
const RINGS: RGB = [176, 142, 88];
const LEAF: RGB = [58, 125, 42];

/** Canvas row 0 is the top of a tile (three flips canvases so it maps to v=1). */
export function createAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE * TILE_COUNT;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d')!;

  paintTile(ctx, Tile.GrassTop, (_x, _y, r) => jitter(GRASS, 0.3, r));
  paintTile(ctx, Tile.GrassSide, (x, y, r) => {
    const edge = 3 + ((x * 7) % 3 === 0 ? 1 : 0);
    return y < edge ? jitter(GRASS, 0.3, r) : jitter(DIRT, 0.3, r);
  });
  paintTile(ctx, Tile.Dirt, (_x, _y, r) => jitter(DIRT, 0.35, r));
  paintTile(ctx, Tile.Stone, (_x, _y, r) => (r() < 0.12 ? jitter([100, 100, 100], 0.2, r) : jitter(STONE, 0.18, r)));
  paintTile(ctx, Tile.Sand, (_x, _y, r) => jitter(SAND, 0.12, r));
  paintTile(ctx, Tile.LogSide, (x, _y, r) => jitter(x % 4 === 0 ? [80, 58, 34] : BARK, 0.2, r));
  paintTile(ctx, Tile.LogTop, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 7) return jitter(BARK, 0.2, r);
    return jitter(Math.floor(d) % 3 === 0 ? [140, 108, 64] : RINGS, 0.12, r);
  });
  paintTile(ctx, Tile.Leaves, (_x, _y, r) => (r() < 0.2 ? jitter([38, 90, 28], 0.2, r) : jitter(LEAF, 0.3, r)));
  return canvas;
}

export function createAtlasTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
