import type { WattenCard as WattenCardType } from "../utils/watten";
import { playHoverSound } from "./WattenGame";

type Props = {
  card: WattenCardType;
  selected?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  requiredChoice?: boolean;
  hint?: string;

  helpStatus?: "winning" | "losing";

  onClick?: () => void;
};

const suitSymbols = {
  Eichel: "♣",
  Gras: "🍃",
  Herz: "♥",
  Schellen: "🔔",
};

export default function WattenCard({
  card,
  selected = false,
  disabled = false,
  invalid = false,
  requiredChoice = false,
  hint,
  helpStatus,
  onClick,
}: Props) {
  const isRed = card.suit === "Herz" || card.suit === "Schellen";

  return (
    <button
      onMouseEnter={playHoverSound}
      type="button"
      disabled={disabled || invalid}
      onClick={onClick}
      title={
        invalid
          ? "Trumpf oder Kritisch: You must play a Trumpf or Kritischer."
          : undefined
      }
      className={`
  group relative flex h-32 w-20 flex-col items-center justify-center
  rounded-xl border bg-white shadow-md
  transition-all duration-150

  ${
    invalid
      ? "cursor-not-allowed border-red-600 opacity-35 ring-2 ring-red-600 grayscale"
      : helpStatus === "winning"
        ? "cursor-pointer border-green-500 ring-4 ring-green-500 shadow-[0_0_18px_rgba(34,197,94,0.55)] hover:-translate-y-3"
        : helpStatus === "losing"
          ? "cursor-pointer border-red-500 ring-2 ring-red-500/80 hover:-translate-y-3"
          : requiredChoice
            ? "cursor-pointer border-emerald-400 ring-2 ring-emerald-400/80 hover:-translate-y-3"
            : selected
              ? "-translate-y-3 border-indigo-500 shadow-lg ring-2 ring-indigo-300"
              : "cursor-pointer border-zinc-200 hover:-translate-y-3 hover:shadow-xl"
  }

  ${disabled && !invalid ? "cursor-not-allowed opacity-60" : ""}
`}
    >
      {invalid && (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white shadow">
          ×
        </span>
      )}

      <span
        className={`text-2xl font-bold ${
          isRed ? "text-red-600" : "text-zinc-900"
        }`}
      >
        {suitSymbols[card.suit]}
      </span>

      <span
        className={`mt-2 text-lg font-semibold ${
          isRed ? "text-red-600" : "text-zinc-900"
        }`}
      >
        {card.rank}
      </span>

      <span className="absolute bottom-2 text-[10px] text-zinc-400">
        {card.suit}
      </span>
      {hint && (
        <div
          className="
      pointer-events-none absolute bottom-full left-1/2 z-50 mb-3
      hidden w-52 -translate-x-1/2
      rounded-lg border border-amber-300/40
      bg-zinc-950 px-3 py-2
      text-center text-xs font-semibold text-amber-200
      shadow-xl
      group-hover:block
    "
        >
          {hint}

          <div
            className="
        absolute left-1/2 top-full
        -translate-x-1/2
        border-4 border-transparent
        border-t-zinc-950
      "
          />
        </div>
      )}
    </button>
  );
}
