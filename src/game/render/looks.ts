import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Visual definition per enemy kind (index = state.enemies.kind, wraps). Gameplay owns kinds' stats; this is purely look. */
export interface EnemyLook { geo: THREE.BufferGeometry; color: number; scale: number; bob: number; hover: number }
const ng = (g: THREE.BufferGeometry) => g.index ? g.toNonIndexed() : g;
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };

function imp() { const b = at(new THREE.IcosahedronGeometry(0.5, 0), 0, 0.5, 0); b.scale(1, 0.9, 1);
  return mergeGeometries([ng(b), ng(at(new THREE.ConeGeometry(0.12, 0.3, 4), -0.22, 1.05, 0)), ng(at(new THREE.ConeGeometry(0.12, 0.3, 4), 0.22, 1.05, 0))])!; }
function spike() { return mergeGeometries([ng(at(new THREE.ConeGeometry(0.42, 1.3, 5), 0, 0.65, 0)), ng(at(new THREE.OctahedronGeometry(0.28), 0, 1.3, 0))])!; }
function brute() { return mergeGeometries([ng(at(new THREE.BoxGeometry(0.9, 0.9, 0.7), 0, 0.75, 0)), ng(at(new THREE.BoxGeometry(0.5, 0.4, 0.5), 0, 1.45, 0.1)), ng(at(new THREE.BoxGeometry(0.28, 0.6, 0.28), -0.6, 0.7, 0)), ng(at(new THREE.BoxGeometry(0.28, 0.6, 0.28), 0.6, 0.7, 0))])!; }
function wisp() { const o = new THREE.OctahedronGeometry(0.4); o.scale(1, 1.4, 1); return mergeGeometries([ng(at(o, 0, 0.1, 0)), ng(at(new THREE.TetrahedronGeometry(0.2), 0, -0.45, 0))])!; }
function shell() { const s = new THREE.DodecahedronGeometry(0.55); s.scale(1.1, 0.7, 1.1); return mergeGeometries([ng(at(s, 0, 0.4, 0)), ng(at(new THREE.ConeGeometry(0.2, 0.4, 4), 0, 0.5, 0.6).rotateX(Math.PI / 2))])!; }
function titan() { return mergeGeometries([ng(at(new THREE.DodecahedronGeometry(0.8), 0, 1.0, 0)), ng(at(new THREE.ConeGeometry(0.2, 0.7, 5), -0.55, 1.9, 0)), ng(at(new THREE.ConeGeometry(0.2, 0.7, 5), 0.55, 1.9, 0)), ng(at(new THREE.ConeGeometry(0.3, 0.5, 5), 0, 1.95, 0))])!; }

let cache: EnemyLook[] | null = null;
export function enemyLooks(): EnemyLook[] {
  return cache ??= [
    { geo: imp(), color: 0xd9472b, scale: 1, bob: 0.08, hover: 0 },
    { geo: spike(), color: 0x8e44ad, scale: 1, bob: 0.05, hover: 0 },
    { geo: brute(), color: 0x5d7a3a, scale: 1.25, bob: 0.04, hover: 0 },
    { geo: wisp(), color: 0x3fb9d8, scale: 1, bob: 0.2, hover: 0.7 },
    { geo: shell(), color: 0xc9a227, scale: 1.1, bob: 0.03, hover: 0 },
    { geo: titan(), color: 0xe8e0d0, scale: 2.2, bob: 0.03, hover: 0 },
  ];
}
/** Projectile kind -> HDR color (>1 blooms). */
export const PROJ_COLORS = [0xffa23a, 0x7fd8ff, 0xff4f6a, 0xb98cff, 0xfff1a0];
export const PICKUP_COLORS = [0x45e0ff, 0xffd23f, 0xff5470, 0xa0ff7a, 0xffffff];
