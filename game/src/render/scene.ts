import * as THREE from 'three';

const SKY = new THREE.Color(0x87b5e8);
const SUN_OFFSET = new THREE.Vector3(40, 70, 25);

export class GameScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400);
  readonly renderer: THREE.WebGLRenderer;
  private readonly sun = new THREE.DirectionalLight(0xfff4e0, 2.2);

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = SKY;
    this.scene.fog = new THREE.Fog(SKY, 50, 85);

    this.scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6b5a40, 1.1));

    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    s.camera.left = -45;
    s.camera.right = 45;
    s.camera.top = 45;
    s.camera.bottom = -45;
    s.camera.near = 1;
    s.camera.far = 200;
    s.bias = -0.0005;
    s.normalBias = 0.04;
    this.sun.castShadow = true;
    this.scene.add(this.sun, this.sun.target);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Keep the shadow frustum centred on the player, snapped to texels to avoid shimmering. */
  followSun(center: THREE.Vector3): void {
    const texel = 90 / this.sun.shadow.mapSize.x;
    const cx = Math.round(center.x / texel) * texel;
    const cz = Math.round(center.z / texel) * texel;
    this.sun.target.position.set(cx, center.y, cz);
    this.sun.position.set(cx + SUN_OFFSET.x, center.y + SUN_OFFSET.y, cz + SUN_OFFSET.z);
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
