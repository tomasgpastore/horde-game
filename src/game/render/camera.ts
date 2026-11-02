import * as THREE from 'three';

/** Smoothed follow camera with look-ahead, zoom breathing and trauma-based shake. Render-only state. */
export class CameraRig {
  cam: THREE.PerspectiveCamera;
  private tx = 0; private tz = 0; private lx = 0; private lz = 0;
  trauma = 0; shakeScale = 1; private t = 0; private inited = false;
  maxR = 1e9; /* camera target never goes beyond this radius from arena centre (set by Renderer: R-9) */ height = 20; back = 14; private zoom = 1; zoomBoost = 0; // zoomBoost: extra pull-out (boss fights)
  constructor(cam: THREE.PerspectiveCamera) { this.cam = cam; }
  addTrauma(a: number) { this.trauma = Math.min(1, this.trauma + a); }
  snap() { this.inited = false; }
  update(dt: number, px: number, pz: number, vx: number, vz: number, enemyCount: number) {
    this.t += dt;
    const k = (r: number) => 1 - Math.exp(-r * dt);
    // look-ahead toward movement direction, smoothed
    this.lx += (vx * 0.35 - this.lx) * k(3); this.lz += (vz * 0.35 - this.lz) * k(3);
    let gx = px + this.lx, gz = pz + this.lz; const gr = Math.hypot(gx, gz); if (gr > this.maxR) { gx *= this.maxR / gr; gz *= this.maxR / gr; } // never frame the edge/void
    if (!this.inited) { this.tx = gx; this.tz = gz; this.inited = true; }
    this.tx += (gx - this.tx) * k(9); this.tz += (gz - this.tz) * k(9);
    // pull out slightly in big hordes
    const asp = this.cam.aspect || 1; const portrait = asp < 1 ? Math.min(1.9, Math.max(1, 0.9 / asp)) : 1; // phones in portrait: pull the camera back so ~16-20u are visible across
    const zt = (1 + Math.min(0.18, enemyCount / 1500) + this.zoomBoost) * portrait;
    this.zoom += (zt - this.zoom) * k(1.5);
    const sh = this.trauma * this.trauma * this.shakeScale;
    const n = (f: number, s: number) => Math.sin(this.t * f + s) * Math.sin(this.t * f * 0.37 + s * 2.1);
    const ox = sh * 0.9 * n(47, 0), oy = sh * 0.6 * n(53, 3), oz = sh * 0.9 * n(41, 7);
    this.cam.position.set(this.tx + ox, this.height * this.zoom + oy, this.tz + this.back * this.zoom + oz);
    this.cam.lookAt(this.tx, 0, this.tz);
    this.cam.rotateZ(sh * 0.03 * n(37, 11));
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }
}
