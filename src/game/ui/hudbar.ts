import type { SimState } from '@shared/types';
/** Top HUD (Artist): level badge + full-width XP bar, big timer, kills, segmented HP with heart, low-HP vignette. fps only with ?debug=1.
 *  Self-contained: mountTopHud(root) -> { update(state, fps) }. hud.ts keeps cards/gear/boss. */
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
const CSS = `.hud-top,.xpbar{display:none!important}.boss{top:76px!important}.gear{top:118px!important}
.tb-xp{position:absolute;left:0;right:0;top:0;height:11px;background:#06060ccc;border-bottom:1px solid #3df2ff44}
.tb-xp i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3df2ff,#9fe8ff 55%,#ffd35a);box-shadow:0 0 14px #3df2ff,0 0 4px #fff8;transition:width .15s}
.tb-xp.pulse{animation:tbpulse .9s ease-out}@keyframes tbpulse{0%{box-shadow:0 0 0 #3df2ff}30%{box-shadow:0 0 36px 8px #3df2ff;filter:brightness(1.8)}100%{box-shadow:0 0 0 #3df2ff}}
.tb-lv{position:absolute;left:12px;top:14px;width:58px;height:64px;display:flex;align-items:center;justify-content:center;font:700 26px Rajdhani,system-ui,sans-serif;color:#eaffff;text-shadow:0 0 10px #3df2ff;
  clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(#1a3a52,#0b1624);filter:drop-shadow(0 0 6px #3df2ff)}
.tb-lv::before{content:'';position:absolute;inset:3px;clip-path:inherit;background:linear-gradient(#10243a,#070d16);z-index:-1}.tb-lv b{position:relative}
.tb-lv small{position:absolute;top:8px;font:700 9px Rajdhani,system-ui,sans-serif;letter-spacing:.2em;color:#9fe8ff;opacity:.8}.tb-lv b{margin-top:8px}
.tb-hp{position:absolute;left:80px;top:34px;display:flex;align-items:center;gap:7px}
.tb-hp svg{width:26px;height:26px;filter:drop-shadow(0 0 5px #ff3355)}
.tb-segs{display:flex;gap:3px;padding:4px;background:#0a0610cc;border:2px solid #5a1a28;border-radius:6px;box-shadow:0 0 12px #000a}
.tb-segs i{width:20px;height:16px;background:#2a1018;transform:skewX(-14deg);border-radius:2px;transition:background .12s,box-shadow .12s}
.tb-segs i.on{background:linear-gradient(#ff6a80,#d81f3c);box-shadow:0 0 8px #ff3355aa}
.tb-hp.hit .tb-segs{border-color:#fff;animation:tbhit .35s}.tb-hp.hit .tb-segs i.on{background:#fff}@keyframes tbhit{50%{transform:translateX(3px)}}
.tb-hp.low .tb-segs i.on{animation:tblow .7s ease-in-out infinite}@keyframes tblow{50%{filter:brightness(1.7)}}
.tb-hpn{font:700 15px Rajdhani,system-ui,sans-serif;color:#ffd0d8;text-shadow:0 1px 3px #000;min-width:54px}
.tb-time{position:absolute;left:50%;top:16px;transform:translateX(-50%);font:700 46px Rajdhani,system-ui,sans-serif;letter-spacing:.06em;color:#fff;text-shadow:0 0 16px #3df2ff99,0 3px 0 #0008;font-variant-numeric:tabular-nums}
.tb-kills{position:absolute;right:20px;top:72px;display:flex;align-items:center;gap:7px;font:700 24px Rajdhani,system-ui,sans-serif;color:#ffe3d0;text-shadow:0 0 10px #ff6a2b99,0 2px 3px #000}
.tb-kills svg{width:22px;height:22px;filter:drop-shadow(0 0 5px #ff6a2b)}
.tb-dbg{position:absolute;right:20px;top:104px;font:600 12px monospace;color:#9fe8ff99}
.tb-vig{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(255,30,60,.55) 100%);transition:opacity .25s}
.tb-vig.on{opacity:1;animation:vigp 1s ease-in-out infinite}@keyframes vigp{50%{opacity:.45}}`;
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-1.5A5 5 0 0 1 22 8c0 3.500-3 7-10 13z" fill="#ff3355" stroke="#ffd0d8" stroke-width="1.2"/></svg>';
const SKULL = '<svg viewBox="0 0 24 24"><path d="M12 2C6.500 2 3 6 3 10.500c0 3 1.500 4.500 3 5.500V20h3v-2h2v2h2v-2h2v2h3v-4c1.500-1 3-2.500 3-5.500C21 6 17.500 2 12 2z" fill="#ffe3d0"/><circle cx="8.500" cy="11" r="2.200" fill="#2a0a0a"/><circle cx="15.500" cy="11" r="2.200" fill="#2a0a0a"/></svg>';
const SEGS = 10;
export function mountTopHud(root: HTMLElement) {
  const el = document.createElement('div'); el.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  el.innerHTML = `<style>${CSS}</style><div class="tb-vig"></div><div class="tb-xp"><i></i></div><div class="tb-lv"><small>LV</small><b>1</b></div>
  <div class="tb-hp">${HEART}<div class="tb-segs">${'<i></i>'.repeat(SEGS)}</div><span class="tb-hpn"></span></div>
  <div class="tb-time">0:00</div><div class="tb-kills">${SKULL}<span>0</span></div>${DEBUG ? '<div class="tb-dbg"></div>' : ''}`;
  root.prepend(el);
  const $ = (q: string) => el.querySelector(q) as HTMLElement, xpw = $('.tb-xp'), xpi = $('.tb-xp i'), lv = $('.tb-lv b'), hpw = $('.tb-hp'), segs = Array.from(el.querySelectorAll('.tb-segs i')) as HTMLElement[],
    hpn = $('.tb-hpn'), time = $('.tb-time'), kills = $('.tb-kills span'), vig = $('.tb-vig'), dbg = DEBUG ? $('.tb-dbg') : null;
  let lastLv = 1, lastHp = -1, hitT = 0, lastOn = -1;
  return { update(s: SimState, fps: number) {
    const p = s.players[0], f = Math.max(0, p.hp / p.maxHp), on = Math.ceil(f * SEGS - 1e-6);
    xpi.style.width = Math.min(100, p.xp / p.xpToNext * 100) + '%';
    if (p.level !== lastLv) { lastLv = p.level; lv.textContent = String(p.level); xpw.classList.remove('pulse'); void xpw.offsetWidth; xpw.classList.add('pulse'); }
    if (on !== lastOn) { segs.forEach((e, i) => e.classList.toggle('on', i < on)); lastOn = on; }
    if (lastHp >= 0 && p.hp < lastHp - 0.01) { hpw.classList.add('hit'); hitT = 0.35; }
    if (hitT > 0) { hitT -= 1 / 60; if (hitT <= 0) hpw.classList.remove('hit'); }
    lastHp = p.hp; hpw.classList.toggle('low', f < 0.35); vig.classList.toggle('on', f < 0.35 && !p.dead); hpn.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    time.textContent = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`; kills.textContent = String(s.kills);
    if (dbg) dbg.textContent = `${fps.toFixed(0)} fps`;
  } };
}
