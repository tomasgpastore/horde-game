import type { SimEvent, SimState } from '@shared/types';
import { audio, sfx, music, type SfxName } from './engine';
export { audio, sfx, music };
export { SFX_TRIM, MUSIC_TRIM } from './engine';
export type { SfxName };

const TICK = 1 / 60;

/** Exact weapon id -> fire sound (ids per Tech Lead). fire_whip intentionally unused. */
const FIRE_SOUND: Record<string, SfxName> = {
  ember_bolt: 'fire_bolt', orbit_blades: 'fire_orb', frost_nova: 'fire_nova',
  chain_lightning: 'fire_lightning', lava_trail: 'fire_flame', seeker_spears: 'fire_arrow',
};
export function fireSound(weapon: string): SfxName { return FIRE_SOUND[weapon] ?? 'fire_bolt'; }

/**
 * Game-facing audio. Call `consume(events, state)` once per sim tick.
 * Handles unlock, adaptive intensity (smoothed kill rate), boss theme + telegraph ducking,
 * level-up card-screen filtering, low-HP heartbeat, and kill/hit batching (never silently dropped).
 * Extra event types Gameplay may emit (optional): {t:'freeze'|'slow'}, {t:'evolve'}.
 */
export class Audio {
  private rate = 0;       // smoothed kills/sec
  private boss = false;
  private started = false;
  private killAcc = 0; private hitAcc = 0; private critAcc = 0; private lastFlush = 0;
  private cards = false;
  constructor() { audio.unlockOnFirstInteraction(); }

  title() { music.play('title'); }
  startRun() { this.boss = false; this.rate = 0; this.started = true; music.setIntensity(0.15); music.play('battle'); }
  stop() { music.play(null); this.started = false; }
  setBossFight(on: boolean) { this.boss = on; music.play(on ? 'boss' : 'battle'); }
  /** Card screen open/closed (also auto-detected from state.phase). */
  setCards(open: boolean) { if (open === this.cards) return; this.cards = open; music.setPaused(open); }
  ui(kind: 'click' | 'hover' | 'card' | 'back') { sfx.play(('ui_' + kind) as SfxName); }
  evolve() { sfx.play('evolve'); music.duck(-8, 1.2); }

  consume(events: SimEvent[], state?: SimState) {
    if (!audio.ctx) return;
    if (!this.started) this.startRun();
    let kills = 0;
    for (const e of events) {
      switch (e.t) {
        case 'hit': this.hitAcc++; if (e.crit) this.critAcc++; break;
        case 'kill': kills++; break;
        case 'shoot': if (e.owner >= 0) sfx.play(fireSound(e.weapon), { volume: 0.7 }); break;
        case 'playerHurt': sfx.play('hurt'); break;
        case 'pickup': sfx.play('gem'); break;
        case 'levelUp': sfx.play('levelup'); if (!state) this.setCards(true); break;
        case 'dash': sfx.play('dash'); break;
        case 'waveStart': sfx.play('boss_roar', { volume: 0.25, pitch: 1.5 }); break;
        case 'bossSpawn': sfx.play('boss_telegraph'); music.duck(-6, 0.6); sfx.play('boss_roar'); this.setBossFight(true); break;
        case 'bossDeath': this.setBossFight(false); sfx.play('levelup', { volume: 0.9, pitch: 0.9 }); sfx.play('boss_slam', { volume: 0.6, pitch: 0.7 }); break;
        case 'gameOver': sfx.play('death'); this.setBossFight(false); music.setIntensity(0.05); break;
        default: {
          const t = (e as { t: string }).t;
          if (t === 'freeze' || t === 'slow') sfx.play('freeze');
          else if (t === 'evolve') this.evolve();
        }
      }
    }
    this.killAcc += kills;
    // Batch hits/kills: flush at most every ~45ms with volume/pitch scaled by count, so a 300 kills/s horde
    // is heard as a thick crunch rather than being dropped.
    const now = audio.ctx.currentTime;
    if (now - this.lastFlush >= 0.045) {
      const k = this.killAcc, h = this.hitAcc;
      if (k > 0) {
        if (k >= 3) sfx.play('crunch', { count: k, volume: 0.8 + Math.min(0.5, Math.log2(k) * 0.12) });
        else sfx.play('kill', { pitch: 0.9 + Math.random() * 0.2 });
      }
      if (h > 0 && k < 3) sfx.play('hit', { pitch: this.critAcc ? 1.4 : 1, volume: Math.min(1.4, 0.9 + Math.log2(1 + h) * 0.15) });
      this.killAcc = 0; this.hitAcc = 0; this.critAcc = 0; this.lastFlush = now;
    }
    this.rate += (kills / TICK - this.rate) * 0.01;
    const i = Math.min(1, 0.1 + this.rate / 14);
    music.setIntensity(this.boss ? Math.max(0.5, i) : i);
    if (state) {
      this.setCards(state.phase === 'levelUp');
      const p = state.players[0];
      music.setHeartbeat(p && !p.dead && state.phase === 'running' ? Math.max(0, Math.min(1, (0.35 - p.hp / p.maxHp) / 0.25)) : 0);
    }
  }
}
