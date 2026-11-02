import * as THREE from 'three';

/** Procedural boss models (Creative Director). Each is a THREE.Group, +Z forward, ~5-8u tall, dark body + emissive accents.
 *  Usage: const b = createBoss('hollow_stag'); scene.add(b.group); each frame b.update(t, phase01, telegraph01).
 *   - telegraph01 (0..1) ramps glow/scale pulse before an attack; phase01 (0..1) = fraction of HP lost (cracks brighten). */
export type BossId = 'hollow_stag' | 'bell_warden' | 'the_unlit';
export interface Boss { group: THREE.Group; update(t: number, hpLost: number, telegraph: number): void; flash(on: boolean): void; radius: number }

const dark = (c: number, e = 0.15) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, emissive: c, emissiveIntensity: e });
const glowMat = (c: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8), toneMapped: false });

function rig() {
  const group = new THREE.Group(); const glows: THREE.MeshBasicMaterial[] = []; const bodies: THREE.MeshStandardMaterial[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial; parent.add(m); return m;
  };
  const body = (c: number) => { const m = dark(c); bodies.push(m); return m; };
  const glow = (c: number) => { const m = glowMat(c); glows.push(m); return m; };
  return { group, glows, bodies, add, body, glow };
}
function finish(r: ReturnType<typeof rig>, radius: number, glowColor: number, anim: (t: number, hp: number, tel: number) => void): Boss {
  const base = new THREE.Color(glowColor).multiplyScalar(1.8), hot = new THREE.Color(0xffffff).multiplyScalar(3);
  { // fresnel rim: a bright silhouette edge in the boss colour so a dark body still reads against the dark floor / horde (Artist)
    const rimColor = new THREE.Color(glowColor);
    for (const m of r.bodies) { m.onBeforeCompile = sh => { sh.uniforms.rimColor = { value: rimColor };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += rimColor * pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.6) * 2.0;'); }; m.needsUpdate = true; }
  }
  const lights = new THREE.PointLight(glowColor, 20, 16, 1.6); lights.position.set(0, 3, 0); r.group.add(lights);
  return {
    group: r.group, radius,
    update(t, hp, tel) {
      anim(t, hp, tel);
      const k = Math.min(1, tel);
      for (const g of r.glows) g.color.copy(base).lerp(hot, k * (0.5 + 0.5 * Math.sin(t * 30))).multiplyScalar(1 + hp * 0.6);
      lights.intensity = 20 + hp * 20 + k * 40;
      r.group.scale.setScalar(1 + k * 0.06 * Math.sin(t * 40));
    },
    flash(on) { for (const m of r.bodies) m.emissiveIntensity = on ? 2.5 : 0.15; },
  };
}

/** THE HOLLOW STAG (Ashen Woods): skeletal stag, ember-lit antlers, ribcage fire. ~5u tall. */
function stag(): Boss {
  const r = rig(); const bone = r.body(0x3b2a26), ember = r.glow(0xff6a2b); const { add } = r;
  const torso = add(new THREE.IcosahedronGeometry(1.5, 0), bone, 0, 2.4, 0); torso.scale.set(1, 0.9, 1.7);
  for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 1.3, 0.08), ember, s * 0.75, 2.5, i * 0.5, 0, 0, s * 0.35);   // glowing ribs
  const neck = add(new THREE.CylinderGeometry(0.5, 0.75, 1.8, 6), bone, 0, 3.3, 1.9, 0.9, 0, 0);
  const head = add(new THREE.ConeGeometry(0.55, 1.4, 5), bone, 0, 4.0, 2.7, Math.PI / 2 + 0.3, 0, 0);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.22, 0.14, 0.1), ember, s * 0.25, 4.15, 3.1);                                   // eyes
    let px = s * 0.35, py = 4.6, pz = 2.4;                                                                    // antlers: branching tines
    for (let i = 0; i < 4; i++) { const seg = add(new THREE.CylinderGeometry(0.08, 0.14, 1.1, 4), bone, px + s * 0.25, py + 0.45, pz - 0.2, -0.2, 0, -s * 0.5); px += s * 0.45; py += 0.8; pz -= 0.25;
      add(new THREE.ConeGeometry(0.07, 0.8, 4), ember, px + s * 0.1, py + 0.2, pz, 0.3, 0, -s * 1.1); void seg; }
  }
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.9, 1.6], [0.9, 1.6], [-0.9, -1.6], [0.9, -1.6]]) legs.push(add(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 5), bone, x, 1.2, z));
  const tail = add(new THREE.ConeGeometry(0.3, 1.2, 4), ember, 0, 2.6, -2.9, -Math.PI / 2 - 0.4, 0, 0);
  return finish(r, 2.2, 0xff6a2b, (t, hp, tel) => {
    torso.scale.y = 0.9 + Math.sin(t * 2) * 0.03; head.position.y = 4.0 + Math.sin(t * 2.2) * 0.1; tail.rotation.z = Math.sin(t * 3) * 0.3;
    legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 6 + i * 1.6) * 0.25 * (1 - tel); });
    head.rotation.x = Math.PI / 2 + 0.3 + tel * 0.5; // lowers antlers before a charge
  });
}

