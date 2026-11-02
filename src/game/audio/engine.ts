/**
 * EMBERHORDE procedural audio. No assets; everything is synthesized with WebAudio.
 *
 *   import { audio, sfx, music } from './audio';
 *   audio.unlockOnFirstInteraction();            // call once at boot
 *   music.play('title');                         // 'title' | 'battle' | 'boss' | null
 *   music.setIntensity(0..1);                    // each frame / when threat changes
 *   sfx.play('hit', { pitch: 1, volume: 1, pan: 0 });
 *   audio.setVolume('master'|'music'|'sfx', 0..1);
 */

export type SfxName =
  | 'hit' | 'kill' | 'gem' | 'levelup' | 'hurt' | 'death'
  | 'fire_bolt' | 'fire_whip' | 'fire_orb' | 'fire_nova' | 'fire_arrow' | 'fire_lightning' | 'fire_flame'
  | 'boss_telegraph' | 'boss_slam' | 'boss_roar'
  | 'ui_click' | 'ui_hover' | 'ui_card' | 'ui_back' | 'chest' | 'dash'
  | 'crunch' | 'freeze' | 'evolve' | 'heartbeat';

export interface PlayOpts { pitch?: number; volume?: number; pan?: number; /** batch size for crunch */ count?: number; }
export type MusicName = 'title' | 'battle' | 'boss';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PAUSE_GAIN = 0.7; // ~ -3dB while card screen is open
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// name -> [max concurrent voices, min ms between plays, priority (higher survives global cap)]
const LIMITS: Record<SfxName, [number, number, number]> = {
  hit: [6, 20, 1], kill: [5, 20, 1], gem: [4, 40, 1], levelup: [1, 300, 5], hurt: [2, 120, 4], death: [1, 500, 6],
  fire_bolt: [4, 45, 1], fire_whip: [2, 100, 1], fire_orb: [2, 120, 1], fire_nova: [2, 120, 2], fire_arrow: [4, 45, 1],
  fire_lightning: [3, 80, 2], fire_flame: [2, 90, 1],
  boss_telegraph: [1, 400, 5], boss_slam: [2, 200, 6], boss_roar: [1, 500, 5],
  ui_click: [3, 30, 3], ui_hover: [2, 40, 2], ui_card: [2, 100, 3], ui_back: [2, 60, 3], chest: [1, 300, 4], dash: [2, 120, 2],
  crunch: [3, 25, 2], freeze: [2, 70, 2], evolve: [1, 800, 7], heartbeat: [2, 200, 4],
};
/** Per-sound output trim (linear), calibrated by tools/audio-demo/verify.mjs so peaks land at the target level. */
export const SFX_TRIM: Partial<Record<SfxName, number>> = {"hit":6.837,"kill":2.801,"gem":3.993,"levelup":1.008,"hurt":3.681,"death":0.638,"fire_bolt":7.635,"fire_whip":0.465,"fire_orb":2.219,"fire_nova":1.7,"fire_arrow":7.494,"fire_lightning":0.597,"fire_flame":2.969,"boss_telegraph":1.975,"boss_slam":1.058,"boss_roar":2.407,"ui_click":6.97,"ui_hover":11.23,"ui_card":1.323,"ui_back":11.055,"chest":1.481,"dash":4.195,"crunch":2.943,"freeze":5.213,"evolve":1.015,"heartbeat":2.722};
/** Per-theme music trim, calibrated so loop RMS ~ -20 dBFS at default sliders. */
export const MUSIC_TRIM: Record<string, number> = { title: 1.527, battle: 0.838, boss: 0.646 };
const MAX_VOICES = 36;

class AudioEngine {
  ctx: AudioContext | null = null;
  offline = false;
  musicDuck!: GainNode; musicLpf!: BiquadFilterNode;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; comp!: DynamicsCompressorNode;
  noiseBuf!: AudioBuffer;
  vol = { master: 0.8, music: 0.6, sfx: 0.9 };
  muted = false;
  private pendingMusic: { name: MusicName | null } | null = null;
  private unlockHooked = false;

