import * as THREE from 'three';
import type { World } from '../world/world';
import type { Input } from './input';
import { waterDepth } from '../world/water';

const HALF_WIDTH = 0.3;
const HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 6.2;
const GRAVITY = 28;
const JUMP_VELOCITY = 8.6;
const TERMINAL_VELOCITY = 55;
const MOUSE_SENSITIVITY = 0.0022;
const SKIN = 1e-4;

// Water: buoyancy nearly cancels gravity, drag caps speeds, Space swims up.
const SWIM_SPEED = 2.6;
const SWIM_SPRINT_SPEED = 3.4;
const WATER_GRAVITY = 9;
const SWIM_UP_ACCEL = 22;
const WATER_DRAG = 3;
const MAX_SINK_SPEED = 3;
const MAX_SWIM_UP_SPEED = 4;
/** Upward kick when swimming into the shore at the surface, enough to climb out onto the bank. */
const WATER_EXIT_VELOCITY = 9;
/** Feet this deep (blocks) or deeper count as swimming. */
const SWIM_DEPTH = 0.2;

/** First-person player: `position` is the centre of the feet. */
export class Player {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  /** Feet are under water deep enough to swim. */
  inWater = false;
  /** Moved into a wall on a horizontal axis during the last update. */
  private hitWall = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  spawn(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx * MOUSE_SENSITIVITY;
    this.pitch -= dy * MOUSE_SENSITIVITY;
    const limit = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  update(dt: number, input: Input, world: World): void {
    const [mx, my] = input.consumeMouse();
    this.look(mx, my);

    const fwd = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const strafe = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const depth = waterDepth(this.position.y);
    this.inWater = depth >= SWIM_DEPTH;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = this.inWater ? (sprint ? SWIM_SPRINT_SPEED : SWIM_SPEED) : sprint ? SPRINT_SPEED : WALK_SPEED;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wx = -sin * fwd + cos * strafe;
    let wz = -cos * fwd - sin * strafe;
    const len = Math.hypot(wx, wz);
    if (len > 0) {
      wx = (wx / len) * speed;
      wz = (wz / len) * speed;
    }
    // Snappy on the ground, a little floaty in the air, sluggish in water.
    const accel = Math.min(1, dt * (this.inWater ? 5 : this.onGround ? 20 : 6));
    this.velocity.x += (wx - this.velocity.x) * accel;
    this.velocity.z += (wz - this.velocity.z) * accel;

    const jump = input.consumePress('Space') || input.isDown('Space');
    if (this.inWater) {
      this.velocity.y -= WATER_GRAVITY * dt;
      if (jump) this.velocity.y += SWIM_UP_ACCEL * dt;
      this.velocity.y *= Math.exp(-WATER_DRAG * dt);
      this.velocity.y = Math.min(MAX_SWIM_UP_SPEED, Math.max(-MAX_SINK_SPEED, this.velocity.y));
      // Swimming into the bank near the surface: kick up and out.
      if (jump && this.hitWall && depth < 1.2) this.velocity.y = WATER_EXIT_VELOCITY;
    } else {
      if (jump && this.onGround) {
        this.velocity.y = JUMP_VELOCITY;
        this.onGround = false;
      }
      this.velocity.y = Math.max(-TERMINAL_VELOCITY, this.velocity.y - GRAVITY * dt);
    }

    // Substep so no single move exceeds ~0.4 blocks on any axis (no tunnelling).
    const maxMove = Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.y), Math.abs(this.velocity.z)) * dt;
    const steps = Math.max(1, Math.ceil(maxMove / 0.4));
    const h = dt / steps;
    this.onGround = false;
    this.hitWall = false;
    for (let i = 0; i < steps; i++) {
      this.moveAxis(1, this.velocity.y * h, world);
      this.moveAxis(0, this.velocity.x * h, world);
      this.moveAxis(2, this.velocity.z * h, world);
    }

    if (this.position.y < -30) this.respawn(world);
    this.syncCamera();
  }

  respawn(world: World): void {
    const x = Math.floor(this.position.x) + 0.5;
    const z = Math.floor(this.position.z) + 0.5;
    this.spawn(x, world.generator.heightAt(Math.floor(x), Math.floor(z)) + 1, z);
  }

  syncCamera(): void {
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  eyePosition(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }

  /** Whether the player's box overlaps the unit block at (bx, by, bz). */
  intersectsBlock(bx: number, by: number, bz: number): boolean {
    const p = this.position;
    return (
      p.x + HALF_WIDTH > bx && p.x - HALF_WIDTH < bx + 1 &&
      p.y + HEIGHT > by && p.y < by + 1 &&
      p.z + HALF_WIDTH > bz && p.z - HALF_WIDTH < bz + 1
    );
  }

  private moveAxis(axis: 0 | 1 | 2, delta: number, world: World): void {
    if (delta === 0) return;
    const p = this.position;
    p.setComponent(axis, p.getComponent(axis) + delta);

    const x0 = Math.floor(p.x - HALF_WIDTH), x1 = Math.ceil(p.x + HALF_WIDTH) - 1;
    const y0 = Math.floor(p.y), y1 = Math.ceil(p.y + HEIGHT) - 1;
    const z0 = Math.floor(p.z - HALF_WIDTH), z1 = Math.ceil(p.z + HALF_WIDTH) - 1;

    let hit = false;
    let limit = delta > 0 ? Infinity : -Infinity;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          if (!world.isSolidAt(x, y, z)) continue;
          hit = true;
          const b = axis === 0 ? x : axis === 1 ? y : z;
          limit = delta > 0 ? Math.min(limit, b) : Math.max(limit, b + 1);
        }
      }
    }
    if (!hit) return;

    const lo = axis === 1 ? 0 : HALF_WIDTH; // extent below the position on this axis
    const hi = axis === 1 ? HEIGHT : HALF_WIDTH; // extent above
    if (delta > 0) {
      p.setComponent(axis, limit - hi - SKIN);
    } else {
      p.setComponent(axis, limit + lo + (axis === 1 ? 0 : SKIN));
      if (axis === 1) this.onGround = true;
    }
    if (axis !== 1) this.hitWall = true;
    this.velocity.setComponent(axis, 0);
  }
}
