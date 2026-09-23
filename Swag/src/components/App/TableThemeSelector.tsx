import { Check, ChevronDown, PanelsTopLeft } from "lucide-react";
import { useState } from "react";

import { useTableTheme, type TableTheme } from "@/context/TableThemeContext";

const tableThemes: {
  id: TableTheme;
  name: string;
  image: string;
}[] = [
  {
    id: "classic",
    name: "Klassisch",
    image: "/images/tables/classic.webp",
  },
  {
    id: "bavarian",
    name: "Bayerische Stube",
    image: "/images/tables/bavarian.webp",
  },
  {
    id: "royal",
    name: "Royal",
    image: "/images/tables/royal.webp",
  },
  {
    id: "steampunk",
    name: "Steampunk",
    image: "/images/tables/steampunk.webp",
  },
  {
    id: "alpine",
    name: "Alpen",
    image: "/images/tables/alpine.webp",
  },
  {
    id: "midnight",
    name: "Midnight",
    image: "/images/tables/midnight.webp",
  },
];

export default function TableThemeSelector() {
  const [open, setOpen] = useState(false);

  const { tableTheme, setTableTheme } = useTableTheme();

  const current =
    tableThemes.find((theme) => theme.id === tableTheme) ?? tableThemes[0];

  return (
    <div className="relative z-[150]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="
          flex items-center gap-3
          rounded-xl
          border border-slate-700/70
          bg-slate-800/90
          px-4 py-2
          text-sm font-semibold
          text-slate-100
          shadow-lg
          backdrop-blur

          hover:border-emerald-400/60
          hover:bg-slate-700
        "
      >
        <PanelsTopLeft size={17} className="text-emerald-400" />

        <span className="text-slate-400">Tischdesign:</span>

        <span>{current.name}</span>

        <ChevronDown
          size={16}
          className={`
            transition-transform
            ${open ? "rotate-180" : ""}
          `}
        />
      </button>

      {open && (
        <div
          className="
            absolute
            left-1/2
            top-full
            z-[200]
            mt-2
            w-64
            -translate-x-1/2
            rounded-2xl
            border border-slate-700
            bg-slate-900/95
            p-2
            shadow-2xl
            backdrop-blur-xl
          "
        >
          {tableThemes.map((theme) => {
            const selected = theme.id === tableTheme;

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  setTableTheme(theme.id);
                  setOpen(false);
                }}
                className={`
                  flex w-full
                  items-center
                  gap-3
                  rounded-xl
                  px-3 py-2
                  text-left

                  ${selected ? "bg-emerald-500/10" : "hover:bg-slate-800"}
                `}
              >
                {/* table preview */}
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md border border-white/10">
                  <img
                    src={theme.image}
                    alt={theme.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <span className="flex-1 text-sm font-semibold text-slate-200">
                  {theme.name}
                </span>

                {selected && <Check size={16} className="text-emerald-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
