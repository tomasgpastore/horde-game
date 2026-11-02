import { defineConfig } from 'vite';
import path from 'path';
const a = (d) => path.resolve(import.meta.dirname, 'src/game/' + d);
export default defineConfig({
  resolve: { alias: { '@shared': a('shared'), '@sim': a('sim'), '@engine': a('engine'), '@render': a('render'), '@world': a('world'), '@net': a('netcode'), '@ui': a('ui'), '@audio': a('audio') } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules/three')) return 'three'; } } } }, // three in its own long-cached chunk
  server: { allowedHosts: true },
  preview: { allowedHosts: true },
});
