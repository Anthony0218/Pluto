import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AppTheme = "black" | "pluto";

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  plutoMode: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "app-theme";

function getInitialTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "pluto";
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);

  return saved === "black" ? "black" : "pluto";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const plutoMode = theme === "pluto";

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        plutoMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
