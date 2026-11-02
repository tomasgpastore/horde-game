// Determinism guardrail: same seed + same input stream => identical state hash, run headless in Node.
// Run: npm run test:determinism   (bundles src/sim + src/netcode/hash with esbuild; no browser)
import { build } from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (d) => path.join(root, 'src/game', d);
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'det-')), 'bundle.mjs');
await build({
  stdin: { contents: `export * from '@sim/index'; export * from '@net/hash'; export * from '@shared/types'; export { getArena } from '@world/index';`, resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  alias: { '@shared': src('shared'), '@sim': src('sim'), '@net': src('netcode'), '@world': src('world'), '@engine': src('engine'), '@render': src('render') },
});
const { Sim, createState, hashState, getArena, MAX_PLAYERS } = await import(pathToFileURL(out).href);

// forbid nondeterministic APIs in sim source
const bad = /Math\.random|Date\.now|performance\.now|new Date\(/;
(function scan(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) scan(p);
    else if (/\.[jt]s$/.test(f.name)) {
      const m = fs.readFileSync(p, 'utf8').split('\n').findIndex((l) => bad.test(l.replace(/\/\/.*$/, '')));
      assert.equal(m, -1, `nondeterministic API in ${path.relative(root, p)}:${m + 1}`);
    }
  }
})(src('sim'));

// scripted input stream (own tiny LCG, independent of sim rng)
function inputStream(seed, ticks, players) {
  let s = seed >>> 0; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const frames = [];
  for (let t = 0; t < ticks; t++) frames.push(Array.from({ length: players }, () => {
    const a = r() * Math.PI * 2;
    return { moveX: Math.cos(a) * (r() < 0.2 ? 0 : 1), moveZ: Math.sin(a), aimX: Math.cos(a), aimZ: Math.sin(a), dash: r() < 0.02, ability: r() < 0.01 };
  }));
  return frames;
}
function run(seed, frames, players, checkpoints) {
  const sim = new Sim(createState(seed, getArena('ashen_basin'), players), getArena('ashen_basin'));
  const hs = [];
  frames.forEach((f, i) => { sim.step(f); if ((i + 1) % checkpoints === 0) hs.push(hashState(sim.state, sim.rng.s)); });
  return hs;
}

const TICKS = 60 * 120;
for (const players of [1, 2, MAX_PLAYERS]) {
  const frames = inputStream(1234, TICKS, players);
  const a = run(42, frames, players, 60), b = run(42, frames, players, 60);
  assert.deepEqual(a, b, `desync with ${players} players (first diff at second ${a.findIndex((x, i) => x !== b[i])})`);
  const c = run(43, frames, players, 60);
  // different seed must hash differently (seed is in the hash at minimum)
  assert.notEqual(a.at(-1), c.at(-1), 'seed not reflected in hash');
  const d = run(42, inputStream(999, TICKS, players), players, 60);
  assert.notEqual(a.at(-1), d.at(-1), 'hash insensitive to inputs');
  console.log(`ok ${players}p ${TICKS} ticks final hash ${a.at(-1).toString(16)}`);
}
console.log('determinism: PASS');
