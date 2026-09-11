import "./ChessBoard.css";
type GameStatusProps = {
  illegal: boolean;
  whiteCheckCounter: number;
  blackCheckCounter: number;
  gameOver: boolean;
  gameOverReason: string;
  winner: string;
};

export default function GameStatus({
  illegal,
  whiteCheckCounter,
  blackCheckCounter,
  gameOver,
  gameOverReason,
  winner,
}: GameStatusProps) {
  return (
    <div className="game-status">
      {illegal && <div>This is an illegal move!</div>}

      <div>
        white: {whiteCheckCounter}, black: {blackCheckCounter}
      </div>

      {gameOver && (
        <div className="game-over">
          {gameOverReason === "Checkmate" ? (
            <span>{winner} has won by checkmate!</span>
          ) : (
            <span>Game drawn: {gameOverReason}</span>
          )}
        </div>
      )}
    </div>
  );
}
