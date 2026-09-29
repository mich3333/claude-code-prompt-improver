import * as THREE from 'three';

/** Shared golden-hour palette so sky, fog, water and clouds agree on one horizon. */
export const SUN_DIR = new THREE.Vector3(0.62, 0.36, 0.7).normalize();
export const SUN_COLOR = new THREE.Color(0xffd3a0);
export const ZENITH = new THREE.Color(0x2463cf);
/** Light sky blue between horizon and zenith, so the warm-to-blue blend never passes through lilac. */
export const SKY_MID = new THREE.Color(0x6fa6e6);
export const HORIZON = new THREE.Color(0xf4d2ad);
export const WATER_LEVEL = 21.85;

/**
 * GLSL sky colour for a view direction. skyBase is the gradient plus the broad sun glow and is
 * what distant terrain fades into; skyColor adds the sun disk for the sky dome and reflections.
 */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
vec3 skyBase(vec3 dir) {
  float h = clamp(dir.y, 0.0, 1.0);
  // Warm horizon on the sun's side, cooler and paler opposite it.
  vec2 flat_ = normalize(dir.xz + 1e-5);
  float toward = dot(flat_, normalize(uSunDir.xz)) * 0.5 + 0.5;
  vec3 horizon = mix(mix(uHorizon, uMid, 0.35), uHorizon, toward);
  vec3 col = mix(horizon, uMid, smoothstep(0.0, 0.16, h));
  col = mix(col, uZenith, smoothstep(0.1, 0.7, h));
  float s = max(dot(dir, uSunDir), 0.0);
  return col + uSunColor * (pow(s, 24.0) * 0.22 + pow(s, 4.0) * 0.07);
}
vec3 skyColor(vec3 dir) {
  float s = max(dot(dir, uSunDir), 0.0);
  return skyBase(dir) + uSunColor * pow(s, 900.0) * 6.0;
}`;

export function skyUniforms() {
  return {
    uZenith: { value: ZENITH },
    uMid: { value: SKY_MID },
    uHorizon: { value: HORIZON },
    uSunDir: { value: SUN_DIR },
    uSunColor: { value: SUN_COLOR },
  };
}

/** 1 = fog takes the sky's colour per view direction; 0 = plain scene fog colour (underwater). */
export const skyFogAmount = { value: 1 };

/**
 * Replacement for three's fog_fragment. Three mixes fog *after* tone mapping and colour-space
 * conversion with an un-tonemapped colour, so a flat fog colour never matches the tone-mapped sky
 * dome and leaves a bright band on the horizon. Here the fog colour is the sky itself in the view
 * direction, pushed through the same tone mapping and output conversion.
 */
export const SKY_FOG_FRAGMENT = /* glsl */ `
#ifdef USE_FOG
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  vec3 skyFogDir = normalize(vSkyFogWorld - cameraPosition);
  skyFogDir.y = max(skyFogDir.y, 0.0);
  vec3 skyFog = linearToOutputTexel(vec4(toneMapping(skyBase(skyFogDir)), 1.0)).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(fogColor, skyFog, uSkyFog), fogFactor);
#endif`;

/** Patch a built-in material so its fog blends into the sky instead of a flat colour. */
export function applySkyFog(material: THREE.Material): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, skyUniforms(), { uSkyFog: skyFogAmount });
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vSkyFogWorld;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvSkyFogWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', `#include <fog_pars_fragment>\nvarying vec3 vSkyFogWorld;\nuniform float uSkyFog;\n${SKY_GLSL}`)
      .replace('#include <fog_fragment>', SKY_FOG_FRAGMENT);
  };
}
