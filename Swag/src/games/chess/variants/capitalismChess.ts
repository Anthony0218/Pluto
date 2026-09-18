import { Chess, type Square } from "chess.js";

export type CapitalSide = "white" | "black";
export type ChessColor = "w" | "b";
export type CapitalPieceType = "p" | "n" | "b" | "r" | "q";

export type MissionId =
  | "give_check"
  | "capture_piece"
  | "capture_minor"
  | "pawn_capture"
  | "knight_check"
  | "advance_pawn"
  | "castle"
  | "king_journey";

export type RoyalPowerId = "investment" | "mission_decree" | "bounty_decree";

export type ShopPieceType = "p" | "n" | "b" | "r" | "q";

export type MissionAssignment = {
  id: MissionId;
  reward: number;

  /*
   * Used only by the special King Journey endgame mission.
   */
  targetSquare?: Square;
};

export type RoyalPowerState = {
  investmentUsed: boolean;
  investmentArmed: boolean;
  missionDecreeUsed: boolean;
  bountyDecreeUsed: boolean;
};

export type CapitalState = {
  coins: Record<CapitalSide, number>;

  /*
   * Key = hunter.
   * white -> a Black piece White is hunting
   * black -> a White piece Black is hunting
   */
  bountyTargets: Record<CapitalSide, Square | null>;
  bountyRewards: Record<CapitalSide, number>;
  bountySequence: Record<CapitalSide, number>;

  missions: Record<CapitalSide, MissionAssignment>;
  missionSequence: Record<CapitalSide, number>;

  powers: Record<CapitalSide, RoyalPowerState>;
};

export type EconomyMoveInput = {
  color: ChessColor;
  piece: "p" | "n" | "b" | "r" | "q" | "k";
  from: Square;
  to: Square;
  captured?: CapitalPieceType;
  capturedSquare: Square | null;
  promotion?: "q" | "r" | "b" | "n";
  isCheck: boolean;
  isCastle: boolean;
  isKingsideCastle: boolean;
};

export type EconomyEvent = {
  side: CapitalSide;
  captureCoins: number;
  investmentBonus: number;
  checkCoins: number;
  castleCoins: number;
  promotionCoins: number;
  bountyCoins: number;
  missionCoins: number;
  totalEarned: number;

  bountyClaimed: {
    square: Square;
    reward: number;
  } | null;

  missionCompleted: MissionAssignment | null;
};

export type CapitalismMoveRecord = {
  ply: number;
  moveNumber: number;
  color: ChessColor;
  san: string;
  from: Square;
  to: Square;
  piece: "p" | "n" | "b" | "r" | "q" | "k";
  captured?: CapitalPieceType;
  promotion?: "q" | "r" | "b" | "n";
  fenAfter: string;
  economy: EconomyEvent;
  stateAfter: CapitalState;
};

export const STARTING_COINS = 2;

/*
 * Base action income.
 *
 * Mission rewards are separate contract bonuses and stack on top.
 * Example:
 *   normal check        -> +1
 *   "Give check" mission -> +3 more
 *   total               -> +4
 */
export const CHECK_REWARD = 1;
export const CASTLE_REWARD = 4;
export const PROMOTION_REWARD = 6;

export const ROYAL_POWER_COSTS: Record<RoyalPowerId, number> = {
  investment: 5,
  mission_decree: 4,
  bounty_decree: 4,
};

export const SHOP_PIECE_COSTS: Record<ShopPieceType, number> = {
  p: 3,
  n: 5,
  b: 5,
  r: 7,
  q: 10,
};

export const pieceValues: Record<CapitalPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

/*
 * Contract rewards are intentionally independent of piece/objective value.
 * A Pawn may carry a jackpot bounty, while a Queen may carry a modest one.
 * That unpredictability is part of Capitalism Chess.
 */
export const BOUNTY_REWARD_MIN = 3;
export const BOUNTY_REWARD_MAX = 10;

export const MISSION_REWARD_MIN = 3;
export const MISSION_REWARD_MAX = 10;

function seededReward(seedText: string, min: number, max: number): number {
  const range = max - min + 1;

  return min + seededIndex(seedText, range);
}

