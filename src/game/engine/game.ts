import { TICK_DT, PlayerInput } from '@shared/types';
import { Sim, createState } from '@sim/index';
import { Renderer } from '@render/renderer';
import { KeyboardMouse, Gamepad } from './input';
import { getArena } from '@world/index';
import { ARENA_BOSS } from '@world/waves';
import { limits, MAX_ALIVE } from '@world/waves';
import { mountHud } from '@ui/hud';
import { Audio, audio } from '@audio/index';
import type { Settings, ShellInput } from './createGame';

/** Fixed-timestep loop (60Hz sim). Owns canvas + HUD overlay inside canvasParent. Never touches #shell. */
export class Game {
  sim!: Sim; renderer: Renderer; input: KeyboardMouse; pad = new Gamepad(); acc = 0; last = performance.now(); hud; audio = new Audio();
  fps = 0; private frames = 0; private fpsT = 0; running = false; paused = false; raf = 0;
  canvas = document.createElement('canvas'); ui = document.createElement('div'); mode: 'solo' | 'coop' = 'solo';
  constructor(parent: HTMLElement, private shellInput: ShellInput, public settings: Settings) {
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; this.ui.style.cssText = 'position:absolute;inset:0;pointer-events:none;color:#fff';
    parent.append(this.canvas, this.ui);
    if (new URLSearchParams(location.search).get('debug') === '1') { this.dbg = document.createElement('pre'); this.dbg.style.cssText = 'position:absolute;left:8px;bottom:8px;margin:0;font:11px monospace;white-space:pre;color:#9fe;background:#0008;padding:4px 6px;pointer-events:none'; this.ui.append(this.dbg); }
    this.input = new KeyboardMouse(this.canvas);
    this.reset(); this.renderer = new Renderer(this.canvas, getArena(new URLSearchParams(location.search).get('arena') || 'ashen_woods')); this.hud = mountHud(this.ui, i => this.choose(i));
    (window as any).__game = this; // QA hook
    this.applySettings(settings);
    this.raf = requestAnimationFrame(this.frame); // renders idle scene behind menu
  }
  reset(seedOverride?: number) {
    const arena = getArena(new URLSearchParams(location.search).get('arena') || 'ashen_woods'); const seed = seedOverride ?? (Number(new URLSearchParams(location.search).get('seed')) || (Date.now() & 0xffffff));
    this.sim = new Sim(createState(seed, arena, 1), arena); this.acc = 0; this.pendingBiome = null;
    if (this.renderer && this.renderer.arenaId !== arena.id) this.renderer.setArena(arena); // Quit/restart after a biome chain: back to the first biome
  }
  pendingBiome: string | null = null;
  /** Sim events that drive client-side flow (hit-stop, slow-mo, biome chain). Called after every sim step (also from tests). */
  onSimEvents(events: import('@shared/types').SimEvent[]) { for (const ev of events) if (ev.t === 'biome') this.pendingBiome = ev.next; else if (ev.t === 'freeze') this.hitstop = Math.max(this.hitstop, ev.ms / 1000); else if (ev.t === 'slow') this.renderer.slowmo = Math.max(this.renderer.slowmo, ev.secs); }
  choose(i: number) { if (this.sim.state.phase === 'levelUp') { this.sim.choose(i); this.audio.ui('card'); if (this.pendingBiome && this.sim.state.phase !== 'levelUp') this.enterBiome(); } }
  /** Boss killed + reward card picked: swap to the next biome, keep the run going (kill The Unlit to win). */
  enterBiome() {
    const next = this.pendingBiome; this.pendingBiome = null; if (!next) return;
    const s = this.sim.state, p = s.players[0], arena = getArena(next); this.sim.arena = arena; this.renderer.setArena(arena);
    const e = s.enemies, pr = s.projectiles, pk = s.pickups; e.alive.fill(0); pr.alive.fill(0); pk.alive.fill(0);
    p.x = 0; p.z = 0; p.vx = p.vz = 0; p.iframes = 2; s.spawner.boss = false; s.spawner.budget = 0; s.biomeT0 = s.time; s.biome++;
    this.titleCard(arena.name, `Biome ${s.biome + 1} of 3`);
  }
  titleCard(name: string, sub: string) {
    const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:0;right:0;top:30%;text-align:center;pointer-events:none;font:700 54px Rajdhani,system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#fff;text-shadow:0 0 24px #4de8ff,0 3px 6px #000;opacity:0;transition:opacity .6s';
    d.innerHTML = `<div style="font-size:20px;letter-spacing:.5em;color:#9fe8ff">Entering</div>${name}<div style="font-size:18px;letter-spacing:.4em;color:#ffc857;margin-top:6px">${sub}</div>`;
    this.ui.appendChild(d); requestAnimationFrame(() => { d.style.opacity = '1'; }); setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, 2800);
  }
  start(mode: 'solo' | 'coop') { this.mode = mode; this.reset(); this.running = true; this.paused = false; this.fastForward(Number(new URLSearchParams(location.search).get('t')) || 0); this.last = performance.now(); audio.resume(); this.audio.startRun(); }
  /** Debug hook ?t=N: simulate N seconds instantly with the bot (invulnerable, auto-picks cards) so trailer/OG shots can show mid/late-game density (?t=300 = boss). */
  fastForward(seconds: number) {
    if (seconds <= 0) return; const s = this.sim.state, p = s.players[0]; let guard = 0;
    s.biomeT0 = Math.max(0, seconds - (ARENA_BOSS[this.sim.arena.id]?.time ?? 300)); // ?arena=X&t=N → that biome's boss arrives right at t=N
    while (s.time < seconds + 0.05 && s.phase !== 'gameOver' && guard++ < 60 * 60 * 20) { p.iframes = 1e9; if (s.phase === 'levelUp') { this.sim.choose(s.tick % 3); continue; } this.sim.step([this.bot(p)]); }
    p.iframes = 1; p.hp = p.maxHp; this.renderer.rig.snap();
  }
  pause() { this.paused = true; audio.suspend(); } resume() { this.paused = false; this.last = performance.now(); audio.resume(); }
  quit() { this.running = false; this.paused = false; this.reset(); audio.resume(); this.audio.stop(); } // un-suspend (Quit while paused) and clear run music; shell then plays the title theme
  applySettings(s: Settings) {
    this.settings = s;
    audio.setVolume('master', s.volume); audio.setVolume('music', s.music); audio.setVolume('sfx', s.sfx);
    const r = (this.renderer as any)?.three; if (r) (this.renderer as any).setQuality(s.quality);
    limits.maxAlive = s.quality === 'low' ? 200 : MAX_ALIVE; // Low: fewer enemies alive
    dispatchEvent(new Event('resize')); // re-apply size with new pixel ratio
    (this.renderer as any)?.setShake?.(s.shake);
  }
  /** Aim at the nearest live enemy (touch/gamepad); fall back to move direction, then keep previous aim. */
  autoAim(me: { x: number; z: number }, inp: PlayerInput) {
    const e = this.sim.state.enemies; let best = -1, bd = Infinity;
    for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - me.x, dz = e.z[i] - me.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    if (best >= 0) { const l = Math.sqrt(bd) || 1; inp.aimX = (e.x[best] - me.x) / l; inp.aimZ = (e.z[best] - me.z) / l; }
    else if (inp.moveX || inp.moveZ) { const l = Math.hypot(inp.moveX, inp.moveZ); inp.aimX = inp.moveX / l; inp.aimZ = inp.moveZ / l; }
  }
  gameOver(victory: boolean) { this.running = false; const s = this.sim.state; dispatchEvent(new CustomEvent('game:over', { detail: { score: s.kills, kills: s.kills, time: s.time, victory, level: s.players[0].level, weapons: s.players[0].weapons.map(w => ({ id: w.id, level: w.level })) } })); }
  /** ?autoplay=1 debug bot (trailer capture): kites away from the horde's centre of mass; invulnerable; auto-picks cards. */
  autoplay = new URLSearchParams(location.search).get('autoplay') === '1'; private botT = 0;
  bot(me: { x: number; z: number }): PlayerInput {
    const e = this.sim.state.enemies; let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < e.count; i++) if (e.alive[i]) { const dx = me.x - e.x[i], dz = me.z - e.z[i], d2 = dx * dx + dz * dz + 1; if (d2 < 150) { sx += dx / d2; sz += dz / d2; n++; } }
    const pk = this.sim.state.pickups; let bd = 144, gx = 0, gz = 0;
    for (let i = 0; i < pk.count; i++) if (pk.alive[i]) { const dx = pk.x[i] - me.x, dz = pk.z[i] - me.z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; gx = dx; gz = dz; } }
    if (bd < 144) { const l = Math.sqrt(bd) || 1; sx += gx / l * 0.12; sz += gz / l * 0.12; }
    this.botT += 1 / 60; const a = this.botT * 0.5;
    // stay in the middle (good trailer framing): pull toward arena centre, ramping hard beyond ~9u so the bot never reaches the edge
    const r = Math.hypot(me.x, me.z) || 1, pull = Math.max(0, (r - 6) / 10); const w = 0.02 + 4 * pull * pull + (r > 22 ? 50 : 0); // hard inward override beyond 22u (camera clamp is at R-9)
    let mx = sx + Math.cos(a) * 0.02 - me.x / r * w, mz = sz + Math.sin(a) * 0.02 - me.z / r * w; const l = Math.hypot(mx, mz) || 1;
    return { moveX: mx / l, moveZ: mz / l, aimX: 0, aimZ: 1, dash: false, ability: false };
  }
  hitstop = 0;
  /** QA/perf hook: window.__game.perf = per-stage CPU ms, draw calls, tris. ?debug=1 shows an overlay. */
  get perf() { return { fps: this.fps, ...this.renderer.perf }; }
  dbg: HTMLElement | null = null;
  frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const me = this.sim.state.players[0];
    if (this.autoplay) { me.iframes = 9999; if (this.sim.state.phase === 'levelUp') this.choose(this.sim.state.tick % 3); }
    if (this.running && !this.paused) {
      const r = this.renderer; this.acc += dt * (r.slowmo > 0 ? 0.3 : 1); if (r.slowmo > 0) r.slowmo -= dt; // level-up slow-mo (sim stays fixed-step)
      const inp: PlayerInput = this.autoplay ? this.bot(me) : this.input.poll(me, this.renderer.camera);
      const si = this.shellInput, m = si.move; if (!this.autoplay && (m.x || m.y)) { inp.moveX = m.x; inp.moveZ = m.y; } // touch stick or gamepad (shell)
      if (si.dash) { inp.dash = true; si.dash = false; }
      if (si.touch || m.x || m.y) this.autoAim(me, inp); // no mouse on touch/gamepad: aim at nearest enemy
      if (!this.autoplay) Object.assign(inp, this.pad.poll(inp)); // physical gamepad: right-stick aim, A/RB dash, X/LB ability
      if (this.hitstop > 0) { this.hitstop -= dt; this.acc = 0; }
      while (this.acc >= TICK_DT) {
        this.sim.step([inp]); inp.dash = inp.ability = false; this.acc -= TICK_DT;
        this.audio.consume(this.sim.state.events, this.sim.state); this.renderer.consumeEvents(this.sim.state.events); this.onSimEvents(this.sim.state.events);
        if (this.sim.state.phase === 'gameOver') { this.gameOver(this.sim.state.events.some(e => e.t === 'gameOver' && e.victory)); break; }
      }
    }
    this.renderer.render(this.sim.state, this.paused ? 0 : dt, this.acc / TICK_DT);
    this.hud.update(this.sim.state, this.fps);
    if (this.dbg) { const q = this.renderer.perf; this.dbg.textContent = `${this.fps.toFixed(0)}fps  calls ${q.calls}  tris ${(q.tris / 1000).toFixed(0)}k  enemies ${q.enemyCount}\ncpu ms: total ${q.total.toFixed(2)} | camera ${q.camera.toFixed(2)} | enemies ${q.enemies.toFixed(2)} | particles ${q.particles.toFixed(2)} | pools ${q.pools.toFixed(2)} | arena ${q.arena.toFixed(2)} | submit ${q.submit.toFixed(2)}`; }
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
  };
}
