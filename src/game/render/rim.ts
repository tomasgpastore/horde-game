import * as THREE from 'three';
/** Fresnel rim light: adds `color * strength` emissive at grazing angles so dark silhouettes separate from the dark ground
 *  (and bloom picks the edge up). Works on Lambert/Standard incl. InstancedMesh + flatShading; no extra draw calls/lights. */
export function addRim<M extends THREE.Material>(mat: M, color: number, strength = 0.9, power = 2.5): M {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    prev?.call(mat, shader, r);
    shader.uniforms.rimColor = { value: new THREE.Color(color) }; shader.uniforms.rimK = { value: strength };
    shader.fragmentShader = 'uniform vec3 rimColor; uniform float rimK;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\n totalEmissiveRadiance += rimColor * rimK * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), ${power.toFixed(1)});`);
  };
  mat.customProgramCacheKey = () => `rim${color}${strength}${power}`;
  return mat;
}
