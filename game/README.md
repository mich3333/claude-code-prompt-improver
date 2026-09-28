# Voxel Sandbox

A small Minecraft-inspired voxel sandbox built with TypeScript, Three.js and Vite. Self-contained: it does not touch the prompt-improver plugin in the repository root.

## Run

```bash
cd game
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle in dist/
```

## Controls

| Input | Action |
|-------|--------|
| Click | capture mouse / start |
| WASD | move (Shift to sprint) |
| Mouse | look |
| Space | jump |
| Left click | break block |
| Right click | place selected block |
| 1–6 / wheel | select hotbar block |
| Esc | release mouse |

## Layout

| Path | Role |
|------|------|
| `src/main.ts` | bootstrap, fixed-step game loop, break/place actions |
| `src/world/blocks.ts` | block ids, per-face atlas tiles, hotbar |
| `src/world/noise.ts` | seeded value noise + fbm |
| `src/world/generator.ts` | heightmap terrain (sand/grass/stone bands) and trees |
| `src/world/chunk.ts` | 16×64×16 chunk storage |
| `src/world/mesher.ts` | face-culled chunk meshes with per-vertex ambient occlusion |
| `src/world/world.ts` | chunk streaming around the player, get/set block, remeshing |
| `src/world/raycast.ts` | voxel DDA for block targeting |
| `src/player/input.ts` | keyboard, pointer lock, mouse deltas |
| `src/player/player.ts` | AABB physics: gravity, jumping, per-axis collision |
| `src/render/scene.ts` | renderer, sky/fog, hemisphere + shadow-casting sun |
| `src/render/textures.ts` | procedurally painted texture atlas |
| `src/ui/hud.ts` | hotbar, overlay, debug readout |
