import { useState } from "react";
import { Link } from "react-router-dom";
import type { ShogiPieceType } from "../../games/shogi/rules";

const pieces: { type: ShogiPieceType; glyph: string; name: string; summary: string; promoted?: string }[] = [
  { type: "K", glyph: "王", name: "King", summary: "One square in any direction." },
  { type: "R", glyph: "飛", name: "Rook", summary: "Any distance orthogonally.", promoted: "Dragon adds one-square diagonal moves." },
  { type: "B", glyph: "角", name: "Bishop", summary: "Any distance diagonally.", promoted: "Horse adds one-square orthogonal moves." },
  { type: "G", glyph: "金", name: "Gold", summary: "One square forward, sideways, backward, or forward-diagonal." },
  { type: "S", glyph: "銀", name: "Silver", summary: "One square forward or diagonally.", promoted: "Promoted Silver moves as Gold." },
  { type: "N", glyph: "桂", name: "Knight", summary: "Jumps two forward and one sideways.", promoted: "Promoted Knight moves as Gold." },
  { type: "L", glyph: "香", name: "Lance", summary: "Any distance straight forward.", promoted: "Promoted Lance moves as Gold." },
  { type: "P", glyph: "歩", name: "Pawn", summary: "One square straight forward.", promoted: "Tokin moves as Gold." },
];

export default function ShogiRules() {
  const [pieceType, setPieceType] = useState<ShogiPieceType>("P");
  const [panel, setPanel] = useState<"pieces" | "promotion" | "drops">("pieces");
  const selected = pieces.find((piece) => piece.type === pieceType)!;

  return (
    <main className="relative left-1/2 h-[calc(100dvh-4rem)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] px-4 py-4 text-zinc-100 sm:px-7 sm:py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(245,158,11,.11),transparent_30%),linear-gradient(to_bottom,#0b0e11,#050607)]" />
      <div className="relative mx-auto flex h-full max-w-6xl flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4">
          <Link to="/games/shogi" className="text-sm text-zinc-500 transition hover:text-white">← Shogi</Link>
          <p className="text-[10px] font-black uppercase tracking-[.28em] text-amber-400">Standard Japanese rules</p>
        </header>

        <div className="grid min-h-0 flex-1 items-center gap-4 py-3 md:grid-cols-[minmax(320px,1fr)_minmax(300px,.8fr)] md:gap-8">
          <section className="min-h-0">
            <p className="text-[10px] font-black uppercase tracking-[.28em] text-zinc-600">Learn the army</p>
            <h1 className="mt-2 font-serif text-4xl text-white sm:text-5xl">Shogi rules</h1>
            <div className="mt-4 grid grid-cols-3 gap-1.5" role="tablist" aria-label="Shogi rule topics">
              {(["pieces", "promotion", "drops"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={panel === item} onClick={() => setPanel(item)} className={"min-h-10 rounded-xl border px-2 text-xs font-bold capitalize transition " + (panel === item ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-white/10 bg-white/5 text-zinc-500 hover:text-white")}>{item}</button>)}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
              {panel === "pieces" && <><h2 className="font-serif text-2xl text-white">{selected.name}</h2><p className="mt-2 text-sm leading-6 text-zinc-400">{selected.summary}</p>{selected.promoted && <p className="mt-3 text-xs leading-5 text-amber-200/75">{selected.promoted}</p>}</>}
              {panel === "promotion" && <><h2 className="font-serif text-2xl text-white">Promotion zones</h2><p className="mt-2 text-sm leading-6 text-zinc-400">The final three ranks are each player’s promotion zone. Promotion is optional when entering, leaving, or moving inside it, except when an unpromoted piece would become immobile.</p><p className="mt-3 text-xs leading-5 text-amber-200/75">Pawns and Lances must promote on the last rank; Knights on either final rank.</p></>}
              {panel === "drops" && <><h2 className="font-serif text-2xl text-white">Captured pieces return</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Captured pieces lose promotion and enter your hand. On your turn, you may drop one onto a legal empty square instead of moving.</p><p className="mt-3 text-xs leading-5 text-amber-200/75">No nifu, no dead-rank drops, and no immediate checkmate delivered specifically by a pawn drop.</p></>}
            </div>
          </section>

          <section className="min-h-0">
            <div className="grid grid-cols-4 gap-2" aria-label="Choose a Shogi piece">
              {pieces.map((piece) => <button key={piece.type} type="button" onClick={() => { setPieceType(piece.type); setPanel("pieces"); }} aria-label={piece.name} className={"flex aspect-square items-center justify-center text-2xl font-black [clip-path:polygon(50%_0,100%_20%,92%_100%,8%_100%,0_20%)] sm:text-3xl " + (pieceType === piece.type ? "bg-amber-300 text-[#2c1a0b]" : "bg-[#d7a657] text-[#3b210d] opacity-75 hover:opacity-100")}>{piece.glyph}</button>)}
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-5 text-zinc-500">
              Win by checkmating the opposing King. A legal move may never leave your own King in check. Black (sente) moves first.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