  get ready() { return !!this.ctx && (this.offline || this.ctx.state === 'running'); }
  /** Test hook: drop the current context so init(ext) can bind a fresh (Offline)AudioContext. */
  reset() { music.dispose(); sfx.reset(); this.ctx = null; this.offline = false; }

  /** Create context (must run in a user gesture to be audible). Safe to call repeatedly. */
  init(ext?: BaseAudioContext) {
    if (this.ctx && !ext) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = (this.ctx = (ext ?? new AC({ latencyHint: 'interactive' })) as AudioContext);
    this.offline = !!ext;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.knee.value = 14; this.comp.ratio.value = 6;
    this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    const limiter = ctx.createDynamicsCompressor(); // brickwall-ish safety
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.05;
    this.master = ctx.createGain(); this.musicBus = ctx.createGain(); this.sfxBus = ctx.createGain();
    this.musicDuck = ctx.createGain(); this.musicLpf = ctx.createBiquadFilter(); this.musicLpf.type = 'lowpass'; this.musicLpf.frequency.value = 20000; this.musicLpf.Q.value = 0.5;
    this.musicBus.connect(this.musicDuck); this.musicDuck.connect(this.musicLpf); this.musicLpf.connect(this.comp); this.sfxBus.connect(this.comp);
    this.comp.connect(this.master); this.master.connect(limiter); limiter.connect(ctx.destination);
    this.applyVolumes();
    const len = ctx.sampleRate * 2; this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    music.attach(this);
    if (!ext) void ctx.resume();
    if (this.pendingMusic) { music.play(this.pendingMusic.name); this.pendingMusic = null; }
  }

  /** Hook first click/key/touch to unlock audio. */
  unlockOnFirstInteraction(target: EventTarget = window) {
    if (this.unlockHooked) return; this.unlockHooked = true;
    const go = () => { this.init(); if (this.ctx?.state === 'running') ['pointerdown', 'keydown', 'touchend', 'click'].forEach(e => target.removeEventListener(e, go)); };
    ['pointerdown', 'keydown', 'touchend', 'click'].forEach(e => target.addEventListener(e, go));
  }

  setVolume(ch: 'master' | 'music' | 'sfx', v: number) { this.vol[ch] = clamp(v); this.applyVolumes(); }
  setMuted(m: boolean) { this.muted = m; this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
  }
  queueMusic(name: MusicName | null) { this.pendingMusic = { name }; }
  /** Pause when tab hidden, e.g. wired to visibilitychange. */
  suspend() { void this.ctx?.suspend(); }
  resume() { void this.ctx?.resume(); }
}
export const audio = new AudioEngine();

/* ------------------------------------------------------------------ SFX */
interface Voice { name: SfxName; prio: number; end: number; kill: () => void; }

class Sfx {
  private voices: Voice[] = [];
  private last: Partial<Record<SfxName, number>> = {};
  private gemStreak = 0; private gemT = 0;
  /** Count of plays dropped by limiter (debug). */
  dropped = 0;

