import * as THREE from 'three';
import type { ArenaDef } from '@shared/types';
/** World Engineer owns this folder: arena defs (data in sim terms + build() for scenery), props, spawn tables, biome variety. */
const ashenBasin: ArenaDef = {
  id: 'ashen_basin', name: 'Ashen Basin', radius: 40, obstacles: [], playerSpawn: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: -2, z: 0 }, { x: 0, z: 2 }],
  palette: { ground: 0x2b2733, fog: 0x1a1722, sky: 0x1a1722, accent: 0xff7a2f, light: 0xffd8a8 },
  build(scene) {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshLambertMaterial({ color: this.palette.ground }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const sun = new THREE.DirectionalLight(this.palette.light, 2); sun.position.set(10, 25, 8); sun.castShadow = true; scene.add(sun, new THREE.HemisphereLight(0x8899ff, 0x221122, 0.8));
    return { update() {}, dispose() { scene.remove(ground, sun); } };
  },
};
const arenas: Record<string, ArenaDef> = { [ashenBasin.id]: ashenBasin };
export const getArena = (id: string) => arenas[id];