export function getRandomBountyReward(
  seed: number,
  side: CapitalSide,
  sequence: number,
): number {
  return seededReward(
    `${seed}:bounty-reward:${side}:${sequence}`,
    BOUNTY_REWARD_MIN,
    BOUNTY_REWARD_MAX,
  );
}

export function getRandomMissionReward(
  seed: number,
  side: CapitalSide,
  sequence: number,
  missionId: MissionId,
): number {
  return seededReward(
    `${seed}:mission-reward:${side}:${sequence}:${missionId}`,
    MISSION_REWARD_MIN,
    MISSION_REWARD_MAX,
  );
}

export function getMissionRewardLabel(mission: MissionAssignment): string {
  return String(mission.reward);
}

export const missionDefinitions: Record<
  MissionId,
  { reward: number; label: string; detail: string }
> = {
  give_check: {
    reward: 0,
    label: "Give check",
    detail: "Put the enemy king in check",
  },

  /*
   * This is the minimum display value.
   * The actual reward is dynamic:
   * Pawn 2 · Knight/Bishop 4 · Rook 6 · Queen 10.
   */
  capture_piece: {
    reward: 0,
    label: "Make a capture",
    detail: "Capture any enemy piece",
  },

  capture_minor: {
    reward: 0,
    label: "Hunt a minor piece",
    detail: "Capture a Knight or Bishop",
  },

  pawn_capture: {
    reward: 0,
    label: "Pawn business",
    detail: "Make a capture with a Pawn",
  },

  knight_check: {
    reward: 0,
    label: "Knight audit",
    detail: "Give check with a Knight",
  },

  advance_pawn: {
    reward: 0,
    label: "Expand the market",
    detail: "Move a Pawn into the enemy half",
  },

  castle: {
    reward: 0,
    label: "Secure the treasury",
    detail: "Castle either side",
  },

  king_journey: {
    reward: 0,
    label: "King Journey",
    detail: "Reach the marked square with your King",
  },
};

const normalMissionIds: MissionId[] = [
  "give_check",
  "capture_piece",
  "capture_minor",
  "pawn_capture",
  "knight_check",
  "advance_pawn",
  "castle",
];

const files = "abcdefgh";

const allSquares: Square[] = Array.from({ length: 8 }, (_, rankIndex) => {
  const rank = String(8 - rankIndex);

  return Array.from(
    { length: 8 },
    (_, fileIndex) => `${files[fileIndex]}${rank}` as Square,
  );
}).flat();

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededIndex(seedText: string, length: number): number {
  if (length <= 1) return 0;

  let value = hashString(seedText);

  value += 0x6d2b79f5;

  let result = value;

  result = Math.imul(result ^ (result >>> 15), result | 1);

  result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

  const random = ((result ^ (result >>> 14)) >>> 0) / 4294967296;

  return Math.floor(random * length);
}

export function createCapitalismSeed(): number {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const values = new Uint32Array(1);

    crypto.getRandomValues(values);

    return values[0] >>> 0;
  }

  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function sideFromColor(color: ChessColor): CapitalSide {
  return color === "w" ? "white" : "black";
}

export function oppositeSide(side: CapitalSide): CapitalSide {
  return side === "white" ? "black" : "white";
}

export function colorFromSide(side: CapitalSide): ChessColor {
  return side === "white" ? "w" : "b";
}

export function getShopSpawnSquares(side: CapitalSide): [Square, Square] {
  return side === "white" ? ["a1", "h1"] : ["a8", "h8"];
}

export function getAvailableShopSquares(
  game: Chess,
  side: CapitalSide,
): Square[] {
  return getShopSpawnSquares(side).filter(
    (square) => game.get(square) === undefined,
  );
}

