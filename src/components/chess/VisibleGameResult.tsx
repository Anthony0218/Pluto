import ChessMatchStatus from "@/components/chess/singleplayer/ChessMatchStatus";
import GameXpReward from "@/components/games/GameXpReward";
import { ui, useUiLanguage } from "@/i18n/ui";
import { type ReactNode } from "react";

type VisibleGameResultProps = {
  winner?: string | null;
  playerColor?: string | null;
  reason?: string | null;
  actions?: ReactNode;
};

const reasonLabels: Record<string, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  draw: "Draw",
  insufficient: "Insufficient material",
  "insufficient material": "Insufficient material",
  fifty: "50-move rule",
  "50-move rule": "50-move rule",
  repetition: "Threefold repetition",
  "threefold repetition": "Threefold repetition",
  resignation: "Resignation",
  boss_hp: "Boss defeated",
  lives: "No lives remaining",
  trapped: "King trapped",
  "last player standing": "Last player standing",
};

export default function VisibleGameResult({
  winner,
  playerColor,
  reason,
  actions,
}: VisibleGameResultProps) {
  useUiLanguage();
  const isDraw = winner === "draw";
  const winnerName = winner ? `${winner[0].toUpperCase()}${winner.slice(1)}` : null;
  const result = isDraw
    ? "Draw"
    : winner && playerColor
      ? winner === playerColor
        ? "You win"
        : "You lose"
      : winnerName
        ? `${winnerName} wins`
        : "Game over";
  const reasonLabel = reason ? reasonLabels[reason.toLowerCase()] ?? reason : null;

  return (
    <div className="mb-3">
      <div className="chess-status-row">
        <ChessMatchStatus
          event={isDraw ? "draw" : reason === "checkmate" ? "checkmate" : "variant"}
          label="Game over"
          message={<strong className="text-lg font-black text-white">{ui(result)}</strong>}
          detail={reasonLabel && reasonLabel !== result ? ui(reasonLabel) : undefined}
          className="!mt-0"
        />
        <GameXpReward />
      </div>
      {actions && (
        <div className="chess-variant-result-actions mt-2 flex flex-wrap gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
