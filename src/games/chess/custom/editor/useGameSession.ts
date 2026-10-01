import { useCallback, useEffect, useState } from "react";
import type { AiKind } from "../engine/ai.ts";
import { applyMove, createGameState, moveNotation } from "../engine/game.ts";
import type { GameState, GameVariant, Move, PositionSetup, TeamId } from "../engine/types.ts";
import { requestAiMove } from "./aiClient.ts";

export type PlayerKind = "human" | AiKind;

export interface SessionFrame {
  state: GameState;
  move?: Move;
  notation?: string;
  team?: TeamId;
}

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;
const MAX_FRAMES = 1500;
const BASE_DELAY_MS = 900;

/**
 * A playable game with full history. Frames are complete snapshots, so stepping
 * back/forward, jumping to any move and branching from the past are exact.
 * `sessionKey` restarts the session whenever the variant or setup is swapped.
 */
export function useGameSession({
  variant,
  setup,
  sessionKey,
  players,
  speed,
}: {
  variant: GameVariant;
  setup: PositionSetup;
  sessionKey: string;
  players: Record<TeamId, PlayerKind>;
  speed: number;
}) {
  const [session, setSession] = useState(() => ({ key: sessionKey, frames: [{ state: createGameState(variant, setup) }] as SessionFrame[], cursor: 0 }));
  const [playing, setPlaying] = useState(false);

  if (session.key !== sessionKey) {
    setSession({ key: sessionKey, frames: [{ state: createGameState(variant, setup) }], cursor: 0 });
    setPlaying(false);
  }

  const { frames, cursor } = session;
  const current = frames[cursor].state;
  const atEnd = cursor === frames.length - 1;
  const humanInvolved = variant.teams.some((team) => (players[team.id] ?? "human") === "human");
  const turnPlayer: PlayerKind = players[current.turn] ?? "human";
  const aiToMove = !current.result && turnPlayer !== "human";

  const play = useCallback(
    (move: Move) => {
      setSession((previous) => {
        const before = previous.frames[previous.cursor].state;
        const after = applyMove(variant, before, move);
        const frame: SessionFrame = { state: after, move, notation: moveNotation(variant, before, move, after), team: before.turn };
        const frames = [...previous.frames.slice(0, previous.cursor + 1), frame].slice(-MAX_FRAMES);
        return { ...previous, frames, cursor: frames.length - 1 };
      });
    },
    [variant],
  );

  const jumpTo = useCallback((index: number) => {
    setSession((previous) => ({ ...previous, cursor: Math.max(0, Math.min(previous.frames.length - 1, index)) }));
  }, []);

  const restart = useCallback(() => {
    setPlaying(false);
    setSession((previous) => ({ ...previous, frames: [{ state: createGameState(variant, setup) }], cursor: 0 }));
  }, [variant, setup]);

  // Playback: replay recorded frames, then let AI players continue.
  useEffect(() => {
    const delay = BASE_DELAY_MS / speed;
    if (!atEnd && playing) {
      const timer = window.setTimeout(() => jumpTo(cursor + 1), delay);
      return () => window.clearTimeout(timer);
    }
    if (!atEnd || !aiToMove) return;
    // AI moves on its own when a human is playing; AI-vs-AI waits for Play.
    if (!humanInvolved && !playing) return;
    let request: ReturnType<typeof requestAiMove> | null = null;
    let cancelled = false;
    let playTimer: number | undefined;
    const started = Date.now();
    const minimumDelay = humanInvolved ? Math.max(250, delay * 0.6) : delay;
    const timer = window.setTimeout(() => {
      request = requestAiMove(variant, current, turnPlayer as AiKind);
      request.promise.then((move) => {
        if (!move || cancelled) return;
        // Searching AIs may already have used the delay while thinking.
        const wait = Math.max(0, minimumDelay - (Date.now() - started));
        playTimer = window.setTimeout(() => {
          if (!cancelled) play(move);
        }, wait);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(playTimer);
      request?.cancel();
    };
  }, [atEnd, aiToMove, playing, humanInvolved, speed, cursor, current, variant, turnPlayer, play, jumpTo]);

  const isPlaying = playing && (!atEnd || (aiToMove && !humanInvolved));

  return {
    frames,
    cursor,
    current,
    atEnd,
    aiToMove,
    humanToMove: !current.result && !aiToMove && atEnd,
    playing: isPlaying,
    setPlaying,
    play,
    jumpTo,
    restart,
    back: () => jumpTo(cursor - 1),
    forward: () => jumpTo(cursor + 1),
    toEnd: () => jumpTo(frames.length - 1),
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
