export type FourPlayerColor = "red" | "blue" | "yellow" | "green";

export type FourPlayerPieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type FourPlayerPiece = {
  color: FourPlayerColor;
  type: FourPlayerPieceType;
};

export type FourPlayerSquare = {
  row: number;
  column: number;
};

export type FourPlayerMove = {
  from: FourPlayerSquare;
  to: FourPlayerSquare;
  piece: FourPlayerPieceType;
  color: FourPlayerColor;
  captured: FourPlayerPiece | null;
  promoted: boolean;
  castle?: FourPlayerCastleSide;
};

export type FourPlayerCastleSide = "king" | "queen";

export type FourPlayerCastlingRights = Record<
  FourPlayerColor,
  Record<FourPlayerCastleSide, boolean>
>;

export type FourPlayerState = {
  board: (FourPlayerPiece | null)[][];
  turn: FourPlayerColor;
  activePlayers: FourPlayerColor[];
  winner: FourPlayerColor | null;
  lastMove: FourPlayerMove | null;
  moveCount: number;
  event: string | null;
  // Optional so states saved before castling existed still load; when it is
  // missing, rights fall back to "king and rook still on their home squares".
  castling?: FourPlayerCastlingRights;
};

export const FOUR_PLAYER_ORDER: FourPlayerColor[] = [
  "red",
  "blue",
  "yellow",
  "green",
];

const HOME_ORDER: FourPlayerPieceType[] = [
  "r",
  "n",
  "b",
  "q",
  "k",
  "b",
  "n",
  "r",
];

const BOARD_SIZE = 14;

type CastleLayout = {
  king: FourPlayerSquare;
  rooks: Record<FourPlayerCastleSide, FourPlayerSquare>;
};

// Home squares derived from HOME_ORDER placement in createInitialFourPlayerState.
const CASTLE_LAYOUT: Record<FourPlayerColor, CastleLayout> = {
  red: {
    king: { row: 13, column: 7 },
    rooks: { king: { row: 13, column: 10 }, queen: { row: 13, column: 3 } },
  },
  yellow: {
    king: { row: 0, column: 6 },
    rooks: { king: { row: 0, column: 3 }, queen: { row: 0, column: 10 } },
  },
  blue: {
    king: { row: 7, column: 0 },
    rooks: { king: { row: 10, column: 0 }, queen: { row: 3, column: 0 } },
  },
  green: {
    king: { row: 6, column: 13 },
    rooks: { king: { row: 3, column: 13 }, queen: { row: 10, column: 13 } },
  },
};

const CASTLE_SIDES: FourPlayerCastleSide[] = ["king", "queen"];

const KNIGHT_STEPS = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

const KING_STEPS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const ROOK_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const BISHOP_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export function fourPlayerLabel(color: FourPlayerColor) {
  switch (color) {
    case "red":
      return "Red";
    case "blue":
      return "Blue";
    case "yellow":
      return "Yellow";
    case "green":
      return "Green";
  }
}

export function isPlayableFourPlayerSquare(row: number, column: number) {
  if (row < 0 || row >= BOARD_SIZE || column < 0 || column >= BOARD_SIZE) {
    return false;
  }

  const topLeft = row < 3 && column < 3;
  const topRight = row < 3 && column > 10;
  const bottomLeft = row > 10 && column < 3;
  const bottomRight = row > 10 && column > 10;

  return !(topLeft || topRight || bottomLeft || bottomRight);
}

export function fourPlayerSquareName(square: FourPlayerSquare) {
  const file = String.fromCharCode("a".charCodeAt(0) + square.column);
  const rank = BOARD_SIZE - square.row;

  return `${file}${rank}`;
}

function initialCastlingRights(): FourPlayerCastlingRights {
  return {
    red: { king: true, queen: true },
    blue: { king: true, queen: true },
    yellow: { king: true, queen: true },
    green: { king: true, queen: true },
  };
}

