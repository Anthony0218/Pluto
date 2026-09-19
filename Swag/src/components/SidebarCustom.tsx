import React from "react";
import {
  type Color,
  type PieceType,
} from "../utils/customChess";

type Props = {
  selectedColor: Color;
  selectedPiece: PieceType;

  boardSize: number;

  pieceInfoCheckbox: boolean;
  opponentInfoCheckbox: boolean;

  onPieceInfoChange: (
    value: boolean
  ) => void;

  onOpponentInfoChange: (
    value: boolean
  ) => void;

  onBoardSizeChange: (
    value: number
  ) => void;

  onClearBoard: () => void;
};

export default function Sidebar({
  selectedColor,

  boardSize,

  pieceInfoCheckbox,
  opponentInfoCheckbox,

  onPieceInfoChange,
  onOpponentInfoChange,
  onBoardSizeChange,

  onClearBoard,
}: Props) {
  const opponentColor =
    selectedColor === "white"
      ? "black"
      : "white";

  return (
    <aside style={styles.sidebar}>
      <h2>
        Position
      </h2>

      <label style={styles.checkbox}>
        <input
          id="pieceInfoCheckbox"
          type="checkbox"
          checked={
            pieceInfoCheckbox
          }
          onChange={(event) =>
            onPieceInfoChange(
              event.target.checked
            )
          }
        />

        Show selected piece moves
      </label>

      <label style={styles.checkbox}>
        <input
          id="opponentInfoCheckbox"
          type="checkbox"
          checked={
            opponentInfoCheckbox
          }
          onChange={(event) =>
            onOpponentInfoChange(
              event.target.checked
            )
          }
        />

        Show opponent moves
      </label>

      <div style={styles.opponent}>
        Opponent:{" "}
        <strong>
          {opponentColor}
        </strong>
      </div>

      <div style={styles.sizeControl}>
        <label htmlFor="boardSizeSlider">
          Board size:{" "}
          {boardSize}px
        </label>

        <input
          id="boardSizeSlider"
          type="range"
          min="320"
          max="900"
          step="10"
          value={boardSize}
          onChange={(event) =>
            onBoardSizeChange(
              Number(event.target.value)
            )
          }
        />
      </div>

      <div style={styles.actions}>

        <button
          type="button"
          onClick={onClearBoard}
          style={styles.button}
        >
          Clear board
        </button>

      </div>
    </aside>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  sidebar: {
    width: 280,

    flexShrink: 0,

    padding: 20,

    background: "#2a2a2a",

    border: "1px solid #444",
    borderRadius: 10,
  },

  checkbox: {
    display: "flex",
    gap: 10,

    marginBottom: 12,

    cursor: "pointer",
  },

  preview: {
    padding: 12,
    marginBottom: 16,

    background: "#222",

    borderRadius: 8,

    textAlign: "center",
  },

  moves: {
    marginTop: 8,

    color: "#aaa",

    fontSize: 12,
    lineHeight: 1.5,
  },

  opponent: {
    marginBottom: 20,

    color: "#aaa",

    fontSize: 13,
  },

  sizeControl: {
    display: "flex",
    flexDirection: "column",

    gap: 8,

    marginBottom: 20,

    color: "#ccc",

    fontSize: 13,
  },

  actions: {
    display: "flex",
    flexDirection: "column",

    gap: 8,
  },

  button: {
    padding: 10,

    border: "none",
    borderRadius: 6,

    background: "#444",
    color: "white",

    cursor: "pointer",
  },

  export: {
    padding: 12,

    border: "none",
    borderRadius: 6,

    background: "#287a45",
    color: "white",

    fontWeight: "bold",

    cursor: "pointer",
  },
};