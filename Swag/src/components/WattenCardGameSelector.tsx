import { Check, ChevronDown, Palette } from "lucide-react";
import { useState } from "react";

import { useCardTheme, type CardTheme } from "@/context/CardThemeContext";

type ThemeOption = {
  id: CardTheme;
  name: string;
};

const themes: ThemeOption[] = [
  {
    id: "bavarian",
    name: "Bayerisch",
  },
  {
    id: "traditional",
    name: "Traditionell",
  },
  {
    id: "modern",
    name: "Modern",
  },
  {
    id: "steampunk",
    name: "Steampunk",
  },
  {
    id: "anime",
    name: "Anime",
  },
  {
    id: "horror",
    name: "Horror",
  },
];

export default function CardThemeSelector() {
  const [open, setOpen] = useState(false);

  const { cardTheme, setCardTheme } = useCardTheme();

  const currentTheme =
    themes.find((theme) => theme.id === cardTheme) ?? themes[0];

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
          shadow-lg shadow-black/20
          backdrop-blur

          transition-all

          hover:border-sky-400/60
          hover:bg-slate-700
        "
      >
        <Palette size={17} className="text-sky-400" />

        <span className="text-slate-400">Kartendesign:</span>

        <span>{currentTheme.name}</span>

        <ChevronDown
          size={16}
          className={`
            ml-1 transition-transform
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
            w-[340px]
            -translate-x-1/2
            rounded-2xl
            border border-slate-700
            bg-slate-900/95
            p-2
            shadow-2xl
            shadow-black/60
            backdrop-blur-xl
          "
        >
          <div className="px-3 pb-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Kartendesign auswählen
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1">
            {themes.map((theme) => {
              const selected = cardTheme === theme.id;

              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setCardTheme(theme.id);
                    setOpen(false);
                  }}
                  className={`
                    flex items-center gap-3
                    rounded-xl
                    px-3 py-2.5
                    text-left
                    transition-all

                    ${
                      selected
                        ? `
                          bg-sky-500/10
                          ring-1 ring-sky-400/40
                        `
                        : `
                          hover:bg-slate-800
                        `
                    }
                  `}
                >
                  {/* Preview card */}
                  <div
                    className="
                      h-12 w-8
                      shrink-0
                      overflow-hidden
                      rounded-md
                      bg-white
                      shadow
                    "
                  >
                    <img
                      src={`/images/${theme.id}/herz-king.png`}
                      alt=""
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  </div>

                  <span
                    className={`
                      flex-1 text-sm font-semibold
                      ${selected ? "text-sky-300" : "text-slate-200"}
                    `}
                  >
                    {theme.name}
                  </span>

                  {selected && <Check size={16} className="text-sky-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
