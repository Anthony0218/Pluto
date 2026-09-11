import "./ChessBoard.css";
import loadButton from "../assets/load-button.svg";

type GameControlsProps = {
  gameName: string;
  whitePlayer: string;
  blackPlayer: string;

  onGameNameChange: (value: string) => void;
  onWhitePlayerChange: (value: string) => void;
  onBlackPlayerChange: (value: string) => void;

  onUndo: () => void;
  onRestart: () => void;
  onSave: () => void;
};

export default function GameControls({
  gameName,
  whitePlayer,
  blackPlayer,
  onGameNameChange,
  onWhitePlayerChange,
  onBlackPlayerChange,
  onUndo,
  onRestart,
  onSave,
}: GameControlsProps) {
  return (
    <div className="game-controls">
      <div className="control-buttons">
        <button onClick={onUndo}>Undo</button>

        <button onClick={onRestart}>Restart Game</button>
      </div>

      <div className="game-info">
        <input
          type="text"
          placeholder="Game name"
          value={gameName}
          onChange={(event) => onGameNameChange(event.target.value)}
        />

        <input
          type="text"
          placeholder="White player"
          value={whitePlayer}
          onChange={(event) => onWhitePlayerChange(event.target.value)}
        />

        <input
          type="text"
          placeholder="Black player"
          value={blackPlayer}
          onChange={(event) => onBlackPlayerChange(event.target.value)}
        />

        <button className="svg-button" onClick={onSave}>
          Save Game <img src={loadButton} alt="save" />
        </button>
      </div>
    </div>
  );
}
