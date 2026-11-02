# Shell ↔ game contract
`src/game/index.js` default-exports `async createGame({canvasParent, onProgress(0..1), settings, input})`
returning `{start({mode:'solo'|'coop'}), pause(), resume(), quit(), applySettings(s)}`.
- `input` is the shell's InputState: `input.move {x,y}` (-1..1, from touch stick/gamepad), `input.touch` bool. Keyboard/mouse: game reads directly.
- Game may call `window.dispatchEvent(new CustomEvent('game:over',{detail:{score,time}}))` to show game over; `game:ready` is not needed.
- Shell never touches the canvas; the game must not touch #shell DOM.
- settings: `{volume, music, sfx, quality:'low'|'med'|'high', shake}` persisted in localStorage.
