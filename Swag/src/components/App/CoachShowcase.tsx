import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowRight, BrainCircuit, ChevronLeft, ChevronRight, Crown, Lightbulb, RotateCcw, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import ChessPreviewBoard from "./ChessPreviewBoard";
import ReviewDemoDialog from "./ReviewDemoDialog";
import QualityBadge from "../chess/singleplayer/ReviewQualityBadge";
import { alternativeQuality, qualityList } from "../chess/singleplayer/reviewQualities";
import { AlternativeMoveButton } from "../chess/singleplayer/ReviewMoveButtons";
import { qualityColor } from "../chess/singleplayer/reviewQualityVisuals";
import { reviewMoveAnnotations } from "../chess/singleplayer/boardAnnotations";
import type { MoveQuality } from "@/utils/chessAnalysis";
import "./landingPreviews.css";

// The sample puzzle's game: Scholar's Mate, reviewed from the mating move.
const moves = ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"];
// Generated with the real Game Review's settings (Stockfish 18 Lite, depth 14, MultiPV 3, hash cleared
// once, positions in game order), so the sample matches a real review of this game exactly.
// Evaluations are from the mover's perspective, as displayed. "lines" are the engine's top three moves,
// the played move included; "current" is the played move's own line, or the reply search when it is not listed.
const reviewLines: { current: string; lines: [string, string][] }[] = [
  { current: "+0.42", lines: [["e4", "+0.42"], ["e3", "+0.20"], ["Nf3", "+0.19"]] },
  { current: "-0.41", lines: [["e6", "-0.30"], ["e5", "-0.41"], ["c5", "-0.46"]] },
  { current: "+0.08", lines: [["Nf3", "+0.41"], ["Nc3", "+0.27"], ["d4", "+0.15"]] },
  { current: "-0.31", lines: [["Nf6", "-0.08"], ["Nc6", "-0.31"], ["c6", "-0.42"]] },
  { current: "-0.21", lines: [["d3", "+0.31"], ["Nf3", "+0.28"], ["a4", "+0.09"]] },
  { current: "-M1", lines: [["g6", "+0.21"], ["Qe7", "+0.19"], ["Qf6", "-0.12"]] },
  { current: "M1", lines: [["Qxf7#", "M1"], ["Qh4", "-0.97"], ["Qg5", "-1.24"]] },
];
const SUPPORT_COLOR = "#4f9dff";
type Point = { tone: "support" | "shield" | "king" | "hint"; text: string };
const notes: Array<{ quality: MoveQuality | "Start"; title: string; detail: string; points?: Point[] }> = [
  { quality: "Start", title: "The opening position", detail: "Step through the game to see how the review explains each move." },
  { quality: "Best", title: "White claims the centre", detail: "The e-pawn opens lines for the queen and the light-squared bishop." },
  { quality: "Excellent", title: "Black answers in kind", detail: "Both sides now contest the central squares." },
  { quality: "Good", title: "The bishop eyes f7", detail: "A natural developing move, though Nf3 first keeps more options." },
  { quality: "Excellent", title: "The knight guards e5", detail: "Black develops while protecting the centre." },
  { quality: "Good", title: "Queen and bishop aim at f7", detail: "White threatens Qxf7#. Only the king defends f7." },
  {
    quality: "Blunder", title: "Nf6 ignores the threat", detail: "The knight attacks the queen, but f7 is still defended by the king alone.",
    points: [{ tone: "hint", text: "g6 or Qe7 would have covered f7." }],
  },
  {
    quality: "Best", title: "Checkmate on f7", detail: "The queen takes on f7 with check, and the black king has no way out.",
    points: [
      { tone: "support", text: "The bishop on c4 protects the queen, so Kxf7 is illegal." },
      { tone: "shield", text: "The checking queen on f7 is protected." },
      { tone: "king", text: "Black's own pieces block d7, d8 and f8; the queen covers e7." },
    ],
  },
];

