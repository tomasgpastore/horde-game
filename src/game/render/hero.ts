import * as THREE from 'three';

/** Shared hero factory (Creative Director). Cloaked lantern-bearer, +Z forward.
 *  Dark body + emissive cyan accents (hem, eyes, lantern) so bloom + rim light make it pop on the dark floor. */
export interface Hero { group: THREE.Group; lantern: THREE.Mesh; light: THREE.PointLight }

export function createHero(opts: { scale?: number; lights?: boolean } = {}): Hero {
  const scale = opts.scale ?? 1;
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a2340, roughness: 0.8, flatShading: true, emissive: 0x0a1630, emissiveIntensity: 0.6 });
  const cyanMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3df2ff).multiplyScalar(1.6) });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; g.add(m); return m;
  };
  add(new THREE.ConeGeometry(0.62, 1.8, 6), dark, 0, 0.9, 0);                            // cloak
  const hem = add(new THREE.TorusGeometry(0.6, 0.035, 4, 12), cyanMat, 0, 0.06, 0, Math.PI / 2); hem.castShadow = false; // glowing hem
  add(new THREE.IcosahedronGeometry(0.23, 0), dark, 0, 1.92, 0);                         // head
  add(new THREE.ConeGeometry(0.3, 0.5, 6), dark, 0, 2.1, -0.02);                         // hood
  for (const sx of [-0.09, 0.09]) { const e = add(new THREE.BoxGeometry(0.07, 0.05, 0.05), cyanMat, sx, 1.9, 0.2); e.castShadow = false; } // eyes
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 5), dark, 0.42, 1.35, 0.18, 0.5, -0.5); // arm
  add(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 5), dark, 0.7, 1.15, 0.45);            // staff
  const lantern = add(new THREE.OctahedronGeometry(0.19, 0), cyanMat, 0.7, 2.2, 0.45); lantern.castShadow = false;
  const light = new THREE.PointLight(0x3df2ff, 16, 11, 1.6); light.position.copy(lantern.position);
  if (opts.lights !== false) g.add(light);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })); // 1.4u blob shadow
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; blob.renderOrder = 1; g.add(blob);
  g.scale.setScalar(scale);
  return { group: g, lantern, light };
}
