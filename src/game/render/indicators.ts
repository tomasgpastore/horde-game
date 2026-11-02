import * as THREE from 'three';
import type { SimState } from '@shared/types';

const MAX = 8, PAD = 44, BOSS = '#ff3b3b', ELITE = '#ffc83a', CHEST = '#ffe14a';
export const CHEST_KIND = 1; // pickup kind per Tech Lead

/** Edge-of-screen arrows (pooled DOM) pointing at off-screen boss / elites / chests. Read-only on SimState. */
export class Indicators {
  private els: HTMLDivElement[] = []; private v = new THREE.Vector3(); private used = 0;
  constructor(parent: HTMLElement) {
    for (let i = 0; i < MAX; i++) {
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;left:0;top:0;width:28px;height:28px;margin:-14px;display:none;clip-path:polygon(50% 0,100% 100%,50% 75%,0 100%);will-change:transform';
      parent.append(d); this.els.push(d);
    }
  }
  private place(x: number, z: number, cam: THREE.Camera, w: number, h: number, color: string, scale: number) {
    if (this.used >= MAX) return;
    this.v.set(x, 0.5, z).project(cam);
    let nx = this.v.x, ny = this.v.y; const behind = this.v.z > 1;
    if (behind) { nx = -nx; ny = -ny; }
    const sx = (nx * 0.5 + 0.5) * w, sy = (-ny * 0.5 + 0.5) * h;
    if (!behind && sx > PAD && sx < w - PAD && sy > PAD && sy < h - PAD) return; // on screen
    const cx = w / 2, cy = h / 2, dx = sx - cx || 1e-3, dy = sy - cy;
    const k = Math.min((cx - PAD) / Math.abs(dx), (cy - PAD) / Math.abs(dy));
    const px = cx + dx * k, py = cy + dy * k, el = this.els[this.used++];
    el.style.display = 'block'; el.style.background = color;
    el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) rotate(${(Math.atan2(dy, dx) + Math.PI / 2).toFixed(3)}rad) scale(${scale})`;
  }
  update(s: SimState, cam: THREE.Camera, w: number, h: number) {
    this.used = 0;
    if (s.boss) { const i = s.boss.idx; if (s.enemies.alive[i]) this.place(s.enemies.x[i], s.enemies.z[i], cam, w, h, BOSS, 1.5); }
    const e = s.enemies;
    for (let i = 0; i < e.count && this.used < MAX; i++) { if (e.alive[i] && (e.flags[i] & 1) && !(s.boss && s.boss.idx === i)) this.place(e.x[i], e.z[i], cam, w, h, ELITE, 1.1); }
    const pk = s.pickups;
    for (let i = 0; i < pk.count && this.used < MAX; i++) if (pk.alive[i] && pk.kind[i] === CHEST_KIND) this.place(pk.x[i], pk.z[i], cam, w, h, CHEST, 1.1);
    for (let i = this.used; i < MAX; i++) { const st = this.els[i].style; if (st.display !== 'none') st.display = 'none'; }
  }
}
