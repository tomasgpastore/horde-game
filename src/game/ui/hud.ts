import type { SimState } from '@shared/types';
/** UI Owner (Gameplay/Web w/ Art direction): HUD, level-up cards, menus. DOM overlay, no framework needed. */
export function mountHud(root: HTMLElement) {
  const d = document.createElement('div'); d.style.cssText = 'position:absolute;left:12px;top:10px;font:600 14px monospace;text-shadow:0 1px 2px #000'; root.appendChild(d);
  return { update(s: SimState, fps: number) { const p = s.players[0]; d.textContent = `HP ${Math.ceil(p.hp)}/${p.maxHp}  LV ${p.level}  KILLS ${s.kills}  ENEMIES ${s.enemies.count}  ${fps.toFixed(0)}fps`; } };
}
