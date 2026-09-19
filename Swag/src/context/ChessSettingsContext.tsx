import { createContext, useContext, useState, type ReactNode } from "react";

type ChessSettingsContextType = {
  boardAnimationEnabled: boolean;
  setBoardAnimationEnabled: React.Dispatch<React.SetStateAction<boolean>>;
};

const ChessSettingsContext = createContext<ChessSettingsContextType | null>(
  null,
);

export function ChessSettingsProvider({ children }: { children: ReactNode }) {
  const [boardAnimationEnabled, setBoardAnimationEnabled] = useState(true);

  return (
    <ChessSettingsContext.Provider
      value={{
        boardAnimationEnabled,
        setBoardAnimationEnabled,
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
