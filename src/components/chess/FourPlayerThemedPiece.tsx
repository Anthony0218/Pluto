import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import ChessPiece from "./ChessPiece";
import { useChessSettings } from "@/context/ChessSettingsContext";
import type { FourPlayerPiece } from "@/games/chess/variants/fourPlayerChess";

const symbols = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" } as const;
const colors = {
  red: { text: "text-red-400", background: "#b91c1c" },
  blue: { text: "text-sky-400", background: "#075985" },
  yellow: { text: "text-amber-300", background: "#fbbf24" },
  green: { text: "text-emerald-400", background: "#047857" },
} as const;

export default function FourPlayerThemedPiece({ piece }: { piece: FourPlayerPiece }) {
  useGameLanguage();
  const { pieceTheme } = useChessSettings();
  const color = colors[piece.color];

  return (
    <span className="pointer-events-none relative z-10 flex h-full w-full select-none items-center justify-center transition-transform duration-150 group-hover:scale-105">
      {gameUi(pieceTheme === "classic" ? (
        <span className={`font-serif text-[clamp(1.15rem,3.5vw,3.2rem)] leading-none drop-shadow-[0_3px_3px_rgba(0,0,0,0.75)] ${color.text}`}>
          {gameUi(symbols[piece.type])}
        </span>
      ) : (
        <>
          <span className="absolute inset-[8%] rounded-full border border-white/45 shadow-[0_2px_5px_rgba(0,0,0,0.6)]" style={{ backgroundColor: color.background }} />
          <span className="relative z-10 flex h-full w-full items-center justify-center">
            <ChessPiece type={piece.type} color={piece.color === "yellow" ? "b" : "w"} theme={pieceTheme} />
          </span>
        </>
      ))}
    </span>
  );
}
