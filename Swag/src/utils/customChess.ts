export type Color = "white" | "black";

export type PieceType =
  | "king"
  | "queen"
  | "rook"
  | "bishop"
  | "knight"
  | "pawn";

export type Piece = {
  color: Color;
  type: PieceType;
};

export type Board = Record<string, Piece | null>;

export const files = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
];

export const ranks = [
  10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
];

export const pieceTypes: PieceType[] = [
  "king",
  "queen",
  "rook",
  "bishop",
  "knight",
  "pawn",
];

export const symbols: Record<
  Color,
  Record<PieceType, string>
> = {
  white: {
    king: "♔",
    queen: "♕",
    rook: "♖",
    bishop: "♗",
    knight: "♘",
    pawn: "♙",
  },

  black: {
    king: "♚",
    queen: "♛",
    rook: "♜",
    bishop: "♝",
    knight: "♞",
    pawn: "♟",
  },
};

export function createEmptyBoard(): Board {
  const board: Board = {};

  for (const rank of ranks) {
    for (const file of files) {
      board[`${file}${rank}`] = null;
    }
  }

  return board;
}

function squareToCoordinates(square: string) {
  return {
    file: files.indexOf(square[0]),
    rank: Number(square[1]),
  };
}

function coordinatesToSquare(
  file: number,
  rank: number
): string | null {
  if (
    file < 0 ||
    file > 7 ||
    rank < 1 ||
    rank > 8
  ) {
    return null;
  }

  return `${files[file]}${rank}`;
}

export function getPossibleMoves(
  board: Board,
  square: string
): string[] {
  const piece = board[square];

  if (!piece) {
    return [];
  }

  const { file, rank } =
    squareToCoordinates(square);

  const moves: string[] = [];

  function addSquare(
    targetFile: number,
    targetRank: number
  ): boolean {
    const target =
      coordinatesToSquare(
        targetFile,
        targetRank
      );

    if (!target) {
      return false;
    }

    const targetPiece = board[target];

    if (!targetPiece) {
      moves.push(target);
      return true;
    }

    if (
      targetPiece.color !==
      piece?.color
    ) {
      moves.push(target);
    }

    return false;
  }

  function addSlidingMoves(
    directions: Array<[number, number]>
  ) {
    for (const [df, dr] of directions) {
      let currentFile = file + df;
      let currentRank = rank + dr;

      while (
        addSquare(
          currentFile,
          currentRank
        )
      ) {
        currentFile += df;
        currentRank += dr;
      }
    }
  }

  switch (piece.type) {
    case "rook":
      addSlidingMoves([
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]);
      break;

    case "bishop":
      addSlidingMoves([
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
      break;

    case "queen":
      addSlidingMoves([
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
      break;

    case "knight":
      for (const [df, dr] of [
        [1, 2],
        [2, 1],
        [2, -1],
        [1, -2],
        [-1, -2],
        [-2, -1],
        [-2, 1],
        [-1, 2],
      ]) {
        addSquare(
          file + df,
          rank + dr
        );
      }
      break;

    case "king":
      for (const [df, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        addSquare(
          file + df,
          rank + dr
        );
      }
      break;

    case "pawn": {
      const direction =
        piece.color === "white"
          ? 1
          : -1;

      const startingRank =
        piece.color === "white"
          ? 2
          : 7;

      const oneForward =
        coordinatesToSquare(
          file,
          rank + direction
        );

      if (
        oneForward &&
        !board[oneForward]
      ) {
        moves.push(oneForward);

        if (rank === startingRank) {
          const twoForward =
            coordinatesToSquare(
              file,
              rank +
                direction * 2
            );

          if (
            twoForward &&
            !board[twoForward]
          ) {
            moves.push(twoForward);
          }
        }
      }

      for (const df of [-1, 1]) {
        const target =
          coordinatesToSquare(
            file + df,
            rank + direction
          );

        if (
          target &&
          board[target] &&
          board[target]?.color !==
            piece.color
        ) {
          moves.push(target);
        }
      }

      break;
    }
  }

  return moves;
}

export function getAllColorMoves(
  board: Board,
  color: Color
): Set<string> {
  const moves = new Set<string>();

  for (const square of Object.keys(board)) {
    const piece = board[square];

    if (
      piece &&
      piece.color === color
    ) {
      for (const move of getPossibleMoves(
        board,
        square
      )) {
        moves.add(move);
      }
    }
  }

  return moves;
}