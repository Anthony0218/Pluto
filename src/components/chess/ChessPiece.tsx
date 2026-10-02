import type { PieceTheme } from "@/context/ChessSettingsContext";
import { chessPieceAssetThemes } from "@/assets/chess/themes";

type Kind = "p" | "n" | "b" | "r" | "q" | "k";
type ArtTheme = Exclude<PieceTheme, "classic">;
type PieceCode = keyof typeof chessPieceAssetThemes.jazz.pieces;

export default function ChessPiece({ type, color, theme }: { type: Kind; color: "w" | "b"; theme: ArtTheme }) {
  const code = `${color}${type.toUpperCase()}` as PieceCode;
  return <img
    src={chessPieceAssetThemes[theme].pieces[code]}
    alt=""
    aria-hidden="true"
    draggable={false}
    className="pointer-events-none block h-[91%] w-[91%] select-none object-contain object-center"
  />;
}
