import { TICK_DT, PlayerInput } from '@shared/types';
import { Sim, createState } from '@sim/index';
import { Renderer } from '@render/renderer';
import { KeyboardMouse } from './input';
import { getArena } from '@world/index';
import { mountHud } from '@ui/hud';
import { Audio } from '@audio/index';
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
    this.reset(); this.renderer = new Renderer(this.canvas, getArena(new URLSearchParams(location.search).get('arena') || 'ashen_woods')); this.hud = mountHud(this.ui);
    (window as any).__game = this; // QA hook
    this.raf = requestAnimationFrame(this.frame); // renders idle scene behind menu
  }
  reset() {
    const arena = getArena(new URLSearchParams(location.search).get('arena') || 'ashen_woods'); const seed = Number(new URLSearchParams(location.search).get('seed')) || (Date.now() & 0xffffff);
    this.sim = new Sim(createState(seed, arena, 1), arena); this.acc = 0;
  }
  start(mode: 'solo' | 'coop') { this.mode = mode; this.reset(); this.running = true; this.paused = false; this.last = performance.now(); }
  pause() { this.paused = true; } resume() { this.paused = false; this.last = performance.now(); }
  quit() { this.running = false; this.paused = false; this.reset(); }
  applySettings(s: Settings) { this.settings = s; /* TODO Engine: volume -> audio, quality -> pixelRatio/post-fx, shake */ }
  gameOver(victory: boolean) { this.running = false; const s = this.sim.state; dispatchEvent(new CustomEvent('game:over', { detail: { score: s.kills, time: s.time, victory } })); }
  frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const me = this.sim.state.players[0];
    if (this.running && !this.paused) {
      this.acc += dt;
      const inp: PlayerInput = this.input.poll(me, this.renderer.camera);
      const m = this.shellInput.move; if (this.shellInput.touch && (m.x || m.y)) { inp.moveX = m.x; inp.moveZ = m.y; }
      while (this.acc >= TICK_DT) {
        this.sim.step([inp]); inp.dash = inp.ability = false; this.acc -= TICK_DT;
        this.audio.consume(this.sim.state.events); this.renderer.consumeEvents(this.sim.state.events);
        if (this.sim.state.phase === 'gameOver') { this.gameOver(this.sim.state.events.some(e => e.t === 'gameOver' && e.victory)); break; }
      }
    }
    this.renderer.render(this.sim.state, this.paused ? 0 : dt, this.acc / TICK_DT);
    this.hud.update(this.sim.state, this.fps);
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
  };
}
