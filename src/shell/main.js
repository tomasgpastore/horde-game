import './shell.css';
const $ = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
const root = document.getElementById('shell');
const DEF = { volume: 0.8, music: 0.7, sfx: 0.9, quality: 'med', shake: true };
let settings = { ...DEF, ...JSON.parse(localStorage.getItem('eh-settings') || '{}') };
const save = () => localStorage.setItem('eh-settings', JSON.stringify(settings));
const input = { move: { x: 0, y: 0 }, dash: false, touch: matchMedia('(pointer:coarse)').matches };
if (input.touch) document.body.classList.add('touch');
window.__input = input;

const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();

const mk = (cls, html) => { const e = $(`<div class="screen ${cls}">${html}</div>`); root.appendChild(e); return e; };
const show = (...s) => { for (const e of Object.values(screens)) e.classList.add('hidden'); s.forEach(e => screens[e].classList.remove('hidden')); };

const screens = {
  loading: mk('', `<h1>EMBERHORDE</h1><div class="bar"><i></i></div><div class="tag" id="ltxt">Loading…</div><div class="hints" id="tip"></div>`),
  menu: mk('hidden', `<h1>EMBERHORDE</h1><p class="tag">Survive the swarm. Build the impossible.</p>
    <button class="btn primary" data-a="play">Play</button><button class="btn" data-a="coop">Co-op</button>
    <button class="btn" data-a="settings">Settings</button><button class="btn" data-a="credits">Credits</button>
    <div class="hints" id="hints"></div>`),
  settings: mk('hidden', `<div class="panel"><h2>Settings</h2>
    <label>Master volume<input type="range" min="0" max="1" step=".05" data-k="volume"></label>
    <label>Music<input type="range" min="0" max="1" step=".05" data-k="music"></label>
    <label>SFX<input type="range" min="0" max="1" step=".05" data-k="sfx"></label>
    <label>Quality<select data-k="quality"><option value="low">Low</option><option value="med">Medium</option><option value="high">High</option></select></label>
    <label>Screen shake<input type="checkbox" data-k="shake"></label>
    <button class="btn" data-a="back">Back</button></div>`),
  credits: mk('hidden', `<div class="panel"><h2>Credits</h2><p>Made by a studio of 15 AI agents.<br>Built with Three.js &amp; Vite.<br>Assets: see in-repo CREDITS.md.</p><button class="btn" data-a="back">Back</button></div>`),
  pause: mk('hidden clear', `<h2>Paused</h2><button class="btn primary" data-a="resume">Resume</button><button class="btn" data-a="psettings">Settings</button><button class="btn" data-a="quit">Quit to menu</button>`),
  over: mk('hidden clear', `<h1 style="font-size:64px">You fell</h1><p class="tag" id="score"></p><button class="btn primary" data-a="play">Try again</button><button class="btn" data-a="quit">Menu</button>`),
  nogl: mk('hidden', `<h1>EMBERHORDE</h1><p class="err">Your browser can't run WebGL, which this game needs. Try a recent Chrome, Firefox, Edge or Safari, and make sure hardware acceleration is enabled.</p>`),
};
const pauseBtn = $('<button id="pausebtn" aria-label="Pause">❚❚</button>'); root.appendChild(pauseBtn);
const stick = $('<div id="stick"><b></b></div>'); root.appendChild(stick);
const dashBtn = $('<button id="dashbtn">DASH</button>'); root.appendChild(dashBtn); dashBtn.addEventListener('pointerdown', () => { input.dash = true; });

screens.menu.querySelector('#hints').innerHTML = input.touch
  ? 'Drag the left stick to move · weapons fire automatically'
  : '<kbd>WASD</kbd> / arrows move · mouse aim · <kbd>Esc</kbd> pause · gamepad supported';

// settings UI
const syncSettings = () => screens.settings.querySelectorAll('[data-k]').forEach(el => {
  const v = settings[el.dataset.k]; el.type === 'checkbox' ? (el.checked = v) : (el.value = v); });
