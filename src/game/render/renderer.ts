import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { SimState, SimEvent, ArenaDef, ArenaHandle } from '@shared/types';
import { createHero } from './hero';
import { CameraRig } from './camera';
import { EnemyRenderer, KIND_COLORS } from './enemies';
import { DamageNumbers } from './dmgnums';
import { MAX_ENEMIES, MAX_PROJECTILES, MAX_PICKUPS } from '@shared/types';

/** Render reads SimState only (never mutates). Enemies = ONE InstancedMesh per kind-group for 300+ @60fps.
 *  Engine Engineer owns: camera, lighting, post-fx, particles, instanced pools for projectiles/pickups, per-kind meshes/colors. */
export class Renderer {
  three: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  projMesh: THREE.InstancedMesh; ringMesh: THREE.InstancedMesh; gemMesh: THREE.InstancedMesh; enemies!: EnemyRenderer; dmg!: DamageNumbers; flashColor = new THREE.Color(0xffffff); baseColors = [0xe0602a, 0xc02a8a, 0x8fd13a];
  rig = new CameraRig(this.camera); private sun: THREE.DirectionalLight | null = null; private sunOff = new THREE.Vector3(); private noDegrade = new URLSearchParams(location.search).has('nodegrade'); private slowT = 0; private slowN = 0; private q: 'low' | 'med' | 'high' = 'high';
  /** Game.frame reads/decrements this: seconds of slow-mo (sim runs at 0.3x). */ slowmo = 0;
  setShake(v: boolean | number) { this.rig.shakeScale = v === false ? 0 : v === true ? 1 : Number(v); }
  composer: EffectComposer; bloomOn = new URLSearchParams(location.search).get('bloom') !== '0'; // ?bloom=0 for software-GL CI shake = 0;
  // shard particles (kill bursts): SoA ring buffer, one InstancedMesh
  static NP = 2000; pMesh: THREE.InstancedMesh; px = new Float32Array(Renderer.NP * 3); pv = new Float32Array(Renderer.NP * 3); pl = new Float32Array(Renderer.NP); pHead = 0;
  setQuality(q: 'low' | 'med' | 'high') { this.q = q; this.bloomOn = q !== 'low' && new URLSearchParams(location.search).get('bloom') !== '0'; const pr = Math.min(devicePixelRatio, q === 'low' ? 1 : q === 'high' ? 2 : 1.5); this.three.setPixelRatio(pr); this.composer.setPixelRatio(pr); this.composer.setSize(innerWidth, innerHeight); }
  tele!: THREE.Mesh; playerMesh: THREE.Group; lantern!: THREE.Mesh; arena: ArenaHandle; m = new THREE.Object3D();
  constructor(canvas: HTMLCanvasElement, def: ArenaDef) {
    this.three = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.three.setPixelRatio(Math.min(devicePixelRatio, 2)); this.three.shadowMap.enabled = true;
    this.scene.background = new THREE.Color(def.palette.sky); this.scene.fog = new THREE.Fog(def.palette.fog, 25, 70);
    this.arena = def.build(this.scene);
    this.tele = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.35, depthWrite: false })); this.tele.rotation.x = -Math.PI / 2; this.tele.visible = false; this.scene.add(this.tele);
    this.scene.traverse(o => { if ((o as THREE.DirectionalLight).isDirectionalLight && !this.sun) this.sun = o as THREE.DirectionalLight; });
    if (this.sun) { this.sunOff.copy(this.sun.position); this.scene.add(this.sun.target); const sc = this.sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.updateProjectionMatrix(); this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.normalBias = 0.04; }
    this.enemies = new EnemyRenderer(this.scene); this.dmg = new DamageNumbers(canvas.parentElement ?? document.body);
    const emissive = (c: number) => new THREE.MeshBasicMaterial({ color: c });
    this.projMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.3), emissive(0xffffff), MAX_PROJECTILES);
    this.projMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PROJECTILES * 3), 3);
    this.ringMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), 64);
    this.ringMesh.frustumCulled = false; this.scene.add(this.ringMesh);
    this.gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4de8ff).multiplyScalar(2.6) }), MAX_PICKUPS);
    for (const m of [this.projMesh, this.gemMesh]) { m.frustumCulled = false; this.scene.add(m); }
    const hero = createHero({ scale: 1.3 }); this.playerMesh = hero.group; this.lantern = hero.lantern; this.scene.add(this.playerMesh);
    this.pMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0xffffff }), Renderer.NP);
    this.pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Renderer.NP * 3), 3); this.pMesh.frustumCulled = false; this.pMesh.count = 0; this.scene.add(this.pMesh);
    this.composer = new EffectComposer(this.three); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.55, 0.55)); this.composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null }, amount: { value: 0.55 } },
      vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;uniform float amount;varying vec2 v;void main(){vec4 c=texture2D(tDiffuse,v);float d=distance(v,vec2(.5));c.rgb*=1.-smoothstep(.35,.85,d)*amount;gl_FragColor=c;}' }));
    this.composer.addPass(new OutputPass());
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
      else if (e.t === 'playerHurt') this.rig.addTrauma(0.6);
      else if (e.t === 'bossSpawn') this.rig.addTrauma(0.7); else if (e.t === 'bossDeath') this.rig.addTrauma(1);
      else if (e.t === 'levelUp') { this.rig.addTrauma(0.2); this.slowmo = 0.6; this.burst(this.playerMesh.position.x, this.playerMesh.position.z, 40, 0x4de8ff, 9); }
    }
  }
  /** Auto-degrade: if frames average >40ms for 0.8s, drop one quality tier (never upgrades). ?nodegrade=1 disables. */
  private watchPerf(dt: number) {
    if (this.q === 'low' || this.noDegrade || dt <= 0 || dt > 0.5) return; this.slowT += dt; this.slowN++; if (this.slowT < 0.8) return;
    if (this.slowT / this.slowN > 0.04) this.setQuality(this.q === 'high' ? 'med' : 'low'); this.slowT = 0; this.slowN = 0;
  }
  render(s: SimState, dt: number, alpha: number) {
    this.watchPerf(dt); const ex = alpha * (1 / 60);
    const p = s.players[0], px = p.x + p.vx * ex, pz = p.z + p.vz * ex; // extrapolate between 60Hz ticks
    this.playerMesh.position.set(px, 0, pz); this.playerMesh.rotation.y = p.facing; this.lantern.position.y = 2.2 + Math.sin(s.time * 3) * 0.08;
    this.rig.update(dt, px, pz, p.vx, p.vz, s.enemies.count);
    if (this.sun) { this.sun.position.set(px + this.sunOff.x, this.sunOff.y, pz + this.sunOff.z); this.sun.target.position.set(px, 0, pz); }
    { let n = 0; for (let i = 0; i < Renderer.NP; i++) { if (this.pl[i] <= 0) continue; this.pl[i] -= dt; if (this.pl[i] <= 0) continue;
        this.pv[i * 3 + 1] -= 14 * dt; this.px[i * 3] += this.pv[i * 3] * dt; this.px[i * 3 + 1] = Math.max(0.05, this.px[i * 3 + 1] + this.pv[i * 3 + 1] * dt); this.px[i * 3 + 2] += this.pv[i * 3 + 2] * dt;
        this.m.position.set(this.px[i * 3], this.px[i * 3 + 1], this.px[i * 3 + 2]); this.m.rotation.set(this.pl[i] * 9, this.pl[i] * 7, 0); this.m.scale.setScalar(Math.min(1, this.pl[i] * 2.5)); this.m.updateMatrix();
        this.pMesh.setMatrixAt(n, this.m.matrix); this.flashColor.setHex(this.pcol[i]).multiplyScalar(2.4); this.pMesh.setColorAt(n, this.flashColor); n++; }
      this.m.scale.setScalar(1); this.pMesh.count = n; this.pMesh.instanceMatrix.needsUpdate = true; if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true; }
    const b = s.boss; this.tele.visible = !!b && b.mode === 1;
    if (b && b.mode === 1) { const e = s.enemies, L = 22, ang = Math.atan2(b.dx, b.dz); this.tele.position.set(e.x[b.idx] + b.dx * L / 2, 0.06, e.z[b.idx] + b.dz * L / 2); this.tele.rotation.set(-Math.PI / 2, 0, -ang); this.tele.scale.set(3.2, L, 1); (this.tele.material as THREE.MeshBasicMaterial).opacity = 0.2 + 0.25 * Math.abs(Math.sin(s.time * 18)); }
    this.enemies.update(s.enemies, s.time, ex); this.dmg.update(dt, this.camera); let n = 0;
    n = 0; let rn = 0; const pr = s.projectiles; for (let i = 0; i < pr.count; i++) { if (!pr.alive[i]) continue;
      const k = pr.kind[i];
      if (k === 2) { const maxLife = 0.35, f = 1 - pr.life[i] / maxLife, r = pr.vx[i] * f; this.m.position.set(pr.x[i], 0.15, pr.z[i]); this.m.rotation.set(-Math.PI / 2, 0, 0); this.m.scale.set(r, r, r); this.m.updateMatrix(); this.ringMesh.setMatrixAt(rn++, this.m.matrix); continue; }
      this.m.position.set(pr.x[i], 0.8, pr.z[i]); this.m.rotation.set(0, s.time * 8, 0); this.m.scale.setScalar(k === 1 ? 1.8 : k === 3 ? 2.2 : 1); this.m.updateMatrix(); this.projMesh.setMatrixAt(n, this.m.matrix);
      this.flashColor.setHex(k === 1 ? 0x6fe8ff : k === 3 ? 0xfff6a8 : 0xffd27a); this.flashColor.multiplyScalar(2.8); this.projMesh.setColorAt(n, this.flashColor); n++; }
    this.m.scale.setScalar(1); this.ringMesh.count = rn; this.ringMesh.instanceMatrix.needsUpdate = true; if (this.projMesh.instanceColor) this.projMesh.instanceColor.needsUpdate = true;
    this.projMesh.count = n; this.projMesh.instanceMatrix.needsUpdate = true;
    n = 0; const pk = s.pickups; for (let i = 0; i < pk.count; i++) { if (!pk.alive[i]) continue;
      this.m.position.set(pk.x[i], 0.4 + Math.sin(s.time * 4 + i) * 0.1, pk.z[i]); this.m.rotation.set(0, s.time * 2 + i, 0); this.m.updateMatrix(); this.gemMesh.setMatrixAt(n++, this.m.matrix); }
    this.gemMesh.count = n; this.gemMesh.instanceMatrix.needsUpdate = true;
    this.arena.update(dt, s.time);
    if (this.bloomOn) this.composer.render(dt); else this.three.render(this.scene, this.camera);
  }
}
