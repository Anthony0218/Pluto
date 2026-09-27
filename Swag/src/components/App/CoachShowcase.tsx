import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowRight, BrainCircuit, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import ChessPreviewBoard from "./ChessPreviewBoard";
import ReviewDemoDialog from "./ReviewDemoDialog";
import QualityBadge from "../chess/singleplayer/ReviewQualityBadge";
import { qualityList } from "../chess/singleplayer/reviewQualities";
import type { MoveQuality } from "@/utils/chessAnalysis";
import "./landingPreviews.css";

const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4"];
// Stockfish 18 Lite, MultiPV 5, depth 14. Scores are centipawns from White's perspective.
// The played move is excluded from the three alternatives, then the remaining lines keep engine rank.
const reviewLines = [
  { current: 35, alternatives: [["d4", 24], ["Nf3", 20], ["c4", 19]] },
  { current: 35, alternatives: [["c5", 36], ["e6", 39], ["c6", 42]] },
  { current: 42, alternatives: [["Nc3", 17], ["d4", 5], ["Ne2", 0]] },
  { current: 35, alternatives: [["Nf6", 42], ["d6", 46], ["d5", 74]] },
  { current: 28, alternatives: [["d4", 41], ["Bb5", 36], ["Nc3", 31]] },
  { current: 34, alternatives: [["Nf6", 25], ["d6", 40], ["Be7", 43]] },
  { current: 32, alternatives: [["d3", 35], ["O-O", 35], ["h3", 31]] },
  { current: 32, alternatives: [["Bb6", 60], ["d6", 61], ["Nge7", 84]] },
  { current: 13, alternatives: [["d3", 30], ["b4", 23], ["Qe2", 0]] },
  { current: 6, alternatives: [["Bb6", 100], ["Bd6", 113], ["b5", 153]] },
] as const;
const formatScore = (centipawns: number) => `${centipawns >= 0 ? "+" : "−"}${(Math.abs(centipawns) / 100).toFixed(2)}`;
const notes: Array<{ quality: MoveQuality | "Start"; title: string; detail: string }> = [
  { quality: "Start", title: "The opening position", detail: "Step through the moves to see how the review connects positions with ideas." },
  { quality: "Best", title: "White claims the centre", detail: "The e-pawn opens lines for the queen and bishop." },
  { quality: "Good", title: "Black answers in kind", detail: "Both sides now contest the central squares." },
  { quality: "Best", title: "A useful developing move", detail: "The knight attacks e5 and prepares kingside castling." },
  { quality: "Inaccuracy", title: "The knight defends e5", detail: "Black develops while protecting the centre." },
  { quality: "Excellent", title: "Pressure on f7", detail: "The bishop points at Black's weakest starting square." },
  { quality: "Mistake", title: "Black develops a bishop", detail: "Both players bring pieces into the game." },
  { quality: "Excellent", title: "Preparing the pawn break", detail: "c3 supports a future d4 and a stronger centre." },
  { quality: "Blunder", title: "More pressure on e4", detail: "Black's knight develops and attacks the central pawn." },
  { quality: "Excellent", title: "The centre opens", detail: "d4 challenges Black's pawn and bishop, opening central lines." },
  { quality: "Best", title: "Black exchanges in the centre", detail: "The position changes. Review each move to understand why." },
];

