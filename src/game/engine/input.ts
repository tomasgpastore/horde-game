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
