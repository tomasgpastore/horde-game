import { Game } from './game';
export interface Settings { volume: number; music: number; sfx: number; quality: 'low' | 'med' | 'high'; shake: boolean | number }
export interface ShellInput { move: { x: number; y: number }; touch: boolean }
export interface GameApi { start(o: { mode: 'solo' | 'coop' }): void; pause(): void; resume(): void; quit(): void; applySettings(s: Settings): void }

/** Shell contract. Heavy init (assets, shaders) should report via onProgress. */
export default async function createGame(o: { canvasParent: HTMLElement; onProgress: (p: number) => void; settings: Settings; input: ShellInput }): Promise<GameApi> {
  o.onProgress(0.1);
  const game = new Game(o.canvasParent, o.input, o.settings);
  o.onProgress(1);
  return {
    start: ({ mode }) => game.start(mode),
    pause: () => game.pause(), resume: () => game.resume(), quit: () => game.quit(),
    applySettings: (s) => game.applySettings(s),
  };
}
