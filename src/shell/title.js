// Live title-screen scene (lazy chunk). Own renderer+canvas behind the DOM menu. API: createTitle() -> {show, hide, transitionOut, reveal, dispose}
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const FOG = 0x1b1f3a, FLOOR = 0x0d0f1a, EMBER_A = new THREE.Color(0xff6a2b), EMBER_B = new THREE.Color(0xffd35a);
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

const EMBER_VS = `
attribute vec4 aSeed; attribute vec4 aProp; // seed: x,z in[-1,1], y phase, w speed | prop: size, flickerHz, flickerPhase, colorMix
uniform float uTime; varying vec2 vUv; varying float vLife; varying float vFlick; varying float vMix;
void main(){
  vUv = uv; vMix = aProp.w;
  #ifdef BOKEH
    float t = uTime*aSeed.w*0.25 + aSeed.y*6.2831;
    vec3 p = vec3(aSeed.x*5.0 + sin(t)*0.6, aSeed.z*3.0 + cos(t*1.3)*0.5, -3.0 - fract(aSeed.y*7.3)*7.0);
    vLife = 1.0;
    vFlick = 0.6 + 0.4*sin(uTime*aProp.y*0.5 + aProp.z*6.2831);
  #else
    float h = fract(aSeed.y + uTime*aSeed.w);
    vec3 p = vec3(aSeed.x*9.0, h*7.0, aSeed.z*9.0);
    p.x += sin(uTime*0.7 + aProp.z*6.2831 + h*5.0)*(0.3+h*0.9);
    p.z += cos(uTime*0.55 + aProp.z*9.0 + h*4.0)*(0.3+h*0.9);
    vLife = sin(3.14159*h);
    vFlick = 0.65 + 0.35*sin(uTime*aProp.y + aProp.z*6.2831);
  #endif
  vec4 mv = modelViewMatrix*vec4(p,1.0);
  mv.xy += position.xy*aProp.x*(0.4+0.6*vLife);
  gl_Position = projectionMatrix*mv;
}`;
const EMBER_FS = `
uniform vec3 uA; uniform vec3 uB; varying vec2 vUv; varying float vLife; varying float vFlick; varying float vMix;
void main(){
  float d = length(vUv-0.5)*2.0;
  #ifdef BOKEH
    float a = smoothstep(1.0,0.75,d)*(0.35+0.65*smoothstep(0.55,0.95,d))*0.22;
  #else
    float a = pow(smoothstep(1.0,0.0,d),2.2);
  #endif
  gl_FragColor = vec4(mix(uA,uB,vMix)*a*vFlick*vLife*1.6, a*vFlick*vLife);
}`;

function emberMesh(count, bokeh, uniforms) {
  const g = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1);
  g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
  const seed = new Float32Array(count * 4), prop = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seed.set([rnd(-1, 1), Math.random(), rnd(-1, 1), bokeh ? rnd(0.5, 1.5) : rnd(0.03, 0.09)], i * 4);
    prop.set([bokeh ? rnd(0.8, 2.2) : rnd(0.04, 0.16), rnd(4, 14), Math.random(), Math.random()], i * 4);
  }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4)); g.setAttribute('aProp', new THREE.InstancedBufferAttribute(prop, 4));
  g.instanceCount = count;
  const m = new THREE.ShaderMaterial({ vertexShader: EMBER_VS, fragmentShader: EMBER_FS, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, defines: bokeh ? { BOKEH: 1 } : {} });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh;
}

function runeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'); x.translate(512, 512);
  x.strokeStyle = '#6fe8ff'; x.fillStyle = '#6fe8ff'; x.lineWidth = 3;
  for (const r of [470, 380]) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'; x.font = '44px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < 24; i++) { x.save(); x.rotate(i / 24 * Math.PI * 2); x.fillText(glyphs[i], 0, -425); x.fillRect(-1.5, -470, 3, 18); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export async function createTitle({ onFallback } = {}) {
  const canvas = document.createElement('canvas'); canvas.id = 'title';
  const white = document.createElement('div'); white.id = 'whiteout'; const vig = document.createElement('div'); vig.id = 'vignette';
  document.body.prepend(canvas); document.body.append(vig, white);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const dpr = Math.min(devicePixelRatio || 1, 2); renderer.setPixelRatio(dpr); renderer.setClearColor(FOG);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(FOG, 0.055); scene.background = new THREE.Color(FOG);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80); scene.add(camera);
  const uniforms = { uTime: { value: 0 }, uA: { value: EMBER_A }, uB: { value: EMBER_B } };

  // floor + rune ring
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.95, metalness: 0 })); scene.add(floor);
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: runeTexture(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  ring.position.y = 0.02; scene.add(ring);

  // hero silhouette with lantern
  const hero = new THREE.Group(); const dark = new THREE.MeshStandardMaterial({ color: 0x16203a, roughness: 0.8, flatShading: true, emissive: 0x0b3a52, emissiveIntensity: 0.55 });
  const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); hero.add(m); return m; };
  add(new THREE.ConeGeometry(0.62, 1.8, 6), dark, 0, 0.9, 0); add(new THREE.IcosahedronGeometry(0.23, 0), dark, 0, 1.92, 0); add(new THREE.ConeGeometry(0.3, 0.5, 6), dark, 0, 2.1, -0.02);
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 5), dark, 0.42, 1.35, 0.18, 0.5, -0.5);
  add(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 5), dark, 0.7, 1.15, 0.45);
  const lantern = add(new THREE.OctahedronGeometry(0.17, 0), new THREE.MeshBasicMaterial({ color: 0x9ff4ff }), 0.7, 2.2, 0.45);
  const cyan = new THREE.PointLight(0x4fe0ff, 14, 9, 1.6); cyan.position.copy(lantern.position); hero.add(cyan);
  const warm = new THREE.PointLight(0xff8a3c, 6, 8, 1.8); warm.position.set(-0.6, 1.3, 0.9); hero.add(warm);
  // match the in-game hero: glowing hem ring + eyes, big lantern halo, cyan rim light from behind-left, 1.3x
  const cy = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x3df2ff).multiplyScalar(3), toneMapped: false });
  const hem = add(new THREE.TorusGeometry(0.66, 0.07, 4, 16), cy, 0, 0.06, 0, Math.PI / 2);
  add(new THREE.BoxGeometry(0.07, 0.05, 0.05), cy, -0.09, 1.9, 0.2); add(new THREE.BoxGeometry(0.07, 0.05, 0.05), cy, 0.09, 1.9, 0.2);
  { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(160,250,255,.7)'); gr.addColorStop(0.35, 'rgba(61,242,255,.45)'); gr.addColorStop(1, 'rgba(61,242,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); halo.scale.setScalar(0.85); halo.position.copy(lantern.position); hero.add(halo); }
  const rimL = new THREE.PointLight(0x3df2ff, 16, 12, 1.4); rimL.position.set(-1.6, 2.2, -1.4); hero.add(rimL);
  hero.scale.setScalar(1.3);
  scene.add(hero);
  scene.add(new THREE.HemisphereLight(0x39406e, 0x07080f, 0.7));
  const rim = new THREE.DirectionalLight(0xff6a2b, 2.2); scene.add(rim, rim.target);

  // enemies drifting at fog edge
  const eGeo = new THREE.OctahedronGeometry(0.7, 0).scale(0.9, 1.5, 0.9);
  const eMesh = new THREE.InstancedMesh(eGeo, new THREE.MeshStandardMaterial({ color: 0x15111f, emissive: 0x3a0d0a, roughness: 0.8, flatShading: true }), 9);
  const eData = Array.from({ length: 9 }, (_, i) => ({ a: i / 9 * 6.283 + rnd(-.2, .2), r: rnd(12, 15), s: rnd(0.02, 0.06) * (Math.random() < .5 ? -1 : 1), p: rnd(0, 6), sc: rnd(0.8, 1.5) }));
  scene.add(eMesh);
  scene.add(emberMesh(300, false, uniforms));
  const bokeh = emberMesh(9, true, uniforms); camera.add(bokeh);

  // post
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.8, 0.65, 0.15); composer.addPass(bloom); composer.addPass(new OutputPass());
  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 68 : 50; camera.updateProjectionMatrix(); setOffset(); };
  // wide: menu is left-aligned, hero sits at ~65% x; narrow/portrait: menu centred over a dimmed scene, hero above it
  function setOffset() { const w = innerWidth, h = innerHeight; if (w / h > 1.2) camera.setViewOffset(w, h, -w * 0.15, h * 0.04, w, h); else camera.setViewOffset(w, h, 0, h * 0.36, w, h); camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  const dummy = new THREE.Object3D(); const V = new THREE.Vector3(); let t = 0, last = 0, raf = 0, on = false, zoom = 0, zoomTarget = 0, frames = 0, bloomOn = true, acc = 0, win = 0, guardDone = false;
  const frame = (now) => {
    raf = requestAnimationFrame(frame); const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now; t += dt;
    zoom += (zoomTarget - zoom) * Math.min(1, dt * 3.5);
    const ang = t * 0.05, R = (11 + Math.sin(t * 0.1) * 0.9) * (1 - zoom * 0.7), el = 35 * Math.PI / 180;
    camera.position.set(Math.cos(ang) * R * Math.cos(el), R * Math.sin(el) * (1 - zoom * 0.3), Math.sin(ang) * R * Math.cos(el)); camera.lookAt(0, 1.5 + zoom * 0.5, 0);
    hero.position.y = Math.sin(t * 1.6) * 0.06; hero.rotation.y = Math.PI / 2 - ang + 0.6; /* 3/4 view toward camera */ lantern.rotation.y = t * 1.2;
    const f = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 31); warm.intensity = 6 * f; cyan.intensity = 14 * (0.93 + 0.07 * Math.sin(t * 4));
    ring.material.opacity = 0.26 + 0.08 * Math.sin(t * 0.8); ring.rotation.y = t * 0.02;
    camera.getWorldDirection(V); rim.position.set(-V.z * 6 - V.x * 5, 4, V.x * 6 - V.z * 5); rim.target.position.set(0, 1.5, 0);
    for (let i = 0; i < eData.length; i++) { const e = eData[i]; e.a += e.s * dt; const a = e.a, r = e.r + Math.sin(t * 0.3 + e.p) * 0.8;
      dummy.position.set(Math.cos(a) * r, 0.9 * e.sc + Math.sin(t * 0.9 + e.p) * 0.12, Math.sin(a) * r); dummy.rotation.set(0, -a + Math.sin(t * .4 + e.p) * .3, 0); dummy.scale.setScalar(e.sc); dummy.updateMatrix(); eMesh.setMatrixAt(i, dummy.matrix); }
    eMesh.instanceMatrix.needsUpdate = true; uniforms.uTime.value = t;
    bloom.strength = 0.8 + zoom * 1.6;
    bloomOn ? composer.render() : renderer.render(scene, camera);
    // perf guard: after a short warm-up, sample 12-frame windows; avg frame >40ms => drop bloom, then give up (static CSS bg)
    if (++frames > 10) { acc += dt; if (++win === 12) { const slow = acc / 12 > 0.04; acc = 0; win = 0; if (slow && !guardDone) { if (bloomOn) { bloomOn = false; frames = 6; } else { guardDone = true; dispose(); onFallback?.(); } } else if (frames > 60) guardDone = true; } }
  };
  const start = () => { if (on || document.hidden) return; on = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { on = false; cancelAnimationFrame(raf); };
  const vis = () => { if (!visible) return; document.hidden ? stop() : start(); };
  let visible = false; document.addEventListener('visibilitychange', vis);
  const show = () => { visible = true; zoom = zoomTarget = 0; canvas.style.display = vig.style.display = 'block'; white.classList.remove('on'); start(); };
  const hide = () => { visible = false; stop(); canvas.style.display = vig.style.display = 'none'; };
  const dispose = () => { hide(); document.removeEventListener('visibilitychange', vis); removeEventListener('resize', resize); renderer.dispose(); canvas.remove(); vig.remove(); white.remove(); };
  /** PLAY: zoom into the hero and white out; resolves when screen is fully white. */
  const transitionOut = () => new Promise(res => { zoomTarget = 1; setTimeout(() => white.classList.add('on'), 250); setTimeout(res, 800); });
  /** call after the game is running: fade the white away. */
  const reveal = () => { white.classList.remove('on'); setTimeout(hide, 20); };
  return { show, hide, transitionOut, reveal, dispose };
}
