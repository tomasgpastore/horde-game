import * as THREE from 'three';
import type { SimState, SimEvent, ArenaDef, ArenaHandle } from '@shared/types';
import { MAX_ENEMIES, MAX_PROJECTILES, MAX_PICKUPS, TICK_DT } from '@shared/types';
import { CameraRig } from './camera';
import { PostFx } from './postfx';
import { Particles } from './particles';
import { DamageNumbers } from './dmgnums';
import { enemyLooks, PROJ_COLORS, PICKUP_COLORS } from './looks';

export interface RenderSettings { quality: 'low' | 'med' | 'high'; shake: boolean | number }
const PLAYER_COLORS = [0xffc857, 0x6ec6ff, 0x9dff8a, 0xff8ad8];

/** Write a Y-rotation + non-uniform scale + translation matrix straight into an instance buffer. */
function put(a: Float32Array, n: number, x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number) {
  const c = Math.cos(yaw), s = Math.sin(yaw), o = n * 16;
  a[o] = c * sx; a[o + 1] = 0; a[o + 2] = -s * sx; a[o + 3] = 0;
  a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = s * sz; a[o + 9] = 0; a[o + 10] = c * sz; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}

/** Render reads SimState only (never mutates). Instanced pools: 1 mesh per enemy kind, 1 projectiles, 1 pickups, 1 particles. */
export class Renderer {
  three: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(48, 1, 0.5, 160);
  rig = new CameraRig(this.camera); post: PostFx; particles: Particles; dmg: DamageNumbers;
  /** Juice requests read by Game.frame: seconds of sim freeze (hitstop) and slow-mo. */
  hitstop = 0; slowmo = 0; arena: ArenaHandle;
  private kinds: { mesh: THREE.InstancedMesh; base: THREE.Color; scale: number; bob: number; hover: number }[] = [];
  private projMesh: THREE.InstancedMesh; private ringMesh: THREE.InstancedMesh; private pickMesh: THREE.InstancedMesh;
  private playerMeshes: THREE.Group[] = []; private playerLight: THREE.PointLight;
  private sun: THREE.DirectionalLight | null = null; private sunOff = new THREE.Vector3(10, 25, 8);
  private hurt = 0; private quality: 'low' | 'med' | 'high' = 'high'; private pr = 1; private clock = 0;
  private c = new THREE.Color();

