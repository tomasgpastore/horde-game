import * as THREE from 'three';
import type { ArenaDef, ArenaHandle } from '@shared/types';
import { Rng } from '@shared/rng';

export type PropKind = 'rock' | 'pillar' | 'crystal' | 'shroom' | 'bone' | 'brazier' | 'tree' | 'flower' | 'shard' | 'arch';
export interface Biome {
  seed: number;
  obstacleKinds: PropKind[];       // how colliders are drawn
  obstacleCount: number; obstacleR: [number, number]; clearRadius: number; // keep spawn area clear
  scatter: { kind: PropKind; count: number; scale: [number, number] }[];
  propColors: number[];            // tinted per-instance
  glowColor: number;               // emissive accents (crystals, cracks, embers)
  ember: { count: number; color: number; rise: number; size: number };
  groundNoise: [number, number];   // two colors blended in ground texture
  ring?: { color: number; r: number }; // boss: glowing ring decal
  fog?: { count: number; color: number; opacity: number }; // low drifting mist sprites
  hemiSky?: number;
  lightIntensity: number; sunDir: [number, number, number];
}

/** Deterministic obstacle layout (shared by sim collision and render). */
export function layoutObstacles(radius: number, b: Biome) {
  const rng = new Rng(b.seed), out: { x: number; z: number; r: number }[] = [];
  let tries = 0;
  while (out.length < b.obstacleCount && tries++ < 2000) {
    const r = rng.range(b.obstacleR[0], b.obstacleR[1]), a = rng.range(0, 6.2832), d = b.clearRadius + r + Math.sqrt(rng.next()) * (radius - 4 - b.clearRadius - r);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (out.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + 2.2)) continue;
    out.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: +r.toFixed(2) });
  }
  return out;
}