function cloneCastlingRights(
  rights: FourPlayerCastlingRights | undefined,
): FourPlayerCastlingRights | undefined {
  if (!rights) return undefined;
  return {
    red: { ...rights.red },
    blue: { ...rights.blue },
    yellow: { ...rights.yellow },
    green: { ...rights.green },
  };
}

function cloneBoard(board: (FourPlayerPiece | null)[][]) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function cloneFourPlayerState(state: FourPlayerState): FourPlayerState {
  return {
    ...state,
    board: cloneBoard(state.board),
    activePlayers: [...state.activePlayers],
    castling: cloneCastlingRights(state.castling),
    lastMove: state.lastMove
      ? {
          ...state.lastMove,
          from: { ...state.lastMove.from },
          to: { ...state.lastMove.to },
          captured: state.lastMove.captured
            ? { ...state.lastMove.captured }
            : null,
        }
      : null,
  };
}

export function createInitialFourPlayerState(): FourPlayerState {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array<FourPlayerPiece | null>(BOARD_SIZE).fill(null),
  );

  // Red: bottom, moves upward.
  HOME_ORDER.forEach((type, index) => {
    board[13][index + 3] = { color: "red", type };
    board[12][index + 3] = { color: "red", type: "p" };
  });

  // Yellow: top, moves downward.
  HOME_ORDER.forEach((type, index) => {
    board[0][10 - index] = { color: "yellow", type };
    board[1][10 - index] = { color: "yellow", type: "p" };
  });

  // Blue: left, moves right.
  HOME_ORDER.forEach((type, index) => {
    board[index + 3][0] = { color: "blue", type };
    board[index + 3][1] = { color: "blue", type: "p" };
  });

  // Green: right, moves left.
  HOME_ORDER.forEach((type, index) => {
    board[10 - index][13] = { color: "green", type };
    board[10 - index][12] = { color: "green", type: "p" };
  });

  return {
    board,
    turn: "red",
    activePlayers: [...FOUR_PLAYER_ORDER],
    winner: null,
    lastMove: null,
    moveCount: 0,
    event: "Red moves first.",
    castling: initialCastlingRights(),
  };
}

function sameSquare(a: FourPlayerSquare, b: FourPlayerSquare) {
  return a.row === b.row && a.column === b.column;
}

function pawnDirection(color: FourPlayerColor) {
  switch (color) {
    case "red":
      return { row: -1, column: 0 };
    case "yellow":
      return { row: 1, column: 0 };
    case "blue":
      return { row: 0, column: 1 };
    case "green":
      return { row: 0, column: -1 };
  }
}

function pawnCaptureSteps(color: FourPlayerColor) {
  switch (color) {
    case "red":
      return [
        [-1, -1],
        [-1, 1],
      ];
    case "yellow":
      return [
        [1, -1],
        [1, 1],
      ];
    case "blue":
      return [
        [-1, 1],
        [1, 1],
      ];
    case "green":
      return [
        [-1, -1],
        [1, -1],
      ];
  }
}

function isPawnStartSquare(
  color: FourPlayerColor,
  row: number,
  column: number,
) {
  switch (color) {
    case "red":
      return row === 12;
    case "yellow":
      return row === 1;
    case "blue":
      return column === 1;
    case "green":
      return column === 12;
  }
}

function isPromotionSquare(
  color: FourPlayerColor,
  row: number,
  column: number,
) {
  switch (color) {
    case "red":
      return row === 0;
    case "yellow":
      return row === 13;
    case "blue":
      return column === 13;
    case "green":
      return column === 0;
  }
}

function findKing(
  board: (FourPlayerPiece | null)[][],
  color: FourPlayerColor,
): FourPlayerSquare | null {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const piece = board[row][column];

      if (piece?.color === color && piece.type === "k") {
        return { row, column };
      }
    }
  }

  return null;
}

