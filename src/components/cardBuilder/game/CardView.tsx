import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { SUIT_SYMBOLS, cardName, type Card } from "@/games/cards/cards/card";

/** Generic, original card artwork: corner index + large suit pip. No external art. */
export default function CardView({
  card,
  size = "md",
  selected,
  selectable,
  target,
  dimmed,
  marked,
  onClick,
  label,
}: {
  /** Missing = face down. */
  card?: Card;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  selectable?: boolean;
  target?: boolean;
  dimmed?: boolean;
  marked?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  useGameLanguage();
  const dims = { sm: "h-14 w-10 text-[11px]", md: "h-20 w-14 text-sm", lg: "h-24 w-[68px] text-base" }[size];
  const red = card && (card.suit === "hearts" || card.suit === "diamonds");
  const interactive = Boolean(onClick);
  const ring = selected
    ? "ring-2 ring-amber-300 -translate-y-2 shadow-amber-300/20"
    : target
      ? "ring-2 ring-sky-400 shadow-sky-400/20"
      : selectable
        ? "ring-1 ring-amber-300/50 hover:-translate-y-1"
        : "";
  const className = `relative shrink-0 select-none rounded-lg border shadow-lg transition ${dims} ${ring} ${dimmed ? "opacity-40" : ""} ${interactive ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-300" : ""}`;

  if (!card) {
    const back = (
      <span className="absolute inset-[3px] rounded-md border border-white/10 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,.07)_0_4px,transparent_4px_9px)]" />
    );
    return interactive ? (
      <button type="button" aria-label={gameUi(label ?? "Face-down card")} onClick={onClick} className={`${className} border-indigo-300/30 bg-indigo-950`}>
        {gameUi(back)}
      </button>
    ) : (
      <span role="img" aria-label={gameUi(label ?? "Face-down card")} className={`${className} block border-indigo-300/30 bg-indigo-950`}>
        {gameUi(back)}
      </span>
    );
  }

  const face = (
    <>
      <span className={`absolute left-1 top-0.5 flex flex-col items-center font-black leading-none ${red ? "text-rose-600" : "text-zinc-900"}`}>
        <span>{gameUi(card.rank)}</span>
        <span className="text-[0.85em]">{gameUi(SUIT_SYMBOLS[card.suit])}</span>
      </span>
      <span className={`absolute inset-0 flex items-center justify-center text-[2.1em] ${red ? "text-rose-600" : "text-zinc-900"}`}>{gameUi(SUIT_SYMBOLS[card.suit])}</span>
      <span className={`absolute bottom-0.5 right-1 rotate-180 text-[0.85em] font-black leading-none ${red ? "text-rose-600" : "text-zinc-900"}`}>{gameUi(card.rank)}</span>
      {marked && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-white bg-emerald-400" title={gameUi("Covered")} />}
    </>
  );
  const title = label ?? cardName(card);
  return interactive ? (
    <button type="button" aria-label={gameUi(title)} aria-pressed={selected} title={gameUi(title)} onClick={onClick} className={`${className} border-zinc-300 bg-[#fbf8f1]`}>
      {gameUi(face)}
    </button>
  ) : (
    <span role="img" aria-label={gameUi(title)} title={gameUi(title)} className={`${className} block border-zinc-300 bg-[#fbf8f1]`}>
      {gameUi(face)}
    </span>
  );
}