/** BELL-WARDEN (Drowned Cathedral): armored giant with a great bell for a torso, hammer arm, teal glow. ~7u tall. */
function bellWarden(): Boss {
  const r = rig(); const iron = r.body(0x1f2c38), teal = r.glow(0x19c9a5); const { add } = r;
  const bell = add(new THREE.CylinderGeometry(0.9, 2.0, 3.2, 8), iron, 0, 3.2, 0);
  add(new THREE.TorusGeometry(2.0, 0.14, 4, 14), teal, 0, 1.65, 0, Math.PI / 2);                          // bell rim glow
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.1, 2.4, 0.04), teal, Math.cos(i * 1.57) * 1.3, 3.1, Math.sin(i * 1.57) * 1.3, 0, -i * 1.57, 0); // cracks
  const clapper = add(new THREE.IcosahedronGeometry(0.5, 0), teal, 0, 1.7, 0);
  const head = add(new THREE.BoxGeometry(1.1, 1.0, 1.1), iron, 0, 5.4, 0.2);
  add(new THREE.BoxGeometry(0.8, 0.12, 0.06), teal, 0, 5.45, 0.8);                                         // visor
  add(new THREE.ConeGeometry(0.45, 1.0, 6), iron, 0, 6.3, 0.2);                                            // helm spike
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-2.1, 4.3, 0); armR.position.set(2.1, 4.3, 0); r.group.add(armL, armR);
  add(new THREE.BoxGeometry(0.7, 2.6, 0.7), iron, 0, -1.2, 0.3, 0.3, 0, 0, armL);
  add(new THREE.BoxGeometry(0.7, 2.6, 0.7), iron, 0, -1.2, 0.3, 0.3, 0, 0, armR);
  add(new THREE.BoxGeometry(1.6, 1.4, 1.6), iron, 0, -2.8, 0.7, 0, 0, 0, armR);                          // hammer fist
  add(new THREE.BoxGeometry(1.2, 0.1, 1.2), teal, 0, -3.5, 0.7, 0, 0, 0, armR);
  add(new THREE.CylinderGeometry(0.5, 0.7, 1.6, 6), iron, -0.8, 0.8, 0); add(new THREE.CylinderGeometry(0.5, 0.7, 1.6, 6), iron, 0.8, 0.8, 0);
  return finish(r, 2.4, 0x19c9a5, (t, hp, tel) => {
    bell.rotation.z = Math.sin(t * 1.5) * 0.02; clapper.position.x = Math.sin(t * 4) * 0.4 * (1 + tel); head.position.y = 5.4 + Math.sin(t * 2) * 0.05;
    armR.rotation.x = -tel * 2.4 + Math.sin(t * 2) * 0.05; armL.rotation.x = Math.sin(t * 2 + 1) * 0.08;  // raise hammer on telegraph
  });
}

/** THE UNLIT (Void Garden): floating dark star — jagged core ringed by orbiting shards, violet/magenta, eye in the center. ~6u. */
function unlit(): Boss {
  const r = rig(); const void_ = r.body(0x120a24), violet = r.glow(0xc04dff), magenta = r.glow(0xff2e88); const { add } = r;
  const core = new THREE.Group(); core.position.y = 3.5; r.group.add(core);
  add(new THREE.IcosahedronGeometry(1.8, 1), void_, 0, 0, 0, 0, 0, 0, core);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; add(new THREE.ConeGeometry(0.28, 2.2, 4), void_, Math.cos(a) * 1.9, Math.sin(a * 2) * 0.5, Math.sin(a) * 1.9, Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57, core); } // spikes
  add(new THREE.SphereGeometry(0.75, 10, 8), magenta, 0, 0, 1.45, 0, 0, 0, core);                         // eye
  add(new THREE.BoxGeometry(0.25, 1.1, 0.1), void_, 0, 0, 2.2, 0, 0, 0, core);                             // slit pupil
  const orbit = new THREE.Group(); orbit.position.y = 3.5; r.group.add(orbit);
  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; shards.push(add(new THREE.OctahedronGeometry(0.5), i % 2 ? violet : magenta, Math.cos(a) * 3.6, Math.sin(i) * 0.6, Math.sin(a) * 3.6, 0, 0, 0, orbit)); }
  const ring = add(new THREE.TorusGeometry(3.6, 0.04, 4, 48), violet, 0, 3.5, 0, Math.PI / 2);
  return finish(r, 2.6, 0xc04dff, (t, hp, tel) => {
    r.group.position.y = Math.sin(t * 1.4) * 0.25; core.rotation.y = t * 0.3; orbit.rotation.y = -t * (0.8 + hp * 1.2 + tel * 3);
    shards.forEach((s, i) => { s.rotation.x = t * 2 + i; s.rotation.y = t * 1.5; }); ring.rotation.z = t * 0.2; ring.scale.setScalar(1 + tel * 0.25);
  });
}

export const BOSS_COLORS: Record<BossId, number> = { hollow_stag: 0xff6a2b, bell_warden: 0x19c9a5, the_unlit: 0xc04dff };
export function createBoss(id: BossId): Boss { return id === 'hollow_stag' ? stag() : id === 'bell_warden' ? bellWarden() : unlit(); }
