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
    <>
      <h2>
        Position
      </h2>

      <label>
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

      <label>
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

      <div>
        Opponent:{" "}
        <strong>
          {opponentColor}
        </strong>
      </div>

      <div>
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

      <div>

        <button
          type="button"
          onClick={onClearBoard}
        >
          Clear board
        </button>

      </div>
    </>
  );
}