# assets-src
Drop raw art/audio here (`tex/`, `models/`, `sfx/`, `music/`). Run `npm run assets` → optimized files in `public/assets/` (commit both).
- png/jpg → webp (≤2048px, q82) · glb → meshopt + quantized + webp textures (≤1024px) · audio → opus .ogg (music 96k, sfx 64k mono)
- GLBs need `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)` (from `three/examples/jsm/libs/meshopt_decoder.module.js`).
- Needs ffmpeg: if `ffmpeg-static` didn't download (blocked install script) run `node node_modules/ffmpeg-static/install.js`.
- Keep the initial download small: load big assets lazily and report progress via `onProgress`.
