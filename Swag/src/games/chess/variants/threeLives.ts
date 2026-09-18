import { Chess } from "chess.js";

export const THREE_LIVES_MAX_HP = 3;

export type ThreeLivesSide = "white" | "black";

export type ThreeLivesDamageEvent = {
  ply: number;
  san: string;
  damagedSide: ThreeLivesSide;
  whiteHpAfter: number;
  blackHpAfter: number;
};

export type ThreeLivesState = {
  whiteHp: number;
  blackHp: number;
  whiteChecksReceived: number;
  blackChecksReceived: number;
  winnerByHp: ThreeLivesSide | null;
  damageEvents: ThreeLivesDamageEvent[];
};

export function getThreeLivesStateFromMoves(moves: string[]): ThreeLivesState {
  const replay = new Chess();

  let whiteChecksReceived = 0;
  let blackChecksReceived = 0;

  const damageEvents: ThreeLivesDamageEvent[] = [];

  for (let index = 0; index < moves.length; index += 1) {
    const move = replay.move(moves[index]);

    if (!replay.isCheck()) {
      continue;
    }

    /*
     * After a legal move, replay.turn() is the side that must move next.
     * If the position is check, that is therefore the side that lost HP.
     */
    const damagedSide: ThreeLivesSide =
      replay.turn() === "w" ? "white" : "black";

    if (damagedSide === "white") {
      whiteChecksReceived += 1;
    } else {
      blackChecksReceived += 1;
    }

    damageEvents.push({
      ply: index + 1,
      san: move.san,
      damagedSide,
      whiteHpAfter: Math.max(0, THREE_LIVES_MAX_HP - whiteChecksReceived),
      blackHpAfter: Math.max(0, THREE_LIVES_MAX_HP - blackChecksReceived),
    });
  }

  const whiteHp = Math.max(0, THREE_LIVES_MAX_HP - whiteChecksReceived);

  const blackHp = Math.max(0, THREE_LIVES_MAX_HP - blackChecksReceived);

  return {
    whiteHp,
    blackHp,
    whiteChecksReceived,
    blackChecksReceived,
    winnerByHp: whiteHp <= 0 ? "black" : blackHp <= 0 ? "white" : null,
    damageEvents,
  };
}

export function getThreeLivesTimeline(moves: string[]) {
  const replay = new Chess();

  let whiteHp = THREE_LIVES_MAX_HP;
  let blackHp = THREE_LIVES_MAX_HP;

  return moves.map((san, index) => {
    const move = replay.move(san);

    let damagedSide: ThreeLivesSide | null = null;

    if (replay.isCheck()) {
      damagedSide = replay.turn() === "w" ? "white" : "black";

      if (damagedSide === "white") {
        whiteHp = Math.max(0, whiteHp - 1);
      } else {
        blackHp = Math.max(0, blackHp - 1);
      }
    }

    return {
      ply: index + 1,
      san: move.san,
      damagedSide,
      whiteHpAfter: whiteHp,
      blackHpAfter: blackHp,
    };
  });
}
