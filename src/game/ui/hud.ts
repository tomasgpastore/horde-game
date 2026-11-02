import type { SimState } from '@shared/types';
import { upgradeDef } from '@sim/content/upgrades';
/** HUD + level-up cards. DOM overlay inside the game's own ui div. Gameplay/UI owner extends (lantern style, Rajdhani). */
export function mountHud(root: HTMLElement, onChoose: (i: number) => void) {
  const css = document.createElement('style');
  css.textContent = `.hud-top{position:absolute;left:0;right:0;top:0;padding:10px 14px;font:600 15px Rajdhani,system-ui,sans-serif;text-shadow:0 1px 3px #000;display:flex;gap:16px;align-items:center}
  .bar{position:relative;height:12px;width:220px;background:#0008;border:1px solid #fff4;border-radius:6px;overflow:hidden}.bar i{position:absolute;inset:0;width:0;border-radius:6px}
  .xpbar{position:absolute;left:0;right:0;bottom:0;height:8px;background:#0008}.xpbar i{display:block;height:100%;width:0;background:#4de8ff;box-shadow:0 0 10px #4de8ff}
  .cards{position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:22px;background:#000a;pointer-events:auto}
  .card{width:220px;padding:26px 18px;background:linear-gradient(#2a2538,#17141f);border:2px solid #ffc857;border-radius:12px;text-align:center;cursor:pointer;font-family:Rajdhani,system-ui,sans-serif;transition:transform .12s;box-shadow:0 0 22px #ffc85755}
  .card:hover{transform:translateY(-8px) scale(1.04)}.card h3{margin:0 0 10px;font-size:26px;color:#ffc857}.card p{margin:0;font-size:17px;color:#ddd}.card small{opacity:.6}
  .cards h2{position:absolute;top:12%;margin:0;font:700 44px Rajdhani,system-ui,sans-serif;color:#4de8ff;text-shadow:0 0 18px #4de8ff}`;
  const top = document.createElement('div'); top.className = 'hud-top';
  top.innerHTML = '<div class="bar"><i style="background:#e0453a"></i></div><span id="h-lv"></span><span id="h-info"></span>';
  const xp = document.createElement('div'); xp.className = 'xpbar'; xp.innerHTML = '<i></i>';
  const cards = document.createElement('div'); cards.className = 'cards';
  root.append(css, top, xp, cards);
  const hp = top.querySelector('.bar i') as HTMLElement, lv = top.querySelector('#h-lv')!, info = top.querySelector('#h-info')!, xpi = xp.firstChild as HTMLElement;
  let shown = '';
  const pick = (i: number) => onChoose(i);
  addEventListener('keydown', e => { if (cards.style.display === 'flex' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) pick(+e.code.slice(5) - 1); });
  return { update(s: SimState, fps: number) {
    const p = s.players[0];
    hp.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%'; xpi.style.width = Math.min(100, p.xp / p.xpToNext * 100) + '%';
    lv.textContent = `LV ${p.level}`; info.textContent = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}   ☠ ${s.kills}   ${fps.toFixed(0)}fps`;
    const key = s.phase === 'levelUp' ? s.levelChoices.join() : '';
    if (key !== shown) { shown = key;
      if (!key) cards.style.display = 'none';
      else { cards.style.display = 'flex'; cards.innerHTML = '<h2>LEVEL UP</h2>'; s.levelChoices.forEach((id, i) => {
        const u = upgradeDef(id), w = p.weapons.find(w => 'w:' + w.id === id), c = document.createElement('div'); c.className = 'card';
        c.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p><br><small>${w ? 'Lv ' + w.level + ' → ' + (w.level + 1) : 'Press ' + (i + 1)}</small>`;
        c.onclick = () => pick(i); cards.appendChild(c); }); }
    }
  } };
}
