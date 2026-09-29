import * as THREE from 'three';
import './style.css';
import { applySkyFog } from './render/atmosphere';
import { GameScene } from './render/scene';
import { createAtlasCanvas, createAtlasTexture } from './render/textures';
import { Block, HOTBAR } from './world/blocks';
import { TerrainGenerator } from './world/generator';
import { raycastVoxels, type RayHit } from './world/raycast';
import { World } from './world/world';
import { CHUNK_SIZE } from './world/chunk';
import { Input } from './player/input';
import { Player } from './player/player';
import { Hud } from './ui/hud';

const REACH = 6;
/** Physics runs at a fixed rate so movement speed is independent of frame rate. */
const STEP = 1 / 120;
const SEED = 1337;
/** Chunks in each direction; the haze is tuned to dissolve terrain exactly at this edge. */
const RENDER_DISTANCE = 7;

const view = new GameScene(document.getElementById('app')!, RENDER_DISTANCE * CHUNK_SIZE - 6, SEED);
const atlas = createAtlasCanvas();
const material = new THREE.MeshLambertMaterial({ map: createAtlasTexture(atlas), vertexColors: true });
applySkyFog(material);
const world = new World(view.scene, material, new TerrainGenerator(SEED), RENDER_DISTANCE);
const player = new Player(view.camera);
const input = new Input(view.renderer.domElement);
const hud = new Hud(atlas);

// Spawn at the centre of the world and mesh the nearby area before the first frame.
const [spawnX, spawnZ] = world.generator.findSpawn(8, 8);
player.spawn(spawnX + 0.5, world.generator.heightAt(spawnX, spawnZ) + 1, spawnZ + 0.5);
world.update(player.position.x, player.position.z, 25);
player.syncCamera();

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
);
highlight.visible = false;
view.scene.add(highlight);

let target: RayHit | null = null;
const eye = new THREE.Vector3();
const dir = new THREE.Vector3();

function updateTarget(): void {
  player.eyePosition(eye);
  view.camera.getWorldDirection(dir);
  target = raycastVoxels(world, eye, dir, REACH);
  highlight.visible = target !== null;
  if (target) highlight.position.set(target.block[0] + 0.5, target.block[1] + 0.5, target.block[2] + 0.5);
}

function breakBlock(): void {
  if (!target) return;
  world.setBlock(...target.block, Block.Air);
  updateTarget();
}

function placeBlock(): void {
  if (!target) return;
  const [x, y, z] = target.block.map((v, i) => v + target!.normal[i]);
  if (world.getBlock(x, y, z) !== Block.Air || player.intersectsBlock(x, y, z)) return;
  world.setBlock(x, y, z, hud.selectedBlock);
  updateTarget();
}

input.onMouseButton = (button) => {
  if (button === 0) breakBlock();
  else if (button === 2) placeBlock();
};
input.onWheel = (d) => hud.select(hud.selected + d);
window.addEventListener('keydown', (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= HOTBAR.length) hud.select(n - 1);
});
input.onLockChange = (locked) => hud.setOverlay(!locked);
hud.onOverlayClick(() => input.requestLock());

let last = performance.now();
let accumulator = 0;
let fpsTime = 0;
let frames = 0;
let fps = 0;

function frame(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;

  // Movement only while playing; the world keeps streaming either way.
  if (input.locked) {
    accumulator += dt;
    while (accumulator >= STEP) {
      player.update(STEP, input, world);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }
  world.update(player.position.x, player.position.z);
  updateTarget();
  view.update(now / 1000, player.position);
  view.render();

  frames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(frames / fpsTime);
    frames = 0;
    fpsTime = 0;
  }
  const p = player.position;
  hud.setDebug(
    `${fps} fps\nxyz ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}${player.onGround ? '  (ground)' : ''}` +
      (target ? `\nlooking at ${target.block.join(' ')}` : ''),
  );
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // Handle for manual/automated testing from the browser console.
  Object.assign(window, { game: { world, player, input, hud, view, getTarget: () => target } });
}
