import type { PlayerInput } from '@shared/types';
export interface InputSource { poll(playerPos: { x: number; z: number }, camera: import('three').Camera): PlayerInput }
/** Keyboard (WASD/arrows) + mouse aim (ray to ground plane). Engine Engineer: add gamepad + touch. */
export class KeyboardMouse implements InputSource {
  keys = new Set<string>(); mx = 0; my = 0; dashQ = false; abQ = false;
  constructor(private el: HTMLElement) {
    addEventListener('keydown', e => { this.keys.add(e.code); if (e.code === 'Space') this.dashQ = true; if (e.code === 'KeyE') this.abQ = true; });
    addEventListener('keyup', e => this.keys.delete(e.code));
    el.addEventListener('pointermove', e => { this.mx = e.clientX / innerWidth * 2 - 1; this.my = -(e.clientY / innerHeight * 2 - 1); });
  }
  poll(pos: { x: number; z: number }, cam: import('three').Camera): PlayerInput {
    const k = this.keys;
    const moveX = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const moveZ = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    // aim: unproject mouse to y=0
    const v = (cam as any).position.clone().set(this.mx, this.my, 0.5).unproject(cam as any);
    const o = (cam as any).position, dx = v.x - o.x, dy = v.y - o.y, dz = v.z - o.z;
    let ax = 0, az = 1; if (Math.abs(dy) > 1e-5) { const t = -o.y / dy, gx = o.x + dx * t - pos.x, gz = o.z + dz * t - pos.z, l = Math.hypot(gx, gz) || 1; ax = gx / l; az = gz / l; }
    const r = { moveX, moveZ, aimX: ax, aimZ: az, dash: this.dashQ, ability: this.abQ }; this.dashQ = this.abQ = false; return r;
  }
}

const dz = (v: number, d = 0.18) => { const a = Math.abs(v); return a < d ? 0 : Math.sign(v) * (a - d) / (1 - d); };
/** Gamepad: left stick move, right stick aim (falls back to last aim), A/RB/RT dash, X/LB/LT ability. Shell already maps left stick -> shellInput.move. */
export class Gamepad {
  aimX = 0; aimZ = 1; private prevDash = false; private prevAb = false; active = false;
  poll(base: PlayerInput): PlayerInput {
    const pad = (navigator.getGamepads?.() ?? []).find(p => p && p.connected);
    if (!pad) { this.active = false; return base; }
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const mx = dz(pad.axes[0] ?? 0), mz = dz(pad.axes[1] ?? 0), rx = dz(pad.axes[2] ?? 0), rz = dz(pad.axes[3] ?? 0);
    if (mx || mz || rx || rz || b(0) || b(2)) this.active = true;
    if (!this.active) return base;
    if (rx || rz) { const l = Math.hypot(rx, rz); this.aimX = rx / l; this.aimZ = rz / l; }
    else if (mx || mz) { const l = Math.hypot(mx, mz); this.aimX = mx / l; this.aimZ = mz / l; }
    const dash = b(0) || b(5) || b(7), ab = b(2) || b(4) || b(6);
    const out = { ...base, moveX: mx || base.moveX, moveZ: mz || base.moveZ, aimX: this.aimX, aimZ: this.aimZ,
      dash: base.dash || (dash && !this.prevDash), ability: base.ability || (ab && !this.prevAb) };
    this.prevDash = dash; this.prevAb = ab; return out;
  }
}
