import React, { useMemo, useState } from "react";

type Color = "white" | "black";
type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

type Piece = {
  color: Color;
  type: PieceType;
};

type Board = Record<string, Piece | null>;

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

const PIECES: Record<Color, Record<PieceType, string>> = {
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

const pieceTypes: PieceType[] = [
  "king",
  "queen",
  "rook",
  "bishop",
  "knight",
  "pawn",
];

function createEmptyBoard(): Board {
  const board: Board = {};

  for (const rank of ranks) {
    for (const file of files) {
      board[`${file}${rank}`] = null;
    }
  }

  return board;
}

/**
 * Converts the internal board representation into a compact
 * JSON string that can be embedded in exported HTML.
 */
function serializeBoard(board: Board): string {
  return JSON.stringify(board);
}

function deserializeBoard(value: string): Board {
  const parsed = JSON.parse(value);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid board data");
  }

  return parsed as Board;
}

/**
 * Creates a completely standalone HTML document.
 *
 * The generated HTML does not require React, JavaScript,
 * or any external files. The constellation is stored directly
 * in the document.
 */
function createExportHtml(board: Board): string {
  const serializedBoard = serializeBoard(board);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chess Position</title>

<style>
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #202020;
    font-family: system-ui, sans-serif;
  }

  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  h1 {
    color: white;
    margin: 0;
    font-size: 22px;
  }

  .board {
    width: min(90vw, 640px);
    aspect-ratio: 1;
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    border: 4px solid #111;
  }

  .square {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(32px, 8vw, 72px);
    user-select: none;
  }

  .light {
    background: #f0d9b5;
  }

  .dark {
    background: #b58863;
  }

  .piece {
    line-height: 1;
    font-family:
      "DejaVu Sans",
      "Noto Sans Symbols 2",
      "Segoe UI Symbol",
      sans-serif;
  }

  .info {
    color: #ccc;
    font-size: 14px;
  }
</style>
</head>

<body>

<div class="container">
  <h1>Saved Chess Position</h1>

  <div id="board" class="board"></div>

  <div class="info">
    Static exported chess constellation
  </div>
</div>

<script>
  const boardData = ${JSON.stringify(serializedBoard)};

  const board = JSON.parse(boardData);

  const files = ["a","b","c","d","e","f","g","h"];
  const ranks = [8,7,6,5,4,3,2,1];

  const pieces = {
    white: {
      king: "♔",
      queen: "♕",
      rook: "♖",
      bishop: "♗",
      knight: "♘",
      pawn: "♙"
    },
    black: {
      king: "♚",
      queen: "♛",
      rook: "♜",
      bishop: "♝",
      knight: "♞",
      pawn: "♟"
    }
  };

  const boardElement = document.getElementById("board");

  for (const rank of ranks) {
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      const squareName = file + rank;

      const square = document.createElement("div");

      const isLight =
        (fileIndex + rank) % 2 === 1;

      square.className =
        "square " + (isLight ? "light" : "dark");

      const piece = board[squareName];

      if (piece) {
        const pieceElement = document.createElement("span");

        pieceElement.className = "piece";
        pieceElement.textContent =
          pieces[piece.color][piece.type];

        square.appendChild(pieceElement);
      }

      boardElement.appendChild(square);
    }
  }
</script>