function rayAttacks(
  board: (FourPlayerPiece | null)[][],
  from: FourPlayerSquare,
  target: FourPlayerSquare,
  directions: number[][],
) {
  for (const [dr, dc] of directions) {
    let row = from.row + dr;
    let column = from.column + dc;

    while (isPlayableFourPlayerSquare(row, column)) {
      if (row === target.row && column === target.column) {
        return true;
      }

      if (board[row][column]) {
        break;
      }

      row += dr;
      column += dc;
    }
  }

  return false;
}

function pieceAttacksSquare(
  board: (FourPlayerPiece | null)[][],
  from: FourPlayerSquare,
  piece: FourPlayerPiece,
  target: FourPlayerSquare,
) {
  const dr = target.row - from.row;
  const dc = target.column - from.column;

  if (piece.type === "p") {
    return pawnCaptureSteps(piece.color).some(
      ([stepRow, stepColumn]) => dr === stepRow && dc === stepColumn,
    );
  }

  if (piece.type === "n") {
    return KNIGHT_STEPS.some(
      ([stepRow, stepColumn]) => dr === stepRow && dc === stepColumn,
    );
  }

  if (piece.type === "k") {
    return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0);
  }

  if (piece.type === "r" && rayAttacks(board, from, target, ROOK_DIRS)) {
    return true;
  }

  if (piece.type === "b" && rayAttacks(board, from, target, BISHOP_DIRS)) {
    return true;
  }

  if (
    piece.type === "q" &&
    rayAttacks(board, from, target, [...ROOK_DIRS, ...BISHOP_DIRS])
  ) {
    return true;
  }

  return false;
}

export function isFourPlayerSquareAttacked(
  board: (FourPlayerPiece | null)[][],
  target: FourPlayerSquare,
  defender: FourPlayerColor,
) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const piece = board[row][column];

      if (!piece || piece.color === defender) {
        continue;
      }

      if (pieceAttacksSquare(board, { row, column }, piece, target)) {
        return true;
      }
    }
  }

  return false;
}

export function isFourPlayerKingInCheck(
  board: (FourPlayerPiece | null)[][],
  color: FourPlayerColor,
) {
  const king = findKing(board, color);

  if (!king) {
    return true;
  }

  return isFourPlayerSquareAttacked(board, king, color);
}

function addRayMoves(
  board: (FourPlayerPiece | null)[][],
  piece: FourPlayerPiece,
  from: FourPlayerSquare,
  directions: number[][],
  moves: FourPlayerSquare[],
) {
  for (const [dr, dc] of directions) {
    let row = from.row + dr;
    let column = from.column + dc;

    while (isPlayableFourPlayerSquare(row, column)) {
      const target = board[row][column];

      if (!target) {
        moves.push({ row, column });
      } else {
        if (target.color !== piece.color && target.type !== "k") {
          moves.push({ row, column });
        }

        break;
      }

      row += dr;
      column += dc;
    }
  }
}

