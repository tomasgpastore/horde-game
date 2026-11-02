import type { NetSession, PlayerInput } from '@shared/types';
/** In-process session (solo). Netcode Engineer: add WsSession implementing NetSession (authoritative server runs same @sim code in Node). */
export class LocalSession implements NetSession {
  localPlayerId = 0; private last: PlayerInput | null = null;
  sendInput(_t: number, i: PlayerInput) { this.last = i; }
  inputsFor() { return this.last ? [this.last] : null; }
  close() {}
}
