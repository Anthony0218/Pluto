import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type PieceTheme = "classic" | "russian" | "geometric" | "elegant" | "jazz";
export type BoardTheme = "wood" | "green" | "walnut" | "dark" | "marble" | "minimal" | "vintage";
export const pieceThemes: PieceTheme[] = ["classic", "russian", "geometric", "elegant", "jazz"];
export const boardThemes: BoardTheme[] = ["wood", "green", "walnut", "dark", "marble", "minimal", "vintage"];
export const boardColors: Record<BoardTheme, { light: string; dark: string; frame: string }> = {
  wood: { light: "#ead7b7", dark: "#82583d", frame: "#493323" },
  green: { light: "#f1f2d8", dark: "#669273", frame: "#314a3b" },
  walnut: { light: "#d2af81", dark: "#65442f", frame: "#39271f" },
  dark: { light: "#a0a8b4", dark: "#384452", frame: "#1e252e" },
  marble: { light: "#f0ede6", dark: "#858d95", frame: "#58616b" },
  minimal: { light: "#f6f5f1", dark: "#a8b0b9", frame: "#59636b" },
  vintage: { light: "#e9d6a1", dark: "#777746", frame: "#504d2e" },
};

function savedValue<T extends string>(key: string, options: readonly T[], fallback: T): T {
  try { const value = localStorage.getItem(key); return options.find(option => option === value) ?? fallback; }
  catch { return fallback; }
}

type ChessSettingsContextType = {
  boardAnimationEnabled: boolean;
  setBoardAnimationEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  pieceTheme: PieceTheme;
  setPieceTheme: React.Dispatch<React.SetStateAction<PieceTheme>>;
  boardTheme: BoardTheme;
  setBoardTheme: React.Dispatch<React.SetStateAction<BoardTheme>>;
};

const ChessSettingsContext = createContext<ChessSettingsContextType | null>(
  null,
);

export function ChessSettingsProvider({ children }: { children: ReactNode }) {
  const [boardAnimationEnabled, setBoardAnimationEnabled] = useState(true);
  const [pieceTheme, setPieceTheme] = useState<PieceTheme>(() => savedValue("chess-piece-theme", pieceThemes, "classic"));
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(() => savedValue("chess-board-theme", boardThemes, "wood"));
  useEffect(() => { try { localStorage.setItem("chess-piece-theme", pieceTheme); } catch { /* Storage is optional. */ } }, [pieceTheme]);
  useEffect(() => { try { localStorage.setItem("chess-board-theme", boardTheme); } catch { /* Storage is optional. */ } }, [boardTheme]);

  return (
    <ChessSettingsContext.Provider
      value={{
        boardAnimationEnabled,
        setBoardAnimationEnabled,
        pieceTheme,
        setPieceTheme,
        boardTheme,
        setBoardTheme,
      }}
    >
      {children}
    </ChessSettingsContext.Provider>
  );
}

export function useChessSettings() {
  const context = useContext(ChessSettingsContext);

  if (!context) {
    throw new Error(
      "useChessSettings must be used inside ChessSettingsProvider",
    );
  }

  return context;
}