function pseudoMoves(
  board: (FourPlayerPiece | null)[][],
  from: FourPlayerSquare,
) {
  const piece = board[from.row]?.[from.column];

  if (!piece) {
    return [];
  }

  const moves: FourPlayerSquare[] = [];

  if (piece.type === "p") {
    const direction = pawnDirection(piece.color);

    const one = {
      row: from.row + direction.row,
      column: from.column + direction.column,
    };

    if (
      isPlayableFourPlayerSquare(one.row, one.column) &&
      !board[one.row][one.column]
    ) {
      moves.push(one);

      const two = {
        row: from.row + direction.row * 2,
        column: from.column + direction.column * 2,
      };

      if (
        isPawnStartSquare(piece.color, from.row, from.column) &&
        isPlayableFourPlayerSquare(two.row, two.column) &&
        !board[two.row][two.column]
      ) {
        moves.push(two);
      }
    }

    for (const [dr, dc] of pawnCaptureSteps(piece.color)) {
      const row = from.row + dr;
      const column = from.column + dc;

      if (!isPlayableFourPlayerSquare(row, column)) {
        continue;
      }

      const target = board[row][column];

      if (target && target.color !== piece.color && target.type !== "k") {
        moves.push({ row, column });
      }
    }

    return moves;
  }

  if (piece.type === "n") {
    for (const [dr, dc] of KNIGHT_STEPS) {
      const row = from.row + dr;
      const column = from.column + dc;

      if (!isPlayableFourPlayerSquare(row, column)) {
        continue;
      }

      const target = board[row][column];

      if (!target || (target.color !== piece.color && target.type !== "k")) {
        moves.push({ row, column });
      }
    }

    return moves;
  }

  if (piece.type === "k") {
    for (const [dr, dc] of KING_STEPS) {
      const row = from.row + dr;
      const column = from.column + dc;

      if (!isPlayableFourPlayerSquare(row, column)) {
        continue;
      }

      const target = board[row][column];

      if (!target || (target.color !== piece.color && target.type !== "k")) {
        moves.push({ row, column });
      }
    }

    return moves;
  }

  if (piece.type === "r") {
    addRayMoves(board, piece, from, ROOK_DIRS, moves);
  }

  if (piece.type === "b") {
    addRayMoves(board, piece, from, BISHOP_DIRS, moves);
  }

  if (piece.type === "q") {
    addRayMoves(board, piece, from, [...ROOK_DIRS, ...BISHOP_DIRS], moves);
  }

  return moves;
}

function simulateMove(
  board: (FourPlayerPiece | null)[][],
  from: FourPlayerSquare,
  to: FourPlayerSquare,
) {
  const next = cloneBoard(board);
  const piece = next[from.row][from.column];

  if (!piece) {
    return next;
  }

  next[from.row][from.column] = null;

  const promoted =
    piece.type === "p" && isPromotionSquare(piece.color, to.row, to.column);

  next[to.row][to.column] = {
    color: piece.color,
    type: promoted ? "q" : piece.type,
  };

  return next;
}

function stepToward(from: FourPlayerSquare, to: FourPlayerSquare) {
  return {
    row: Math.sign(to.row - from.row),
    column: Math.sign(to.column - from.column),
  };
}

function hasCastlingRight(
  state: FourPlayerState,
  color: FourPlayerColor,
  side: FourPlayerCastleSide,
) {
  if (state.castling) return state.castling[color][side];
  return true;
}

function castleSideForMove(
  color: FourPlayerColor,
  from: FourPlayerSquare,
  to: FourPlayerSquare,
): FourPlayerCastleSide | null {
  const layout = CASTLE_LAYOUT[color];
  if (!sameSquare(from, layout.king)) return null;

  for (const side of CASTLE_SIDES) {
    const step = stepToward(layout.king, layout.rooks[side]);
    if (
      to.row === layout.king.row + step.row * 2 &&
      to.column === layout.king.column + step.column * 2
    ) {
      return side;
    }
  }

  return null;
}

function castlingMoves(state: FourPlayerState, color: FourPlayerColor) {
  const layout = CASTLE_LAYOUT[color];
  const board = state.board;
  const king = board[layout.king.row][layout.king.column];
  const moves: FourPlayerSquare[] = [];

  if (king?.color !== color || king.type !== "k") return moves;
  if (isFourPlayerSquareAttacked(board, layout.king, color)) return moves;

  for (const side of CASTLE_SIDES) {
    if (!hasCastlingRight(state, color, side)) continue;

    const rookSquare = layout.rooks[side];
    const rook = board[rookSquare.row][rookSquare.column];
    if (rook?.color !== color || rook.type !== "r") continue;

    const step = stepToward(layout.king, rookSquare);
    let row = layout.king.row + step.row;
    let column = layout.king.column + step.column;
    let clear = true;

    while (row !== rookSquare.row || column !== rookSquare.column) {
      if (board[row][column]) {
        clear = false;
        break;
      }
      row += step.row;
      column += step.column;
    }

    if (!clear) continue;

    const pass = {
      row: layout.king.row + step.row,
      column: layout.king.column + step.column,
    };
    const land = {
      row: layout.king.row + step.row * 2,
      column: layout.king.column + step.column * 2,
    };

    if (
      isFourPlayerSquareAttacked(board, pass, color) ||
      isFourPlayerSquareAttacked(board, land, color)
    ) {
      continue;
    }

    const castled = cloneBoard(board);
    castled[layout.king.row][layout.king.column] = null;
    castled[land.row][land.column] = king;
    applyCastleRook(castled, color, side);
    if (isFourPlayerKingInCheck(castled, color)) continue;

    moves.push(land);
  }

  return moves;
}

