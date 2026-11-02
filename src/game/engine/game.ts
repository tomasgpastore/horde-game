import { TICK_DT, PlayerInput } from '@shared/types';
import { Sim, createState } from '@sim/index';
import { Renderer } from '@render/renderer';
import { KeyboardMouse } from './input';
import { getArena } from '@world/index';
import { mountHud } from '@ui/hud';
import { Audio, audio } from '@audio/index';
import type { Settings, ShellInput } from './createGame';

/** Fixed-timestep loop (60Hz sim). Owns canvas + HUD overlay inside canvasParent. Never touches #shell. */
export class Game {
  sim!: Sim; renderer: Renderer; input: KeyboardMouse; acc = 0; last = performance.now(); hud; audio = new Audio();
  fps = 0; private frames = 0; private fpsT = 0; running = false; paused = false; raf = 0;
  canvas = document.createElement('canvas'); ui = document.createElement('div'); mode: 'solo' | 'coop' = 'solo';
  constructor(parent: HTMLElement, private shellInput: ShellInput, public settings: Settings) {
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; this.ui.style.cssText = 'position:absolute;inset:0;pointer-events:none;color:#fff';
    parent.append(this.canvas, this.ui);
    this.input = new KeyboardMouse(this.canvas);
    this.reset(); this.renderer = new Renderer(this.canvas, getArena(new URLSearchParams(location.search).get('arena') || 'ashen_woods')); this.hud = mountHud(this.ui, i => this.choose(i));
    (window as any).__game = this; // QA hook
    this.applySettings(settings);
    this.raf = requestAnimationFrame(this.frame); // renders idle scene behind menu
  }
  reset() {
    const arena = getArena(new URLSearchParams(location.search).get('arena') || 'ashen_woods'); const seed = Number(new URLSearchParams(location.search).get('seed')) || (Date.now() & 0xffffff);
    this.sim = new Sim(createState(seed, arena, 1), arena); this.acc = 0;
  }
  choose(i: number) { if (this.sim.state.phase === 'levelUp') { this.sim.choose(i); this.audio.ui('card'); } }
  start(mode: 'solo' | 'coop') { this.mode = mode; this.reset(); this.running = true; this.paused = false; this.last = performance.now(); }
  pause() { this.paused = true; audio.suspend(); } resume() { this.paused = false; this.last = performance.now(); audio.resume(); }
  quit() { this.running = false; this.paused = false; this.reset(); }
  applySettings(s: Settings) {
    this.settings = s;
    audio.setVolume('master', s.volume); audio.setVolume('music', s.music); audio.setVolume('sfx', s.sfx);
    const r = (this.renderer as any)?.three; if (r) r.setPixelRatio(Math.min(devicePixelRatio, s.quality === 'low' ? 1 : s.quality === 'high' ? 2 : 1.5));
    dispatchEvent(new Event('resize')); // re-apply size with new pixel ratio
    // TODO Engine: screenshake honours s.shake
  }
  /** Aim at the nearest live enemy (touch/gamepad); fall back to move direction, then keep previous aim. */
  autoAim(me: { x: number; z: number }, inp: PlayerInput) {
    const e = this.sim.state.enemies; let best = -1, bd = Infinity;
    for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - me.x, dz = e.z[i] - me.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    if (best >= 0) { const l = Math.sqrt(bd) || 1; inp.aimX = (e.x[best] - me.x) / l; inp.aimZ = (e.z[best] - me.z) / l; }
    else if (inp.moveX || inp.moveZ) { const l = Math.hypot(inp.moveX, inp.moveZ); inp.aimX = inp.moveX / l; inp.aimZ = inp.moveZ / l; }
  }
  gameOver(victory: boolean) { this.running = false; const s = this.sim.state; dispatchEvent(new CustomEvent('game:over', { detail: { score: s.kills, time: s.time, victory } })); }
  /** ?autoplay=1 debug bot (trailer capture): kites away from the horde's centre of mass; invulnerable; auto-picks cards. */
  autoplay = new URLSearchParams(location.search).get('autoplay') === '1'; private botT = 0;
  bot(me: { x: number; z: number }): PlayerInput {
    const e = this.sim.state.enemies; let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < e.count; i++) if (e.alive[i]) { const dx = me.x - e.x[i], dz = me.z - e.z[i], d2 = dx * dx + dz * dz + 1; if (d2 < 150) { sx += dx / d2; sz += dz / d2; n++; } }
    const pk = this.sim.state.pickups; let bd = 144, gx = 0, gz = 0;
    for (let i = 0; i < pk.count; i++) if (pk.alive[i]) { const dx = pk.x[i] - me.x, dz = pk.z[i] - me.z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; gx = dx; gz = dz; } }
    if (bd < 144) { const l = Math.sqrt(bd) || 1; sx += gx / l * 0.12; sz += gz / l * 0.12; }
    this.botT += 1 / 60; const a = this.botT * 0.5;
    let mx = sx + Math.cos(a) * 0.02 - me.x * 0.0008, mz = sz + Math.sin(a) * 0.02 - me.z * 0.0008; const l = Math.hypot(mx, mz) || 1;
    return { moveX: mx / l, moveZ: mz / l, aimX: 0, aimZ: 1, dash: false, ability: false };
  }
  frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const me = this.sim.state.players[0];
    if (this.autoplay) { me.iframes = 9999; if (this.sim.state.phase === 'levelUp') this.choose(this.sim.state.tick % 3); }
    if (this.running && !this.paused) {
      this.acc += dt;
      const inp: PlayerInput = this.autoplay ? this.bot(me) : this.input.poll(me, this.renderer.camera);
      const si = this.shellInput, m = si.move; if (!this.autoplay && (m.x || m.y)) { inp.moveX = m.x; inp.moveZ = m.y; } // touch stick or gamepad (shell)
      if (si.dash) { inp.dash = true; si.dash = false; }
      if (si.touch || m.x || m.y) this.autoAim(me, inp); // no mouse on touch/gamepad: aim at nearest enemy
      while (this.acc >= TICK_DT) {
        this.sim.step([inp]); inp.dash = inp.ability = false; this.acc -= TICK_DT;
        this.audio.consume(this.sim.state.events, this.sim.state); this.renderer.consumeEvents(this.sim.state.events);
        if (this.sim.state.phase === 'gameOver') { this.gameOver(this.sim.state.events.some(e => e.t === 'gameOver' && e.victory)); break; }
      }
    }
    this.renderer.render(this.sim.state, this.paused ? 0 : dt, this.acc / TICK_DT);
    this.hud.update(this.sim.state, this.fps);
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
  };
}