  play(name: SfxName, o: PlayOpts = {}) {
    const ctx = audio.ctx; if (!ctx || !audio.ready) return;
    const [cap, gap, prio] = LIMITS[name];
    const now = ctx.currentTime;
    this.voices = this.voices.filter(v => v.end > now);
    if (now * 1000 - (this.last[name] ?? -1e9) < gap) { this.dropped++; return; }
    const same = this.voices.filter(v => v.name === name);
    if (same.length >= cap) { this.dropped++; return; }
    if (this.voices.length >= MAX_VOICES) {
      const weak = this.voices.filter(v => v.prio < prio).sort((a, b) => a.prio - b.prio || a.end - b.end)[0];
      if (!weak) { this.dropped++; return; }
      weak.kill(); this.voices.splice(this.voices.indexOf(weak), 1);
    }
    this.last[name] = now * 1000;
    // crowd attenuation: the busier the mix, the quieter the small sounds
    const crowd = prio <= 1 ? 1 / (1 + this.voices.length * 0.045) : 1;
    const out = ctx.createGain(); let node: AudioNode = out;
    if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); out.connect(p); node = p; }
    node.connect(audio.sfxBus);
    const nodes: AudioScheduledSourceNode[] = [];
    const rv = 0.94 + Math.random() * 0.12; // humanize
    let pitch = (o.pitch ?? 1) * rv;
    let vol = (o.volume ?? 1) * crowd;
    if (name === 'gem') {
      if (now - this.gemT > 0.9) this.gemStreak = 0;
      this.gemT = now; const PENT = [0, 2, 4, 7, 9];
      const s = this.gemStreak++; const semis = PENT[s % 5] + 12 * Math.min(2, Math.floor(s / 5));
      pitch = (o.pitch ?? 1) * Math.pow(2, semis / 12);
    }
    const ctxx = { ctx, out, nodes, t: now, pitch, vol, count: o.count ?? 1 };
    const dur = SYN[name](ctxx);
    out.gain.value = SFX_TRIM[name] ?? 1;
    const end = now + dur + 0.1;
    const kill = () => { try { out.gain.cancelScheduledValues(0); out.gain.setTargetAtTime(0, ctx.currentTime, 0.01); nodes.forEach(n => { try { n.stop(ctx.currentTime + 0.05); } catch { /* */ } }); } catch { /* */ } };
    this.voices.push({ name, prio, end, kill });
    const last = nodes[nodes.length - 1]; if (last) last.onended = () => { try { node.disconnect(); } catch { /* */ } };
  }
  reset() { this.voices = []; this.last = {}; this.gemStreak = 0; this.dropped = 0; }
  /** Reset gem streak (e.g. after a pause). */
  resetStreak() { this.gemStreak = 0; }
}
export const sfx = new Sfx();

interface SC { ctx: AudioContext; out: GainNode; nodes: AudioScheduledSourceNode[]; t: number; pitch: number; vol: number; count: number; }

function osc(c: SC, type: OscillatorType, f0: number, f1: number, dur: number, g: number, delay = 0, curve: 'exp' | 'lin' = 'exp', dest?: AudioNode) {
  const o = c.ctx.createOscillator(), a = c.ctx.createGain(); const t = c.t + delay;
  o.type = type; o.frequency.setValueAtTime(Math.max(20, f0 * c.pitch), t);
  if (f1 !== f0) o.frequency[curve === 'exp' ? 'exponentialRampToValueAtTime' : 'linearRampToValueAtTime'](Math.max(20, f1 * c.pitch), t + dur);
  const peak = g * c.vol;
  a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(peak, t + 0.004);
  a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(a); a.connect(dest ?? c.out); o.start(t); o.stop(t + dur + 0.02); c.nodes.push(o); return o;
}
function noise(c: SC, type: BiquadFilterType, f0: number, f1: number, dur: number, g: number, delay = 0, q = 1, attack = 0.003) {
  const s = c.ctx.createBufferSource(), f = c.ctx.createBiquadFilter(), a = c.ctx.createGain(); const t = c.t + delay;
  s.buffer = audio.noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g * c.vol, t + attack); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(a); a.connect(c.out); s.start(t, Math.random()); s.stop(t + dur + 0.02); c.nodes.push(s);
}

