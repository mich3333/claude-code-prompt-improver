import * as THREE from 'three';
import { hash2, valueNoise } from '../world/noise';
import { SKY_GLSL, skyUniforms } from './atmosphere';

const CELL = 12;
const HEIGHT = 96;
const RANGE = 22; // cells in each direction
const DRIFT = 1.2; // blocks per second

/** Blocky cloud layer with its own distance haze (scene fog would wash it out overhead). */
export class Clouds {
  readonly mesh: THREE.InstancedMesh;
  private lastKey = '';
  private readonly dummy = new THREE.Object3D();

  constructor(private readonly seed: number) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // Opaque, so the faces between neighbouring cells stay hidden; distance haze blends each
    // cloud into the exact sky colour behind it instead of fading it out with transparency.
    const material = new THREE.ShaderMaterial({
      uniforms: { ...skyUniforms(), uFar: { value: RANGE * CELL * 0.95 } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vNormal = normal;
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFar;
        varying vec3 vNormal;
        varying vec3 vWorld;
        ${SKY_GLSL}
        void main() {
          // Sunlit tops, warm sides, cool shaded undersides.
          vec3 col = vNormal.y > 0.5 ? vec3(1.0) : vNormal.y < -0.5 ? vec3(0.74, 0.78, 0.88) : mix(vec3(0.92), uSunColor, 0.22);
          vec3 dir = normalize(vWorld - cameraPosition);
          float haze = smoothstep(uFar * 0.3, uFar, length(vWorld.xz - cameraPosition.xz));
          gl_FragColor = vec4(mix(col, skyBase(dir), haze), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      fog: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, material, (RANGE * 2 + 1) ** 2);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  update(time: number, center: THREE.Vector3): void {
    const drift = time * DRIFT;
    this.mesh.position.x = drift % CELL;
    const shift = Math.floor(drift / CELL);
    const cx = Math.floor((center.x - this.mesh.position.x) / CELL);
    const cz = Math.floor(center.z / CELL);
    const key = `${cx},${cz},${shift}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    let n = 0;
    for (let dx = -RANGE; dx <= RANGE; dx++) {
      for (let dz = -RANGE; dz <= RANGE; dz++) {
        const gx = cx + dx, gz = cz + dz;
        const nx = gx - shift; // pattern moves with the wind
        const v = valueNoise(nx * 0.18, gz * 0.18, this.seed) + valueNoise(nx * 0.45, gz * 0.45, this.seed + 3) * 0.35;
        if (v < 0.28) continue;
        const thick = 3 + Math.floor(hash2(nx, gz, this.seed) * 3);
        this.dummy.position.set(gx * CELL + CELL / 2, HEIGHT + thick / 2, gz * CELL + CELL / 2);
        this.dummy.scale.set(CELL, thick, CELL);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(n++, this.dummy.matrix);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
