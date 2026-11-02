// Usage: node scripts/ws-smoke.mjs wss://host/ws
// Protocol-agnostic: passes if the WebSocket upgrade succeeds and the connection stays open
// for ~1.5s (server may send any handshake/hello). Does NOT depend on message formats, so
// Netcode's room/handshake changes won't fail deploys. Prints any first message for debugging.
const url = process.argv[2];
if (!url) { console.error('usage: ws-smoke.mjs <wss-url>'); process.exit(2); }
const w = new WebSocket(url);
const fail = (m) => { console.error('ws smoke FAILED:', m); process.exit(1); };
const timer = setTimeout(() => fail('connect timeout'), 10000);
let opened = false;
w.onmessage = (e) => console.log('first message:', String(e.data).slice(0, 120));
w.onerror = () => fail('connect error');
w.onclose = (e) => { if (!opened) fail('closed before open'); else fail(`closed early (${e.code})`); };
w.onopen = () => {
  opened = true; clearTimeout(timer);
  setTimeout(() => { console.log('ws smoke ok'); process.exit(0); }, 1500);
};
