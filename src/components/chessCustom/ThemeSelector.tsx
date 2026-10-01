import { Check } from "lucide-react";
import { BOARD_THEMES } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";

/** Board theme swatches. Purely cosmetic — gameplay is untouched. */
export default function ThemeSelector({ value, onChange, compact = false }: { value: string; onChange: (id: string) => void; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label={ui("Board theme")} className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
      {BOARD_THEMES.map((theme) => {
        const active = theme.id === value;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={ui(theme.name)}
            onClick={() => onChange(theme.id)}
            className={`group relative overflow-hidden rounded-xl border text-left transition ${active ? "border-amber-300/70 ring-2 ring-amber-300/25" : "border-white/10 hover:border-white/25"}`}
          >
            <span className="grid grid-cols-4" style={{ background: theme.frame }}>
              {Array.from({ length: compact ? 4 : 8 }, (_, index) => (
                <span key={index} className={compact ? "h-4" : "h-5"} style={{ background: (index + Math.floor(index / 4)) % 2 ? theme.dark : theme.light }} />
              ))}
            </span>
            {!compact && (
              <span className="flex items-center justify-between gap-1 bg-black/60 px-2 py-1.5 text-[11px] font-semibold text-zinc-200">
                <span className="truncate">{ui(theme.name)}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: theme.trim }} />
              </span>
            )}
            {active && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 text-zinc-950">
                <Check size={10} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
