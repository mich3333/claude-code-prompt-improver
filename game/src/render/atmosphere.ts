import * as THREE from 'three';

/** Shared golden-hour palette so sky, fog, water and clouds agree on one horizon. */
export const SUN_DIR = new THREE.Vector3(0.62, 0.36, 0.7).normalize();
export const SUN_COLOR = new THREE.Color(0xffd3a0);
export const ZENITH = new THREE.Color(0x2166d9);
export const HORIZON = new THREE.Color(0xf6cfa6);
export const WATER_LEVEL = 21.85;

/** GLSL sky colour for a view direction; used by the sky dome and water reflections. */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
vec3 skyColor(vec3 dir) {
  float h = clamp(dir.y, 0.0, 1.0);
  // Warmer horizon on the sun's side, cooler opposite.
  float toward = dot(normalize(vec3(dir.x, 0.0, dir.z) + 1e-5), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))) * 0.5 + 0.5;
  vec3 horizon = mix(uHorizon * vec3(0.72, 0.86, 1.12), uHorizon, toward);
  vec3 col = mix(horizon, uZenith, smoothstep(0.0, 1.0, pow(h, 0.3)));
  float s = max(dot(dir, uSunDir), 0.0);
  col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.28 + pow(s, 4.0) * 0.08);
  return col;
}`;

export function skyUniforms() {
  return {
    uZenith: { value: ZENITH },
    uHorizon: { value: HORIZON },
    uSunDir: { value: SUN_DIR },
    uSunColor: { value: SUN_COLOR },
  };
}
