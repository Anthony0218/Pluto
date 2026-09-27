import { ui, useUiLanguage } from "@/i18n/ui";
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
  useUiLanguage();
  return (
    <div className="game-status">
      {illegal && <div>{ui("This is an illegal move!")}</div>}

      <div>{ui("white:")}{whiteCheckCounter}{ui(", black: ")}{blackCheckCounter}
      </div>

      {gameOver && (
        <div className="game-over">
          {gameOverReason === "Checkmate" ? (
            <span>{winner}{ui(" has won by checkmate!")}</span>
          ) : (
            <span>{ui("Game drawn: ")}{gameOverReason}</span>
          )}
        </div>
      )}
    </div>
  );
}