const SYN: Record<SfxName, (c: SC) => number> = {
  hit(c) { noise(c, 'bandpass', 2200, 900, 0.06, 0.35, 0, 1.2); osc(c, 'square', 220, 90, 0.07, 0.18); return 0.08; },
  kill(c) {
    osc(c, 'triangle', 520, 140, 0.12, 0.32); noise(c, 'highpass', 3000, 6000, 0.09, 0.25);
    osc(c, 'sine', 90, 45, 0.14, 0.3); return 0.15;
  },
  gem(c) { osc(c, 'sine', 880, 880, 0.16, 0.22); osc(c, 'triangle', 1760, 1760, 0.12, 0.1, 0.015); return 0.18; },
  levelup(c) {
    [0, 4, 7, 12, 16, 19].forEach((s, i) => { const f = mtof(69 + s); osc(c, 'triangle', f, f, 0.55, 0.2, i * 0.07); osc(c, 'sine', f * 2, f * 2, 0.4, 0.1, i * 0.07 + 0.01); });
    noise(c, 'highpass', 5000, 9000, 0.6, 0.08, 0.1, 1, 0.1); osc(c, 'sawtooth', 110, 110, 0.8, 0.12); return 1.1;
  },
  hurt(c) { osc(c, 'sawtooth', 300, 60, 0.28, 0.35); noise(c, 'lowpass', 1800, 200, 0.25, 0.4); osc(c, 'sine', 70, 40, 0.3, 0.4); return 0.32; },
  death(c) {
    osc(c, 'sawtooth', 440, 35, 1.4, 0.3, 0, 'exp'); osc(c, 'square', 330, 28, 1.6, 0.15, 0.1);
    noise(c, 'lowpass', 3000, 80, 1.5, 0.45, 0, 0.7); osc(c, 'sine', 80, 30, 1.2, 0.5, 0.05); return 1.7;
  },
  fire_bolt(c) { osc(c, 'sawtooth', 900, 260, 0.1, 0.16); noise(c, 'bandpass', 3500, 1500, 0.07, 0.12, 0, 2); return 0.12; },
  fire_whip(c) { noise(c, 'bandpass', 800, 5000, 0.12, 0.4, 0, 1.5, 0.02); noise(c, 'highpass', 6000, 8000, 0.04, 0.3, 0.1); return 0.16; },
  fire_orb(c) { osc(c, 'sine', 300, 600, 0.25, 0.22, 0, 'lin'); osc(c, 'triangle', 450, 900, 0.22, 0.1, 0.02, 'lin'); return 0.28; },
  fire_nova(c) { noise(c, 'lowpass', 400, 4000, 0.35, 0.4, 0, 0.8, 0.05); osc(c, 'sine', 160, 50, 0.4, 0.4); osc(c, 'sawtooth', 200, 800, 0.25, 0.1, 0, 'lin'); return 0.45; },
  fire_arrow(c) { noise(c, 'bandpass', 2000, 6000, 0.09, 0.2, 0, 3); osc(c, 'triangle', 700, 250, 0.08, 0.14); return 0.11; },
  fire_lightning(c) {
    for (let i = 0; i < 4; i++) noise(c, 'highpass', 2500 + i * 700, 7000, 0.05, 0.25, i * 0.035);
    osc(c, 'square', 1500, 100, 0.2, 0.12); osc(c, 'sine', 120, 50, 0.25, 0.25, 0.05); return 0.3;
  },
  fire_flame(c) { noise(c, 'bandpass', 600, 1800, 0.22, 0.28, 0, 0.8, 0.04); osc(c, 'sawtooth', 120, 90, 0.2, 0.08); return 0.25; },
  boss_telegraph(c) {
    osc(c, 'sawtooth', 70, 300, 0.9, 0.3, 0, 'lin'); osc(c, 'square', 140, 600, 0.9, 0.1, 0, 'lin');
    noise(c, 'bandpass', 300, 3000, 0.9, 0.25, 0, 3, 0.8); osc(c, 'sine', 55, 55, 0.9, 0.4); return 1.0;
  },
  boss_slam(c) {
    osc(c, 'sine', 120, 28, 0.9, 0.9); osc(c, 'sawtooth', 200, 40, 0.5, 0.3);
    noise(c, 'lowpass', 2500, 100, 0.8, 0.7, 0, 0.7); noise(c, 'highpass', 1500, 4000, 0.25, 0.3); return 1.0;
  },
  boss_roar(c) {
    osc(c, 'sawtooth', 90, 60, 1.2, 0.3, 0, 'lin'); osc(c, 'sawtooth', 93, 62, 1.2, 0.3, 0, 'lin');
    noise(c, 'bandpass', 500, 900, 1.2, 0.35, 0, 2, 0.15); return 1.3;
  },
  ui_click(c) { osc(c, 'square', 700, 500, 0.05, 0.14); osc(c, 'sine', 1200, 1200, 0.07, 0.1); return 0.08; },
  ui_hover(c) { osc(c, 'sine', 1400, 1500, 0.04, 0.07); return 0.05; },
  ui_back(c) { osc(c, 'square', 500, 300, 0.07, 0.13); return 0.09; },
  ui_card(c) {
    [0, 7, 12].forEach((s, i) => osc(c, 'triangle', mtof(64 + s), mtof(64 + s), 0.35, 0.2, i * 0.05));
    noise(c, 'highpass', 4000, 8000, 0.2, 0.15); osc(c, 'sine', 100, 60, 0.2, 0.3); return 0.5;
  },
  chest(c) {
    osc(c, 'sine', 100, 50, 0.2, 0.35); [0, 4, 7, 11, 12].forEach((s, i) => osc(c, 'triangle', mtof(72 + s), mtof(72 + s), 0.4, 0.14, 0.1 + i * 0.06));
    noise(c, 'highpass', 6000, 9000, 0.3, 0.1, 0.1); return 0.8;
  },
  crunch(c) {
    // batched kills: heavier with count (1..~30)
    const n = Math.min(30, c.count), k = Math.log2(1 + n) / Math.log2(31);
    noise(c, 'lowpass', 2500 + k * 2000, 300, 0.1 + k * 0.14, 0.3 + k * 0.4, 0, 0.8, 0.004);
    osc(c, 'sine', 140 - k * 40, 40, 0.14 + k * 0.16, 0.25 + k * 0.45); osc(c, 'triangle', 480 * (1 - k * 0.3), 120, 0.1, 0.18);
    noise(c, 'highpass', 4000, 7000, 0.07, 0.15 * (1 - k * 0.4)); return 0.3;
  },
  freeze(c) { osc(c, 'sine', 2400, 3400, 0.08, 0.1, 0, 'lin'); osc(c, 'triangle', 3200, 2000, 0.1, 0.07, 0.02); noise(c, 'highpass', 8000, 9000, 0.05, 0.08); return 0.14; },
  evolve(c) {
    [0, 7, 12, 16, 19, 24].forEach((s, i) => { const f = mtof(57 + s); osc(c, 'sawtooth', f, f, 1.4, 0.1, i * 0.09); osc(c, 'triangle', f * 2, f * 2, 1.2, 0.09, i * 0.09); });
    osc(c, 'sine', 90, 35, 1.2, 0.6); noise(c, 'bandpass', 200, 6000, 1.1, 0.35, 0, 1.2, 0.5); noise(c, 'highpass', 6000, 9000, 1.2, 0.12, 0.5, 1, 0.1);
    osc(c, 'square', mtof(81), mtof(81), 1.6, 0.06, 0.55); return 2.1;
  },
  heartbeat(c) { osc(c, 'sine', 70, 38, 0.16, 0.9); osc(c, 'sine', 62, 36, 0.2, 0.7, 0.2); noise(c, 'lowpass', 220, 80, 0.12, 0.2); return 0.45; },
  dash(c) { noise(c, 'bandpass', 600, 3000, 0.15, 0.3, 0, 1.2, 0.03); return 0.18; },
};

