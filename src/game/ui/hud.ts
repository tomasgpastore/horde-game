import type { SimState } from '@shared/types';
import { describeChoice, WEAPONS, PASSIVES } from '@sim/content';

const CSS = `
.eh{position:absolute;inset:0;pointer-events:none;font-family:'Rajdhani','Chakra Petch',system-ui,sans-serif;color:#e8f6ff;user-select:none}
.eh *{box-sizing:border-box}
.eh .xp{position:absolute;left:0;right:0;top:0;height:10px;background:rgba(10,14,30,.7)}
.eh .xp i{display:block;height:100%;width:0;background:linear-gradient(90deg,#19c9a5,#3df2ff);box-shadow:0 0 12px #3df2ff;transition:width .12s}
.eh .lv{position:absolute;top:14px;left:50%;transform:translateX(-50%);font-weight:700;font-size:20px;letter-spacing:.2em;text-shadow:0 0 10px #3df2ff}
.eh .tl{position:absolute;top:18px;left:16px;font-weight:600;font-size:18px;letter-spacing:.08em;text-shadow:0 2px 4px #000;line-height:1.35}
.eh .tl b{color:#ffd35a}
.eh .hp{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);width:min(420px,60vw);height:18px;border-radius:10px;background:rgba(10,14,30,.75);border:1px solid rgba(61,242,255,.45);overflow:hidden;box-shadow:0 0 16px rgba(61,242,255,.25)}
.eh .hp i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff3355,#ff6a2b);transition:width .1s}
.eh .hp span{position:absolute;inset:0;text-align:center;font-weight:700;font-size:13px;line-height:18px;text-shadow:0 1px 2px #000}
.eh .dash{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:140px;height:6px;border-radius:4px;background:rgba(10,14,30,.75);overflow:hidden}
.eh .dash i{display:block;height:100%;background:#3df2ff;box-shadow:0 0 8px #3df2ff}
.eh .inv{position:absolute;right:16px;top:18px;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.eh .pill{display:flex;gap:8px;align-items:center;padding:3px 10px;border-radius:14px;background:rgba(10,14,30,.7);border:1px solid var(--c);font-weight:600;font-size:14px;letter-spacing:.05em;box-shadow:0 0 10px color-mix(in srgb,var(--c) 40%,transparent)}
.eh .pill em{font-style:normal;color:var(--c);font-weight:700}
.eh .vig{position:absolute;inset:0;box-shadow:inset 0 0 160px rgba(255,51,85,0);transition:box-shadow .25s}
.eh .vig.hurt{box-shadow:inset 0 0 160px rgba(255,51,85,.6);transition:none}
.eh .lvl{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:22px;background:radial-gradient(ellipse at center,rgba(13,15,26,.55),rgba(13,15,26,.88));pointer-events:auto;animation:ehf .25s ease-out}
.eh .lvl.on{display:flex}
.eh .lvl h2{margin:0;font-size:44px;letter-spacing:.35em;color:#ffd35a;text-shadow:0 0 24px rgba(255,211,90,.7);font-weight:700}
.eh .cards{display:flex;gap:22px;flex-wrap:wrap;justify-content:center;padding:0 16px}
.eh .card{width:230px;min-height:290px;padding:20px 18px;border-radius:16px;background:linear-gradient(180deg,rgba(23,26,46,.96),rgba(13,15,26,.96));border:2px solid var(--c);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;box-shadow:0 0 22px color-mix(in srgb,var(--c) 35%,transparent);transition:transform .15s,box-shadow .15s;animation:ehu .35s cubic-bezier(.2,1.4,.4,1) backwards}
.eh .card:nth-child(2){animation-delay:.07s}.eh .card:nth-child(3){animation-delay:.14s}
.eh .card:hover{transform:translateY(-12px) scale(1.04);box-shadow:0 0 44px var(--c)}
.eh .card .ic{width:84px;height:84px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,var(--c) 45%,transparent 72%);box-shadow:0 0 30px var(--c);margin-top:6px}
.eh .card .nm{font-size:25px;font-weight:700;letter-spacing:.06em}
.eh .card .ds{font-size:17px;opacity:.85;line-height:1.25}
.eh .card .kd{font-size:12px;letter-spacing:.3em;color:var(--c);font-weight:700}
.eh .card .pips{display:flex;gap:5px;margin-top:auto}
.eh .card .pips u{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--c);background:transparent}
.eh .card .pips u.f{background:var(--c);box-shadow:0 0 8px var(--c)}
.eh .card .key{font-size:13px;opacity:.5;letter-spacing:.2em}
.eh .toast{position:absolute;top:22%;left:50%;transform:translateX(-50%);font-size:34px;font-weight:700;letter-spacing:.3em;color:#ff6a2b;text-shadow:0 0 20px #ff6a2b;opacity:0;transition:opacity .6s}
.eh .toast.on{opacity:1;transition:none}
@keyframes ehf{from{opacity:0}to{opacity:1}}@keyframes ehu{from{opacity:0;transform:translateY(40px) scale(.9)}to{opacity:1}}
`;
function el(tag: string, cls: string, parent: HTMLElement, html = '') { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; parent.appendChild(e); return e; }
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** DOM HUD. Reads SimState only. onPick(i) is called when the player chooses a level-up card (mouse click or keys 1-3). */
export function mountHud(root: HTMLElement, onPick: (i: number) => void = () => {}) {
  if (!document.getElementById('eh-font')) { const l = document.createElement('link'); l.id = 'eh-font'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&display=swap'; document.head.appendChild(l); }
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const r = el('div', 'eh', root);
  const vig = el('div', 'vig', r), xp = el('div', 'xp', r, '<i></i>'), xpI = xp.firstChild as HTMLElement;
  const lv = el('div', 'lv', r), tl = el('div', 'tl', r), inv = el('div', 'inv', r);
  const hp = el('div', 'hp', r, '<i></i><span></span>'), hpI = hp.firstChild as HTMLElement, hpT = hp.lastChild as HTMLElement;
  const dash = el('div', 'dash', r, '<i></i>'), dashI = dash.firstChild as HTMLElement;
  const toast = el('div', 'toast', r);
  const lvl = el('div', 'lvl', r, '<h2>LEVEL UP</h2><div class="cards"></div>'), cards = lvl.querySelector('.cards') as HTMLElement;
  let shown = '', invKey = '', lastHp = -1, toastT = 0, waveSeen = 0;
  const pick = (i: number) => { onPick(i); };
  addEventListener('keydown', e => { if (lvl.classList.contains('on') && e.code >= 'Digit1' && e.code <= 'Digit3') pick(Number(e.code.slice(5)) - 1); });
  return {
    update(s: SimState, fps: number) {
      const p = s.players[0]; if (!p) return;
      xpI.style.width = Math.min(100, p.xp / p.xpToNext * 100) + '%';
      lv.textContent = 'LV ' + p.level;
      tl.innerHTML = `${mmss(s.time)}<br>KILLS <b>${s.kills}</b>  GOLD <b>${s.gold}</b>${fps ? `<br><span style="opacity:.4;font-size:13px">${fps.toFixed(0)} fps · ${s.enemies.count}</span>` : ''}`;
      hpI.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%'; hpT.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
      dashI.style.width = (p.dashCooldown > 0 ? (1 - p.dashCooldown / 1.1) * 100 : 100) + '%'; dashI.style.opacity = p.dashCooldown > 0 ? '.45' : '1';
      if (lastHp >= 0 && p.hp < lastHp) { vig.classList.add('hurt'); requestAnimationFrame(() => requestAnimationFrame(() => vig.classList.remove('hurt'))); }
      lastHp = p.hp;
      // inventory pills (rebuild only on change)
      const key = p.weapons.map(w => w.id + w.level).join() + '|' + Object.keys(p.stats).filter(k => k.startsWith('lv_')).map(k => k + p.stats[k]).join();
      if (key !== invKey) { invKey = key; inv.innerHTML = '';
        for (const w of p.weapons) { const d = WEAPONS[w.id]; el('div', 'pill', inv, `${d.name} <em>${d.evolved ? 'MAX' : w.level}</em>`).style.setProperty('--c', '#' + d.color.toString(16).padStart(6, '0')); }
        for (const k of Object.keys(p.stats)) if (k.startsWith('lv_') && p.stats[k] > 0) { const d = PASSIVES[k.slice(3)]; el('div', 'pill', inv, `${d.name} <em>${p.stats[k]}</em>`).style.setProperty('--c', '#' + d.color.toString(16).padStart(6, '0')); } }
      // wave toast
      if (s.wave !== waveSeen) { if (s.wave > 1) { toast.textContent = 'WAVE ' + s.wave; toast.classList.add('on'); toastT = 1.2; } waveSeen = s.wave; }
      if (toastT > 0) { toastT -= 1 / 60; if (toastT <= 0) toast.classList.remove('on'); }
      // level-up cards
      const want = s.phase === 'levelUp' && p.choices.length ? p.choices.join() : '';
      if (want !== shown) { shown = want; cards.innerHTML = '';
        if (want) { lvl.classList.add('on'); p.choices.forEach((id, i) => { const c = describeChoice(p, id), col = '#' + c.color.toString(16).padStart(6, '0');
          const card = el('div', 'card', cards, `<div class="kd">${c.kind === 'evolve' ? 'EVOLUTION' : c.kind === 'weapon' ? (c.tier === 1 ? 'NEW WEAPON' : 'UPGRADE') : c.kind === 'passive' ? 'PASSIVE' : 'BOON'}</div><div class="ic"></div><div class="nm">${c.name}</div><div class="ds">${c.desc}</div><div class="pips">${Array.from({ length: c.maxTier }, (_, k) => `<u class="${k < c.tier ? 'f' : ''}"></u>`).join('')}</div><div class="key">[ ${i + 1} ]</div>`);
          card.style.setProperty('--c', col); card.addEventListener('click', () => pick(i)); }); }
        else lvl.classList.remove('on'); }
    },
  };
}