</body>
</html>`;
}

function downloadHtml(board: Board) {
  const html = createExportHtml(board);

  const blob = new Blob([html], {
    type: "text/html;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "chess-position.html";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function ChessPositionEditor() {
  const [board, setBoard] = useState<Board>(() =>
    createEmptyBoard()
  );

  const [selectedColor, setSelectedColor] =
    useState<Color>("white");

  const [selectedPiece, setSelectedPiece] =
    useState<PieceType>("king");

  const [selectedSquare, setSelectedSquare] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const selectedPieceSymbol = useMemo(
    () => PIECES[selectedColor][selectedPiece],
    [selectedColor, selectedPiece]
  );

  function handleSquareClick(square: string) {
    setError(null);
    setSelectedSquare(square);

    setBoard((current) => ({
      ...current,
      [square]: {
        color: selectedColor,
        type: selectedPiece,
      },
    }));
  }

  function removePiece(square: string) {
    setBoard((current) => ({
      ...current,
      [square]: null,
    }));
  }

  function clearBoard() {
    setBoard(createEmptyBoard());
    setSelectedSquare(null);
  }

  function handleImport(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = String(reader.result);

        const match = text.match(
          /const boardData = (.*?);/
        );

        if (!match) {
          throw new Error(
            "Could not find a saved chess position."
          );
        }

        const serialized = JSON.parse(match[1]);
        const importedBoard = deserializeBoard(serialized);

        setBoard(importedBoard);
        setError(null);
      } catch {
        setError(
          "The selected file does not contain a valid chess position."
        );
      }
    };

    reader.readAsText(file);

    // Allows selecting the same file again later.
    event.target.value = "";
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>
          Chess Position Editor
        </h1>

        <div style={styles.editor}>
          <div style={styles.board}>
            {ranks.map((rank) =>
              files.map((file, fileIndex) => {
                const square = `${file}${rank}`;
                const piece = board[square];

                const isLight =
                  (fileIndex + rank) % 2 === 1;

                const isSelected =
                  selectedSquare === square;

                return (
                  <button
                    key={square}
                    type="button"
                    onClick={() =>
                      handleSquareClick(square)
                    }
                    onContextMenu={(event) => {
                      event.preventDefault();
                      removePiece(square);
                    }}
                    title={square}
                    style={{
                      ...styles.square,
                      background: isLight
                        ? "#f0d9b5"
                        : "#b58863",
                      outline: isSelected
                        ? "4px solid #ffcc00"
                        : "none",
                      outlineOffset: "-4px",
                    }}
                  >
                    {piece && (
                      <span style={styles.piece}>
                        {PIECES[piece.color][piece.type]}
                      </span>
                    )}

                    {/* Coordinate labels */}
                    {file === "a" && (
                      <span style={styles.rankLabel}>
                        {rank}
                      </span>
                    )}

                    {rank === 1 && (
                      <span style={styles.fileLabel}>
                        {file}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>
              Piece
            </h2>

            <div style={styles.colorButtons}>
              <button
                type="button"
                onClick={() =>
                  setSelectedColor("white")
                }
                style={{
                  ...styles.colorButton,
                  ...(selectedColor === "white"
                    ? styles.activeButton
                    : {}),
                }}
              >
                White
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedColor("black")
                }
                style={{
                  ...styles.colorButton,
                  ...(selectedColor === "black"
                    ? styles.activeButton
                    : {}),
                }}
              >
                Black
              </button>
            </div>

            <div style={styles.pieceGrid}>
              {pieceTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setSelectedPiece(type)
                  }
                  title={type}
                  style={{
                    ...styles.pieceButton,
                    ...(selectedPiece === type
                      ? styles.activePiece
                      : {}),
                  }}
                >
                  {PIECES[selectedColor][type]}
                </button>
              ))}
            </div>

            <div style={styles.selectedInfo}>
              Selected:{" "}
              <strong>
                {selectedPieceSymbol}{" "}
                {selectedColor} {selectedPiece}
              </strong>
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedSquare) {
                  removePiece(selectedSquare);
                }
              }}
              style={styles.actionButton}
            >
              Remove selected
            </button>

            <button
              type="button"
              onClick={clearBoard}
              style={styles.actionButton}
            >
              Clear board
            </button>

            <button
              type="button"
              onClick={() => downloadHtml(board)}
              style={styles.exportButton}
            >
              Export HTML
            </button>

            <label style={styles.importButton}>
              Import HTML
              <input
                type="file"
                accept=".html,text/html"
                onChange={handleImport}
                style={{ display: "none" }}
              />
            </label>

            {error && (
              <div style={styles.error}>
                {error}
              </div>
            )}

            <div style={styles.help}>
              <strong>How to use</strong>

              <p>
                Select a color and piece, then click any
                square to place it.
              </p>

              <p>
                Right-click a square to remove its piece.
              </p>

              <p>
                Export HTML creates a completely
                standalone file containing the current
                constellation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#202020",
    color: "white",
    padding: 32,
    fontFamily: "system-ui, sans-serif",
  },

  container: {
    maxWidth: 1100,
    margin: "0 auto",
  },

  title: {
    marginTop: 0,
    marginBottom: 24,
  },

  editor: {
    display: "flex",
    gap: 32,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  board: {
    width: "min(70vw, 640px)",
    minWidth: 320,
    aspectRatio: "1",
    display: "grid",
    gridTemplateColumns: "repeat(8, 1fr)",
    border: "4px solid #111",
  },

  square: {
    position: "relative",
    border: "none",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    aspectRatio: "1",
  },

  piece: {
    fontSize: "clamp(30px, 7vw, 70px)",
    lineHeight: 1,
    fontFamily:
      '"DejaVu Sans", "Noto Sans Symbols 2", "Segoe UI Symbol", sans-serif',
    pointerEvents: "none",
  },

  rankLabel: {
    position: "absolute",
    top: 3,
    left: 4,
    fontSize: 11,
    fontWeight: 700,
    opacity: 0.6,
    pointerEvents: "none",
  },

  fileLabel: {
    position: "absolute",
    right: 4,
    bottom: 2,
    fontSize: 11,
    fontWeight: 700,
    opacity: 0.6,
    pointerEvents: "none",
  },

  panel: {
    width: 280,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  panelTitle: {
    margin: 0,
  },

  colorButtons: {
    display: "flex",
    gap: 8,
  },

  colorButton: {
    flex: 1,
    padding: "10px 14px",
    border: "1px solid #555",
    borderRadius: 6,
    background: "#333",
    color: "white",
    cursor: "pointer",
  },

  activeButton: {
    background: "#555",
    borderColor: "#fff",
  },

  pieceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },

  pieceButton: {
    height: 64,
    fontSize: 40,
    border: "1px solid #555",
    borderRadius: 6,
    background: "#333",
    color: "white",
    cursor: "pointer",
  },

  activePiece: {
    background: "#555",
    borderColor: "#ffcc00",
    boxShadow: "0 0 0 2px #ffcc00",
  },

  selectedInfo: {
    padding: 12,
    background: "#2b2b2b",
    borderRadius: 6,
    fontSize: 14,
  },

  actionButton: {
    padding: "11px 14px",
    border: "none",
    borderRadius: 6,
    background: "#444",
    color: "white",
    cursor: "pointer",
  },

  exportButton: {
    padding: "13px 14px",
    border: "none",
    borderRadius: 6,
    background: "#287a45",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },

  importButton: {
    padding: "11px 14px",
    border: "1px solid #555",
    borderRadius: 6,
    background: "#333",
    color: "white",
    cursor: "pointer",
    textAlign: "center",
  },

  error: {
    padding: 10,
    borderRadius: 6,
    background: "#632b2b",
    color: "#ffcccc",
    fontSize: 13,
  },

  help: {
    marginTop: 8,
    padding: 14,
    background: "#292929",
    borderRadius: 6,
    color: "#bbb",
    fontSize: 13,
    lineHeight: 1.5,
  },
};