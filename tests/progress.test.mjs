// Unit test for meta/progress.ts (personal bests). Run: npm run test:progress
import { build } from 'esbuild'; import path from 'node:path'; import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..'), out = path.join((await import('node:fs')).mkdtempSync(path.join((await import('node:os')).tmpdir(), 'prog-')), 'p.mjs');
await build({ entryPoints: [path.join(root, 'src/game/meta/progress.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { Meta } = await import(out);
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const st = mem(); let m = new Meta(st);
let r = m.record('a', { kills: 10, time: 60, level: 3 });
assert.equal(r.first, true); assert.deepEqual(r.broken, []);
r = m.record('a', { kills: 5, time: 90, level: 3 }); assert.deepEqual(r.broken, ['time']); assert.equal(r.prev.time, 60);
r = m.record('a', { kills: 50, time: 30, level: 9, victory: true }); assert.deepEqual(r.broken.sort(), ['kills', 'level']);
assert.equal(m.bests('a').runs, 3); assert.equal(m.bests('a').wins, 1); assert.equal(m.bests('b'), null);
assert.equal(m.record('b', { kills: 1, time: 1, level: 1 }).first, true); // bests are per arena
for (let i = 0; i < 15; i++) m.record('a', { kills: i, time: i, level: 1 });
assert.equal(m.recent().length, 10); assert.equal(m.recent()[0].kills, 14);
m = new Meta(st); assert.equal(m.bests('a').kills, 50); assert.equal(m.recent().length, 10); // persisted
m = new Meta({ getItem: () => '{garbage', setItem() { throw new Error('quota'); } }); m.record('a', { kills: 1, time: 1, level: 1 }); // corrupt + failing storage don't throw
m = new Meta(null); assert.equal(m.record('a', { kills: NaN, time: -5, level: 1 }).best.kills, 0);
console.log('progress: PASS');
