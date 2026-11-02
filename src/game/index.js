// STUB game — Engine Engineer replaces this. Contract documented in src/shell/README.md
import * as THREE from 'three';
export default async function createGame({ canvasParent, onProgress, settings }) {
  for (let i = 1; i <= 10; i++) { await new Promise(r => setTimeout(r, 120)); onProgress(i / 10); }
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  canvasParent.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d0b14);
  const cam = new THREE.PerspectiveCamera(60, 1, .1, 100); cam.position.set(0, 2, 5);
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshNormalMaterial({ flatShading: true }));
  scene.add(mesh);
  const resize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  let running = false, paused = false;
  renderer.setAnimationLoop(() => { if (!paused) mesh.rotation.y += .01; renderer.render(scene, cam); });
  return {
    start(opts) { running = true; paused = false; },
    pause() { paused = true; }, resume() { paused = false; },
    quit() { running = false; paused = false; },
    applySettings(s) {},
  };
}