/* ---------------------------------------------------------------- MUSIC */
// Layers: pad -> pulse -> drums -> bass -> lead. Layer level = smoothstep over intensity window.
type Layer = 'pad' | 'pulse' | 'drums' | 'bass' | 'lead';
const LAYERS: Layer[] = ['pad', 'pulse', 'drums', 'bass', 'lead'];
const WINDOW: Record<MusicName, Record<Layer, [number, number]>> = {
  battle: { pad: [-1, 0], pulse: [0.1, 0.25], drums: [0.3, 0.45], bass: [0.5, 0.62], lead: [0.72, 0.85] },
  boss:   { pad: [-1, 0], pulse: [-1, 0], drums: [-1, 0], bass: [-1, 0], lead: [0.3, 0.6] },
  title:  { pad: [-1, 0], pulse: [-1, 0], drums: [2, 3], bass: [2, 3], lead: [-1, 0] },
};
interface Theme { bpm: number; root: number; prog: number[][]; bassRoots: number[]; }
// Chords as semitone offsets from root (A minor: i VI III VII / boss D minor-ish with b2 flavour)
const THEMES: Record<MusicName, Theme> = {
  battle: { bpm: 138, root: 57, bassRoots: [0, -4, 3, -2], prog: [[0, 3, 7, 12], [-4, 0, 3, 8], [3, 7, 10, 15], [-2, 2, 5, 10]] },
  boss: { bpm: 152, root: 50, bassRoots: [0, 1, 0, -2], prog: [[0, 3, 7, 12], [1, 4, 8, 13], [0, 3, 6, 12], [-2, 2, 5, 10]] },
  title: { bpm: 68, root: 57, bassRoots: [0, -4, -7, -2], prog: [[0, 7, 10, 15], [-4, 3, 7, 12], [-7, 0, 3, 7], [-2, 5, 9, 14]] },
};

