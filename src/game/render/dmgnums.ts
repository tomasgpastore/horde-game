import * as THREE from 'three';
/** Pooled DOM damage numbers projected from world space. Pool of 40, reused round-robin; zero allocation per hit. */
export class DamageNumbers {
  private els: HTMLElement[] = []; private life = new Float32Array(40); private wx = new Float32Array(40); private wy = new Float32Array(40); private wz = new Float32Array(40); private head = 0; private v = new THREE.Vector3();
  constructor(parent: HTMLElement) {
    const root = document.createElement('div'); root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'; parent.appendChild(root);
    for (let i = 0; i < 40; i++) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;top:0;display:none;font:700 18px Rajdhani,system-ui,sans-serif;color:#ffe9a8;text-shadow:0 0 6px #000,0 2px 2px #000;will-change:transform'; root.appendChild(d); this.els.push(d); }
  }
  add(x: number, z: number, dmg: number, crit: boolean) {
    const i = this.head; this.head = (i + 1) % 40; const d = this.els[i];
    d.textContent = String(Math.round(dmg)); d.style.display = 'block'; d.style.color = crit ? '#ff8a3a' : '#ffe9a8'; d.style.fontSize = crit ? '26px' : '17px';
    this.life[i] = 0.7; this.wx[i] = x + (Math.random() - 0.5) * 0.6; this.wy[i] = 1.6; this.wz[i] = z;
  }
  update(dt: number, cam: THREE.Camera) {
    const w = innerWidth, h = innerHeight;
    for (let i = 0; i < 40; i++) { if (this.life[i] <= 0) continue; this.life[i] -= dt; const d = this.els[i];
      if (this.life[i] <= 0) { d.style.display = 'none'; continue; }
      this.wy[i] += dt * 1.6; this.v.set(this.wx[i], this.wy[i], this.wz[i]).project(cam);
      d.style.transform = `translate(${((this.v.x + 1) / 2 * w) | 0}px,${((1 - this.v.y) / 2 * h) | 0}px) translate(-50%,-50%)`; d.style.opacity = String(Math.min(1, this.life[i] * 3)); }
  }
}
