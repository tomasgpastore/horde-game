import * as THREE from 'three';

const N = 64;
/** Pooled floating damage numbers (sprites). Textures cached per (text,crit). */
export class DamageNumbers {
  private sp: THREE.Sprite[] = []; private life = new Float32Array(N); private vy = new Float32Array(N); private head = 0;
  private cache = new Map<string, THREE.CanvasTexture>();
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < N; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, fog: false, toneMapped: false }));
      s.visible = false; s.renderOrder = 10; scene.add(s); this.sp.push(s);
    }
  }
  private tex(text: string, crit: boolean) {
    const key = text + (crit ? '!' : ''); let t = this.cache.get(key); if (t) return t;
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d')!;
    g.font = `bold ${crit ? 52 : 40}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#1a0a10'; g.strokeText(text, 64, 34); g.fillStyle = crit ? '#ffd23f' : '#ffffff'; g.fillText(text, 64, 34);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (this.cache.size > 400) this.cache.clear(); this.cache.set(key, t); return t;
  }
  spawn(x: number, z: number, dmg: number, crit: boolean) {
    const i = this.head; this.head = (this.head + 1) % N; const s = this.sp[i], m = s.material as THREE.SpriteMaterial;
    m.map = this.tex(String(Math.round(dmg)), crit); m.opacity = 1; m.needsUpdate = true;
    s.position.set(x + (Math.random() - 0.5) * 0.8, 1.8, z + (Math.random() - 0.5) * 0.4); const k = crit ? 2.4 : 1.7; s.scale.set(k, k / 2, 1);
    s.visible = true; this.life[i] = 0.7; this.vy[i] = crit ? 4.5 : 3;
  }
  update(dt: number) {
    for (let i = 0; i < N; i++) {
      const s = this.sp[i]; if (!s.visible) continue; this.life[i] -= dt;
      if (this.life[i] <= 0) { s.visible = false; continue; }
      s.position.y += this.vy[i] * dt; this.vy[i] *= Math.exp(-3 * dt); (s.material as THREE.SpriteMaterial).opacity = Math.min(1, this.life[i] * 4);
    }
  }
}