function applyCastleRook(
  board: (FourPlayerPiece | null)[][],
  color: FourPlayerColor,
  side: FourPlayerCastleSide,
) {
  const layout = CASTLE_LAYOUT[color];
  const rookSquare = layout.rooks[side];
  const step = stepToward(layout.king, rookSquare);
  const rook = board[rookSquare.row][rookSquare.column];

  board[rookSquare.row][rookSquare.column] = null;
  board[layout.king.row + step.row][layout.king.column + step.column] = rook;
}

function nextCastlingRights(
  state: FourPlayerState,
  from: FourPlayerSquare,
  to: FourPlayerSquare,
): FourPlayerCastlingRights {
  const rights: FourPlayerCastlingRights =
    cloneCastlingRights(state.castling) ?? initialCastlingRights();

  if (!state.castling) {
    // Legacy state: drop any right whose king or rook already left home.
    for (const color of FOUR_PLAYER_ORDER) {
      const layout = CASTLE_LAYOUT[color];
      const king = state.board[layout.king.row][layout.king.column];
      for (const side of CASTLE_SIDES) {
        const rookSquare = layout.rooks[side];
        const rook = state.board[rookSquare.row][rookSquare.column];
        if (
          king?.color !== color ||
          king.type !== "k" ||
          rook?.color !== color ||
          rook.type !== "r"
        ) {
          rights[color][side] = false;
        }
      }
    }
  }

  for (const color of FOUR_PLAYER_ORDER) {
    const layout = CASTLE_LAYOUT[color];
    if (sameSquare(from, layout.king)) {
      rights[color].king = false;
      rights[color].queen = false;
    }
    for (const side of CASTLE_SIDES) {
      const rookSquare = layout.rooks[side];
      if (sameSquare(from, rookSquare) || sameSquare(to, rookSquare)) {
        rights[color][side] = false;
      }
    }
  }

  return rights;
}

export function getFourPlayerLegalMoves(
  state: FourPlayerState,
  from: FourPlayerSquare,
) {
  const piece = state.board[from.row]?.[from.column];

  if (
    !piece ||
    piece.color !== state.turn ||
    !state.activePlayers.includes(piece.color)
  ) {
    return [];
  }

  const legal = pseudoMoves(state.board, from).filter((to) => {
    const simulated = simulateMove(state.board, from, to);

    return !isFourPlayerKingInCheck(simulated, piece.color);
  });

  if (
    piece.type === "k" &&
    sameSquare(from, CASTLE_LAYOUT[piece.color].king)
  ) {
    legal.push(...castlingMoves(state, piece.color));
  }

  return legal;
}

function playerHasLegalMove(
  board: (FourPlayerPiece | null)[][],
  color: FourPlayerColor,
  activePlayers: FourPlayerColor[],
) {
  const state: FourPlayerState = {
    board,
    turn: color,
    activePlayers,
    winner: null,
    lastMove: null,
    moveCount: 0,
    event: null,
  };

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      if (
        board[row][column]?.color === color &&
        getFourPlayerLegalMoves(state, { row, column }).length > 0
      ) {
        return true;
      }
    }
  }

  return false;
}

