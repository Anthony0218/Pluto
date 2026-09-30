import { ui, useUiLanguage } from "@/i18n/ui";
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
    name: "Classic",
    image: "/images/tables/classic.webp",
  },
  {
    id: "bavarian",
    name: "Bavarian room",
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
    name: "Alpine",
    image: "/images/tables/alpine.webp",
  },
  {
    id: "midnight",
    name: "Midnight",
    image: "/images/tables/midnight.webp",
  },
];

export default function TableThemeSelector() {
  useUiLanguage();
  const [open, setOpen] = useState(false);

  const { tableTheme, setTableTheme } = useTableTheme();

  const current =
    tableThemes.find((theme) => theme.id === tableTheme) ?? tableThemes[0];

  return (
    <div className="relative z-[150]">
      <button
        type="button"
        aria-expanded={open}
        title={ui("Table design")}
        onClick={() => setOpen((prev) => !prev)}
        className="
          flex h-10 items-center gap-2 xl:gap-3
          rounded-xl
          border border-slate-700/70
          bg-slate-800/90
          px-3 xl:px-4
          text-sm font-semibold
          text-slate-100
          shadow-lg
          backdrop-blur

          hover:border-emerald-400/60
          hover:bg-slate-700
        "
      >
        <PanelsTopLeft size={17} className="text-emerald-400" />

        <span className="hidden text-slate-400 xl:inline">{ui("Table design")}:</span>

        <span>{ui(current.name)}</span>

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
            right-0
            top-full
            z-[200]
            mt-2
            w-64
            max-w-[calc(100vw-1rem)]
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
                    alt={ui(theme.name)}
                    className="h-full w-full object-cover"
                  />
                </div>

                <span className="flex-1 text-sm font-semibold text-slate-200">
                  {ui(theme.name)}
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
