// Rigorous offline 2-minute mix render + BS.1770 loudness / true-peak / clipping / seam / spectral report.
// Usage: node tools/audio-demo/mix.mjs [--secs=120]   (exit 1 if out of spec)
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1]?.split(',') || null;
const SECS = Number((process.argv.find(a => a.startsWith('--secs=')) || '--secs=120').split('=')[1]);
const out = await build({ entryPoints: [path.join(root, 'src/game/audio/index.ts')], bundle: true, format: 'iife', globalName: 'A', write: false, alias: { '@shared': path.join(root, 'src/game/shared') }, logLevel: 'error' });
const b = await chromium.launch(); const page = await b.newPage(); page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.setContent('<html></html>'); await page.addScriptTag({ content: out.outputFiles[0].text });
const R = await page.evaluate(async ({ SECS, ONLY }) => {
  const { audio, sfx, music, Audio } = A; const SR = 48000; let R0;
  const db = x => 20 * Math.log10(Math.max(x, 1e-9)); const r1 = x => +x.toFixed(1);
  // ---------- analysis helpers ----------
  const biq = (x, b0, b1, b2, a1, a2) => { const y = new Float32Array(x.length); let z1 = 0, z2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], o = b0 * v + z1; z1 = b1 * v - a1 * o + z2; z2 = b2 * v - a2 * o; y[i] = o; } return y; };
  const kw = (x) => biq(biq(x, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585), 1, -2, 1, -1.99004745483398, 0.99007225036621);
  const kFilt = (buf) => [kw(buf.getChannelData(0)), kw(buf.getChannelData(1))];
  // mean-square per 400ms block, hop 100ms
  const blocks = (K) => { const N = Math.floor(0.4 * SR), H = Math.floor(0.1 * SR), n = K[0].length, out = []; for (let s = 0; s + N <= n; s += H) { let z = 0; for (const ch of K) { let sq = 0; for (let i = s; i < s + N; i++) sq += ch[i] * ch[i]; z += sq / N; } out.push(z); } return out; };
  const lk = z => -0.691 + 10 * Math.log10(Math.max(z, 1e-12));
  const integrated = (bl) => { const g1 = bl.filter(z => lk(z) > -70); if (!g1.length) return -70; const m1 = g1.reduce((a, c) => a + c) / g1.length; const g2 = g1.filter(z => lk(z) > lk(m1) - 10); return lk(g2.reduce((a, c) => a + c) / g2.length); };
  const lufsRange = (K, bl, t0, t1) => integrated(bl.slice(Math.floor(t0 * 10), Math.max(Math.floor(t0 * 10) + 1, Math.floor(t1 * 10) - 3)));
  const stLufs = (bl, t0, t1) => { const s = bl.slice(Math.floor(t0 * 10), Math.floor(t1 * 10) - 3); return lk(s.reduce((a, c) => a + c, 0) / Math.max(1, s.length)); }; // ungated mean over window
  const truePeak = (buf) => { // 4x oversampling, 12-tap windowed-sinc polyphase
    let pk = 0; const T = 6; const ph = [0.25, 0.5, 0.75].map(f => { const h = []; for (let k = -T + 1; k <= T; k++) { const x = k - f, s = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x), w = 0.5 + 0.5 * Math.cos(Math.PI * x / (T + 0.5)); h.push(s * w); } return h; });
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = T; i < d.length - T; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; if (a < 0.2) continue; for (const h of ph) { let v = 0; for (let k = 0; k < h.length; k++) v += h[k] * d[i - T + 1 + k]; if (Math.abs(v) > pk) pk = Math.abs(v); } } }
    return db(pk); };
  const clipCount = (buf) => { let n = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) >= 0.999) n++; } return n; };
  const fft = (re, im) => { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const ur = re[i + j], ui = im[i + j], vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr; re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } };
  // fraction of power above 4 kHz + band power (Welch, 4096 Hann)
  const spec = (buf, t0, t1) => { const N = 4096, d0 = buf.getChannelData(0), d1 = buf.getChannelData(1); let hf = 0, tot = 0, cnt = 0; const k4 = Math.floor(4000 / SR * N);
    for (let s = Math.floor(t0 * SR); s + N <= Math.floor(t1 * SR); s += N / 2) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = 0.5 * (d0[s + i] + d1[s + i]) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im); for (let k = 1; k < N / 2; k++) { const p = re[k] * re[k] + im[k] * im[k]; tot += p; if (k >= k4) hf += p; } cnt++; }
    return { hfFrac: hf / Math.max(tot, 1e-20), hfDb: db(Math.sqrt(hf / Math.max(cnt, 1))), totDb: db(Math.sqrt(tot / Math.max(cnt, 1))) }; };
  // ---------- scenario ----------
  const mul = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const T_PLAY = 14, T_BOSS = 75, T_LEVEL = 62, T_BDEATH = 105;
  const killRate = t => t < T_PLAY ? 0 : t < 30 ? 1 + (t - 14) * 0.15 : t < 45 ? 4 + (t - 30) * 1.2 : t < 60 ? 22 + (t - 45) * 5 : t < 75 ? 300 : t < T_BDEATH ? 45 : 8;
  const REAL_PLAY = sfx.play.bind(sfx);
  const scenario = async (mode /* full | music | sfx */) => {
    audio.reset(); const o = new OfflineAudioContext(2, Math.ceil(SR * SECS), SR); audio.init(o);
    if (mode === 'sfx') audio.musicBus.gain.value = 0;
    sfx.play = mode === 'music' ? () => {} : ONLY ? (n, o) => { if (ONLY.includes(n)) REAL_PLAY(n, o); } : REAL_PLAY;
    const g = new Audio(); const rnd = mul(7); let acc = { k: 0 };
    const mk = (extra = []) => extra;
    g.title();
    const TICKS = Math.floor(SECS * 60);
    for (let k = 0; k < TICKS; k++) {
      const t = k / 60;
      o.suspend(Math.max(t, 1e-4)).then(() => {
        const ev = [], inCards = t >= T_LEVEL && t < T_LEVEL + 3.5;
        const state = { phase: inCards ? 'levelUp' : 'running', players: [{ hp: t > 90 && t < 100 ? 20 : 100, maxHp: 100, dead: false }] };
        if (t < T_PLAY) { if (Math.abs(t - 3) < 0.009 || Math.abs(t - 6) < 0.009 || Math.abs(t - 9.5) < 0.009) g.ui(t < 5 ? 'hover' : 'click'); if (Math.abs(t - 12) < 0.009) g.ui('click'); if (Math.abs(t - T_PLAY) < 0.009) { g.ui('click'); g.stinger(); } }
        else {
          if (k === Math.round((T_PLAY + 0.8) * 60)) g.startRun();
          if (!inCards) {
            const kr = killRate(t) + (t >= T_BOSS && t < T_BDEATH ? 0 : 0); acc.k += kr / 60;
            const n = Math.floor(acc.k); acc.k -= n;
            for (let i = 0; i < n; i++) ev.push({ t: 'kill', x: 0, z: 0, enemyKind: i & 3 });
            const nh = Math.floor(n * 1.6 + (rnd() < 6 / 60 ? 1 : 0)); for (let i = 0; i < nh; i++) ev.push({ t: 'hit', x: 0, z: 0, dmg: 1, crit: rnd() < 0.1, enemyKind: 0 });
            if (rnd() < Math.min(0.25, kr * 0.3 / 60 + 0.02)) ev.push({ t: 'pickup', kind: 0, id: 0 });
            if (rnd() < 6 / 60) ev.push({ t: 'shoot', weapon: 'ember_bolt', x: 0, z: 0, owner: 0 }); if (t > 30 && rnd() < 3 / 60) ev.push({ t: 'shoot', weapon: 'orbit_blades', x: 0, z: 0, owner: 0 }); if (t > 45 && rnd() < 2.5 / 60) ev.push({ t: 'shoot', weapon: 'chain_lightning', x: 0, z: 0, owner: 0 }); if (t > 50 && rnd() < 1.5 / 60) ev.push({ t: 'shoot', weapon: 'frost_nova', x: 0, z: 0, owner: 0 });
          }
          if (Math.abs(t - T_LEVEL) < 0.009) ev.push({ t: 'levelUp', id: 0, choices: [] });
          if (Math.abs(t - T_BOSS) < 0.009) ev.push({ t: 'bossSpawn', x: 0, z: 0, bossId: 'b' });
          if (Math.abs(t - T_BDEATH) < 0.009) ev.push({ t: 'bossDeath', x: 0, z: 0, bossId: 'b' });
          for (const th of [83, 90, 90.6, 96, 112]) if (Math.abs(t - th) < 0.009) { ev.push({ t: 'playerHurt', id: 0, dmg: 8 }, { t: 'freeze', ms: 50 }); }
        }
        if (t >= T_PLAY) g.consume(ev, state);
        music.tick(); // offline: no interval timer, drive the scheduler per sim tick
        o.resume(); });
    }
    return o.startRendering(); };
  const mus = await scenario('music'), full = await scenario('full'), sfxOnly = await scenario('sfx');
  const pk = b => { let m = 0; for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); } return m; }; R0 = [pk(full), pk(mus), pk(sfxOnly)];
  const Kf = kFilt(full), Bf = blocks(Kf), Km = kFilt(mus), Bm = blocks(Km), Ks = kFilt(sfxOnly), Bs = blocks(Ks);
  const R = { secs: SECS, fail: [], dbg: R0 };
  const seg = { title: [2, 13], battleSparse: [18, 28], battleBuild: [35, 55], peakDensity: [64, 74], boss: [78, 100], bossDeath_outro: [108, 119] };
  R.integratedLufs = { full: r1(integrated(Bf)), musicOnly: r1(integrated(Bm)), sfxOnly: r1(integrated(Bs)) };
  R.truePeakDbTP = { full: r1(truePeak(full)) }; R.clipCount = clipCount(full);
  R.segments = {}; for (const [k, [a, b2]] of Object.entries(seg)) R.segments[k] = { full: r1(stLufs(Bf, a, b2)), music: r1(stLufs(Bm, a, b2)), sfx: r1(stLufs(Bs, a, b2)) };
  R.timeline = []; for (let t = 0; t + 3 <= SECS; t += 6) R.timeline.push({ t, full: r1(stLufs(Bf, t, t + 3)), music: r1(stLufs(Bm, t, t + 3)), sfx: r1(stLufs(Bs, t, t + 3)) });
  // spec checks
  if (R.integratedLufs.full > -13 || R.integratedLufs.full < -19) R.fail.push(`integrated ${R.integratedLufs.full} LUFS outside -19..-13 (target ~-16)`);
  if (R.truePeakDbTP.full > -1) R.fail.push(`true peak ${R.truePeakDbTP.full} dBTP > -1`);
  if (R.clipCount > 0) R.fail.push(`clipped samples: ${R.clipCount}`);
  const bm = R.segments.battleBuild.music, tm = R.segments.peakDensity;
  if (tm.sfx < tm.music - 3) R.fail.push(`SFX (${tm.sfx}) >3 LU below music (${tm.music}) at peak density`);
  if (tm.full - tm.music < 1.5) R.fail.push(`full mix only ${r1(tm.full - tm.music)} LU above music-only at peak density (SFX not audible)`);
  // spectral: >4 kHz energy of sfx at peak density vs music
  const sp = { sfx: spec(sfxOnly, 64, 74), music: spec(mus, 64, 74), full: spec(full, 64, 74) };
  R.spectral = { peakDensity: { sfxHfFrac: +sp.sfx.hfFrac.toFixed(3), musicHfFrac: +sp.music.hfFrac.toFixed(3), sfxHfDb: r1(sp.sfx.hfDb), musicHfDb: r1(sp.music.hfDb), hfSfxOverMusicDb: r1(sp.sfx.hfDb - sp.music.hfDb) } };
  if ((sp.sfx.hfDb - sp.music.hfDb > 15 || sp.sfx.hfFrac > 0.2)) R.fail.push(`>4kHz SFX energy ${r1(sp.sfx.hfDb - sp.music.hfDb)} dB above music, ${Math.round(sp.sfx.hfFrac * 100)}% of sfx energy (fatiguing: limit +15 dB or 20%)`);
  // per-sound HF fraction for frequent sounds
  R.freqSounds = {};
  for (const n of ['hit', 'kill', 'crunch', 'gem', 'fire_bolt', 'fire_orb', 'fire_nova', 'fire_arrow', 'fire_lightning', 'fire_flame', 'dash']) {
    audio.reset(); const o = new OfflineAudioContext(2, SR * 2, SR); audio.init(o); sfx.play = REAL_PLAY; sfx.reset(); sfx.play(n, { count: 12 }); const bf = await o.startRendering();
    const s = spec(bf, 0, 1.9); R.freqSounds[n] = { hfFrac: +s.hfFrac.toFixed(2) }; if (s.hfFrac > 0.5) R.fail.push(`${n}: ${Math.round(s.hfFrac * 100)}% of energy >4kHz (fatiguing)`); }
  // loop seams (music-only, per theme, int 1): max |dx| within +-2ms of 4-bar boundary vs median of 4ms-window maxima
  R.seams = {};
  for (const th of ['title', 'battle', 'boss']) {
    const bpm = { title: 68, battle: 138, boss: 152 }[th], bar = 16 * 60 / bpm / 4, cyc = bar * 4, secs = cyc * 4 + 1;
    audio.reset(); const o = new OfflineAudioContext(2, Math.ceil(secs * SR), SR); audio.init(o); music.setIntensity(1); music.play(th); music.scheduleUntil(secs - 0.1); const bf = await o.startRendering(); const d = bf.getChannelData(0);
    const W = Math.floor(0.004 * SR), wmax = (c) => { let m = 0; for (let i = c - W / 2; i < c + W / 2; i++) m = Math.max(m, Math.abs(d[i] - d[i - 1])); return m; };
    const all = []; for (let c = Math.floor(cyc * SR * 0.5); c < Math.floor(cyc * SR * 3.5); c += W) all.push(wmax(c)); all.sort((a, b) => a - b); const med = all[all.length >> 1];
    const seams = [1, 2, 3].map(k => wmax(Math.round(cyc * k * SR))); const worst = Math.max(...seams);
    R.seams[th] = { seamMaxDiff: +worst.toFixed(4), medianWindowMaxDiff: +med.toFixed(4), ratio: +(worst / Math.max(med, 1e-6)).toFixed(2) };
    if (worst / Math.max(med, 1e-6) > 3 && worst > 0.05) R.fail.push(`${th}: loop seam diff ${(worst / med).toFixed(1)}x median`); }
  return R;
}, { SECS, ONLY });
await b.close();
console.log(JSON.stringify(R, null, 1)); console.log(R.fail.length ? 'FAIL:\n ' + R.fail.join('\n ') : 'MIX WITHIN SPEC'); process.exit(R.fail.length ? 1 : 0);
