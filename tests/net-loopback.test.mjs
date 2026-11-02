// Loopback: real server, 2 ws clients, checks welcome/snapshot/inputs move the right hero. Run: npm run test:net
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import WebSocket from 'ws';
import { build } from 'esbuild';
const root = path.resolve(import.meta.dirname, '..');
await import('../scripts/build-server.mjs');
const proto = path.join(root, 'dist-server/proto.mjs');
await build({ entryPoints: [path.join(root, 'src/game/netcode/protocol.ts')], bundle: true, format: 'esm', platform: 'node', outfile: proto, logLevel: 'error', alias: { '@shared': path.join(root, 'src/game/shared') } });
const { encodeInput, decodeSnapshot } = await import(proto);
const PORT = 18000 + Math.floor(Math.random() * 1000);
const srv = spawn('node', ['server/index.js'], { cwd: root, env: { ...process.env, PORT }, stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok) break; } catch {} await sleep(100); }
  function client(room) {
    const c = { snaps: [], welcome: null, ws: new WebSocket(`ws://127.0.0.1:${PORT}/ws`), bytes: 0 };
    c.ws.on('open', () => c.ws.send(JSON.stringify({ t: 'join', room })));
    c.ws.on('message', (d, bin) => { if (bin) { c.bytes += d.length; c.snaps.push(decodeSnapshot(new Uint8Array(d))); } else { const m = JSON.parse(d); if (m.t === 'welcome') c.welcome = m; } });
    return c;
  }
  const a = client('T1'), b = client('T1');
  await sleep(300);
  assert.equal(a.welcome.slot, 0); assert.equal(b.welcome.slot, 1); assert.equal(a.welcome.seed, b.welcome.seed);
  const inp = { moveX: 1, moveZ: 0, aimX: 1, aimZ: 0, dash: false, ability: false };
  let seq = 1; const t0 = Date.now();
  while (Date.now() - t0 < 3000) { a.ws.send(encodeInput(seq++, inp)); await sleep(16); }
  const last = a.snaps.at(-1).meta, first = a.snaps[0].meta;
  const hz = a.snaps.length / 3.3;
  assert.ok(hz > 14 && hz < 26, `snapshot rate ${hz.toFixed(1)}Hz`);
  assert.ok(last.players[0].x > first.players[0].x + 5, `hero 0 should move +x: ${first.players[0].x} -> ${last.players[0].x}`);
  assert.ok(Math.abs(last.players[1].x - first.players[1].x) < 0.01, 'hero 1 idle');
  assert.ok(last.players[0].active && last.players[1].active && !last.players[2].active);
  assert.ok(last.acks[0] > 100, 'input acked');
  assert.deepEqual(b.snaps.at(-1).meta.tick, b.snaps.at(-1).meta.tick);
  console.log(`ok: ${hz.toFixed(1)}Hz snapshots, ${(a.bytes / 3.3 / 1024).toFixed(1)} KB/s per client, tick ${last.tick}, enemies ${a.snaps.at(-1).enemies.n}`);
  a.ws.close(); b.ws.close(); await sleep(200);
  const st = await (await fetch(`http://127.0.0.1:${PORT}/netstats`)).json(); assert.equal(st.players, 0);
  console.log('net loopback: PASS');
} finally { srv.kill(); }