function replaceEmptySquareInFen(
  fen: string,
  square: Square,
  color: ChessColor,
  piece: ShopPieceType,
): string {
  const parts = fen.split(" ");
  const ranks = parts[0].split("/");

  const expanded = ranks.map((rank) => {
    const cells: string[] = [];

    for (const char of rank) {
      if (/\d/.test(char)) {
        for (let index = 0; index < Number(char); index += 1) {
          cells.push("");
        }
      } else {
        cells.push(char);
      }
    }

    return cells;
  });

  const fileIndex = "abcdefgh".indexOf(square[0]);
  const rankIndex = 8 - Number(square[1]);

  if (expanded[rankIndex][fileIndex]) {
    throw new Error("Spawn square is occupied");
  }

  expanded[rankIndex][fileIndex] = color === "w" ? piece.toUpperCase() : piece;

  parts[0] = expanded
    .map((cells) => {
      let rank = "";
      let empty = 0;

      for (const cell of cells) {
        if (!cell) {
          empty += 1;
          continue;
        }

        if (empty > 0) {
          rank += String(empty);
          empty = 0;
        }

        rank += cell;
      }

      if (empty > 0) {
        rank += String(empty);
      }

      return rank;
    })
    .join("/");

  return parts.join(" ");
}

function fenWithTurn(fen: string, color: ChessColor): string {
  const parts = fen.split(" ");

  parts[1] = color;
  parts[3] = "-";

  return parts.join(" ");
}

function sideIsInCheck(fen: string, side: CapitalSide): boolean {
  try {
    return new Chess(fenWithTurn(fen, colorFromSide(side))).isCheck();
  } catch {
    return true;
  }
}

