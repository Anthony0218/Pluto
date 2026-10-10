import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import type { GameState } from "@/games/cards/engine/types";

const KIND_STYLE = {
  rule: "border-violet-400/30 text-violet-200",
  action: "border-amber-300/30 text-amber-100",
  event: "border-sky-400/30 text-sky-200",
  info: "border-white/10 text-zinc-400",
};

/** Newest first. Rule firings are highlighted so creators can see priorities at work. */
export default function EventLog({ state, limit = 60 }: { state: GameState; limit?: number }) {
  useGameLanguage();
  const entries = state.log.slice(-limit).reverse();
  return (
    <ol aria-label={gameUi("Game log")} className="max-h-[420px] space-y-1 overflow-y-auto pr-1 text-xs">
      {entries.map((entry) => (
        <li key={entry.seq} className={`rounded-md border-l-2 bg-white/[0.02] px-2 py-1 ${KIND_STYLE[entry.kind]}`}>
          <span className="mr-1.5 font-mono text-[10px] text-zinc-600">{gameUi(entry.seq)}</span>
          {gameUi(entry.text)}
        </li>
      ))}
    </ol>
  );
}