class Music {
  private e!: AudioEngine; private ctx!: AudioContext;
  current: MusicName | null = null;
  intensity = 0.3;
  paused = false;
  private bus: GainNode | null = null; private layerG: Record<Layer, GainNode> | null = null;
  private level: Record<Layer, number> = { pad: 0, pulse: 0, drums: 0, bass: 0, lead: 0 };
  private step = 0; private nextT = 0; private timer = 0;
  private pending: { name: MusicName | null } | null = null;
  private rev!: ConvolverNode;
  private heart = 0; private nextBeat = 0;

  attach(e: AudioEngine) {
    this.dispose();
    this.e = e; this.ctx = e.ctx!;
    const c = this.ctx;
    const len = c.sampleRate * 2.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = c.createConvolver(); this.rev.buffer = ir; const rg = c.createGain(); rg.gain.value = 0.35; this.rev.connect(rg); rg.connect(e.musicBus);
    this.current = null; this.bus = null; this.layerG = null; this.pending = null; this.paused = false; this.heart = 0;
    if (!e.offline) this.timer = window.setInterval(() => this.tick(), 40);
  }
  dispose() { clearInterval(this.timer); this.timer = 0; }

  setIntensity(v: number) { this.intensity = clamp(v); }

  /** Duck the music by `db` (negative) for `secs`, e.g. boss telegraph. */
  duck(db = -6, secs = 0.6) {
    if (!this.e.ctx) return; const g = this.e.musicDuck.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setTargetAtTime(Math.pow(10, db / 20), t, 0.04); g.setTargetAtTime(this.paused ? PAUSE_GAIN : 1, t + secs, 0.2);
  }
  /** While true (card screen open): music is low-passed ~800Hz and slightly ducked. */
  setPaused(p: boolean) {
    this.paused = p; if (!this.e.ctx) return; const t = this.ctx.currentTime;
    this.e.musicLpf.frequency.setTargetAtTime(p ? 800 : 20000, t, p ? 0.08 : 0.25);
    this.e.musicDuck.gain.cancelScheduledValues(t); this.e.musicDuck.gain.setTargetAtTime(p ? PAUSE_GAIN : 1, t, 0.1);
  }
  /** 0..1 low-HP heartbeat layer (0 = off). */
  setHeartbeat(v: number) { this.heart = clamp(v); }

  /** Switch theme. Crossfades on the next bar boundary when something is already playing (sync=true). */
  play(name: MusicName | null, sync = true) {
    if (!this.e.ctx) { this.e.queueMusic(name); return; }
    if (name === this.current && !this.pending) return;
    if (name === this.current) { this.pending = null; return; }
    if (this.current && sync && name) { this.pending = { name }; return; }
    this.pending = null; this.swap(name, this.ctx.currentTime + 0.05, 0.25);
  }

  private swap(name: MusicName | null, t: number, fade: number) {
    const c = this.ctx;
    if (this.bus) { const old = this.bus; old.gain.setTargetAtTime(0, t, fade * 0.6); setTimeout(() => { try { old.disconnect(); } catch { /* */ } }, (t - c.currentTime + 3) * 1000); }
    this.current = name; this.layerG = null; this.bus = null;
    if (!name) return;
    this.bus = c.createGain(); this.bus.gain.setValueAtTime(0.0001, t); this.bus.gain.linearRampToValueAtTime(MUSIC_TRIM[name] ?? 1, t + 0.04);
    this.bus.connect(this.e.musicBus); this.bus.connect(this.rev);
    this.layerG = {} as Record<Layer, GainNode>;
    for (const l of LAYERS) { const g = c.createGain(); g.gain.value = 0; g.connect(this.bus); this.layerG[l] = g; this.level[l] = 0; }
    this.step = 0; this.nextT = t;
    this.updateLevels(true);
  }

