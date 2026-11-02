// Objective audio verification (nobody can listen): renders every SFX + music theme via OfflineAudioContext
// in headless Chromium and checks levels / clipping / DC / edge clicks / loop periodicity.
// Usage: node tools/audio-demo/verify.mjs [--json]    (exit code 1 on failure)
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = await build({ entryPoints: [path.join(root, 'src/game/audio/index.ts')], bundle: true, format: 'iife', globalName: 'A', write: false,
  alias: { '@shared': path.join(root, 'src/game/shared') }, logLevel: 'error' });
const code = out.outputFiles[0].text;
const b = await chromium.launch(); const page = await b.newPage();
page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.setContent('<html></html>'); await page.addScriptTag({ content: code });
const CAL = process.argv.includes('--calibrate');
const R = await page.evaluate(async (CAL) => {
  const { audio, sfx, music, Audio, SFX_TRIM, MUSIC_TRIM } = A; const SR = 48000;
  const db = x => 20 * Math.log10(Math.max(x, 1e-9));
  const stats = (buf, from = 0, to = buf.length) => {
    let peak = 0, sum = 0, sq = 0, nan = false, n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = from; i < to; i++) { const v = d[i]; if (v !== v) nan = true; const a = Math.abs(v); if (a > peak) peak = a; sum += v; sq += v * v; n++; } }
    return { peak, rms: Math.sqrt(sq / n), dc: sum / n, nan };
  };
  const fresh = (secs) => { audio.reset(); const o = new OfflineAudioContext(2, Math.ceil(SR * secs), SR); audio.init(o); return o; };
  const sfxNames = ['hit','kill','gem','levelup','hurt','death','fire_bolt','fire_whip','fire_orb','fire_nova','fire_arrow','fire_lightning','fire_flame','boss_telegraph','boss_slam','boss_roar','ui_click','ui_hover','ui_card','ui_back','chest','dash','crunch','freeze','evolve','heartbeat','stinger'];
  const FREQ = { hit: -11, kill: -10, gem: -11, fire_bolt: -14, fire_whip: -14, fire_orb: -13, fire_nova: -10, fire_arrow: -14, fire_lightning: -11, fire_flame: -13, dash: -12, freeze: -14, ui_click: -12, ui_hover: -18, ui_back: -13, heartbeat: -9, ui_card: -8, gem_: 0 };
  const TARGET_SFX = n => FREQ[n] ?? -6, TARGET_MUS = { title: -23, battle: -20, boss: -20 };
  const bpmOf = { title: 68, battle: 138, boss: 152 };
  const musRms = async (th, inten, bars = 13) => { const barS = 16 * 60 / bpmOf[th] / 4, secs = barS * bars; const o = fresh(secs); music.setIntensity(inten); music.play(th); music.scheduleUntil(secs - 0.1); const buf = await o.startRendering(); return { buf, barS, secs, ...stats(buf, Math.floor(barS * SR), Math.floor(barS * (bars) * SR) - 1) }; };
  if (CAL) for (let it = 0; it < 4; it++) {
    for (const n of sfxNames) { const o = fresh(3); sfx.play(n, { count: n === 'crunch' ? 12 : 1 }); const pk = stats(await o.startRendering()).peak; SFX_TRIM[n] = (SFX_TRIM[n] ?? 1) * Math.pow(10, (TARGET_SFX(n) - db(pk)) / 20); }
    for (const th of ['title', 'battle', 'boss']) { const m = await musRms(th, 1); MUSIC_TRIM[th] = (MUSIC_TRIM[th] ?? 1) * Math.pow(10, (TARGET_MUS[th] - db(m.rms)) / 20); }
  }
  const res = { trim: { SFX_TRIM, MUSIC_TRIM }, sfx: {}, music: {}, stress: {}, fail: [] };
  for (const n of sfxNames) {
    const o = fresh(3); sfx.play(n, { count: n === 'crunch' ? 12 : 1 }); const buf = await o.startRendering();
    const s = stats(buf); const head = stats(buf, 0, Math.floor(SR * 0.0005)); const tail = stats(buf, buf.length - Math.floor(SR * 0.003));
    res.sfx[n] = { peakDb: +db(s.peak).toFixed(1), rmsDb: +db(s.rms).toFixed(1), dc: +s.dc.toExponential(1), startAmp: +head.peak.toExponential(1), endAmp: +tail.peak.toExponential(1) };
    if (s.nan) res.fail.push(n + ': NaN'); if (s.peak > 0.99) res.fail.push(n + ': clipping'); if (s.peak < 0.01) res.fail.push(n + ': silent');
    if (head.peak > 0.02) res.fail.push(n + ': click at start'); if (tail.peak > 0.002) res.fail.push(n + ': click at end');
    if (Math.abs(s.dc) > 0.01 * s.peak) res.fail.push(n + ': DC offset');
  }
  // music: render 12 bars at several intensities, skip first bar (fade-in), check RMS + periodicity
  for (const th of ['title', 'battle', 'boss']) {
    const bpm = { title: 68, battle: 138, boss: 152 }[th], barS = 16 * 60 / bpm / 4, secs = barS * 13;
    res.music[th] = {};
    for (const inten of [0.05, 0.2, 0.4, 0.55, 0.8, 1]) {
      const m = await musRms(th, inten); const buf = m.buf, s = m;
      const a = Math.floor(barS * 1 * SR), z = Math.floor(barS * 13 * SR) - 1;
      // periodicity: 4-bar chord cycle should repeat; compare per-step RMS envelope of bars 1-4 vs 5-8
      const sd = barS / 16, env = (start) => { const e = []; for (let k = 0; k < 64; k++) { const f = Math.floor((start + k * sd) * SR); e.push(stats(buf, f, f + Math.floor(sd * SR)).rms); } return e; };
      const e1 = env(barS * 5), e2 = env(barS * 9); let num = 0, d1 = 0, d2 = 0; const m1 = e1.reduce((x, y) => x + y) / 64, m2 = e2.reduce((x, y) => x + y) / 64;
      for (let k = 0; k < 64; k++) { num += (e1[k] - m1) * (e2[k] - m2); d1 += (e1[k] - m1) ** 2; d2 += (e2[k] - m2) ** 2; }
      const corr = +(num / Math.sqrt(d1 * d2 + 1e-12)).toFixed(3);
      // seam clicks: biggest sample-to-sample jump within +-2ms of each bar line vs. elsewhere (mono L)
      const L = buf.getChannelData(0); let seam = 0, glob = 0; for (let i = a + 1; i < z; i++) glob = Math.max(glob, Math.abs(L[i] - L[i - 1]));
      for (let bar = 2; bar < 12; bar++) { const c = Math.floor(bar * barS * SR); for (let i = c - 96; i < c + 96; i++) seam = Math.max(seam, Math.abs(L[i] - L[i - 1])); }
      res.music[th][inten] = { rmsDb: +db(s.rms).toFixed(1), peakDb: +db(s.peak).toFixed(1), dc: +s.dc.toExponential(1), loopCorr: corr, seamJump: +seam.toFixed(3), maxJump: +glob.toFixed(3) };
      if (s.nan) res.fail.push(th + ' NaN'); if (s.peak > 0.99) res.fail.push(`${th}@${inten} clipping`); if (Math.abs(s.dc) > 0.01) res.fail.push(`${th}@${inten} DC`);
      if (inten >= 0.8 && corr < 0.8) res.fail.push(`${th}@${inten} loop not periodic (${corr})`);
      if (seam > 0.9 * glob && seam > 0.3) res.fail.push(`${th}@${inten} seam click`);
    }
  }
  // stress: 300 kills/s + hits + shots + gems for 4s over battle music, through the real Audio class.
  // `extra(o, t)` lets us inject levelup / gems at t=2s to measure how much they poke out of the horde mix.
  const stressRun = async (extra, gems = true) => { const secs = 4, o = fresh(secs); music.play('battle'); music.setIntensity(1); music.scheduleUntil(secs);
    const g = new Audio();
    for (let k = 0; k < 4 * 60; k++) { const t = k / 60; o.suspend(Math.max(t, 0.0001)).then(() => {
      const e = []; for (let i = 0; i < 5; i++) e.push({ t: 'kill', x: 0, z: 0, enemyKind: i }); for (let i = 0; i < 8; i++) e.push({ t: 'hit', x: 0, z: 0, dmg: 1, crit: i === 0, enemyKind: 0 });
      e.push({ t: 'shoot', weapon: 'chain_lightning', x: 0, z: 0, owner: 0 }, ...(gems && k % 12 === 0 ? [{ t: 'pickup', kind: 0, id: 0 }] : []), { t: 'shoot', weapon: 'ember_bolt', x: 0, z: 0, owner: 0 }); g.consume(e); extra?.(k, e, g); o.resume(); }); }
    return o.startRendering(); };
  { const buf = await stressRun(); const s = stats(buf, SR, buf.length);
    res.stress = { peakDb: +db(s.peak).toFixed(1), rmsDb: +db(s.rms).toFixed(1), dropped: sfx.dropped, nan: s.nan };
    if (s.peak > 0.99) res.fail.push('stress clipping'); if (s.nan) res.fail.push('stress NaN'); if (s.rms < 0.02) res.fail.push('stress silent');
    // Prominence: the compressor flattens overall RMS, so measure tonal energy at the sound's own partials (Goertzel)
    // in the window right after it plays, with vs without it, over the full horde mix.
    const tone = (bf, t0, t1, base) => { const fs = base.flatMap(f => [0.93, 0.955, 0.98, 1, 1.02, 1.045, 1.07].map(m => f * m)); const d = bf.getChannelData(0), i0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR); let tot = 0;
      for (const f of fs) { const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w); let a = 0, b = 0; for (let i = 0; i < n; i++) { const x = d[i0 + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n)); const nx = x + c * a - b; b = a; a = nx; } tot += a * a + b * b - c * a * b; } return tot; };
    const lv = await stressRun((k, e, g) => { if (k === 120) g.consume([{ t: 'levelUp', id: 0, choices: [] }]); });
    const nog = await stressRun(null, false);
    const gm = await stressRun((k, e, g) => { if (k >= 120 && k < 150 && k % 8 === 0) g.consume([{ t: 'pickup', kind: 0, id: 0 }, { t: 'pickup', kind: 0, id: 0 }]); }, false);
    const LV = [440, 554.4, 659.3, 880, 1108.7], GM = [880, 987.8, 1108.7, 1318.5, 1568];
    res.mixDensity = { levelupToneDb: +db(Math.sqrt(tone(lv, 2.05, 2.55, LV) / tone(buf, 2.05, 2.55, LV))).toFixed(1), gemToneDb: +db(Math.sqrt(tone(gm, 2.0, 2.5, GM) / tone(nog, 2.0, 2.5, GM))).toFixed(1) };
    if (res.mixDensity.levelupToneDb < 3) res.fail.push('levelup chime not prominent over horde'); if (res.mixDensity.gemToneDb < 3) res.fail.push('gem streak not prominent over horde'); }
  // crossfade title->battle on bar boundary + card filter + duck: must not NaN/clip and must land on 'battle'
  { const o = fresh(14); music.setIntensity(0.8); music.play('title'); music.scheduleUntil(3); music.play('battle'); music.scheduleUntil(13);
    o.suspend(6).then(() => { music.setPaused(true); music.duck(-6, 0.6); o.resume(); });
    const buf = await o.startRendering(); const s = stats(buf);
    res.xfade = { current: music.current, peakDb: +db(s.peak).toFixed(1) };
    if (music.current !== 'battle' || s.nan || s.peak > 0.99) res.fail.push('crossfade/duck/filter smoke failed'); }
  // mix: loudest-music vs weakest important sfx
  const mus = Math.max(...['battle', 'boss'].map(t => res.music[t][1].rmsDb));
  res.mix = { loudestMusicRmsDb: mus };
  for (const n of ['hurt', 'levelup', 'boss_slam', 'crunch', 'evolve', 'ui_card', 'chest']) if (res.sfx[n].peakDb < mus + 6) res.fail.push(`${n} not >=6dB above music RMS`);
  return res;
}, CAL);
await b.close();
if (process.argv.includes('--json')) console.log(JSON.stringify(R, null, 1));
else {
  console.log('SFX (dB, default sliders):'); for (const [k, v] of Object.entries(R.sfx)) console.log(' ', k.padEnd(15), `peak ${v.peakDb}  rms ${v.rmsDb}  dc ${v.dc}  start ${v.startAmp} end ${v.endAmp}`);
  console.log('MUSIC:'); for (const [t, m] of Object.entries(R.music)) for (const [i, v] of Object.entries(m)) console.log(' ', t.padEnd(7), 'int', i.padEnd(5), `rms ${v.rmsDb} peak ${v.peakDb} loopCorr ${v.loopCorr} seamJump ${v.seamJump}/${v.maxJump}`);
  if (CAL) console.log('SFX_TRIM =', JSON.stringify(Object.fromEntries(Object.entries(R.trim.SFX_TRIM).map(([k, v]) => [k, +v.toFixed(3)]))), '\nMUSIC_TRIM =', JSON.stringify(Object.fromEntries(Object.entries(R.trim.MUSIC_TRIM).map(([k, v]) => [k, +v.toFixed(3)]))));
  console.log('STRESS', R.stress, 'DENSITY', R.mixDensity, 'MIX', R.mix);
}
console.log(R.fail.length ? 'FAIL:\n ' + R.fail.join('\n ') : 'ALL CHECKS PASSED'); process.exit(R.fail.length ? 1 : 0);
