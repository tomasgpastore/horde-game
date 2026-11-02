// Usage: npm run assets   (reads assets-src/**, writes public/assets/**, skips up-to-date files)
// png/jpg -> webp (max 2048px) | glb -> meshopt+webp textures, deduped/pruned | wav/mp3/flac -> ogg opus (~96k, mono for sfx/)
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import sharp from 'sharp'; import ffmpegStatic from 'ffmpeg-static';
const ffmpeg = ffmpegStatic && fs.existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg'; // run: node node_modules/ffmpeg-static/install.js if blocked
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, meshopt, textureCompress, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
const SRC = 'assets-src', OUT = 'public/assets';
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const fresh = (a, b) => fs.existsSync(b) && fs.statSync(b).mtimeMs >= fs.statSync(a).mtimeMs;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
let inB = 0, outB = 0;
for (const f of walk(SRC)) {
  if (f.endsWith('README.md')) continue;
  const rel = path.relative(SRC, f), ext = path.extname(f).toLowerCase(), base = rel.slice(0, -ext.length);
  let out = null, run = null;
  if (['.png', '.jpg', '.jpeg'].includes(ext)) { out = path.join(OUT, base + '.webp'); run = () => sharp(f).resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(out); }
  else if (ext === '.glb' || ext === '.gltf') { out = path.join(OUT, base + '.glb'); run = async () => {
    const doc = await io.read(f);
    await doc.transform(dedup(), prune(), weld(), resample(), quantize(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 80 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    await io.write(out, doc); }; }
  else if (['.wav', '.mp3', '.flac', '.ogg', '.m4a'].includes(ext)) { out = path.join(OUT, base + '.ogg');
    run = () => execFileSync(ffmpeg, ['-y', '-v', 'error', '-i', f, '-c:a', 'libopus', '-b:a', rel.startsWith('music') ? '96k' : '64k', ...(rel.startsWith('sfx') ? ['-ac', '1'] : []), out]); }
  else { out = path.join(OUT, rel); run = () => fs.copyFileSync(f, out); }
  if (fresh(f, out)) continue;
  fs.mkdirSync(path.dirname(out), { recursive: true }); await run();
  const a = fs.statSync(f).size, b = fs.statSync(out).size; inB += a; outB += b;
  console.log(`${rel} -> ${path.relative('.', out)}  ${(a / 1024) | 0}KB -> ${(b / 1024) | 0}KB`);
}
console.log(`done: ${(inB / 1024) | 0}KB -> ${(outB / 1024) | 0}KB`);
