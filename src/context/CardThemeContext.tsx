import { createContext, useContext, useState, type ReactNode } from "react";

export type CardTheme =
  | "bavarian"
  | "modern"
  | "traditional"
  | "steampunk"
  | "anime"
  | "horror";

type CardThemeContextType = {
  cardTheme: CardTheme;
  setCardTheme: (theme: CardTheme) => void;
};

const CardThemeContext = createContext<CardThemeContextType | undefined>(
  undefined,
);

export function CardThemeProvider({ children }: { children: ReactNode }) {
  const [cardTheme, setCardTheme] = useState<CardTheme>("bavarian");

  return (
    <CardThemeContext.Provider
      value={{
        cardTheme,
        setCardTheme,
      }}
    >
      {children}
    </CardThemeContext.Provider>
  );
}

export function useCardTheme() {
  const context = useContext(CardThemeContext);

  if (!context) {
    throw new Error("useCardTheme must be used inside CardThemeProvider");
  }

  return context;
}
