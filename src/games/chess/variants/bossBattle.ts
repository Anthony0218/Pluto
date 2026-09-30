import { Chess, type Square } from "chess.js";

export type BossSide = "w" | "b";
export type BossWinner = "white" | "black" | "draw" | null;
export type BossPowerId = "shockwave" | "summon" | "dark_step";
export type BossTargetMode = "summon" | "dark_step" | null;

export type BossCooldowns = Record<BossPowerId, number>;

export type BossBattleState = {
  hp: number;
  armorPliesRemaining: number;
  bossTurnsCompleted: number;
  cooldowns: BossCooldowns;
  summons: number;
  lastPower: BossPowerId | null;
  lastPowerSquares: Square[];
};

export type ShockwavePush = {
  from: Square;
  to: Square;
  piece: "p" | "n" | "b" | "r" | "q";
};

export type BossPowerResult = {
  game: Chess;
  state: BossBattleState;
  affectedSquares: Square[];
  pushes: ShockwavePush[];
};

export const BOSS_STARTING_FEN =
  "4k3/p1pppp1p/2n2b2/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1";

export const BOSS_MAX_HP = 5;
export const BOSS_ARMOR_PLIES = 2;
export const BOSS_MAX_RAGE = 3;
export const BOSS_RAGE_TURNS_PER_LEVEL = 4;

export const BOSS_POWER_BASE_COOLDOWNS: Record<BossPowerId, number> = {
  shockwave: 5,
  summon: 6,
  dark_step: 4,
};

const FILES = "abcdefgh";

export function createInitialBossBattleState(): BossBattleState {
  return {
    hp: BOSS_MAX_HP,
    armorPliesRemaining: 0,
    bossTurnsCompleted: 0,
    cooldowns: {
      shockwave: 0,
      summon: 0,
      dark_step: 0,
    },
    summons: 0,
    lastPower: null,
    lastPowerSquares: [],
  };
}

export function cloneBossBattleState(
  state: BossBattleState,
): BossBattleState {
  return {
    ...state,
    cooldowns: { ...state.cooldowns },
    lastPowerSquares: [...state.lastPowerSquares],
  };
}

export function getBossRage(state: BossBattleState): number {
  return Math.min(
    BOSS_MAX_RAGE,
    Math.floor(state.bossTurnsCompleted / BOSS_RAGE_TURNS_PER_LEVEL),
  );
}

export function getBossPowerCooldown(
  power: BossPowerId,
  state: BossBattleState,
): number {
  return Math.max(2, BOSS_POWER_BASE_COOLDOWNS[power] - getBossRage(state));
}

export function tickBossArmor(state: BossBattleState): BossBattleState {
  if (state.armorPliesRemaining <= 0) {
    return cloneBossBattleState(state);
  }

  return {
    ...cloneBossBattleState(state),
    armorPliesRemaining: Math.max(0, state.armorPliesRemaining - 1),
  };
}

export function damageBoss(state: BossBattleState): {
  state: BossBattleState;
  damaged: boolean;
} {
  if (state.armorPliesRemaining > 0) {
    return {
      state: tickBossArmor(state),
      damaged: false,
    };
  }

  return {
    state: {
      ...cloneBossBattleState(state),
      hp: Math.max(0, state.hp - 1),
      armorPliesRemaining: BOSS_ARMOR_PLIES,
      lastPower: null,
      lastPowerSquares: [],
    },
    damaged: true,
  };
}

export function completeOrdinaryPly(
  state: BossBattleState,
  mover: BossSide,
): BossBattleState {
  const next = tickBossArmor(state);

  if (mover !== "b") {
    next.lastPower = null;
    next.lastPowerSquares = [];
    return next;
  }

  next.bossTurnsCompleted += 1;
  next.cooldowns = decrementCooldowns(next.cooldowns);
  next.lastPower = null;
  next.lastPowerSquares = [];

  return next;
}

function decrementCooldowns(cooldowns: BossCooldowns): BossCooldowns {
  return {
    shockwave: Math.max(0, cooldowns.shockwave - 1),
    summon: Math.max(0, cooldowns.summon - 1),
    dark_step: Math.max(0, cooldowns.dark_step - 1),
  };
}