const geo: Record<PropKind, () => THREE.BufferGeometry> = {
  rock: () => { const g = new THREE.IcosahedronGeometry(1, 0); g.scale(1, 0.8, 1); g.translate(0, 0.5, 0); return g; },
  pillar: () => { const g = new THREE.CylinderGeometry(0.8, 1, 5, 6, 1); g.translate(0, 2.5, 0); return g; },
  crystal: () => { const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.55, 1.6, 0.55); g.translate(0, 1.4, 0); return g; },
  shroom: () => { const stem = new THREE.CylinderGeometry(0.18, 0.28, 1, 5); stem.translate(0, 0.5, 0);
    const cap = new THREE.SphereGeometry(0.9, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2); cap.translate(0, 1, 0); return merge(stem, cap); },
  bone: () => { const g = new THREE.ConeGeometry(0.25, 2, 4); g.translate(0, 1, 0); g.rotateZ(0.35); return g; },
  tree: () => { const trunk = new THREE.CylinderGeometry(0.15, 0.4, 4.5, 5); trunk.translate(0, 2.25, 0);
    const b1 = new THREE.ConeGeometry(0.12, 2.4, 4); b1.rotateZ(1.0); b1.translate(0.9, 3.6, 0);
    const b2 = new THREE.ConeGeometry(0.1, 2, 4); b2.rotateZ(-1.1); b2.rotateY(1.6); b2.translate(0, 3, 0.8);
    return merge(merge(trunk, b1), b2); },
  flower: () => { const stem = new THREE.CylinderGeometry(0.05, 0.08, 1.2, 4); stem.translate(0, 0.6, 0);
    const bloom = new THREE.OctahedronGeometry(0.45, 0); bloom.scale(1, 0.7, 1); bloom.translate(0, 1.3, 0); return merge(stem, bloom); },
  shard: () => { const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.45, 1.3, 0.45); g.translate(0, 3.2, 0); return g; },
  arch: () => { const l = new THREE.CylinderGeometry(0.5, 0.65, 4.5, 6); l.translate(-1.6, 2.25, 0);
    const r = new THREE.CylinderGeometry(0.5, 0.65, 3, 6); r.translate(1.6, 1.5, 0);
    const top = new THREE.BoxGeometry(4.2, 0.6, 0.9); top.rotateZ(0.12); top.translate(0, 4.4, 0); return merge(merge(l, r), top); },
  brazier: () => { const bowl = new THREE.CylinderGeometry(0.9, 0.5, 0.7, 6); bowl.translate(0, 1.6, 0);
    const leg = new THREE.CylinderGeometry(0.15, 0.25, 1.4, 5); leg.translate(0, 0.7, 0); return merge(bowl, leg); },
};
function merge(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const ai = a.toNonIndexed(), bi = b.toNonIndexed(), pos = new Float32Array(ai.attributes.position.count * 3 + bi.attributes.position.count * 3);
  pos.set(ai.attributes.position.array as Float32Array, 0); pos.set(bi.attributes.position.array as Float32Array, ai.attributes.position.count * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
const EMISSIVE: PropKind[] = ['crystal', 'brazier', 'flower', 'shard'];

/** One non-repeating 1024px map over the whole disc (+ emissive map for glowing cracks). */
function groundTextures(b: Biome, p: ArenaDef['palette'], R: number) {
  const N = 1024, mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  const cv = mk(), ce = mk(), g = cv.getContext('2d')!, ge = ce.getContext('2d')!, rng = new Rng(b.seed ^ 0x51ed);
  const ca = new THREE.Color(b.groundNoise[0]), cb = new THREE.Color(b.groundNoise[1]), acc = new THREE.Color(p.accent), px = N / (2 * R);
  g.fillStyle = '#' + ca.getHexString(); g.fillRect(0, 0, N, N); ge.fillStyle = '#000'; ge.fillRect(0, 0, N, N);
  const rgba = (c: THREE.Color, a: number) => `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`;
  // large soft blotches + fine grit
  for (let i = 0; i < 220; i++) { const x = rng.range(0, N), y = rng.range(0, N), r = rng.range(30, 120), c = ca.clone().lerp(cb, rng.next());
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, 0.35)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 5000; i++) { const x = rng.range(0, N), y = rng.range(0, N), c = ca.clone().lerp(cb, rng.next()).offsetHSL(0, 0, rng.range(-0.06, 0.06));
    g.fillStyle = rgba(c, 0.5); g.fillRect(x, y, rng.range(1, 4), rng.range(1, 4)); }
  // worn paths: lighter winding strips from centre outwards
  const nPaths = 4 + rng.int(3), pathCol = ca.clone().lerp(cb, 0.5).offsetHSL(0, 0, 0.07);
  for (let k = 0; k < nPaths; k++) { let a = rng.range(0, 6.28), d = 0, x = N / 2, y = N / 2; g.strokeStyle = rgba(pathCol, 0.45); g.lineCap = 'round';
    g.lineWidth = rng.range(14, 26); g.beginPath(); g.moveTo(x, y);
    while (d < R * px * 0.95) { a += rng.range(-0.25, 0.25); x += Math.cos(a) * 14; y += Math.sin(a) * 14; d = Math.hypot(x - N / 2, y - N / 2); g.lineTo(x, y); } g.stroke(); }
  // spawn clearing + concentric rune ring (boss arena style ring if set)
  g.strokeStyle = rgba(pathCol, 0.5); g.lineWidth = 6; g.beginPath(); g.arc(N / 2, N / 2, 6 * px, 0, 6.2832); g.stroke();
  // glowing cracks (colour map gets a dim copy, emissive map the bright one)
  const nCr = 26;
  for (let k = 0; k < nCr; k++) { let a = rng.range(0, 6.28), x = N / 2 + Math.cos(a) * rng.range(8, R * 0.95) * px, y = N / 2 + Math.sin(a) * rng.range(8, R * 0.95) * px;
    if (Math.hypot(x - N / 2, y - N / 2) < 5 * px) continue;
    const pts: [number, number][] = [[x, y]]; const len = rng.int(14) + 8;
    for (let s = 0; s < len; s++) { a += rng.range(-0.7, 0.7); x += Math.cos(a) * rng.range(10, 24); y += Math.sin(a) * rng.range(10, 24); pts.push([x, y]); }
    const stroke = (ctx: CanvasRenderingContext2D, col: string, w: number) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([X, Y], i) => i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)); ctx.stroke(); };
    stroke(g, 'rgba(0,0,0,0.6)', 7); stroke(g, rgba(acc, 0.5), 2.5);
    ge.shadowColor = rgba(acc, 1); ge.shadowBlur = 10; stroke(ge, rgba(acc.clone().lerp(new THREE.Color(1, 1, 1), 0.25), 1), 3); ge.shadowBlur = 0; }
  const wrap = (c: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return { map: wrap(cv, true), emissive: wrap(ce, true) };
}

