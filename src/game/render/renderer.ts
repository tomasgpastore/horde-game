import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { SimState, SimEvent, ArenaDef, ArenaHandle } from '@shared/types';
import { EnemyRenderer, KIND_COLORS } from './enemies';
import { DamageNumbers } from './dmgnums';
import { MAX_ENEMIES, MAX_PROJECTILES, MAX_PICKUPS } from '@shared/types';

/** Render reads SimState only (never mutates). Enemies = ONE InstancedMesh per kind-group for 300+ @60fps.
 *  Engine Engineer owns: camera, lighting, post-fx, particles, instanced pools for projectiles/pickups, per-kind meshes/colors. */
export class Renderer {
  three: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  projMesh: THREE.InstancedMesh; ringMesh: THREE.InstancedMesh; gemMesh: THREE.InstancedMesh; enemies!: EnemyRenderer; dmg!: DamageNumbers; flashColor = new THREE.Color(0xffffff); baseColors = [0xe0602a, 0xc02a8a, 0x8fd13a];
  shake = 0; composer: EffectComposer; bloomOn = new URLSearchParams(location.search).get('bloom') !== '0'; // ?bloom=0 for software-GL CI shake = 0;
  // shard particles (kill bursts): SoA ring buffer, one InstancedMesh
  static NP = 2000; pMesh: THREE.InstancedMesh; px = new Float32Array(Renderer.NP * 3); pv = new Float32Array(Renderer.NP * 3); pl = new Float32Array(Renderer.NP); pHead = 0;
  setQuality(q: 'low' | 'med' | 'high') { this.bloomOn = q !== 'low' && new URLSearchParams(location.search).get('bloom') !== '0'; const pr = Math.min(devicePixelRatio, q === 'low' ? 1 : q === 'high' ? 2 : 1.5); this.three.setPixelRatio(pr); this.composer.setPixelRatio(pr); this.composer.setSize(innerWidth, innerHeight); }
  playerMesh: THREE.Mesh; arena: ArenaHandle; m = new THREE.Object3D();
  constructor(canvas: HTMLCanvasElement, def: ArenaDef) {
    this.three = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.three.setPixelRatio(Math.min(devicePixelRatio, 2)); this.three.shadowMap.enabled = true;
    this.scene.background = new THREE.Color(def.palette.sky); this.scene.fog = new THREE.Fog(def.palette.fog, 25, 70);
    this.arena = def.build(this.scene);
    this.enemies = new EnemyRenderer(this.scene); this.dmg = new DamageNumbers(canvas.parentElement ?? document.body);
    const emissive = (c: number) => new THREE.MeshBasicMaterial({ color: c });
    this.projMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.3), emissive(0xffffff), MAX_PROJECTILES);
    this.projMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PROJECTILES * 3), 3);
    this.ringMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), 64);
    this.ringMesh.frustumCulled = false; this.scene.add(this.ringMesh);
    this.gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22), emissive(0x4de8ff), MAX_PICKUPS);
    for (const m of [this.projMesh, this.gemMesh]) { m.frustumCulled = false; this.scene.add(m); }
    this.playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 8), new THREE.MeshLambertMaterial({ color: 0xffc857 }));
    this.playerMesh.position.y = 0.8; this.playerMesh.castShadow = true; this.scene.add(this.playerMesh);
    this.pMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0xffffff }), Renderer.NP);
    this.pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Renderer.NP * 3), 3); this.pMesh.frustumCulled = false; this.pMesh.count = 0; this.scene.add(this.pMesh);
    this.composer = new EffectComposer(this.three); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 0.55)); this.composer.addPass(new OutputPass());
    const onResize = () => { this.three.setSize(innerWidth, innerHeight, false); this.composer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); };
    addEventListener('resize', onResize); onResize();
  }
  private burst(x: number, z: number, n: number, col: number, spd: number) {
    for (let k = 0; k < n; k++) { const i = this.pHead; this.pHead = (i + 1) % Renderer.NP; const a = Math.random() * 6.283, v = spd * (0.4 + Math.random());
      this.px[i * 3] = x; this.px[i * 3 + 1] = 0.6; this.px[i * 3 + 2] = z; this.pv[i * 3] = Math.cos(a) * v; this.pv[i * 3 + 1] = 2 + Math.random() * 4; this.pv[i * 3 + 2] = Math.sin(a) * v; this.pl[i] = 0.5 + Math.random() * 0.4; this.pcol[i] = col; }
  }
  pcol = new Uint32Array(Renderer.NP);
  consumeEvents(ev: SimEvent[]) { // visual-only randomness is fine here (never feeds the sim)
    for (const e of ev) {
      if (e.t === 'kill') this.burst(e.x, e.z, 7, (KIND_COLORS[e.enemyKind] ?? 0xe0602a), 5);
      else if (e.t === 'hit') { this.burst(e.x, e.z, e.crit ? 4 : 1, 0xffe9a8, 3); this.dmg.add(e.x, e.z, e.dmg, e.crit); }
      else if (e.t === 'playerHurt') this.shake = Math.min(1, this.shake + 0.6);
      else if (e.t === 'levelUp') this.burst(this.playerMesh.position.x, this.playerMesh.position.z, 40, 0x4de8ff, 9);
    }
  }
  render(s: SimState, dt: number, _alpha: number) {
    const p = s.players[0]; this.playerMesh.position.set(p.x, 0.8, p.z); this.playerMesh.rotation.y = p.facing;
    this.shake = Math.max(0, this.shake - dt * 2.5); const sh = this.shake * this.shake * 0.5;
    this.camera.position.set(p.x + (Math.random() - 0.5) * sh, 16 + (Math.random() - 0.5) * sh * 0.5, p.z + 11 + (Math.random() - 0.5) * sh); this.camera.lookAt(p.x, 0, p.z);
    { let n = 0; for (let i = 0; i < Renderer.NP; i++) { if (this.pl[i] <= 0) continue; this.pl[i] -= dt; if (this.pl[i] <= 0) continue;
        this.pv[i * 3 + 1] -= 14 * dt; this.px[i * 3] += this.pv[i * 3] * dt; this.px[i * 3 + 1] = Math.max(0.05, this.px[i * 3 + 1] + this.pv[i * 3 + 1] * dt); this.px[i * 3 + 2] += this.pv[i * 3 + 2] * dt;
        this.m.position.set(this.px[i * 3], this.px[i * 3 + 1], this.px[i * 3 + 2]); this.m.rotation.set(this.pl[i] * 9, this.pl[i] * 7, 0); this.m.scale.setScalar(Math.min(1, this.pl[i] * 2.5)); this.m.updateMatrix();
        this.pMesh.setMatrixAt(n, this.m.matrix); this.flashColor.setHex(this.pcol[i]); this.pMesh.setColorAt(n, this.flashColor); n++; }
      this.m.scale.setScalar(1); this.pMesh.count = n; this.pMesh.instanceMatrix.needsUpdate = true; if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true; }
    this.enemies.update(s.enemies, s.time); this.dmg.update(dt, this.camera); let n = 0;
    n = 0; let rn = 0; const pr = s.projectiles; for (let i = 0; i < pr.count; i++) { if (!pr.alive[i]) continue;
      const k = pr.kind[i];
      if (k === 2) { const maxLife = 0.35, f = 1 - pr.life[i] / maxLife, r = pr.vx[i] * f; this.m.position.set(pr.x[i], 0.15, pr.z[i]); this.m.rotation.set(-Math.PI / 2, 0, 0); this.m.scale.set(r, r, r); this.m.updateMatrix(); this.ringMesh.setMatrixAt(rn++, this.m.matrix); continue; }
      this.m.position.set(pr.x[i], 0.8, pr.z[i]); this.m.rotation.set(0, s.time * 8, 0); this.m.scale.setScalar(k === 1 ? 1.8 : k === 3 ? 2.2 : 1); this.m.updateMatrix(); this.projMesh.setMatrixAt(n, this.m.matrix);
      this.flashColor.setHex(k === 1 ? 0x6fe8ff : k === 3 ? 0xfff6a8 : 0xffd27a); this.projMesh.setColorAt(n, this.flashColor); n++; }
    this.m.scale.setScalar(1); this.ringMesh.count = rn; this.ringMesh.instanceMatrix.needsUpdate = true; if (this.projMesh.instanceColor) this.projMesh.instanceColor.needsUpdate = true;
    this.projMesh.count = n; this.projMesh.instanceMatrix.needsUpdate = true;
    n = 0; const pk = s.pickups; for (let i = 0; i < pk.count; i++) { if (!pk.alive[i]) continue;
      this.m.position.set(pk.x[i], 0.4 + Math.sin(s.time * 4 + i) * 0.1, pk.z[i]); this.m.rotation.set(0, s.time * 2 + i, 0); this.m.updateMatrix(); this.gemMesh.setMatrixAt(n++, this.m.matrix); }
    this.gemMesh.count = n; this.gemMesh.instanceMatrix.needsUpdate = true;
    this.arena.update(dt, s.time);
    if (this.bloomOn) this.composer.render(dt); else this.three.render(this.scene, this.camera);
  }
}
