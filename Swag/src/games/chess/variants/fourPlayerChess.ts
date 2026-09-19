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
};

export type FourPlayerState = {
  board: (FourPlayerPiece | null)[][];
  turn: FourPlayerColor;
  activePlayers: FourPlayerColor[];
  winner: FourPlayerColor | null;
  lastMove: FourPlayerMove | null;
  moveCount: number;
  event: string | null;
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

function cloneBoard(board: (FourPlayerPiece | null)[][]) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function cloneFourPlayerState(state: FourPlayerState): FourPlayerState {
  return {
    ...state,
    board: cloneBoard(state.board),
    activePlayers: [...state.activePlayers],
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

  return pseudoMoves(state.board, from).filter((to) => {
    const simulated = simulateMove(state.board, from, to);

    return !isFourPlayerKingInCheck(simulated, piece.color);
  });
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
    },
    moveCount: state.moveCount + 1,
    event:
      resolved.event ??
      (promoted
        ? `${fourPlayerLabel(piece.color)} promoted a pawn to Queen.`
        : null),
  };
}
