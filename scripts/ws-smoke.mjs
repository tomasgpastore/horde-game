// Usage: node scripts/ws-smoke.mjs wss://host/ws  — two clients; one must receive the other's broadcast.
const url = process.argv[2];
if (!url) { console.error('usage: ws-smoke.mjs <wss-url>'); process.exit(2); }
const open = () => new Promise((res, rej) => {
  const w = new WebSocket(url);
  w.onopen = () => res(w);
  w.onerror = () => rej(new Error('ws connect failed'));
});
const timer = setTimeout(() => { console.error('ws smoke FAILED: timeout'); process.exit(1); }, 10000);
const [a, b] = [await open(), await open()];
b.onmessage = (e) => { console.log('ws smoke ok:', e.data); clearTimeout(timer); process.exit(0); };
a.send('smoke');
