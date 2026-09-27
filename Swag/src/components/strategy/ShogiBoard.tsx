import { useMemo, useState } from "react";
import { getLegalShogiMoves, type ShogiMove, type ShogiPieceType, type ShogiState } from "../../games/shogi/rules";
const GLYPHS: Record<ShogiPieceType, string> = { K: "王", R: "飛", B: "角", G: "金", S: "銀", N: "桂", L: "香", P: "歩" };
const PROMOTED: Partial<Record<ShogiPieceType, string>> = { R: "龍", B: "馬", S: "全", N: "圭", L: "杏", P: "と" };
type Props = { state: ShogiState; onMove: (move: ShogiMove) => void; disabled?: boolean };
export default function ShogiBoard({ state, onMove, disabled }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hand, setHand] = useState<Exclude<ShogiPieceType, "K"> | null>(null);
  const [promotion, setPromotion] = useState<ShogiMove[] | null>(null);
  const legal = useMemo(() => getLegalShogiMoves(state), [state]);
  const destinations = useMemo(() => new Set(legal.filter((move) => move.type === "move" ? move.from === selected : move.type === "drop" && move.piece === hand).map((move) => move.type === "resign" ? -1 : move.to)), [legal, selected, hand]);
  const choose = (to: number) => {
    if (disabled) return;
    const options = legal.filter((move) => move.type === "move" ? move.from === selected && move.to === to : move.type === "drop" && move.piece === hand && move.to === to);
    if (options.length > 1) setPromotion(options);
    else if (options[0]) { onMove(options[0]); setSelected(null); setHand(null); }
    else if (state.board[to]?.color === state.currentPlayer) { setSelected(to); setHand(null); }
    else { setSelected(null); setHand(null); }
  };
  const handPanel = (color: "black" | "white") => <div className={"flex min-h-12 flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-2 " + (color === "white" ? "rotate-180" : "")}>
    <span className="px-2 text-xs font-bold uppercase text-zinc-500">{color}</span>
    {(Object.entries(state.hands[color]) as [Exclude<ShogiPieceType, "K">, number][]).filter(([,count]) => count > 0).map(([piece,count]) => <button type="button" key={piece} disabled={disabled || color !== state.currentPlayer} onClick={() => { setHand(piece); setSelected(null); }} className={"min-h-10 rounded-lg border px-3 text-lg " + (hand === piece && color === state.currentPlayer ? "border-amber-300 bg-amber-300/20" : "border-white/10 bg-black/20")}>{GLYPHS[piece]} <small>×{count}</small></button>)}
  </div>;
  return <div className="w-[min(92vw,calc(100dvh-28rem),680px)] min-w-56 lg:w-[min(65vw,calc(100dvh-14rem),680px)]">
    {handPanel("white")}
    <div className="my-2 grid aspect-square grid-cols-9 border-4 border-[#70451f] bg-[#d7a657] shadow-2xl" style={{ touchAction: "manipulation" }}>
      {state.board.map((piece, index) => {
        const isLast = state.lastMove?.type !== "resign" && state.lastMove?.to === index;
        return <button type="button" key={index} disabled={disabled} onClick={() => choose(index)} aria-label={"Shogi square " + (index + 1)} className={"relative flex items-center justify-center border border-[#70451f]/70 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white " + (selected === index ? "bg-amber-200/70" : destinations.has(index) ? "bg-emerald-300/45" : isLast ? "bg-sky-300/35" : "")}>
          {destinations.has(index) && !piece && <span className="absolute h-3 w-3 rounded-full bg-emerald-800/60" />}
          {piece && <span className={"flex h-[82%] w-[78%] items-center justify-center text-[clamp(.75rem,4.5vw,2.1rem)] font-black text-[#2c1a0b] [clip-path:polygon(50%_0,100%_20%,92%_100%,8%_100%,0_20%)] " + (piece.promoted ? "bg-orange-200 text-red-800 " : "bg-[#f1c977] ") + (piece.color === "white" ? "rotate-180" : "")}>{piece.promoted ? PROMOTED[piece.type] : GLYPHS[piece.type]}</span>}
        </button>;
      })}
    </div>
    {handPanel("black")}
    {promotion && <div role="dialog" aria-modal="true" aria-label="Choose promotion" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="rounded-2xl border border-white/15 bg-zinc-900 p-6 shadow-2xl"><h2 className="text-xl font-bold text-white">Promote this piece?</h2><div className="mt-5 flex gap-3">{promotion.map((move) => move.type === "move" && <button type="button" key={String(move.promote)} onClick={() => { onMove(move); setPromotion(null); setSelected(null); }} className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-black">{move.promote ? "Promote" : "Keep form"}</button>)}</div></div></div>}
  </div>;
}
