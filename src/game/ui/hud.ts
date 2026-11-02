import type { SimState } from '@shared/types';
import { BOSSES } from '@sim/content/enemies';
import { upgradeDef } from '@sim/content/upgrades';
import { iconSvg } from '../art/icons';
const SVG = (d: string, c: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:${c}">${d}</svg>`;
const ICONS: Record<string, string> = {
  ember_bolt: SVG('<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-7 1-10z" fill="#ff8a3a55"/>', '#ff8a3a'),
  orbit_blades: SVG('<circle cx="12" cy="12" r="2" fill="#9fe8ff"/><path d="M12 3l2 4h-4zM20 15l-4-1 2-3zM4 15l4-1-2-3z" fill="#9fe8ff88"/><circle cx="12" cy="12" r="8" stroke-dasharray="2 3"/>', '#9fe8ff'),
  frost_nova: SVG('<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2"/>', '#7fc8ff'),
  chain_lightning: SVG('<path d="M13 2L5 14h6l-2 8 9-13h-6z" fill="#ffe85a55"/>', '#ffe85a'),
  might: SVG('<path d="M12 21V7M6 13l6-6 6 6M7 20h10"/>', '#ff6a5a'),
  haste: SVG('<path d="M7 3h10M7 21h10M8 3c0 6 8 6 8 9s-8 3-8 9" />', '#ffd35a'),
  speed: SVG('<path d="M6 7l5 5-5 5M13 7l5 5-5 5"/>', '#8affc1'),
  magnet: SVG('<path d="M5 3v9a7 7 0 0 0 14 0V3h-4v9a3 3 0 0 1-6 0V3z"/>', '#c9a8ff'),
  hp: SVG('<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" fill="#ff5a7a55"/>', '#ff5a7a'),
};
const BASE = { damageMult: 1.15, cooldownMult: 0.9, moveSpeed: 1.1, pickupRadius: 1.35 } as const;
const BASE0 = { damageMult: 1, cooldownMult: 1, moveSpeed: 6, pickupRadius: 2.5 };
/** Passive stack counts derived from stats (sim doesn't track a passive list). */
function passives(st: Record<string, number>, maxHp: number): [string, number][] {
  const n = (k: keyof typeof BASE, id: string): [string, number] => [id, Math.round(Math.log(st[k] / BASE0[k]) / Math.log(BASE[k]))];
  return ([n('damageMult', 'might'), n('cooldownMult', 'haste'), n('moveSpeed', 'speed'), n('pickupRadius', 'magnet'), ['hp', Math.round((maxHp - 100) / 25)]] as [string, number][]).filter(x => x[1] > 0);
}
/** HUD + level-up cards. DOM overlay inside the game's own ui div. Gameplay/UI owner extends (lantern style, Rajdhani). */
export function mountHud(root: HTMLElement, onChoose: (i: number) => void) {
  const css = document.createElement('style');
  css.textContent = `.hud-top{position:absolute;left:0;right:0;top:0;padding:10px 14px;font:600 15px Rajdhani,system-ui,sans-serif;text-shadow:0 1px 3px #000;display:flex;gap:16px;align-items:center}
  .bar{position:relative;height:12px;width:220px;background:#0008;border:1px solid #fff4;border-radius:6px;overflow:hidden}.bar i{position:absolute;inset:0;width:0;border-radius:6px}
  .xpbar{position:absolute;left:0;right:0;bottom:0;height:8px;background:#0008}.xpbar i{display:block;height:100%;width:0;background:#4de8ff;box-shadow:0 0 10px #4de8ff}
  .cards{position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:22px;background:#000a;pointer-events:auto}
  .card{width:220px;padding:26px 18px;background:linear-gradient(#2a2538,#17141f);border:2px solid #ffc857;border-radius:12px;text-align:center;cursor:pointer;font-family:Rajdhani,system-ui,sans-serif;transition:transform .12s;box-shadow:0 0 22px #ffc85755}
  .card:hover{transform:translateY(-8px) scale(1.04)}.card h3{margin:0 0 10px;font-size:26px;color:#ffc857}.card p{margin:0;font-size:17px;color:#ddd}.card small{opacity:.6}
  .gear{position:absolute;left:14px;top:40px;display:flex;flex-direction:column;gap:6px}.gear-row{display:flex;gap:6px;min-height:34px}
  .gi{position:relative;width:34px;height:34px;border-radius:7px;background:linear-gradient(#262035,#14111c);border:1.5px solid #ffc857aa;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px #0008}
  .gi.p{border-color:#4de8ffaa;width:28px;height:28px}.gi svg{width:78%;height:78%;filter:drop-shadow(0 0 3px currentColor)}
  .gi .pips{position:absolute;left:3px;right:3px;bottom:2px;display:flex;gap:2px;justify-content:center}.gi .pips b{flex:1;max-width:5px;height:3px;border-radius:2px;background:#ffffff33}.gi .pips b.on{background:#ffc857;box-shadow:0 0 4px #ffc857}
  .gi .n{position:absolute;right:-4px;top:-5px;font:700 12px Rajdhani,system-ui,sans-serif;background:#4de8ff;color:#06222a;border-radius:8px;padding:0 4px;line-height:15px}
  .boss{position:absolute;left:50%;top:44px;transform:translateX(-50%);width:min(620px,74vw);text-align:center;pointer-events:none}
  .boss .bn{font:700 22px Rajdhani,system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase;color:#ffb199;text-shadow:0 0 12px #ff3a2a,0 2px 3px #000;margin-bottom:5px}
  .boss .bt{position:relative;height:16px;background:#12060acc;border:2px solid #b8362a;border-radius:3px;box-shadow:0 0 18px #ff3a2a55,inset 0 0 8px #000;overflow:hidden;clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,10px 100%,0 50%)}
  .boss .lag{position:absolute;inset:0;width:100%;background:#ffd9cf;opacity:.6}.boss .fill{position:absolute;inset:0;width:100%;background:linear-gradient(#ff6a4a,#c4180d 60%,#7a0b0b)}
  .boss .fill::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 40%,#fff5 50%,transparent 60%);animation:bshine 3s linear infinite}
  .boss .notch{position:absolute;top:0;bottom:0;width:2px;background:#0009}
  @keyframes bshine{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
  .cards h2{position:absolute;top:12%;margin:0;font:700 44px Rajdhani,system-ui,sans-serif;color:#4de8ff;text-shadow:0 0 18px #4de8ff}`;
  const top = document.createElement('div'); top.className = 'hud-top';
  top.innerHTML = '<div class="bar"><i style="background:#e0453a"></i></div><span id="h-lv"></span><span id="h-info"></span>';
  const xp = document.createElement('div'); xp.className = 'xpbar'; xp.innerHTML = '<i></i>';
  const cards = document.createElement('div'); cards.className = 'cards';
  const gear = document.createElement('div'); gear.className = 'gear'; gear.innerHTML = '<div class="gear-row" id="gw"></div><div class="gear-row" id="gp"></div>';
  const gw = gear.querySelector('#gw') as HTMLElement, gp = gear.querySelector('#gp') as HTMLElement; let gearKey = '';
  const boss = document.createElement('div'); boss.className = 'boss'; boss.style.display = 'none';
  boss.innerHTML = '<div class="bn"></div><div class="bt"><i class="lag"></i><i class="fill"></i><i class="notch" style="left:50%"></i><i class="notch" style="left:25%"></i></div>';
  root.append(css, top, gear, xp, cards, boss); const bn = boss.querySelector('.bn') as HTMLElement, bf = boss.querySelector('.fill') as HTMLElement, bl = boss.querySelector('.lag') as HTMLElement; let lag = 100;
  const hp = top.querySelector('.bar i') as HTMLElement, lv = top.querySelector('#h-lv')!, info = top.querySelector('#h-info')!, xpi = xp.firstChild as HTMLElement;
  let shown = '';
  const pick = (i: number) => onChoose(i);
  addEventListener('keydown', e => { if (cards.style.display === 'flex' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) pick(+e.code.slice(5) - 1); });
  return { update(s: SimState, fps: number) {
    const p = s.players[0];
    hp.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%'; xpi.style.width = Math.min(100, p.xp / p.xpToNext * 100) + '%';
    lv.textContent = `LV ${p.level}`; info.textContent = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}   ☠ ${s.kills}   ${fps.toFixed(0)}fps`;
    if (s.boss) { boss.style.display = 'block'; bn.textContent = BOSSES[s.boss.id]?.name ?? 'Boss'; const pct = Math.max(0, s.enemies.hp[s.boss.idx] / s.boss.maxHp * 100);
      lag = pct >= lag ? pct : Math.max(pct, lag - 0.35); bf.style.width = pct + '%'; bl.style.width = lag + '%'; } else { boss.style.display = 'none'; lag = 100; }
    const ps = passives(p.stats, p.maxHp), gk = p.weapons.map(w => w.id + w.level).join() + '|' + ps.join();
    if (gk !== gearKey) { gearKey = gk;
      gw.innerHTML = p.weapons.map(w => `<div class="gi" title="${upgradeDef('w:' + w.id)?.name ?? w.id} Lv ${w.level}">${ICONS[w.id] ?? ''}<div class="pips">${Array.from({ length: Math.max(5, w.level) }, (_, i) => `<b class="${i < w.level ? 'on' : ''}"></b>`).join('')}</div></div>`).join('');
      gp.innerHTML = ps.map(([id, c]) => `<div class="gi p" title="${upgradeDef('p:' + id)?.name ?? id} x${c}">${ICONS[id] ?? ''}${c > 1 ? `<span class="n">${c}</span>` : ''}</div>`).join(''); }
    const key = s.phase === 'levelUp' ? s.levelChoices.join() : '';
    if (key !== shown) { shown = key;
      if (!key) cards.style.display = 'none';
      else { cards.style.display = 'flex'; cards.innerHTML = '<h2>LEVEL UP</h2>'; s.levelChoices.forEach((id, i) => {
        const u = upgradeDef(id), w = p.weapons.find(w => 'w:' + w.id === id), c = document.createElement('div'); c.className = 'card';
        c.innerHTML = `<div style="filter:drop-shadow(0 0 10px #0008);margin-bottom:6px">${iconSvg(id)}</div><h3>${u.name}</h3><p>${u.desc}</p><br><small>${w ? 'Lv ' + w.level + ' → ' + (w.level + 1) : 'Press ' + (i + 1)}</small>`;
        c.onclick = () => pick(i); cards.appendChild(c); }); }
    }
  } };
}
