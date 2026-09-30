import type {
  Difficulty,
  MinigameInput,
  MinigameType,
} from "../types.ts";

export type Random = () => number;
export interface MinigameParticipant {
  id: string;
  isBot: boolean;
  difficulty: Difficulty;
}
export interface MinigameCreateContext {
  participants: MinigameParticipant[];
  startedAt: number;
  endsAt: number;
  random: Random;
}
export interface TimedInput<I> {
  input: I;
  at: number;
}
// Contract every minigame module implements. The match flow only calls these hooks and consumes the
// ranking; it never reads the minigame's own state. `S` is the module's authoritative runtime state and
// `I` its parsed client input. All hooks run on the authority; clients receive `publicView` only.
export interface MinigameDefinition<S = unknown, I = unknown> {
  id: string;
  name: string;
  description: string;
  instructions: string[];
  controls: string;
  durationSeconds: number;
  gameType: MinigameType;
  supportsBots: boolean;
  create(context: MinigameCreateContext): S;
  // Strictly parses an untrusted input record; null means "reject".
  parseInput(input: MinigameInput): I | null;
  // Validates and applies one input at server time `at`. Throws on rejection without mutating.
  applyInput(state: S, playerId: string, input: I, at: number): void;
  // Per-minigame bot controller: returns inputs that are due by `now`. May update its own plan in `state`.
  botInputs?(
    state: S,
    bot: MinigameParticipant,
    now: number,
    random: Random,
  ): TimedInput<I>[];
  scores(state: S): Record<string, number>;
  // Participants ordered best first. Must be a total order (use `random` as the final tiebreaker).
  rank(state: S, participants: readonly string[], random: Random): string[];
  // What clients may see at `now` (no hidden schedules or bot plans).
  publicView(state: S, now: number): unknown;
  // Realtime minigames (physics, moving hazards) advance their own simulation to server time `now` in
  // fixed steps. Returns whether anything changed. Called before every input and on every server tick.
  tick?(state: S, now: number): boolean;
  // Early completion (for example "first to 3 points"); otherwise the minigame runs until `endsAt`.
  isFinished?(state: S): boolean;
  // Snapshot cadence while this minigame runs. Realtime games need more than the default batching.
  snapshotIntervalMs?: number;
}
