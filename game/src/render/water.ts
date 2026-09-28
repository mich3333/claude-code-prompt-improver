import * as THREE from 'three';
import { SKY_GLSL, skyUniforms, WATER_LEVEL } from './atmosphere';

/**
 * Flat animated water sheet at sea level that follows the player. It reflects the sky
 * gradient (Fresnel) and glints toward the sun, which is the main depth cue on lakes.
 */
export class Water {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(size: number) {
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          vec4 mvPosition = viewMatrix * world;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform float uTime;
        varying vec3 vWorld;
        ${SKY_GLSL}
        void main() {
          vec2 p = vWorld.xz;
          // Cheap layered ripples for a moving normal.
          vec3 n = normalize(vec3(
            sin(p.x * 0.9 + uTime * 1.3) * 0.04 + sin(p.y * 1.7 - uTime * 0.9) * 0.025,
            1.0,
            cos(p.y * 0.8 + uTime * 1.1) * 0.04 + cos(p.x * 1.5 + uTime * 0.7) * 0.025));
          vec3 view = normalize(cameraPosition - vWorld);
          float fresnel = pow(1.0 - max(dot(view, n), 0.0), 4.0);
          vec3 refl = reflect(-view, n);
          refl.y = abs(refl.y);
          vec3 deep = vec3(0.04, 0.2, 0.3);
          vec3 col = mix(deep, skyColor(refl), 0.25 + 0.75 * fresnel);
          gl_FragColor = vec4(col, mix(0.72, 0.95, fresnel));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    Object.assign(this.material.uniforms, skyUniforms());
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 1;
  }

  update(time: number, camera: THREE.Camera): void {
    this.material.uniforms.uTime.value = time;
    this.mesh.position.set(Math.round(camera.position.x), WATER_LEVEL, Math.round(camera.position.z));
  }
}