export function findKingSquare(game: Chess, color: BossSide): Square | null {
  const board = game.board();

  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      const piece = board[row][column];

      if (piece?.type === "k" && piece.color === color) {
        return `${FILES[column]}${8 - row}` as Square;
      }
    }
  }

  return null;
}

function fileIndex(square: Square): number {
  return FILES.indexOf(square[0]);
}

function rankNumber(square: Square): number {
  return Number(square[1]);
}

function toSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}` as Square;
}

function stripCastlingRightForDisplacedWhiteRook(
  fen: string,
  from: Square,
): string {
  if (from !== "a1" && from !== "h1") return fen;

  const fields = fen.split(" ");
  let rights = fields[2];

  if (from === "a1") rights = rights.replace("Q", "");
  if (from === "h1") rights = rights.replace("K", "");

  fields[2] = rights || "-";
  return fields.join(" ");
}

function endBlackTurn(
  game: Chess,
  resetHalfmoveClock: boolean,
): Chess {
  const fields = game.fen().split(" ");

  fields[1] = "w";
  fields[4] = resetHalfmoveClock
    ? "0"
    : String(Number(fields[4] || "0") + 1);
  fields[5] = String(Number(fields[5] || "1") + 1);

  return new Chess(fields.join(" "));
}

export function getSummonSquares(game: Chess): Square[] {
  if (game.turn() !== "b" || game.isCheck()) return [];

  const result: Square[] = [];

  for (const rank of [6, 7]) {
    for (let file = 0; file < 8; file += 1) {
      const square = toSquare(file, rank);
      if (!square) continue;

      if (!game.get(square)) {
        result.push(square);
      }
    }
  }

  return result;
}

export function getDarkStepSquares(game: Chess): Square[] {
  if (game.turn() !== "b" || game.isCheck()) return [];

  const bossSquare = findKingSquare(game, "b");
  if (!bossSquare) return [];

  const bossFile = fileIndex(bossSquare);
  const bossRank = rankNumber(bossSquare);
  const result: Square[] = [];

  for (let df = -2; df <= 2; df += 1) {
    for (let dr = -2; dr <= 2; dr += 1) {
      if (df === 0 && dr === 0) continue;
      if (Math.max(Math.abs(df), Math.abs(dr)) > 2) continue;

      const target = toSquare(bossFile + df, bossRank + dr);
      if (!target || game.get(target)) continue;

      const simulation = new Chess(game.fen());
      const king = simulation.remove(bossSquare);
      if (!king) continue;

      simulation.put(king, target);

      if (!simulation.isCheck()) {
        result.push(target);
      }
    }
  }

  return result;
}

function simulateShockwave(game: Chess): {
  game: Chess;
  pushes: ShockwavePush[];
  affectedSquares: Square[];
} | null {
  if (game.turn() !== "b" || game.isCheck()) return null;

  const bossSquare = findKingSquare(game, "b");
  if (!bossSquare) return null;

  const bossFile = fileIndex(bossSquare);
  const bossRank = rankNumber(bossSquare);
  const original = new Chess(game.fen());
  let simulation = new Chess(game.fen());
  const pushes: ShockwavePush[] = [];
  const affected = new Set<Square>([bossSquare]);

  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;

      const from = toSquare(bossFile + df, bossRank + dr);
      const to = toSquare(bossFile + df * 2, bossRank + dr * 2);

      if (!from || !to) continue;

      const piece = original.get(from);

      if (!piece || piece.color !== "w" || piece.type === "k") continue;
      if (original.get(to)) continue;

      const removed = simulation.remove(from);
      if (!removed) continue;

      simulation.put(removed, to);

      if (removed.type === "r") {
        simulation = new Chess(
          stripCastlingRightForDisplacedWhiteRook(simulation.fen(), from),
        );
      }

      pushes.push({
        from,
        to,
        piece: removed.type as ShockwavePush["piece"],
      });
      affected.add(from);
      affected.add(to);
    }
  }

  if (pushes.length === 0) return null;

  /*
   * A Boss power may not be used to leave the Boss standing in check.
   * This also catches rare discovered-line situations caused by a push.
   */
  if (simulation.isCheck()) return null;

  return {
    game: simulation,
    pushes,
    affectedSquares: [...affected],
  };
}

export function canUseShockwave(game: Chess): boolean {
  return simulateShockwave(game) !== null;
}

export function canUseBossPower(
  game: Chess,
  state: BossBattleState,
  power: BossPowerId,
): boolean {
  if (game.turn() !== "b") return false;
  if (game.isCheck()) return false;
  if (state.cooldowns[power] > 0) return false;

  if (power === "shockwave") return canUseShockwave(game);
  if (power === "summon") return getSummonSquares(game).length > 0;
  return getDarkStepSquares(game).length > 0;
}

function completePowerState(
  state: BossBattleState,
  power: BossPowerId,
  affectedSquares: Square[],
  summonsDelta = 0,
): BossBattleState {
  const next = tickBossArmor(state);
  const nextCooldowns = decrementCooldowns(next.cooldowns);

  next.bossTurnsCompleted += 1;
  next.cooldowns = nextCooldowns;
  next.cooldowns[power] = getBossPowerCooldown(power, state);
  next.summons += summonsDelta;
  next.lastPower = power;
  next.lastPowerSquares = [...affectedSquares];

  return next;
}

export function useShockwavePower(
  game: Chess,
  state: BossBattleState,
): BossPowerResult | null {
  if (!canUseBossPower(game, state, "shockwave")) return null;

  const simulation = simulateShockwave(game);
  if (!simulation) return null;

  const endedTurn = endBlackTurn(simulation.game, false);

  return {
    game: endedTurn,
    state: completePowerState(
      state,
      "shockwave",
      simulation.affectedSquares,
    ),
    affectedSquares: simulation.affectedSquares,
    pushes: simulation.pushes,
  };
}

export function useSummonPower(
  game: Chess,
  state: BossBattleState,
  square: Square,
): BossPowerResult | null {
  if (!canUseBossPower(game, state, "summon")) return null;
  if (!getSummonSquares(game).includes(square)) return null;

  const simulation = new Chess(game.fen());

  simulation.put({ type: "p", color: "b" }, square);

  const endedTurn = endBlackTurn(simulation, true);

  return {
    game: endedTurn,
    state: completePowerState(state, "summon", [square], 1),
    affectedSquares: [square],
    pushes: [],
  };
}

export function useDarkStepPower(
  game: Chess,
  state: BossBattleState,
  square: Square,
): BossPowerResult | null {
  if (!canUseBossPower(game, state, "dark_step")) return null;
  if (!getDarkStepSquares(game).includes(square)) return null;

  const bossSquare = findKingSquare(game, "b");
  if (!bossSquare) return null;

  const simulation = new Chess(game.fen());
  const king = simulation.remove(bossSquare);
  if (!king) return null;

  simulation.put(king, square);

  if (simulation.isCheck()) return null;

  const endedTurn = endBlackTurn(simulation, false);

  return {
    game: endedTurn,
    state: completePowerState(
      state,
      "dark_step",
      [bossSquare, square],
    ),
    affectedSquares: [bossSquare, square],
    pushes: [],
  };
}

export function bossPowerLabel(power: BossPowerId): string {
  if (power === "shockwave") return "Shockwave";
  if (power === "summon") return "Summon";
  return "Dark Step";
}

export function bossPowerIcon(power: BossPowerId): string {
  if (power === "shockwave") return "💥";
  if (power === "summon") return "👹";
  return "🌑";
}

export function bossRepetitionKey(
  game: Chess,
  state: BossBattleState,
): string {
  const fenFields = game.fen().split(" ");
  const boardTurnCastlingEp = fenFields.slice(0, 4).join(" ");

  return [
    boardTurnCastlingEp,
    `hp:${state.hp}`,
    `armor:${state.armorPliesRemaining}`,
    `rage:${getBossRage(state)}`,
    `cd:${state.cooldowns.shockwave},${state.cooldowns.summon},${state.cooldowns.dark_step}`,
  ].join("|");
}

export function isThreefoldBossBattle(keys: string[]): boolean {
  const counts = new Map<string, number>();

  for (const key of keys) {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);

    if (next >= 3) return true;
  }

  return false;
}
