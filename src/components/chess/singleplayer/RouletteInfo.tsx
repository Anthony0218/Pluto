import { gameUi } from "../../../i18n/gameUi.ts";
import { ui, useUiLanguage } from "@/i18n/ui";
import { ROULETTE_PROBABILITIES, type PortalState } from "@/games/chess/variants/chessRoulette";
export default function RouletteInfo({ state }: { state?: PortalState }) {
  useUiLanguage();
  return <section className="mb-4 rounded-2xl border border-amber-300/20 bg-[#091019] p-4">
    <h2 className="text-sm font-bold text-amber-100">{ui("Lucky Square probabilities")}</h2>
    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">{Object.entries(ROULETTE_PROBABILITIES).map(([effect, percent]) => <div key={effect} className="flex justify-between gap-2 rounded-lg bg-white/5 p-2"><dt>{ui(({ destroy: "Destroy", promote: "Promotion", teleport: "Teleport", swap: "Swap" })[effect as keyof typeof ROULETTE_PROBABILITIES])}</dt><dd className="font-bold text-amber-200">{gameUi(percent)}%</dd></div>)}</dl>
    <p className="mt-3 text-xs font-bold text-violet-200">{ui("King: 80% card, 20% extra turn.")}</p>
    <p className="mt-2 text-xs leading-5 text-zinc-400">{ui("A king keeps its normal moves and gains the drawn piece’s movement for its next three king moves. Pawn: no change. King: you lose.")}</p>
    {Object.entries(state?.kingPowers ?? {}).map(([side, power]) => <p key={side} className="mt-2 text-xs text-amber-200">{ui(side === "w" ? "White" : "Black")} ♚ + {ui(({ n: "Knight", b: "Bishop", r: "Rook", q: "Queen" })[power.piece])} · {gameUi(power.movesLeft)} {ui("Moves")}</p>)}
  </section>;
}