export function canBuyPiece({
  state,
  game,
  side,
  piece,
  square,
}: {
  state: CapitalState;
  game: Chess;
  side: CapitalSide;
  piece: ShopPieceType;
  square: Square;
}): boolean {
  if (game.turn() !== colorFromSide(side)) {
    return false;
  }

  if (game.isCheck()) {
    return false;
  }

  if (!getShopSpawnSquares(side).includes(square)) {
    return false;
  }

  if (game.get(square) !== undefined) {
    return false;
  }

  if (state.coins[side] < SHOP_PIECE_COSTS[piece]) {
    return false;
  }

  try {
    const fenAfter = replaceEmptySquareInFen(
      game.fen(),
      square,
      colorFromSide(side),
      piece,
    );

    /*
     * Buying may not magically place the opponent in check before
     * the current player has made an actual chess move.
     */
    if (sideIsInCheck(fenAfter, oppositeSide(side))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function buyPiece({
  state: previousState,
  game,
  seed,
  side,
  piece,
  square,
}: {
  state: CapitalState;
  game: Chess;
  seed: number;
  side: CapitalSide;
  piece: ShopPieceType;
  square: Square;
}): CapitalState {
  if (
    !canBuyPiece({
      state: previousState,
      game,
      side,
      piece,
      square,
    })
  ) {
    return previousState;
  }

  const state = cloneCapitalState(previousState);

  const fenAfter = replaceEmptySquareInFen(
    game.fen(),
    square,
    colorFromSide(side),
    piece,
  );

  game.load(fenAfter);

  state.coins[side] -= SHOP_PIECE_COSTS[piece];

  /*
   * Buying a Knight/Bishop/Rook/Queen exits the King+Pawns-only
   * condition. Buying a Pawn keeps it active.
   */
  normalizeMissions(state, game, seed);

  return state;
}

export function cloneCapitalState(state: CapitalState): CapitalState {
  return {
    coins: { ...state.coins },
    bountyTargets: { ...state.bountyTargets },
    bountyRewards: { ...state.bountyRewards },
    bountySequence: { ...state.bountySequence },
    missions: {
      white: { ...state.missions.white },
      black: { ...state.missions.black },
    },
    missionSequence: { ...state.missionSequence },
    powers: {
      white: { ...state.powers.white },
      black: { ...state.powers.black },
    },
  };
}

export function hasOnlyKingAndPawns(game: Chess, side: CapitalSide): boolean {
  const color = colorFromSide(side);

  let foundKing = false;

  for (const square of allSquares) {
    const piece = game.get(square);

    if (!piece || piece.color !== color) {
      continue;
    }

    if (piece.type === "k") {
      foundKing = true;
      continue;
    }

    if (piece.type !== "p") {
      return false;
    }
  }

  return foundKing;
}

export function getKingSquare(game: Chess, side: CapitalSide): Square | null {
  const color = colorFromSide(side);

  for (const square of allSquares) {
    const piece = game.get(square);

    if (piece?.color === color && piece.type === "k") {
      return square;
    }
  }

  return null;
}

function chooseKingJourneyTarget(
  game: Chess,
  seed: number,
  side: CapitalSide,
  sequence: number,
): Square | null {
  const kingSquare = getKingSquare(game, side);

  const candidates = allSquares.filter((square) => {
    if (square === kingSquare) {
      return false;
    }

    /*
     * Start the contract on a currently empty square so it is
     * a meaningful destination instead of another own piece.
     */
    return game.get(square) === undefined;
  });

  if (candidates.length === 0) {
    return null;
  }

  const index = seededIndex(
    `${seed}:king-journey:${side}:${sequence}:${game.fen()}`,
    candidates.length,
  );

  return candidates[index] ?? null;
}

function chooseKingJourneyMission(
  game: Chess,
  seed: number,
  side: CapitalSide,
  sequence: number,
): MissionAssignment {
  return {
    id: "king_journey",
    reward: getRandomMissionReward(seed, side, sequence, "king_journey"),
    targetSquare:
      chooseKingJourneyTarget(game, seed, side, sequence) ?? undefined,
  };
}

function chooseBountySquare(
  game: Chess,
  hunter: CapitalSide,
  seed: number,
  sequence: number,
): Square | null {
  const targetColor = colorFromSide(oppositeSide(hunter));

  const candidates = allSquares.filter((square) => {
    const piece = game.get(square);

    return (
      piece !== undefined && piece.color === targetColor && piece.type !== "k"
    );
  });

  if (candidates.length === 0) {
    return null;
  }

  const index = seededIndex(
    `${seed}:bounty:${hunter}:${sequence}:${game.fen()}`,
    candidates.length,
  );

  return candidates[index] ?? null;
}

function chooseMission(
  game: Chess,
  seed: number,
  side: CapitalSide,
  sequence: number,
  previousId?: MissionId,
): MissionAssignment {
  if (hasOnlyKingAndPawns(game, side)) {
    return chooseKingJourneyMission(game, seed, side, sequence);
  }

  const candidates =
    previousId === undefined || previousId === "king_journey"
      ? normalMissionIds
      : normalMissionIds.filter((missionId) => missionId !== previousId);

  const index = seededIndex(
    `${seed}:mission:${side}:${sequence}`,
    candidates.length,
  );

  const id = candidates[index] ?? normalMissionIds[0];

  return {
    id,
    reward: getRandomMissionReward(seed, side, sequence, id),
  };
}

function normalizeMissionForSide(
  state: CapitalState,
  game: Chess,
  seed: number,
  side: CapitalSide,
): void {
  const specialCondition = hasOnlyKingAndPawns(game, side);

  const current = state.missions[side];

  if (specialCondition && current.id !== "king_journey") {
    state.missionSequence[side] += 1;

    state.missions[side] = chooseKingJourneyMission(
      game,
      seed,
      side,
      state.missionSequence[side],
    );

    return;
  }

  if (!specialCondition && current.id === "king_journey") {
    state.missionSequence[side] += 1;

    state.missions[side] = chooseMission(
      game,
      seed,
      side,
      state.missionSequence[side],
      "king_journey",
    );
  }
}

function normalizeMissions(
  state: CapitalState,
  game: Chess,
  seed: number,
): void {
  normalizeMissionForSide(state, game, seed, "white");

  normalizeMissionForSide(state, game, seed, "black");
}

export function createInitialCapitalState(
  game: Chess,
  seed: number,
): CapitalState {
  return {
    coins: {
      white: STARTING_COINS,
      black: STARTING_COINS,
    },

    bountyTargets: {
      white: chooseBountySquare(game, "white", seed, 0),
      black: chooseBountySquare(game, "black", seed, 0),
    },

    bountyRewards: {
      white: getRandomBountyReward(seed, "white", 0),
      black: getRandomBountyReward(seed, "black", 0),
    },

    bountySequence: {
      white: 0,
      black: 0,
    },

    missions: {
      white: chooseMission(game, seed, "white", 0),
      black: chooseMission(game, seed, "black", 0),
    },

    missionSequence: {
      white: 0,
      black: 0,
    },

    powers: {
      white: {
        investmentUsed: false,
        investmentArmed: false,
        missionDecreeUsed: false,
        bountyDecreeUsed: false,
      },
      black: {
        investmentUsed: false,
        investmentArmed: false,
        missionDecreeUsed: false,
        bountyDecreeUsed: false,
      },
    },
  };
}

function missionCompletedByMove(
  mission: MissionAssignment,
  move: EconomyMoveInput,
): boolean {
  switch (mission.id) {
    case "give_check":
      return move.isCheck;

    case "capture_piece":
      return move.captured !== undefined;

    case "capture_minor":
      return move.captured === "n" || move.captured === "b";

    case "pawn_capture":
      return move.piece === "p" && move.captured !== undefined;

    case "knight_check":
      return move.piece === "n" && move.isCheck;

    case "advance_pawn": {
      if (move.piece !== "p") return false;

      const rank = Number(move.to[1]);

      return move.color === "w" ? rank >= 5 : rank <= 4;
    }

    case "castle":
      return move.isCastle;

    case "king_journey":
      return (
        move.piece === "k" &&
        mission.targetSquare !== undefined &&
        move.to === mission.targetSquare
      );
  }
}

function moveOpponentBountyWithPiece(
  state: CapitalState,
  move: EconomyMoveInput,
) {
  const mover = sideFromColor(move.color);

  /*
   * The other player is hunting pieces of the mover's color.
   */
  const opponentHunter = oppositeSide(mover);

  if (state.bountyTargets[opponentHunter] === move.from) {
    state.bountyTargets[opponentHunter] = move.to;
  }

  /*
   * Castling also moves a rook, even though chess.js
   * reports the King as the primary move.
   */
  if (move.isCastle) {
    let rookFrom: Square | null = null;
    let rookTo: Square | null = null;

    if (move.color === "w") {
      if (move.isKingsideCastle) {
        rookFrom = "h1";
        rookTo = "f1";
      } else {
        rookFrom = "a1";
        rookTo = "d1";
      }
    } else if (move.isKingsideCastle) {
      rookFrom = "h8";
      rookTo = "f8";
    } else {
      rookFrom = "a8";
      rookTo = "d8";
    }

    if (
      rookFrom &&
      rookTo &&
      state.bountyTargets[opponentHunter] === rookFrom
    ) {
      state.bountyTargets[opponentHunter] = rookTo;
    }
  }
}

export function resolveCapitalismAfterMove({
  previousState,
  gameAfterMove,
  move,
  seed,
}: {
  previousState: CapitalState;
  gameAfterMove: Chess;
  move: EconomyMoveInput;
  seed: number;
}): {
  state: CapitalState;
  event: EconomyEvent;
} {
  const state = cloneCapitalState(previousState);

  const side = sideFromColor(move.color);

  moveOpponentBountyWithPiece(state, move);

  const captureCoins = move.captured ? pieceValues[move.captured] : 0;

  let investmentBonus = 0;

  if (move.captured && state.powers[side].investmentArmed) {
    investmentBonus = captureCoins;

    state.powers[side].investmentArmed = false;
  }

  const checkCoins = move.isCheck ? CHECK_REWARD : 0;

  const castleCoins = move.isCastle ? CASTLE_REWARD : 0;

  const promotionCoins = move.promotion ? PROMOTION_REWARD : 0;

  let bountyCoins = 0;
  let bountyClaimed: EconomyEvent["bountyClaimed"] = null;

  if (
    move.capturedSquare &&
    move.captured &&
    state.bountyTargets[side] === move.capturedSquare
  ) {
    bountyCoins = state.bountyRewards[side];

    bountyClaimed = {
      square: move.capturedSquare,
      reward: bountyCoins,
    };

    state.bountySequence[side] += 1;

    state.bountyTargets[side] = chooseBountySquare(
      gameAfterMove,
      side,
      seed,
      state.bountySequence[side],
    );

    state.bountyRewards[side] = getRandomBountyReward(
      seed,
      side,
      state.bountySequence[side],
    );
  }

  let missionCoins = 0;
  let missionCompleted: MissionAssignment | null = null;

  const activeMission = state.missions[side];

  if (missionCompletedByMove(activeMission, move)) {
    missionCoins = activeMission.reward;

    missionCompleted = {
      ...activeMission,
    };

    state.missionSequence[side] += 1;

    state.missions[side] = chooseMission(
      gameAfterMove,
      seed,
      side,
      state.missionSequence[side],
      activeMission.id,
    );
  }

  /*
   * The opponent may have just lost their last Knight/Bishop/Rook/Queen.
   * In that case their next mission must immediately become King Journey.
   * Likewise, promotion may break the condition for the mover.
   */
  normalizeMissions(state, gameAfterMove, seed);

  const totalEarned =
    captureCoins +
    investmentBonus +
    checkCoins +
    castleCoins +
    promotionCoins +
    bountyCoins +
    missionCoins;

  state.coins[side] += totalEarned;

  return {
    state,
    event: {
      side,
      captureCoins,
      investmentBonus,
      checkCoins,
      castleCoins,
      promotionCoins,
      bountyCoins,
      missionCoins,
      totalEarned,
      bountyClaimed,
      missionCompleted,
    },
  };
}

export function canUseRoyalPower(
  state: CapitalState,
  side: CapitalSide,
  power: RoyalPowerId,
): boolean {
  const costs = ROYAL_POWER_COSTS[power];

  if (state.coins[side] < costs) {
    return false;
  }

  const powerState = state.powers[side];

  switch (power) {
    case "investment":
      return !powerState.investmentUsed && !powerState.investmentArmed;

    case "mission_decree":
      return !powerState.missionDecreeUsed;

    case "bounty_decree":
      return !powerState.bountyDecreeUsed;
  }
}

export function applyRoyalPower({
  state: previousState,
  game,
  seed,
  side,
  power,
}: {
  state: CapitalState;
  game: Chess;
  seed: number;
  side: CapitalSide;
  power: RoyalPowerId;
}): CapitalState {
  if (!canUseRoyalPower(previousState, side, power)) {
    return previousState;
  }

  const state = cloneCapitalState(previousState);

  state.coins[side] -= ROYAL_POWER_COSTS[power];

  switch (power) {
    case "investment":
      state.powers[side].investmentUsed = true;
      state.powers[side].investmentArmed = true;
      break;

    case "mission_decree": {
      state.powers[side].missionDecreeUsed = true;

      const current = state.missions[side];

      state.missionSequence[side] += 1;

      state.missions[side] = chooseMission(
        game,
        seed,
        side,
        state.missionSequence[side],
        current.id,
      );

      break;
    }

    case "bounty_decree":
      state.powers[side].bountyDecreeUsed = true;

      state.bountySequence[side] += 1;

      state.bountyTargets[side] = chooseBountySquare(
        game,
        side,
        seed,
        state.bountySequence[side],
      );

      state.bountyRewards[side] = getRandomBountyReward(
        seed,
        side,
        state.bountySequence[side],
      );

      break;
  }

  return state;
}

export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export function isThreefoldFromCapitalRecords(
  records: CapitalismMoveRecord[],
  currentFen: string,
): boolean {
  const initialFen = new Chess().fen();

  const keys = [
    positionKey(initialFen),
    ...records.map((record) => positionKey(record.fenAfter)),
  ];

  const currentKey = positionKey(currentFen);

  return keys.filter((key) => key === currentKey).length >= 3;
}

export function getPowerSpent(state: CapitalState, side: CapitalSide): number {
  const powers = state.powers[side];

  let spent = 0;

  if (powers.investmentUsed) {
    spent += ROYAL_POWER_COSTS.investment;
  }

  if (powers.missionDecreeUsed) {
    spent += ROYAL_POWER_COSTS.mission_decree;
  }

  if (powers.bountyDecreeUsed) {
    spent += ROYAL_POWER_COSTS.bounty_decree;
  }

  return spent;
}
