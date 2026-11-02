import * as THREE from 'three';
import type { SimState, SimEvent, ArenaDef, ArenaHandle } from '@shared/types';
import { MAX_ENEMIES, MAX_PROJECTILES, MAX_PICKUPS } from '@shared/types';

/** Render reads SimState only (never mutates). Enemies = ONE InstancedMesh per kind-group for 300+ @60fps.
 *  Engine Engineer owns: camera, lighting, post-fx, particles, instanced pools for projectiles/pickups, per-kind meshes/colors. */
export class Renderer {
  three: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  projMesh: THREE.InstancedMesh; ringMesh: THREE.InstancedMesh; gemMesh: THREE.InstancedMesh; enemyMesh: THREE.InstancedMesh; flashColor = new THREE.Color(0xffffff); baseColors = [0xe0602a, 0xc02a8a, 0x8fd13a];
  playerMesh: THREE.Mesh; arena: ArenaHandle; m = new THREE.Object3D();
  constructor(canvas: HTMLCanvasElement, def: ArenaDef) {
    this.three = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.three.setPixelRatio(Math.min(devicePixelRatio, 2)); this.three.shadowMap.enabled = true;
    this.scene.background = new THREE.Color(def.palette.sky); this.scene.fog = new THREE.Fog(def.palette.fog, 25, 70);
    this.arena = def.build(this.scene);
    const g = new THREE.ConeGeometry(0.45, 1.1, 6); g.translate(0, 0.55, 0);
    this.enemyMesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), MAX_ENEMIES);
    this.enemyMesh.frustumCulled = false; this.enemyMesh.castShadow = true; this.scene.add(this.enemyMesh);
    this.enemyMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ENEMIES * 3), 3);
    const emissive = (c: number) => new THREE.MeshBasicMaterial({ color: c });
    this.projMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.3), emissive(0xffffff), MAX_PROJECTILES);
    this.projMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PROJECTILES * 3), 3);
    this.ringMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), 64);
    this.ringMesh.frustumCulled = false; this.scene.add(this.ringMesh);
    this.gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22), emissive(0x4de8ff), MAX_PICKUPS);
    for (const m of [this.projMesh, this.gemMesh]) { m.frustumCulled = false; this.scene.add(m); }
    this.playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 4, 8), new THREE.MeshLambertMaterial({ color: 0xffc857 }));
    this.playerMesh.position.y = 0.8; this.playerMesh.castShadow = true; this.scene.add(this.playerMesh);
    const onResize = () => { this.three.setSize(innerWidth, innerHeight, false); this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); };
    addEventListener('resize', onResize); onResize();
  }
  consumeEvents(_ev: SimEvent[]) { /* TODO Engine: spawn particles/damage numbers/screenshake */ }
  render(s: SimState, dt: number, _alpha: number) {
    const p = s.players[0]; this.playerMesh.position.set(p.x, 0.8, p.z); this.playerMesh.rotation.y = p.facing;
    this.camera.position.set(p.x, 16, p.z + 11); this.camera.lookAt(p.x, 0, p.z);
    const e = s.enemies; let n = 0;
    for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue;
      this.m.position.set(e.x[i], 0, e.z[i]); this.m.rotation.set(0, e.facing[i], 0); this.m.updateMatrix(); this.enemyMesh.setMatrixAt(n, this.m.matrix);
      this.flashColor.setHex(e.hitFlash[i] > 0 ? 0xffffff : this.baseColors[e.kind[i] % 3]); this.enemyMesh.setColorAt(n, this.flashColor); n++; }
    this.enemyMesh.count = n; this.enemyMesh.instanceMatrix.needsUpdate = true; if (this.enemyMesh.instanceColor) this.enemyMesh.instanceColor.needsUpdate = true;
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
    this.three.render(this.scene, this.camera);
  }
}
