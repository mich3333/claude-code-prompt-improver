import * as THREE from 'three';
import { SKY_GLSL, skyUniforms } from './atmosphere';

/** Gradient sky dome with a sun disk, re-centred on the camera every frame. */
export class Sky {
  readonly mesh: THREE.Mesh;

  constructor(radius: number) {
    const material = new THREE.ShaderMaterial({
      uniforms: skyUniforms(),
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        ${SKY_GLSL}
        void main() {
          gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  update(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }
}