export default function CoachShowcase() {
  useUiLanguage();
  const [ply, setPly] = useState(moves.length);
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
    const suggestions = reviewLines[ply - 1].lines.map(([san, evaluation]) => ({ san, evaluation }));
    // Graded against the top engine line, exactly like the real review.
    return suggestions.flatMap(({ san, evaluation }, index) => {
      const game = new Chess(before);
      try {
        const move = game.move(san);
        return [{ san, evaluation, index, quality: alternativeQuality(suggestions, index), fen: game.fen(), lastMove: [move.from, move.to] as [Square, Square] }];
      } catch { return []; }
    });
  }, [ply, positions]);
  const note = notes[ply];
  const currentColor = note.quality === "Start" ? "#a8a29e" : qualityColor(note.quality);
  const selected = candidatePositions.find(candidate => candidate.index === selectedAlternative);
  const board = selected ?? positions[ply];
  const played = positions[ply].lastMove;
  // The played move gets the full Game Review markup; alternatives only their last-move ring.
  const annotations = !selected && played && note.quality !== "Start"
    ? reviewMoveAnnotations({ from: played[0], to: played[1], quality: note.quality, fenAfter: positions[ply].fen })
    : null;

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
      <div><ChessPreviewBoard fen={board.fen} lastMove={board.lastMove} annotations={annotations} label={ui("Sample game review board")} /><div className="mt-3 flex items-center justify-between gap-2"><button type="button" onClick={() => selectPly(0)} aria-label={ui("Start of game")} className="rounded-lg border border-white/10 p-2 text-amber-100 hover:bg-white/10"><RotateCcw size={15} /></button><div className="flex items-center gap-2"><button type="button" disabled={ply === 0} onClick={() => selectPly(ply - 1)} aria-label={ui("Previous move")} className="rounded-lg border border-white/10 p-2 text-amber-100 hover:bg-white/10 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="min-w-12 text-center text-xs text-stone-400">{ply}/{moves.length}</span><button type="button" disabled={ply === moves.length} onClick={() => selectPly(ply + 1)} aria-label={ui("Next move")} className="rounded-lg border border-white/10 p-2 text-amber-100 hover:bg-white/10 disabled:opacity-40"><ChevronRight size={16} /></button></div></div><div className="mt-5 border-t border-[#a38960]/20 pt-4"><p className="mb-2 text-[11px] leading-4 text-stone-400">{ui("Sample move categories")}</p><div className="flex flex-wrap items-center gap-1.5">{qualityList.map(quality => <QualityBadge key={quality} quality={quality} />)}</div><button type="button" onClick={() => setReviewOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-200 px-4 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-100">{ui("Open sample review")}<ArrowRight size={16} /></button></div></div>
      <div className="flex min-w-0 flex-col">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">{ui("Review insight")}</p>
        <p className="mt-2 font-serif text-xl text-[#f3e7cf]">{ui(note.title)}</p>
        <p className="mt-2 text-xs leading-5 text-stone-400">{ui(note.detail)}</p>
        {note.points && <ul className="mt-3 grid justify-items-start gap-1">{note.points.map(point => <li key={point.text} className="flex max-w-full items-start gap-1.5 rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[11px] leading-4 text-stone-300"><PointIcon tone={point.tone} />{ui(point.text)}</li>)}</ul>}
        <button type="button" onClick={() => setSelectedAlternative(null)} aria-pressed={selectedAlternative === null} className={`mt-5 flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition ${selectedAlternative === null ? "" : "border-white/5 bg-black/20 hover:bg-white/5"}`} style={selectedAlternative === null ? { borderColor: `${currentColor}66`, background: `${currentColor}1a` } : undefined}>
          <span className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-amber-200/60"><span>{ui("Current Move")}</span><small className="font-mono text-[11px] normal-case tracking-normal text-emerald-300">{ui("Evaluation")} {ply ? reviewLines[ply - 1].current : "—"}</small></span>
          <span className="flex items-center justify-between gap-2"><span className="font-mono text-2xl font-black text-[#f1e4ca]">{ply ? `${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."} ${moves[ply - 1]}` : "—"}</span>{note.quality === "Start" ? <strong className="text-sm text-stone-300">{ui("Start")}</strong> : <QualityBadge quality={note.quality} />}</span>
        </button>
        {candidatePositions.length > 0 && <div className="mt-5"><p className="text-[10px] font-black uppercase tracking-widest text-amber-400">{ui("Best Alternatives")}</p><div className="mt-3 space-y-2">{candidatePositions.map((candidate, index) => <AlternativeMoveButton key={candidate.san} index={index} san={candidate.san} evaluation={candidate.evaluation} quality={candidate.quality} active={selectedAlternative === candidate.index} onClick={() => setSelectedAlternative(candidate.index)} />)}</div></div>}
        <Link to="/games/chess/classic/ai" className="mt-auto flex items-center justify-between pt-6 text-sm font-semibold text-amber-200 hover:text-amber-100">{ui("Try a full game review")}<ArrowRight size={16} /></Link>
      </div>
    </div>
    {reviewOpen && <ReviewDemoDialog moves={moves} onClose={() => setReviewOpen(false)} />}
  </div>;
}

function PointIcon({ tone }: { tone: Point["tone"] }) {
  if (tone === "support") return <span aria-hidden="true" className="mt-0.5 size-3 shrink-0 rounded-[3px]" style={{ boxShadow: `inset 0 0 0 2px ${SUPPORT_COLOR}` }} />;
  if (tone === "shield") return <Shield aria-hidden="true" size={12} className="mt-0.5 shrink-0" style={{ color: SUPPORT_COLOR }} />;
  if (tone === "king") return <Crown aria-hidden="true" size={12} className="mt-0.5 shrink-0 text-rose-300" />;
  return <Lightbulb aria-hidden="true" size={12} className="mt-0.5 shrink-0 text-amber-300" />;
}
