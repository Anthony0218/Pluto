import React from "react";
import {
  type Color,
  type PieceType,
  pieceTypes,
  symbols,
} from "../utils/customChess";

type Props = {
  color: Color;
  pieceType: PieceType;

  onColorChange: (
    color: Color
  ) => void;

  onPieceChange: (
    piece: PieceType
  ) => void;
};

export default function SelectionNavigation({
  color,
  pieceType,
  onColorChange,
  onPieceChange,
}: Props) {
  return (
    <div
      id="selectionNavigation"
      style={styles.navigation}
    >
      <div style={styles.colors}>
        <button
          type="button"
          onClick={() =>
            onColorChange("white")
          }
          style={{
            ...styles.colorButton,
            ...(color === "white"
              ? styles.active
              : {}),
          }}
        >
          White
        </button>

        <button
          type="button"
          onClick={() =>
            onColorChange("black")
          }
          style={{
            ...styles.colorButton,
            ...(color === "black"
              ? styles.active
              : {}),
          }}
        >
          Black
        </button>
      </div>

      <div style={styles.pieces}>
        {pieceTypes.map((type) => (
          <button
            key={type}
            type="button"
            title={type}
            onClick={() =>
              onPieceChange(type)
            }
            style={{
              ...styles.pieceButton,
              ...(pieceType === type
                ? styles.selected
                : {}),
            }}
          >
            <span>
              {symbols[color][type]}
            </span>

            <small>{type}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  navigation: {
    width: "100%",

    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",

    gap: 16,

    padding: 10,

    marginBottom: 12,

    background: "#2a2a2a",

    border: "1px solid #444",
    borderRadius: 8,
  },

  colors: {
    display: "flex",
    gap: 6,
  },

  colorButton: {
    padding: "8px 12px",

    border: "1px solid #555",
    borderRadius: 6,

    background: "#333",
    color: "white",

    cursor: "pointer",
  },

  active: {
    background: "#666",
    borderColor: "#aaa",
  },

  pieces: {
    display: "flex",
    gap: 5,
  },

  pieceButton: {
    width: 64,
    height: 60,

    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",

    border: "2px solid transparent",
    borderRadius: 6,

    background: "#333",
    color: "white",

    cursor: "pointer",
  },

  selected: {
    borderColor: "#ffcc00",
  },
};