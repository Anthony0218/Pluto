import { useState } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import ChessPreviewBoard from "./ChessPreviewBoard";
import "./landingPreviews.css";

const puzzleFen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
const slides = [
  { title: "Chess Puzzle", route: "/games/chess/rules?tab=puzzles", action: "More chess puzzles" },
  { title: "Watten Rules", route: "/games/watten/rules", action: "Explore the rules" },
] as const;

export default function LearnShowcase() {
  useUiLanguage();
  const [slide, setSlide] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [solved, setSolved] = useState(false);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState("");
  const current = slides[slide];
  const game = new Chess(puzzleFen);
  if (solved) game.move({ from: "h5", to: "f7" });

  function chooseSquare(square: Square) {
    if (solved) return;
    if (selected === "h5" && square === "f7") {
      setSolved(true);
      setSelected(null);
      setFeedback("");
      return;
    }
    setFeedback(selected === "h5" && square !== "h5" ? "Try another square. Look for a check the king cannot escape." : "");
    setSelected(square === "h5" ? square : null);
  }

  function changeSlide(next: number) {
    setSlide((next + slides.length) % slides.length);
  }

  return (
    <section aria-roledescription="carousel" aria-label={ui("Featured lessons")} className="landing-preview overflow-hidden rounded-[28px] border border-white/10 bg-[#0b101d] shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-100"><BookOpen size={17} className="text-amber-400" />{ui("Learn by doing")}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => changeSlide(slide - 1)} aria-label={ui("Previous lesson")} className="rounded-full border border-white/15 p-2 text-zinc-300 hover:bg-white/10"><ChevronLeft size={17} /></button>
          <button type="button" onClick={() => changeSlide(slide + 1)} aria-label={ui("Next lesson")} className="rounded-full border border-white/15 p-2 text-zinc-300 hover:bg-white/10"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3" aria-live="polite">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400">{ui("Featured lesson")} / 0{slide + 1}</p><h3 className="mt-1 font-serif text-2xl text-white">{ui(current.title)}</h3></div>
          <div className="flex gap-1.5" aria-label={ui("Select lesson")}>{slides.map((item, index) => <button key={item.title} type="button" onClick={() => changeSlide(index)} aria-label={ui(item.title)} aria-current={slide === index ? "true" : undefined} className={`h-2 rounded-full transition-all ${slide === index ? "w-7 bg-amber-400" : "w-2 bg-white/25 hover:bg-white/50"}`} />)}</div>
        </div>
        <div className="learning-preview__stage">
        {slide === 0 ? (
          <div key="puzzle" className="learning-preview__lesson grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(150px,.8fr)]">
            <ChessPreviewBoard fen={game.fen()} selected={selected} lastMove={solved ? ["h5", "f7"] : null} onSquareClick={chooseSquare} label={ui("Chess puzzle: white to move")} />
            <div aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">{ui("White to move")}</p>
              <p className="mt-2 font-serif text-xl text-white">{solved ? ui("Checkmate!") : ui("Find mate in one.")}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{solved ? ui("The queen lands on f7, protected by the bishop on c4.") : ui("Tap the white queen, then the square that ends the game.")}</p>
              {!solved && <button type="button" onClick={() => setHint(true)} className="mt-4 text-xs font-semibold text-amber-300 underline underline-offset-4 hover:text-amber-200">{ui("Need a hint?")}</button>}
              {hint && !solved && <p className="mt-2 text-xs text-amber-200">{ui("Look at f7 beside the black king.")}</p>}
              {feedback && <p className="mt-2 text-xs text-amber-200">{ui(feedback)}</p>}
              {solved && <button type="button" onClick={() => { setSolved(false); setHint(false); }} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-amber-300 hover:text-amber-200"><RotateCcw size={14} />{ui("Try again")}</button>}
            </div>
          </div>
        ) : (
          <div key="watten" className="learning-preview__lesson relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-2xl border border-amber-300/20 bg-[#132d25] p-5">
            <img src="/images/watten-home.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#160d09] via-[#160d09]/40 to-transparent" />
            <div className="relative"><span className="rounded-full border border-amber-200/30 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">{ui("Bavarian card game")}</span><div className="learning-preview__cards" aria-hidden="true"><img src="/images/bavarian/herz-king.png" alt="" /><img src="/images/bavarian/schellen-7.png" alt="" /><img src="/images/bavarian/eichel-7.png" alt="" /></div><h4 className="mt-2 font-serif text-2xl text-amber-50">{ui("Learn the cards. Read the table.")}</h4><p className="mt-2 max-w-sm text-sm leading-6 text-amber-100/75">{ui("Explore trump, Schlag and the three critical cards with visual examples.")}</p></div>
          </div>
        )}
        </div>
        <Link to={current.route} className="mt-5 inline-flex w-full items-center justify-between rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20">{ui(current.action)}<ArrowRight size={16} /></Link>
      </div>
    </section>
  );
}