  private updateLevels(snap = false) {
    if (!this.current || !this.layerG) return; const w = WINDOW[this.current], c = this.ctx;
    for (const l of LAYERS) {
      const lv = smooth(w[l][0], w[l][1], this.intensity);
      if (Math.abs(lv - this.level[l]) > 0.005 || snap) {
        this.level[l] = lv;
        if (snap) this.layerG[l].gain.setValueAtTime(lv, c.currentTime); else this.layerG[l].gain.setTargetAtTime(lv, c.currentTime, 0.6);
      }
    }
  }

  /** Public so offline renders can pre-schedule: schedules all steps whose time is < until. */
  scheduleUntil(until: number) {
    if (!this.current || !this.layerG) return;
    for (;;) {
      if (this.pending && this.step % 16 === 0 && this.nextT < until) {
        const p = this.pending.name; this.pending = null; this.swap(p, this.nextT, 0.4);
        if (!this.current || !this.layerG) return;
      }
      if (this.nextT >= until) break;
      const th = THEMES[this.current], sd = 60 / th.bpm / 4;
      this.sched(this.step, this.nextT, th, sd); this.step++; this.nextT += sd;
    }
  }

  tick() {
    const c = this.ctx; if (!c) return;
    this.updateLevels();
    this.scheduleUntil(c.currentTime + 0.2);
    if (this.heart > 0.01 && c.currentTime >= this.nextBeat) {
      sfx.play('heartbeat', { volume: 0.6 + this.heart * 0.5 });
      this.nextBeat = c.currentTime + 1.05 - this.heart * 0.45; // 57..100 bpm
    }
  }