  constructor(canvas: HTMLCanvasElement, def: ArenaDef) {
    this.three = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.three.shadowMap.enabled = true; this.three.shadowMap.type = THREE.PCFSoftShadowMap;
    this.three.toneMapping = THREE.ACESFilmicToneMapping; this.three.toneMappingExposure = 1.7;
    this.scene.background = new THREE.Color(def.palette.sky); this.scene.fog = new THREE.FogExp2(def.palette.fog, 0.019);
    this.arena = def.build(this.scene);
    this.setupLights(def);

    const mat = new THREE.MeshLambertMaterial({ flatShading: true });
    for (const look of enemyLooks()) {
      const m = new THREE.InstancedMesh(look.geo, mat, MAX_ENEMIES);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ENEMIES * 3), 3);
      m.frustumCulled = false; m.castShadow = true; m.count = 0; this.scene.add(m);
      this.kinds.push({ mesh: m, base: new THREE.Color(look.color), scale: look.scale, bob: look.bob, hover: look.hover });
    }
    const pg = new THREE.OctahedronGeometry(0.2); pg.scale(1, 1, 2.6); pg.translate(0, 0.7, 0);
    this.projMesh = this.pool(pg, MAX_PROJECTILES);
    this.ringMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fe8ff).multiplyScalar(2), side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), 64);
    this.ringMesh.frustumCulled = false; this.ringMesh.count = 0; this.scene.add(this.ringMesh);
    const kg = new THREE.OctahedronGeometry(0.28); kg.scale(0.8, 1.2, 0.8); kg.translate(0, 0.5, 0);
    this.pickMesh = this.pool(kg, MAX_PICKUPS);

    const pm = new THREE.MeshLambertMaterial({ flatShading: true });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 3, 8), pm.clone()); (body.material as THREE.MeshLambertMaterial).color.setHex(PLAYER_COLORS[i]);
      body.position.y = 0.85; body.castShadow = true;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(PLAYER_COLORS[i]).multiplyScalar(1.6) }));
      gem.position.set(0, 1.65, 0);
      g.add(body, gem); g.visible = false; this.scene.add(g); this.playerMeshes.push(g);
    }
    this.playerLight = new THREE.PointLight(0xffa860, 7, 16, 1.5); this.scene.add(this.playerLight);
    this.particles = new Particles(this.scene); this.dmg = new DamageNumbers(this.scene);
    this.post = new PostFx(this.three, this.scene, this.camera);
    addEventListener('resize', this.onResize); this.applySettings({ quality: 'high', shake: true }); this.onResize();
  }

  private pool(geo: THREE.BufferGeometry, n: number) {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), n);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    m.frustumCulled = false; m.count = 0; this.scene.add(m); return m;
  }

  /** Arena (World) may add its own lights; we tune whatever sun it made, and fill in if it made none. */
  private setupLights(def: ArenaDef) {
    this.scene.traverse(o => { if ((o as THREE.DirectionalLight).isDirectionalLight && !this.sun) this.sun = o as THREE.DirectionalLight; });
    if (!this.sun) {
      this.sun = new THREE.DirectionalLight(def.palette.light, 2.2); this.sun.position.copy(this.sunOff); this.scene.add(this.sun);
      this.scene.add(new THREE.HemisphereLight(0x8899ff, 0x221122, 0.8));
    } else this.sunOff.copy(this.sun.position);
    const s = this.sun; s.castShadow = true; s.shadow.bias = -0.0004; s.shadow.normalBias = 0.04;
    const cam = s.shadow.camera; cam.left = -24; cam.right = 24; cam.top = 24; cam.bottom = -24; cam.near = 1; cam.far = 80; cam.updateProjectionMatrix();
    this.scene.add(s.target);
  }

  private slowT = 0; private slowN = 0; private shakeSet: boolean | number = true;
  /** Auto-degrade: if the GPU can't hold ~25fps for 0.8s, drop one quality tier (high->med->low). Never upgrades. */
  private watchPerf(rawDt: number) {
    if (this.quality === 'low' || rawDt <= 0 || rawDt > 0.5) return;
    this.slowT += rawDt; this.slowN++;
    if (this.slowT < 0.8) return;
    if (this.slowT / this.slowN > 0.04) this.applySettings({ quality: this.quality === 'high' ? 'med' : 'low', shake: this.shakeSet });
    this.slowT = 0; this.slowN = 0;
  }
  applySettings(st: RenderSettings) {
    this.shakeSet = st.shake;
    this.quality = st.quality; this.rig.shakeScale = st.shake === false ? 0 : st.shake === true ? 1 : Number(st.shake);
    this.pr = Math.min(devicePixelRatio, st.quality === 'high' ? 2 : st.quality === 'med' ? 1.5 : 1);
    this.three.setPixelRatio(this.pr);
    const sz = st.quality === 'low' ? 1024 : 2048; const sh = this.sun!.shadow;
    if (sh.mapSize.x !== sz) { sh.mapSize.set(sz, sz); sh.map?.dispose(); sh.map = null; }
    this.three.shadowMap.enabled = st.quality !== 'low';
    this.post.enabled = st.quality !== 'low'; this.post.bloom.strength = st.quality === 'high' ? 0.6 : 0.4;
    this.onResize();
  }
  private onResize = () => {
    const w = innerWidth, h = innerHeight;
    this.three.setSize(w, h, false); this.post?.setSize(w, h, this.pr);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };

  consumeEvents(evs: SimEvent[], s?: SimState) {
    const P = this.particles, me = s?.players[0];
    for (const e of evs) switch (e.t) {
      case 'hit': P.burst(e.x, e.z, e.crit ? 10 : 4, e.crit ? 7 : 4.5, 0.35, e.crit ? 0.14 : 0.1, e.crit ? 0xffe27a : 0xffb46a, 3, 3); this.dmg.spawn(e.x, e.z, e.dmg, e.crit); if (e.crit) { this.rig.addTrauma(0.08); this.hitstop = Math.max(this.hitstop, 0.04); } break;
      case 'kill': P.burst(e.x, e.z, 12, 6, 0.6, 0.18, 0xff7a2f, 2.2, 5); P.burst(e.x, e.z, 4, 3, 0.8, 0.12, 0x3a2f3a, 0.8, 3); this.rig.addTrauma(0.03); break;
      case 'shoot': P.burst(e.x, e.z, 2, 3, 0.18, 0.08, 0xffd08a, 3, 0.5, 0, 0.8); break;
      case 'playerHurt': this.hurt = 1; this.rig.addTrauma(0.45); this.hitstop = Math.max(this.hitstop, 0.05); if (me) P.burst(me.x, me.z, 14, 6, 0.5, 0.16, 0xff3344, 2.5, 4); break;
      case 'pickup': if (me) P.burst(me.x, me.z, 5, 3, 0.4, 0.1, PICKUP_COLORS[e.kind % PICKUP_COLORS.length], 3, 3, 4, 1); break;
      case 'levelUp': if (me) { P.ring(me.x, me.z, 48, 11, 0.8, 0.2, 0xffd23f, 3); P.burst(me.x, me.z, 30, 5, 1, 0.16, 0xfff1a0, 3, 9); } this.rig.addTrauma(0.2); this.slowmo = 0.6; break;
      case 'dash': if (me) P.burst(me.x, me.z, 10, 3, 0.4, 0.14, 0x9ad8ff, 2, 0.5, 0); break;
      case 'bossSpawn': P.ring(e.x, e.z, 64, 14, 1.2, 0.3, 0xff3a3a, 3); this.rig.addTrauma(0.7); this.hitstop = Math.max(this.hitstop, 0.06); break;
      case 'bossDeath': P.burst(e.x, e.z, 120, 12, 1.5, 0.3, 0xffb040, 3, 12); P.ring(e.x, e.z, 64, 16, 1, 0.25, 0xffffff, 3); this.rig.addTrauma(1); this.hitstop = 0.06; this.slowmo = 0.8; break;
      case 'waveStart': this.rig.addTrauma(0.1); break;
    }
  }

  render(s: SimState, dt: number, alpha: number) {
    this.watchPerf(dt); this.clock += dt; const t = this.clock, ex = alpha * TICK_DT;
    // players (extrapolate by velocity for smoothness between 60Hz ticks)
    let me = s.players[0];
    for (let i = 0; i < this.playerMeshes.length; i++) {
      const p = s.players[i], g = this.playerMeshes[i]; g.visible = !!p && p.active && !p.dead; if (!g.visible) continue;
      g.position.set(p.x + p.vx * ex, Math.abs(Math.sin(t * 10)) * 0.08 * Math.min(1, Math.hypot(p.vx, p.vz)), p.z + p.vz * ex); g.rotation.y = p.facing;
      g.children[1].rotation.y = t * 2; g.children[1].position.y = 1.65 + Math.sin(t * 3) * 0.08;
    }
    const px = me.x + me.vx * ex, pz = me.z + me.vz * ex;
    this.rig.update(dt, px, pz, me.vx, me.vz, s.enemies.count);
    this.playerLight.position.set(px, 3.5, pz);
    if (this.sun) { this.sun.position.set(px + this.sunOff.x, this.sunOff.y, pz + this.sunOff.z); this.sun.target.position.set(px, 0, pz); }

    // enemies: one instanced mesh per kind
    const e = s.enemies, K = this.kinds;
    for (const k of K) k.mesh.count = 0;
    for (let i = 0; i < e.count; i++) {
      if (!e.alive[i]) continue;
      const k = K[e.kind[i] % K.length], m = k.mesh, n = m.count++;
      const bob = Math.abs(Math.sin(t * 9 + i * 1.7)), sq = 1 + (bob - 0.5) * k.bob;
      const f = e.hitFlash[i] > 0 ? Math.min(1, e.hitFlash[i] / 0.1) : 0;
      put(m.instanceMatrix.array as Float32Array, n, e.x[i] + e.vx[i] * ex, k.hover + bob * k.bob * 2.5 + (k.hover ? Math.sin(t * 2 + i) * 0.15 : 0), e.z[i] + e.vz[i] * ex, e.facing[i], k.scale / sq, k.scale * sq, k.scale / sq);
      const ca = m.instanceColor!.array as Float32Array, w = 1 + f * 4; // >1 => blooms white-hot
      ca[n * 3] = k.base.r * (1 - f) + w * f; ca[n * 3 + 1] = k.base.g * (1 - f) + w * f; ca[n * 3 + 2] = k.base.b * (1 - f) + w * f;
    }
    for (const k of K) { k.mesh.instanceMatrix.needsUpdate = true; k.mesh.instanceColor!.needsUpdate = true; }

    // projectiles
    const pr = s.projectiles, pm = this.projMesh; let n = 0, rn = 0; const ra = this.ringMesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < pr.count; i++) {
      if (!pr.alive[i]) continue;
      if (pr.kind[i] === 2 && rn < 64) { // expanding shockwave ring: vx = max radius, life = remaining of 0.35s
        const r = pr.vx[i] * (1 - pr.life[i] / 0.35), o = rn++ * 16; ra.fill(0, o, o + 16);
        ra[o] = r; ra[o + 6] = r; ra[o + 9] = -r; ra[o + 12] = pr.x[i]; ra[o + 13] = 0.15; ra[o + 14] = pr.z[i]; ra[o + 15] = 1; continue; }
      put(pm.instanceMatrix.array as Float32Array, n, pr.x[i] + pr.vx[i] * ex, 0, pr.z[i] + pr.vz[i] * ex, Math.atan2(pr.vx[i], pr.vz[i]), 1, 1, 1);
      this.c.setHex(PROJ_COLORS[pr.kind[i] % PROJ_COLORS.length]).multiplyScalar(2.5);
      const ca = pm.instanceColor!.array as Float32Array; ca[n * 3] = this.c.r; ca[n * 3 + 1] = this.c.g; ca[n * 3 + 2] = this.c.b; n++;
    }
    this.ringMesh.count = rn; this.ringMesh.instanceMatrix.needsUpdate = true;
    pm.count = n; pm.instanceMatrix.needsUpdate = true; pm.instanceColor!.needsUpdate = true;

    // pickups (spin + bob)
    const pk = s.pickups, km = this.pickMesh; n = 0;
    for (let i = 0; i < pk.count; i++) {
      if (!pk.alive[i]) continue;
      put(km.instanceMatrix.array as Float32Array, n, pk.x[i], Math.sin(t * 3 + i) * 0.12, pk.z[i], t * 2.5 + i, 1, 1, 1);
      this.c.setHex(PICKUP_COLORS[pk.kind[i] % PICKUP_COLORS.length]).multiplyScalar(2.2);
      const ca = km.instanceColor!.array as Float32Array; ca[n * 3] = this.c.r; ca[n * 3 + 1] = this.c.g; ca[n * 3 + 2] = this.c.b; n++;
    }
    km.count = n; km.instanceMatrix.needsUpdate = true; km.instanceColor!.needsUpdate = true;

    this.particles.update(dt); this.dmg.update(dt);
    this.arena.update(dt, s.time);
    this.hurt = Math.max(0, this.hurt - dt * 2.5);
    if (this.post.enabled) this.post.render(dt, t, this.hurt); else this.three.render(this.scene, this.camera);
  }
}
