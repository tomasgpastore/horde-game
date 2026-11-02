import type { SimEvent } from '@shared/types';
import { audio, sfx, music, type SfxName } from './engine';
export { audio, sfx, music };
export type { SfxName };

const TICK = 1 / 60;

/** Maps weapon ids to fire sounds by keyword; falls back to fire_bolt. */
function fireSound(weapon: string): SfxName {
  const w = weapon.toLowerCase();
  if (/whip|slash|blade|sword|axe/.test(w)) return 'fire_whip';
  if (/orb|orbit|ring|guard/.test(w)) return 'fire_orb';
  if (/nova|blast|pulse|shock|aura|slam/.test(w)) return 'fire_nova';
  if (/arrow|bow|dagger|knife|shard/.test(w)) return 'fire_arrow';
  if (/light|chain|bolt|spark|zap/.test(w)) return 'fire_lightning';
  if (/fire|flame|ember|burn|torch/.test(w)) return 'fire_flame';
  return 'fire_bolt';
}

/**
 * Game-facing audio: consume(events) once per sim tick. Handles unlock, adaptive intensity
 * (smoothed kill rate + wave), boss theme, and UI helpers. Never touches sim state.
 */
export class Audio {
  private rate = 0;       // smoothed kills/sec
  private boss = false;
  private started = false;
  private lowHp = 0;
  constructor() { audio.unlockOnFirstInteraction(); }

  /** Start title theme (call on menu). */
  title() { music.play('title'); }
  /** Start run music (call on run start). */
  startRun() { this.boss = false; this.rate = 0; this.started = true; music.setIntensity(0.15); music.play('battle'); }
  stop() { music.play(null); this.started = false; }
  setBossFight(on: boolean) { this.boss = on; music.play(on ? 'boss' : 'battle'); }
  ui(kind: 'click' | 'hover' | 'card' | 'back') { sfx.play(('ui_' + kind) as SfxName); }

  consume(events: SimEvent[]) {
    if (!audio.ctx) return;
    if (!this.started) this.startRun();
    let kills = 0;
    for (const e of events) {
      switch (e.t) {
        case 'hit': sfx.play('hit', { pitch: e.crit ? 1.4 : 1, volume: e.crit ? 1.2 : 1 }); break;
        case 'kill': kills++; sfx.play('kill', { pitch: 0.85 + (e.enemyKind % 4) * 0.1 }); break;
        case 'shoot': if (e.owner >= 0) sfx.play(fireSound(e.weapon), { volume: 0.7 }); break;
        case 'playerHurt': sfx.play('hurt'); break;
        case 'pickup': sfx.play('gem'); break;
        case 'levelUp': sfx.play('levelup'); break;
        case 'dash': sfx.play('dash'); break;
        case 'waveStart': sfx.play('boss_roar', { volume: 0.25, pitch: 1.5 }); break;
        case 'bossSpawn': sfx.play('boss_telegraph'); sfx.play('boss_roar'); this.setBossFight(true); break;
        case 'bossDeath': this.setBossFight(false); break;
        case 'gameOver': sfx.play('death'); this.setBossFight(false); music.setIntensity(0.05); break;
      }
    }
    // intensity: exponential smoothing of kill rate, target ~ 12 kills/s => 1
    this.rate += (kills / TICK - this.rate) * 0.01;
    const i = Math.min(1, 0.1 + this.rate / 14);
    music.setIntensity(this.boss ? Math.max(0.5, i) : i);
  }
}