  // --- schedulers ---
  private sched(step: number, t: number, th: Theme, sd: number) {
    const bar = Math.floor(step / 16) % 4, s = step % 16, ch = th.prog[bar], g = this.layerG!;
    const on = (l: Layer) => this.level[l] > 0.01 || (this.current === 'title' && (l === 'pad' || l === 'pulse'));
    const name = this.current!;
    const root = th.root;
    // PAD: sustained detuned saws through lowpass, new chord each bar
    if (s === 0 && on('pad')) {
      const barDur = sd * 16;
      ch.slice(0, name === 'title' ? 4 : 3).forEach((n, i) => {
        for (const det of [-7, 7]) {
          const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), a = this.ctx.createGain();
          o.type = name === 'title' ? 'triangle' : 'sawtooth'; o.frequency.value = mtof(root + 12 + n); o.detune.value = det;
          f.type = 'lowpass'; f.frequency.setValueAtTime(name === 'boss' ? 500 : 800, t);
          f.frequency.linearRampToValueAtTime(name === 'boss' ? 1400 : 1800, t + barDur * 0.5); f.frequency.linearRampToValueAtTime(600, t + barDur);
          a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(0.045 - i * 0.004, t + barDur * 0.3); a.gain.linearRampToValueAtTime(0.0001, t + barDur + 0.05);
          o.connect(f); f.connect(a); a.connect(g.pad); o.start(t); o.stop(t + barDur + 0.1);
        }
      });
      if (name === 'boss') this.tone(g.pad, 'sawtooth', mtof(root - 24 + th.bassRoots[bar]), t, barDur, 0.12, 200);
    }
    // PULSE: 8th/16th arpeggio plucks (title: slow bell arpeggio)
    if (on('pulse')) {
      if (name === 'title') {
        if (s % 4 === 0) { const n = ch[(s / 4 + bar) % 4]; this.pluck(g.pulse, 'sine', mtof(root + 24 + n), t, 1.6, 0.07, 3000); this.pluck(g.pulse, 'triangle', mtof(root + 36 + n), t, 0.8, 0.025, 4000); }
      } else if (s % 2 === 0) {
        const pat = [0, 1, 2, 3, 2, 1, 2, 3]; const n = ch[pat[(s / 2) % 8]];
        this.pluck(g.pulse, 'square', mtof(root + 12 + n), t, sd * 1.8, 0.05, 1200 + this.intensity * 2500);
      }
    }
    // DRUMS
    if (on('drums') && name !== 'title') {
      const boss = name === 'boss';
      if (s % 4 === 0 || (boss && s % 16 === 10)) this.kick(g.drums, t, boss ? 0.9 : 0.75);
      if (s === 4 || s === 12) this.snare(g.drums, t, boss ? 0.5 : 0.4);
      if (s % 2 === 0 || boss) this.hat(g.drums, t, s % 4 === 2 ? 0.12 : 0.06, s % 4 === 2 ? 0.1 : 0.04);
      if (boss && bar === 3 && s >= 12) this.snare(g.drums, t, 0.25);
    }
    // BASS: driving 8ths on chord root (boss: 16ths)
    if (on('bass') && name !== 'title') {
      const boss = name === 'boss'; const n = root - 24 + th.bassRoots[bar];
      if (boss ? true : s % 2 === 0) { const accent = s % 4 === 0; this.tone(g.bass, 'sawtooth', mtof(n + (s % 8 === 6 ? 12 : 0)), t, sd * (boss ? 0.9 : 1.7), accent ? 0.22 : 0.15, 260 + (accent ? 300 : 0)); }
    }
    // LEAD: melody over 2 bars, brassy saw + octave
    if (on('lead') && name !== 'title') {
      const mel = name === 'boss'
        ? [[0, 12], [3, 12], [6, 10], [10, 12], [12, 15], [14, 13]]
        : [[0, 12], [3, 15], [6, 19], [8, 17], [10, 15], [12, 12], [14, 10]];
      const hit = mel.find(m => m[0] === s);
      if (hit) {
        const f = mtof(root + 12 + hit[1] + (bar === 3 ? -2 : 0));
        this.tone(g.lead, 'sawtooth', f, t, sd * 2.6, 0.09, 2600, 0.01, 6); this.tone(g.lead, 'square', f * 2, t, sd * 2, 0.025, 3500);
      }
    }
  }

  private tone(dest: AudioNode, type: OscillatorType, f: number, t: number, dur: number, g: number, cutoff: number, attack = 0.005, det = 0) {
    const o = this.ctx.createOscillator(), fl = this.ctx.createBiquadFilter(), a = this.ctx.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = det; fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff * 2.5, t); fl.frequency.exponentialRampToValueAtTime(cutoff, t + dur * 0.8); fl.Q.value = 3;
    a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + attack); a.gain.setValueAtTime(g, t + dur * 0.6); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(a); a.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  private pluck(dest: AudioNode, type: OscillatorType, f: number, t: number, dur: number, g: number, cutoff: number) {
    const o = this.ctx.createOscillator(), fl = this.ctx.createBiquadFilter(), a = this.ctx.createGain();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t); fl.frequency.exponentialRampToValueAtTime(300, t + dur);
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(a); a.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  private kick(dest: AudioNode, t: number, g: number) {
    const o = this.ctx.createOscillator(), a = this.ctx.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(a); a.connect(dest); o.start(t); o.stop(t + 0.3);
  }
  private noiseHit(dest: AudioNode, t: number, dur: number, g: number, type: BiquadFilterType, f: number) {
    const s = this.ctx.createBufferSource(), fl = this.ctx.createBiquadFilter(), a = this.ctx.createGain();
    s.buffer = this.e.noiseBuf; fl.type = type; fl.frequency.value = f; a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(a); a.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  private snare(dest: AudioNode, t: number, g: number) { this.noiseHit(dest, t, 0.18, g, 'bandpass', 1800); this.pluck(dest, 'triangle', 200, t, 0.1, g * 0.6, 1500); }
  private hat(dest: AudioNode, t: number, g: number, d: number) { this.noiseHit(dest, t, d, g, 'highpass', 7500); }
}
export const music = new Music();