export function buildArena(def: ArenaDef, b: Biome, scene: THREE.Scene): ArenaHandle {
  const R = def.radius, p = def.palette, rng = new Rng(b.seed ^ 0x9e37), disposables: { dispose(): void }[] = [], objs: THREE.Object3D[] = [];
  const add = (o: THREE.Object3D) => { scene.add(o); objs.push(o); return o; };
  // ground disc + dark skirt so the void never shows
  const gt = groundTextures(b, p, R), tex = gt.map;
  const gmat = new THREE.MeshLambertMaterial({ map: gt.map, emissiveMap: gt.emissive, emissive: 0xffffff, emissiveIntensity: 0.9 }); const ground = new THREE.Mesh(new THREE.CircleGeometry(R, 64), gmat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; add(ground);
  const skirtMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.ground).multiplyScalar(0.35) });
  const skirt = new THREE.Mesh(new THREE.RingGeometry(R - 0.1, R + 90, 48, 1), skirtMat); skirt.rotation.x = -Math.PI / 2; skirt.position.y = -0.05; add(skirt);
  disposables.push(tex, gt.emissive, gmat, skirtMat, ground.geometry, skirt.geometry);
  // lights
  const sun = new THREE.DirectionalLight(p.light, b.lightIntensity); sun.position.set(...b.sunDir); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 80;
  const hemi = new THREE.HemisphereLight(b.hemiSky ?? 0xaab4ff, new THREE.Color(p.ground).multiplyScalar(2.5), 1.6); add(sun); add(hemi);
  // instanced props: one InstancedMesh per kind (collider-drawn + scatter + rim)
  const buckets = new Map<PropKind, { m: THREE.Matrix4; c: THREE.Color }[]>();
  const push = (k: PropKind, x: number, z: number, sx: number, sy: number, ry: number, col: number, lift = 0) => {
    const o = new THREE.Object3D(); o.position.set(x, lift, z); o.rotation.set(0, ry, 0); o.scale.set(sx, sy, sx); o.updateMatrix();
    const lst = buckets.get(k) ?? []; buckets.set(k, lst);
    lst.push({ m: o.matrix.clone(), c: new THREE.Color(col).offsetHSL(0, rng.range(-0.05, 0.05), rng.range(-0.05, 0.06)) });
  };
  for (const o of def.obstacles) { const k = rng.pick(b.obstacleKinds), s = k === 'pillar' ? o.r / 0.9 : k === 'arch' ? o.r / 2 : o.r; push(k, o.x, o.z, s, k === 'pillar' ? rng.range(0.8, 1.5) : s * rng.range(0.9, 1.5), rng.range(0, 6.28), rng.pick(b.propColors)); }
  for (const sc of b.scatter) for (let i = 0; i < sc.count; i++) {
    const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * (R - 2), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (def.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.8)) continue;
    const s = rng.range(...sc.scale); push(sc.kind, x, z, s, s * rng.range(0.8, 1.6), rng.range(0, 6.28), rng.pick(b.propColors));
  }
  // rim wall: tall jagged rocks just outside the playable edge
  const rimN = Math.round(R * 2.6);
  for (let i = 0; i < rimN; i++) { const a = i / rimN * 6.2832 + rng.range(-0.03, 0.03), d = R + 0.6 + rng.range(0, 2.5) + 2.5 * Math.max(0, Math.sin(a)), s = rng.range(1.8, 4) * (1 - 0.4 * Math.max(0, Math.sin(a)));
    push('rock', Math.cos(a) * d, Math.sin(a) * d, s, s * rng.range(1.5, 3.2) * (1 - 0.7 * Math.max(0, Math.sin(a))) /* camera sits at +z: keep the near-side wall low so it never hides the hero */, rng.range(0, 6.28), rng.pick(b.propColors), -0.2); }
  const glowMats: THREE.MeshLambertMaterial[] = []; let shards: THREE.InstancedMesh | undefined, edge: THREE.MeshBasicMaterial | undefined;
  for (const [k, lst] of buckets) {
    const g = geo[k](), emissive = EMISSIVE.includes(k);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: emissive ? b.glowColor : 0x000000, emissiveIntensity: emissive ? 0.9 : 0 });
    if (emissive) glowMats.push(mat);
    const im = new THREE.InstancedMesh(g, mat, lst.length); lst.forEach((l, i) => { im.setMatrixAt(i, l.m); im.setColorAt(i, l.c); });
    if (k === 'shard') shards = im; im.castShadow = k !== 'bone' && k !== 'shard'; im.receiveShadow = true; im.frustumCulled = false; add(im); disposables.push(g, mat, im);
  }
  // optional glowing ring decal (boss arena)
  let ring: THREE.Mesh | undefined;
  if (b.ring) { const rm = new THREE.MeshBasicMaterial({ color: b.ring.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    ring = new THREE.Mesh(new THREE.RingGeometry(b.ring.r - 0.35, b.ring.r + 0.35, 96), rm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; add(ring); disposables.push(rm, ring.geometry); }
  { const em = new THREE.MeshBasicMaterial({ color: p.accent, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const er = new THREE.Mesh(new THREE.RingGeometry(R - 1.1, R + 0.1, 96), em); er.rotation.x = -Math.PI / 2; er.position.y = 0.05; add(er); disposables.push(em, er.geometry); edge = em; }
  let ring2: THREE.Mesh | undefined;
  if (b.ring) { const m2 = new THREE.MeshBasicMaterial({ color: b.ring.color, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
    ring2 = new THREE.Mesh(new THREE.CircleGeometry(b.ring.r, 64), m2); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.03; add(ring2); disposables.push(m2, ring2.geometry); }
  // low mist: big soft sprites hugging the ground (one draw call)
  let mist: THREE.Points | undefined, mp: Float32Array | undefined;
  if (b.fog) { const F = b.fog, c3 = document.createElement('canvas'); c3.width = c3.height = 64; const g3 = c3.getContext('2d')!, gr3 = g3.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr3.addColorStop(0, 'rgba(255,255,255,0.5)'); gr3.addColorStop(1, 'rgba(255,255,255,0)'); g3.fillStyle = gr3; g3.fillRect(0, 0, 64, 64);
    const ft = new THREE.CanvasTexture(c3); mp = new Float32Array(F.count * 3);
    for (let i = 0; i < F.count; i++) { const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * R; mp[i * 3] = Math.cos(a) * d; mp[i * 3 + 1] = rng.range(0.3, 1.4); mp[i * 3 + 2] = Math.sin(a) * d; }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    const mm = new THREE.PointsMaterial({ map: ft, color: F.color, size: 9, transparent: true, opacity: F.opacity, depthWrite: false, sizeAttenuation: true });
    mist = new THREE.Points(mg, mm); mist.frustumCulled = false; add(mist); disposables.push(ft, mg, mm); }
  // embers / motes (one Points draw call)
  const E = b.ember, ep = new Float32Array(E.count * 3), ev = new Float32Array(E.count * 2);
  for (let i = 0; i < E.count; i++) { const a = rng.range(0, 6.28), d = Math.sqrt(rng.next()) * R; ep[i * 3] = Math.cos(a) * d; ep[i * 3 + 1] = rng.range(0, 14); ep[i * 3 + 2] = Math.sin(a) * d; ev[i * 2] = rng.range(0.5, 1.5); ev[i * 2 + 1] = rng.range(0, 6.28); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const sc2 = document.createElement('canvas'); sc2.width = sc2.height = 32; const sg = sc2.getContext('2d')!, gr = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 32, 32);
  const spr = new THREE.CanvasTexture(sc2);
  const em = new THREE.PointsMaterial({ map: spr, alphaTest: 0.01, color: E.color, size: E.size, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false });
  const embers = new THREE.Points(eg, em); embers.frustumCulled = false; add(embers); disposables.push(eg, em, spr);
  return {
    update(dt, t) {
      const a = eg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < E.count; i++) { const sp = ev[i * 2], ph = ev[i * 2 + 1];
        let y = ep[i * 3 + 1] + E.rise * sp * dt; if (y > 14) y -= 14;
        ep[i * 3 + 1] = y; ep[i * 3] += Math.sin(t * 0.7 + ph) * 0.6 * dt; ep[i * 3 + 2] += Math.cos(t * 0.6 + ph) * 0.6 * dt; }
      a.needsUpdate = true;
      const pulse = 0.75 + Math.sin(t * 3) * 0.2 + Math.sin(t * 7.3) * 0.05; for (const m of glowMats) m.emissiveIntensity = pulse;
      if (edge) edge.opacity = 0.35 + Math.sin(t * 1.5) * 0.12;
      if (shards) shards.position.y = Math.sin(t * 0.8) * 0.35;
      if (mist && mp) { const ma = mist.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < mp.length; i += 3) mp[i] += (0.25 + (i % 7) * 0.03) * dt, mp[i] > R && (mp[i] = -R);
        ma.needsUpdate = true; }
      if (ring2) (ring2.material as THREE.MeshBasicMaterial).opacity = 0.07 + Math.sin(t * 4) * 0.04;
      if (ring) (ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 2) * 0.15;
    },
    dispose() { for (const o of objs) scene.remove(o); for (const d of disposables) d.dispose(); },
  };
}
