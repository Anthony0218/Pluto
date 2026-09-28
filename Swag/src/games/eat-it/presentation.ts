import { EAT } from './config.ts';
import { movePlayer } from './engine.ts';
import { clamp } from './maps.ts';
import { angleDelta } from './rules.ts';
import type { GameState, Input, Player } from './types.ts';

type Frame = { state: GameState; receivedAt: number };
/** Presentation only: authoritative state and all rewards remain untouched. */
export class SnapshotBuffer {
  private frames: Frame[] = [];
  push(state: GameState, receivedAt: number): void {
    const last = this.frames.at(-1);
    if (last?.state.id !== state.id) this.frames = [];
    else if (last && (state.time < last.state.time || receivedAt < last.receivedAt)) return;
    else if (last && state.time === last.state.time) { last.state = state; return; }
    this.frames.push({ state, receivedAt });
    if (this.frames.length > EAT.network.maxSnapshots) this.frames.shift();
  }
  get size() { return this.frames.length; }
  sample(now: number, localId: string, input: Input): GameState {
    const latest = this.frames.at(-1);
    if (!latest) throw new Error('No authoritative snapshot');
    const state = latest.state;
    if (state.status === 'finished') return state;
    const renderAt = now - EAT.network.interpolationMs;
    let before = this.frames[0], after = before;
    for (const frame of this.frames) {
      if (frame.receivedAt <= renderAt) before = frame;
      after = frame;
      if (frame.receivedAt >= renderAt) break;
    }
    const fraction = before === after ? 1 : clamp((renderAt - before.receivedAt) / (after.receivedAt - before.receivedAt), 0, 1);
    const project = (p: Player, seconds: number, intent: Input) => {
      const predicted = { ...p };
      while (seconds > 0.000001) {
        const dt = Math.min(seconds, 1 / EAT.network.tickRate);
        movePlayer(state, predicted, intent, dt); seconds -= dt;
      }
      return predicted;
    };
    return { ...state, players: state.players.map(p => {
      if (!p.alive) return p;
      if (p.id === localId) {
        // Respond to local direction changes while awaiting the next input acknowledgement.
        // Only the transform is predicted; collisions with food/players are never simulated.
        const lead = clamp(now - latest.receivedAt + EAT.network.inputIntervalMs / 2, 0, EAT.network.maxExtrapolationMs) / 1000;
        return project(p, lead, input);
      }
      if (renderAt > latest.receivedAt) {
        const lead = Math.min(renderAt - latest.receivedAt, EAT.network.maxExtrapolationMs) / 1000;
        return project(p, lead, p.input);
      }
      const a = before.state.players.find(other => other.id === p.id) ?? p;
      const b = after.state.players.find(other => other.id === p.id) ?? p;
      return { ...p, x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction,
        facing: a.facing + angleDelta(a.facing, b.facing) * fraction };
    }) };
  }
}
