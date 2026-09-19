import { useState } from "react";

import "../index.css";

import ChessBoard from "../components/ChessBoardCustom";
import SelectionNavigation from "../components/SelectionNavigation";
import Sidebar from "../components/SidebarCustom";

import "../utils/customChess";

type Color = "white" | "black";

type PieceType =
  | "king"
  | "queen"
  | "rook"
  | "bishop"
  | "knight"
  | "pawn";

type Piece = {
  color: Color;
  type: PieceType;
};

type Board = Record<string, Piece | null>;

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = [8, 7, 6, 5, 4, 3, 2, 1];



function createEmptyBoard(): Board {
  const board: Board = {};

  for (const rank of ranks) {
    for (const file of files) {
      board[`${file}${rank}`] = null;
    }
  }

  return board;
}

/* -------------------------------------------------------
   Coordinate helpers
------------------------------------------------------- */

function squareToCoordinates(square: string) {
  const file = files.indexOf(square[0]);
  const rank = Number(square[1]);

  return {
    file,
    rank,
  };
}

function coordinatesToSquare(
  file: number,
  rank: number
): string | null {
  if (file < 0 || file > 7) {
    return null;
  }

  if (rank < 1 || rank > 8) {
    return null;
  }

  return `${files[file]}${rank}`;
}

/* -------------------------------------------------------
   Move calculation
------------------------------------------------------- */

/*
 * Calculates pseudo-legal moves.

 * This intentionally does not check whether the player's
 * king would be left in check.

 * That keeps the position editor independent of a chess
 * library and makes it useful for arbitrary constellations.
 */
function getPossibleMoves(
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

    /*
     * A piece cannot move onto a square occupied
     * by a friendly piece.
     *
     * It can capture an opponent piece.
     */
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

      while (true) {
        const canContinue = addSquare(
          currentFile,
          currentRank
        );

        if (!canContinue) {
          break;
        }

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

    case "knight": {
      const knightMoves = [
        [1, 2],
        [2, 1],
        [2, -1],
        [1, -2],
        [-1, -2],
        [-2, -1],
        [-2, 1],
        [-1, 2],
      ];

      for (const [df, dr] of knightMoves) {
        addSquare(
          file + df,
          rank + dr
        );
      }

      break;
    }

    case "king": {
      const kingMoves = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ];

      for (const [df, dr] of kingMoves) {
        addSquare(
          file + df,
          rank + dr
        );
      }

      break;
    }

    case "pawn": {
      const direction =
        piece.color === "white"
          ? 1
          : -1;

      const startingRank =
        piece.color === "white"
          ? 2
          : 7;

      /*
       * One square forward.
       */
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

        /*
         * Two squares from starting position.
         */
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

      /*
       * Pawn captures.
       */
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

/*
 * Returns all currently possible moves of one color.
 */
function getAllColorMoves(
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
      const pieceMoves =
        getPossibleMoves(
          board,
          square
        );

      for (const move of pieceMoves) {
        moves.add(move);
      }
    }
  }

  return moves;
}

/* -------------------------------------------------------
   Main component
------------------------------------------------------- */

export default function ChessBoardEditor() {
  const [board, setBoard] =
    useState<Board>(createEmptyBoard);

  const [boardSize, setBoardSize] = 
    useState(640);

  const [selectedColor, setSelectedColor] =
    useState<Color>("white");

  const [selectedPiece, setSelectedPiece] =
    useState<PieceType>("king");

  const [
    pieceInfoCheckbox,
    setPieceInfoCheckbox,
  ] = useState(false);

  const [
    opponentInfoCheckbox,
    setOpponentInfoCheckbox,
  ] = useState(false);

  const [
    hoveredSquare, 
    setHoveredSquare
  ] = useState<string | null>(null);

  const [
    selectedSquare,
    setSelectedSquare,
  ] = useState<string | null>(null);

  /*
   * Possible moves for the selected piece
   * if it were placed on the hovered square.
   */
 

  /*
   * All possible destinations of the
   * opposite color's currently placed pieces.
   */


  function clearBoard() {
    setBoard(createEmptyBoard());
    setSelectedSquare(null);
  }

  return (
    <>
    <div className="grid grid-flow-col grid-rows-3 gap-4">
      <div className="row-span-3 h-screen w-1/3 rounded-sm place-items-center">
        <Sidebar
        selectedColor={selectedColor}
        selectedPiece={selectedPiece}
        boardSize={boardSize}
        pieceInfoCheckbox={pieceInfoCheckbox}
        opponentInfoCheckbox={opponentInfoCheckbox}
        onPieceInfoChange={setPieceInfoCheckbox}
        onOpponentInfoChange={setOpponentInfoCheckbox}
        onBoardSizeChange={setBoardSize}
        onClearBoard={clearBoard}
      />
      </div>
      
      <div className="col-span-2 w-2/3">
        <SelectionNavigation
          color={selectedColor}
          pieceType={selectedPiece}
          onColorChange={setSelectedColor}
          onPieceChange={setSelectedPiece}
        />
      </div>

      <div className="col-span-2 row-span-2 place-self-center">
        <Grid />
      </div>
    </div>
    </>
  )
};

const ROW_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const COLUMN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Grid() {
  const [rowCount, setRowCount] = useState(3);
  const [columnCount, setColumnCount] = useState(4);

  return (
    <div>
      <div>
        <label htmlFor="row-count">Number of rows: </label>

        <select
          id="row-count"
          value={rowCount}
          onChange={(event) => setRowCount(Number(event.target.value))}
        >
          {ROW_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="column-count">Number of columns: </label>

        <select
          id="column-count"
          value={columnCount}
          onChange={(event) => setColumnCount(Number(event.target.value))}
        >
          {COLUMN_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateRows: `repeat(${rowCount}, 50px)`,
          gridTemplateColumns: `repeat(${columnCount}, 100px)`,
          gap: "8px",
          marginTop: "16px",
        }}
      >
        {Array.from(
          { length: rowCount * columnCount },
          (_, index) => (
            <div
              key={index}
              style={{
                minWidth: 0,
                minHeight: 0,
              }}
            >
              <button
                type="button"
                style={{
                  width: "100%",
                  height: "100%",
                  padding: 0,
                  zIndex: 3,
                  border: "2px red dashed",
                  boxSizing: "border-box",
                  cursor: "pointer",
                }}
                onClick={() => console.log(`Button ${index + 1} clicked`)}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

/*
<ChessBoard
        board={board}
        boardSize={boardSize}
        selectedSquare={selectedSquare}
        hoveredSquare={hoveredSquare}
        selectedPieceMoves={selectedPieceMoves}
        opponentMoves={opponentMoves}
        onSquareClick={placePiece}
        onSquareHover={setHoveredSquare}
        onSquareRemove={removePiece}
      />
      */