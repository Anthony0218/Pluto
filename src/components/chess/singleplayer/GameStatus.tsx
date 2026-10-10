import { gameUi } from "../../../i18n/gameUi.ts";
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

      <div>{ui("white:")}{gameUi(whiteCheckCounter)}{ui(", black: ")}{gameUi(blackCheckCounter)}
      </div>

      {gameUi(gameOver && (
        <div className="game-over">
          {gameUi(gameOverReason === "Checkmate" ? (
            <span>{gameUi(winner)}{ui(" has won by checkmate!")}</span>
          ) : (
            <span>{ui("Game drawn: ")}{gameUi(gameOverReason)}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