function removePlayerPieces(
  board: (FourPlayerPiece | null)[][],
  color: FourPlayerColor,
) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      if (board[row][column]?.color === color) {
        board[row][column] = null;
      }
    }
  }
}

function nextPlayerAfter(
  current: FourPlayerColor,
  activePlayers: FourPlayerColor[],
) {
  const currentIndex = FOUR_PLAYER_ORDER.indexOf(current);

  for (let offset = 1; offset <= FOUR_PLAYER_ORDER.length; offset += 1) {
    const candidate =
      FOUR_PLAYER_ORDER[(currentIndex + offset) % FOUR_PLAYER_ORDER.length];

    if (activePlayers.includes(candidate)) {
      return candidate;
    }
  }

  return current;
}

function resolveNextTurn(
  board: (FourPlayerPiece | null)[][],
  justMoved: FourPlayerColor,
  activePlayers: FourPlayerColor[],
) {
  let active = [...activePlayers];
  let cursor = justMoved;
  const events: string[] = [];

  while (active.length > 1) {
    const candidate = nextPlayerAfter(cursor, active);

    if (playerHasLegalMove(board, candidate, active)) {
      if (isFourPlayerKingInCheck(board, candidate)) {
        events.push(`${fourPlayerLabel(candidate)} is in check.`);
      }

      return {
        turn: candidate,
        activePlayers: active,
        winner: null as FourPlayerColor | null,
        event: events.length > 0 ? events.join(" ") : null,
      };
    }

    const checked = isFourPlayerKingInCheck(board, candidate);

    removePlayerPieces(board, candidate);

    active = active.filter((color) => color !== candidate);

    events.push(
      checked
        ? `${fourPlayerLabel(candidate)} was checkmated and eliminated.`
        : `${fourPlayerLabel(candidate)} was stalemated and eliminated.`,
    );

    cursor = candidate;
  }

  return {
    turn: active[0] ?? justMoved,
    activePlayers: active,
    winner: active[0] ?? null,
    event:
      active.length === 1
        ? `${fourPlayerLabel(active[0])} wins the game.`
        : events.join(" "),
  };
}

export function applyFourPlayerMove(
  state: FourPlayerState,
  from: FourPlayerSquare,
  to: FourPlayerSquare,
): FourPlayerState {
  if (state.winner) {
    return state;
  }

  const piece = state.board[from.row]?.[from.column];

  if (!piece || piece.color !== state.turn) {
    return state;
  }

  const legalMoves = getFourPlayerLegalMoves(state, from);

  if (!legalMoves.some((square) => sameSquare(square, to))) {
    return state;
  }

  const board = cloneBoard(state.board);
  const captured = board[to.row][to.column]
    ? { ...board[to.row][to.column]! }
    : null;

  board[from.row][from.column] = null;

  const promoted =
    piece.type === "p" && isPromotionSquare(piece.color, to.row, to.column);

  board[to.row][to.column] = {
    color: piece.color,
    type: promoted ? "q" : piece.type,
  };

  const castle =
    piece.type === "k" ? castleSideForMove(piece.color, from, to) : null;

  if (castle) {
    applyCastleRook(board, piece.color, castle);
  }

  const castling = nextCastlingRights(state, from, to);
  const resolved = resolveNextTurn(board, piece.color, state.activePlayers);

  return {
    board,
    turn: resolved.turn,
    activePlayers: resolved.activePlayers,
    winner: resolved.winner,
    lastMove: {
      from: { ...from },
      to: { ...to },
      piece: piece.type,
      color: piece.color,
      captured,
      promoted,
      ...(castle ? { castle } : {}),
    },
    moveCount: state.moveCount + 1,
    castling,
    event:
      resolved.event ??
      (promoted
        ? `${fourPlayerLabel(piece.color)} promoted a pawn to Queen.`
        : castle
          ? `${fourPlayerLabel(piece.color)} castled.`
          : null),
  };
}