screens.settings.addEventListener('input', e => { const el = e.target, k = el.dataset.k; if (!k) return;
  settings[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value; save(); game?.applySettings(settings); });
syncSettings();

// virtual stick
{ let id = null; const knob = stick.firstChild, R = 55;
  const set = (e) => { const r = stick.getBoundingClientRect(); let x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    const d = Math.hypot(x, y); if (d > R) { x *= R / d; y *= R / d; }
    knob.style.transform = `translate(${x}px,${y}px)`; input.move.x = x / R; input.move.y = y / R; };
  stick.addEventListener('pointerdown', e => { id = e.pointerId; stick.setPointerCapture(id); set(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
  const end = e => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; input.move.x = input.move.y = 0; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end); }

// gamepad -> input.move; touch stick takes priority while held
let padActive = false;
(function pad() { const p = [...(navigator.getGamepads?.() || [])].find(Boolean);
  if (p) { const dz = v => Math.abs(v) < .15 ? 0 : v; const x = dz(p.axes[0]), y = dz(p.axes[1]);
    if (x || y) { input.move.x = x; input.move.y = y; padActive = true; } else if (padActive) { input.move.x = input.move.y = 0; padActive = false; }
    const b = p.buttons; if (b[0]?.pressed || b[1]?.pressed || b[5]?.pressed) input.dash = true;
    const s = b[9]?.pressed; if (s && !pad.s) toggle(); pad.s = s; }
  requestAnimationFrame(pad); })();

let game = null, state = 'loading', mode = 'solo';
const setState = (s) => { state = s; document.body.classList.toggle('playing', s === 'playing'); };
function toggle() { if (state === 'playing') { game.pause(); setState('paused'); show('pause'); } else if (state === 'paused') resume(); }
function resume() { game.resume(); setState('playing'); show(); }

root.addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
  if (a === 'play' || a === 'coop') { mode = a === 'coop' ? 'coop' : 'solo'; show(); game.quit(); game.start({ mode }); setState('playing'); }
  else if (a === 'settings') { show('settings'); screens.settings.dataset.from = 'menu'; }
  else if (a === 'psettings') { show('settings'); screens.settings.dataset.from = 'pause'; }
  else if (a === 'credits') show('credits');
  else if (a === 'back') show(screens.settings.dataset.from === 'pause' && !screens.settings.classList.contains('hidden') && state === 'paused' ? 'pause' : 'menu');
  else if (a === 'resume') resume();
  else if (a === 'quit') { game.quit(); setState('menu'); show('menu'); }
});
pauseBtn.addEventListener('click', toggle);
addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'p') toggle(); });
addEventListener('blur', () => { if (state === 'playing') toggle(); });
addEventListener('game:over', (e) => { setState('over'); screens.over.querySelector('#score').textContent = e.detail ? `Score ${e.detail.score ?? ''} · ${Math.round(e.detail.time ?? 0)}s` : ''; show('over'); });

const TIPS=['Standing still is how you die.','Weapons that fit together beat weapons that are strong.'];
screens.loading.querySelector('#tip').textContent=TIPS[Math.random()*TIPS.length|0];
// boot
(async () => {
  if (!webgl) return show('nogl');
  const bar = screens.loading.querySelector('.bar i'), txt = screens.loading.querySelector('#ltxt');
  try {
    const { default: createGame } = await import('../game/index.js');
    txt.textContent = 'Loading assets…';
    game = await createGame({ canvasParent: document.getElementById('game'), settings, input,
      onProgress: p => { bar.style.width = (p * 100).toFixed(0) + '%'; txt.textContent = `Loading… ${(p * 100) | 0}%`; } });
    bar.style.width = '100%'; setState('menu'); show('menu');
  } catch (err) { console.error(err); txt.textContent = 'Failed to load. Please refresh.'; }
})();
