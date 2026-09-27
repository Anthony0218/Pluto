import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowRight, BrainCircuit, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import ChessPreviewBoard from "./ChessPreviewBoard";
import ReviewDemoDialog from "./ReviewDemoDialog";
import "./landingPreviews.css";

const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4"];
const notes = [
  { eval: "+0.2", title: "The opening position", detail: "Step through the moves to see how the review connects positions with ideas." },
  { eval: "+0.3", title: "White claims the centre", detail: "The e-pawn opens lines for the queen and bishop." },
  { eval: "+0.2", title: "Black answers in kind", detail: "Both sides now contest the central squares." },
  { eval: "+0.3", title: "A useful developing move", detail: "The knight attacks e5 and prepares kingside castling." },
  { eval: "+0.2", title: "The knight defends e5", detail: "Black develops while protecting the centre." },
  { eval: "+0.3", title: "Pressure on f7", detail: "The bishop points at Black's weakest starting square." },
  { eval: "+0.2", title: "Black develops a bishop", detail: "Both players bring pieces into the game." },
  { eval: "+0.1", title: "Preparing the pawn break", detail: "c3 supports a future d4 and a stronger centre." },
  { eval: "+0.1", title: "More pressure on e4", detail: "Black's knight develops and attacks the central pawn." },
  { eval: "+0.4", title: "The centre opens", detail: "d4 challenges Black's pawn and bishop, opening central lines." },
  { eval: "+0.3", title: "Black exchanges in the centre", detail: "The position changes. Review each move to understand why." },
];

export default function CoachShowcase() {
  useUiLanguage();
  const [ply, setPly] = useState(5);
  const [reviewOpen, setReviewOpen] = useState(false);
  const positions = useMemo(() => {
    const game = new Chess();
    const result = [{ fen: game.fen(), lastMove: null as [Square, Square] | null }];
    for (const move of moves) {
      const played = game.move(move);
      result.push({ fen: game.fen(), lastMove: [played.from, played.to] as [Square, Square] });
    }
    return result;
  }, []);
  const note = notes[ply];

  return (
    <div className="landing-preview overflow-hidden rounded-[28px] border border-[#a38960]/25 bg-[#141312] shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between gap-3 border-b border-[#a38960]/20 px-5 py-4">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-amber-200/10 p-2 text-amber-200"><BrainCircuit size={19} /></span><div><p className="font-serif text-lg text-[#f3e7cf]">{ui("Game Review")}</p><p className="text-[10px] uppercase tracking-widest text-[#aa977b]">{ui("Interactive example")}</p></div></div>
        <span className="rounded-full border border-amber-300/25 px-2 py-1 text-[10px] font-bold text-amber-200">{ui("Sample game")}</span>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(160px,.85fr)]">
        <div><ChessPreviewBoard fen={positions[ply].fen} lastMove={positions[ply].lastMove} label={ui("Sample game review board")} /><div className="mt-3 flex items-center justify-between gap-2"><button type="button" onClick={() => setPly(0)} aria-label={ui("Start of game")} className="rounded-lg border border-white/10 p-2 text-amber-100 hover:bg-white/10"><RotateCcw size={15} /></button><div className="flex items-center gap-2"><button type="button" disabled={ply === 0} onClick={() => setPly(ply - 1)} aria-label={ui("Previous move")} className="rounded-lg border border-white/10 p-2 text-amber-100 hover:bg-white/10 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="min-w-12 text-center text-xs text-stone-400">{ply}/{moves.length}</span><button type="button" disabled={ply === moves.length} onClick={() => setPly(ply + 1)} aria-label={ui("Next move")} className="rounded-lg border border-white/10 p-2 text-amber-100 hover:bg-white/10 disabled:opacity-40"><ChevronRight size={16} /></button></div></div></div>
        <div className="flex min-w-0 flex-col"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">{ui("Review insight")}</p><p className="mt-2 font-serif text-xl text-[#f3e7cf]">{ui(note.title)}</p><p className="mt-2 text-xs leading-5 text-stone-400">{ui(note.detail)}</p><div className="mt-5 rounded-xl border border-white/10 bg-white/[0.035] p-3"><div className="flex justify-between text-[10px] uppercase tracking-widest text-stone-500"><span>{ui("Evaluation")}</span><span>{ui("White")}</span></div><p className="mt-1 font-mono text-xl font-bold text-emerald-300">{note.eval}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-700"><div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${50 + Number(note.eval) * 12}%` }} /></div></div><div className="mt-4 flex flex-wrap gap-1.5">{moves.map((move, index) => <button key={index} type="button" onClick={() => setPly(index + 1)} aria-current={ply === index + 1 ? "step" : undefined} className={`rounded-md px-2 py-1 font-mono text-xs transition ${ply === index + 1 ? "bg-amber-300 text-stone-950" : "bg-white/5 text-stone-300 hover:bg-white/15"}`}>{index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ""}{move}</button>)}</div><Link to="/games/chess/classic/ai" className="mt-auto flex items-center justify-between pt-6 text-sm font-semibold text-amber-200 hover:text-amber-100">{ui("Try a full game review")}<ArrowRight size={16} /></Link></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#a38960]/20 px-5 py-4">
        <p className="max-w-48 text-[11px] leading-4 text-stone-400">{ui("Illustrative scores. Explore this sample in the full review.")}</p>
        <button type="button" onClick={() => setReviewOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber-200 px-4 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-100">{ui("Open sample review")}<ArrowRight size={16} /></button>
      </div>
      {reviewOpen && <ReviewDemoDialog moves={moves} onClose={() => setReviewOpen(false)} />}
    </div>
  );
}
