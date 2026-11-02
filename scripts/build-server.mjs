// Bundles the shared sim + netcode server into dist-server/net.mjs for Node (`ws` stays external; server/index.js owns it).
import { build } from 'esbuild';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'), a = (d) => path.join(root, 'src/game', d);
await build({
  entryPoints: [a('netcode/server.ts')], bundle: true, format: 'esm', platform: 'node', target: 'node22', outfile: path.join(root, 'dist-server/net.mjs'), logLevel: 'warning',
  alias: { '@shared': a('shared'), '@sim': a('sim'), '@net': a('netcode'), '@world': a('world'), '@engine': a('engine'), '@render': a('render') },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
