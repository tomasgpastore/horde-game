import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, vig: { value: 0.55 }, hurt: { value: 0 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vig; uniform float hurt; uniform float time; varying vec2 vUv;
    void main(){
      vec2 c = vUv-0.5; float d = dot(c,c);
      vec2 off = c * d * 0.012; // subtle chromatic aberration at edges
      vec3 col = vec3(texture2D(tDiffuse, vUv+off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv-off).b);
      col *= 1.0 - smoothstep(0.12, 0.62, d) * vig;
      col = mix(col, col * vec3(1.6,0.45,0.4), hurt * smoothstep(0.05,0.4,d));
      gl_FragColor = vec4(col,1.0);
    }`,
};

/** HDR bloom + vignette/grade. Runs before OutputPass (tone mapping). */
export class PostFx {
  composer: EffectComposer; bloom: UnrealBloomPass; grade: ShaderPass; enabled = true;
  constructor(private r: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera) {
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(scene, cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.6, 1.0);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }
  setSize(w: number, h: number, pr: number) { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); }
  render(dt: number, time: number, hurt: number) {
    this.grade.uniforms.hurt.value = hurt; this.grade.uniforms.time.value = time;
    this.composer.render(dt);
  }
}