export default function CoachShowcase() {
  useUiLanguage();
  const [ply, setPly] = useState(5);
  const [selectedAlternative, setSelectedAlternative] = useState<number | null>(null);
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
  const candidatePositions = useMemo(() => {
    if (ply === 0) return [];
    const before = positions[ply - 1].fen;
    return reviewLines[ply - 1].alternatives.flatMap(([san, score], index) => {
      const game = new Chess(before);
      try {
        const move = game.move(san);
        return [{ san, score, index, fen: game.fen(), lastMove: [move.from, move.to] as [Square, Square] }];
      } catch { return []; }
    });
  }, [ply, positions]);
  const note = notes[ply];
  const selected = candidatePositions.find(candidate => candidate.index === selectedAlternative);
  const board = selected ?? positions[ply];

  function selectPly(next: number) {
    setPly(next);
    setSelectedAlternative(null);
  }

  return <div className="landing-preview overflow-hidden rounded-[28px] border border-[#a38960]/25 bg-[#141312] shadow-2xl shadow-black/30">
    <div className="flex items-center justify-between gap-3 border-b border-[#a38960]/20 px-5 py-4">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-amber-200/10 p-2 text-amber-200"><BrainCircuit size={19} /></span><div><p className="font-serif text-lg text-[#f3e7cf]">{ui("Game Review")}</p><p className="text-[10px] uppercase tracking-widest text-[#aa977b]">{ui("Interactive example")}</p></div></div>
      <span className="rounded-full border border-amber-300/25 px-2 py-1 text-[10px] font-bold text-amber-200">{ui("Sample game")}</span>
    </div>
    <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(170px,.85fr)]">
      <div><ChessPreviewBoard fen={board.fen} lastMove={board.lastMove} label={ui("Sample game review board")} /><div className="mt-3 flex items-center justify-between gap-2"><button type="button" onClick={() => selectPly(0)} aria-label={ui("Start of game")} className="rounded-lg border border-white/10 p-2 text-amber-100 hover:bg-white/10"><RotateCcw size={15} /></button><div className="flex items-center gap-2"><button type="button" disabled={ply === 0} onClick={() => selectPly(ply - 1)} aria-label={ui("Previous move")} className="rounded-lg border border-white/10 p-2 text-amber-100 hover:bg-white/10 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="min-w-12 text-center text-xs text-stone-400">{ply}/{moves.length}</span><button type="button" disabled={ply === moves.length} onClick={() => selectPly(ply + 1)} aria-label={ui("Next move")} className="rounded-lg border border-white/10 p-2 text-amber-100 hover:bg-white/10 disabled:opacity-40"><ChevronRight size={16} /></button></div></div></div>
      <div className="flex min-w-0 flex-col">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">{ui("Review insight")}</p>
        <p className="mt-2 font-serif text-xl text-[#f3e7cf]">{ui(note.title)}</p>
        <p className="mt-2 text-xs leading-5 text-stone-400">{ui(note.detail)}</p>
        <button type="button" onClick={() => setSelectedAlternative(null)} aria-pressed={selectedAlternative === null} className={`mt-5 w-full rounded-xl border p-3 text-left transition ${selectedAlternative === null ? "border-amber-300/60 bg-amber-300/15" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.08]"}`}>
          <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-stone-400"><span>{ui("Current Move")}</span><span className="font-mono text-amber-100">{ply ? `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."} ${moves[ply - 1]}` : "—"}</span></span>
          <span className="mt-2 flex items-center justify-between gap-2">{note.quality === "Start" ? <strong className="text-sm text-stone-300">{ui("Start")}</strong> : <QualityBadge quality={note.quality} />}<small className="font-mono text-[11px] text-emerald-300">{ui("Evaluation")} {ply ? formatScore(reviewLines[ply - 1].current) : "—"}</small></span>
        </button>
        {candidatePositions.length > 0 && <div className="mt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">{ui("Best alternatives")}</p><div className="grid gap-1.5">{candidatePositions.map((candidate, index) => <button key={candidate.san} type="button" aria-pressed={selectedAlternative === candidate.index} onClick={() => setSelectedAlternative(candidate.index)} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${selectedAlternative === candidate.index ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/[0.035] text-stone-300 hover:bg-white/10"}`}><span><span className="mr-2 text-stone-500">{index + 1}.</span>{candidate.san}</span><span className="font-mono text-[10px] text-emerald-300">{formatScore(candidate.score)}</span></button>)}</div></div>}
        <Link to="/games/chess/classic/ai" className="mt-auto flex items-center justify-between pt-6 text-sm font-semibold text-amber-200 hover:text-amber-100">{ui("Try a full game review")}<ArrowRight size={16} /></Link>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#a38960]/20 px-5 py-4"><div className="flex max-w-xl flex-wrap items-center gap-1.5"><p className="w-full text-[11px] leading-4 text-stone-400">{ui("Sample move categories")}</p>{qualityList.map(quality => <QualityBadge key={quality} quality={quality} />)}</div><button type="button" onClick={() => setReviewOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-amber-200 px-4 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-100">{ui("Open sample review")}<ArrowRight size={16} /></button></div>
    {reviewOpen && <ReviewDemoDialog moves={moves} onClose={() => setReviewOpen(false)} />}
  </div>;
}
