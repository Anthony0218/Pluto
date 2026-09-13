import { createContext, useContext, useState, type ReactNode } from "react";

export type TableTheme =
  | "classic"
  | "bavarian"
  | "royal"
  | "steampunk"
  | "alpine"
  | "midnight";

type TableThemeContextType = {
  tableTheme: TableTheme;
  setTableTheme: (theme: TableTheme) => void;
};

const TableThemeContext = createContext<TableThemeContextType | undefined>(
  undefined,
);

export function TableThemeProvider({ children }: { children: ReactNode }) {
  const [tableTheme, setTableTheme] = useState<TableTheme>("bavarian");

  return (
    <TableThemeContext.Provider
      value={{
        tableTheme,
        setTableTheme,
      }}
    >
      {children}
    </TableThemeContext.Provider>
  );
}

export function useTableTheme() {
  const context = useContext(TableThemeContext);

  if (!context) {
    throw new Error("useTableTheme must be used inside TableThemeProvider");
  }

  return context;
}
