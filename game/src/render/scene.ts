import * as THREE from 'three';
import { HORIZON, SUN_COLOR, SUN_DIR, WATER_LEVEL, skyFogAmount } from './atmosphere';
import { Clouds } from './clouds';
import { Sky } from './sky';
import { Water } from './water';

const SUN_DISTANCE = 100;
const UNDERWATER = new THREE.Color(0x1d5a78);

export class GameScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 600);
  readonly renderer: THREE.WebGLRenderer;
  private readonly sun = new THREE.DirectionalLight(SUN_COLOR, 2.6);
  private readonly fog: THREE.Fog;
  private readonly sky = new Sky(450);
  private readonly water: Water;
  private readonly clouds: Clouds;
  private readonly underwaterFog = new THREE.Fog(UNDERWATER, 0.5, 16);
  private underwater = false;

  /** @param viewDistance blocks until terrain fully dissolves into the horizon haze */
  constructor(private readonly container: HTMLElement, viewDistance: number, seed: number) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.appendChild(this.renderer.domElement);

    // Aerial perspective: distant terrain fades into the same colour as the sky's horizon.
    this.fog = new THREE.Fog(HORIZON, viewDistance * 0.3, viewDistance);
    this.scene.fog = this.fog;
    this.scene.background = HORIZON;

    // Cool sky fill against a warm low sun gives the warm/cool depth contrast.
    this.scene.add(new THREE.HemisphereLight(0xa8cbff, 0x8a6a48, 1.7));

    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = -45;
    s.camera.right = 45;
    s.camera.top = 45;
    s.camera.bottom = -45;
    s.camera.near = 1;
    s.camera.far = 260;
    s.bias = -0.0005;
    s.normalBias = 0.05;
    this.sun.castShadow = true;
    this.scene.add(this.sun, this.sun.target);

    this.water = new Water(viewDistance * 2.4);
    this.clouds = new Clouds(seed);
    this.scene.add(this.sky.mesh, this.water.mesh, this.clouds.mesh);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Per-frame atmosphere: sun/shadow frustum follow the player, sky/water/clouds animate. */
  update(time: number, center: THREE.Vector3): void {
    const texel = 90 / this.sun.shadow.mapSize.x;
    const cx = Math.round(center.x / texel) * texel;
    const cz = Math.round(center.z / texel) * texel;
    this.sun.target.position.set(cx, center.y, cz);
    this.sun.position.set(cx, center.y, cz).addScaledVector(SUN_DIR, SUN_DISTANCE);
    this.sky.update(this.camera);
    this.water.update(time, this.camera);
    this.clouds.update(time, center);
    this.setUnderwater(this.camera.position.y < WATER_LEVEL);
  }

  /** Below the surface: murky short fog, no sky or clouds, and a blue screen tint. */
  private setUnderwater(under: boolean): void {
    if (under === this.underwater) return;
    this.underwater = under;
    this.scene.fog = under ? this.underwaterFog : this.fog;
    skyFogAmount.value = under ? 0 : 1;
    this.scene.background = under ? UNDERWATER : HORIZON;
    this.sky.mesh.visible = this.water.mesh.visible = this.clouds.mesh.visible = !under;
    this.container.classList.toggle('underwater', under);
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
