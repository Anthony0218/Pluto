import type { WattenCard as WattenCardType } from "../utils/watten";

type Props = {
  card: WattenCardType;
  selected?: boolean;
  disabled?: boolean;
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
  onClick,
}: Props) {
  const isRed = card.suit === "Herz" || card.suit === "Schellen";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`
        relative flex h-32 w-20 flex-col items-center justify-center
        rounded-xl border bg-white shadow-md
        transition-all duration-150
        ${
          selected
            ? "-translate-y-3 border-indigo-500 shadow-lg ring-2 ring-indigo-300"
            : "border-zinc-200 hover:-translate-y-1 hover:shadow-lg"
        }
        ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:-translate-y-3 hover:shadow-xl"}
      `}
    >
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
    </button>
  );
}
