import * as THREE from 'three';
import type { SimState, SimEvent, ArenaDef, ArenaHandle } from '@shared/types';
import { MAX_ENEMIES } from '@shared/types';

/** Render reads SimState only (never mutates). Enemies = ONE InstancedMesh per kind-group for 300+ @60fps.
 *  Engine Engineer owns: camera, lighting, post-fx, particles, instanced pools for projectiles/pickups, per-kind meshes/colors. */
export class Renderer {
  three: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  enemyMesh: THREE.InstancedMesh; playerMesh: THREE.Mesh; arena: ArenaHandle; m = new THREE.Object3D();
  constructor(canvas: HTMLCanvasElement, def: ArenaDef) {
    this.three = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.three.setPixelRatio(Math.min(devicePixelRatio, 2)); this.three.shadowMap.enabled = true;
    this.scene.background = new THREE.Color(def.palette.sky); this.scene.fog = new THREE.Fog(def.palette.fog, 25, 70);
    this.arena = def.build(this.scene);
    const g = new THREE.ConeGeometry(0.45, 1.1, 6); g.translate(0, 0.55, 0);
    this.enemyMesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xc0392b }), MAX_ENEMIES);
    this.enemyMesh.frustumCulled = false; this.enemyMesh.castShadow = true; this.scene.add(this.enemyMesh);
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
      this.m.position.set(e.x[i], 0, e.z[i]); this.m.rotation.set(0, e.facing[i], 0); this.m.updateMatrix(); this.enemyMesh.setMatrixAt(n++, this.m.matrix); }
    this.enemyMesh.count = n; this.enemyMesh.instanceMatrix.needsUpdate = true;
    this.arena.update(dt, s.time);
    this.three.render(this.scene, this.camera);
  }
}
