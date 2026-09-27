import { useEffect, useRef, useState } from "react";
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

export default function LearnShowcase({ compact = false, bare = false }: { compact?: boolean; bare?: boolean }) {
  useUiLanguage();
  const [slide, setSlide] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [solved, setSolved] = useState(false);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [wrongMove, setWrongMove] = useState<[Square, Square] | null>(null);
  const [animatedMove, setAnimatedMove] = useState<{ from: Square; to: Square; atDestination: boolean } | null>(null);
  const animating = useRef(false);
  const timers = useRef<number[]>([]);
  const frames = useRef<number[]>([]);
  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    frames.current.forEach(window.cancelAnimationFrame);
  }, []);
  const current = slides[slide];
  const game = new Chess(puzzleFen);
  if (solved) game.move({ from: "h5", to: "f7" });
  const legalSquares = selected && !solved ? game.moves({ square: selected, verbose: true }).map(move => move.to) : [];

  function attemptMove(from: Square, to: Square) {
    if (solved || animating.current || !game.get(from) || from === to) return;
    animating.current = true;
    setSelected(null);
    setWrongMove(null);
    setFeedback("");
    const schedule = (callback: () => void, delay: number) => { timers.current.push(window.setTimeout(callback, delay)); };
    const animate = (moveFrom: Square, moveTo: Square, done: () => void) => {
      setAnimatedMove({ from: moveFrom, to: moveTo, atDestination: false });
      frames.current.push(window.requestAnimationFrame(() => {
        frames.current.push(window.requestAnimationFrame(() => setAnimatedMove({ from: moveFrom, to: moveTo, atDestination: true })));
      }));
      schedule(done, 360);
    };
    const finishCorrectMove = () => {
        setSolved(true);
        setWrongMove(null);
        setFeedback("");
        setAnimatedMove(null);
        animating.current = false;
    };
    const showCorrectMove = () => {
      setAnimatedMove(null);
      schedule(() => animate("h5", "f7", finishCorrectMove), 80);
    };
    if (from === "h5" && to === "f7") {
      animate(from, to, finishCorrectMove);
    } else {
      animate(from, to, () => {
      setWrongMove([from, to]);
      setFeedback("That move misses mate. Watch the correct move.");
      schedule(showCorrectMove, 650);
      });
    }
  }

  function chooseSquare(square: Square) {
    if (solved || animating.current) return;
    if (selected && selected !== square) {
      attemptMove(selected, square);
      return;
    }
    const piece = game.get(square);
    if (piece?.color === game.turn()) {
      setSelected(square);
      setWrongMove(null);
      setFeedback("");
    } else {
      setSelected(null);
    }
  }

  function changeSlide(next: number) {
    setSlide((next + slides.length) % slides.length);
  }

  return (
    <section aria-roledescription="carousel" aria-label={ui("Featured lessons")} className={`landing-preview ${bare ? "landing-preview--bare" : "overflow-hidden rounded-[28px] border border-white/10 bg-[#0b101d] shadow-2xl shadow-black/30"} ${compact ? "learning-preview--compact" : ""}`}>
      {!bare && <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-100"><BookOpen size={17} className="text-amber-400" />{ui("Learn by doing")}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => changeSlide(slide - 1)} aria-label={ui("Previous lesson")} className="rounded-full border border-white/15 p-2 text-zinc-300 hover:bg-white/10"><ChevronLeft size={17} /></button>
          <button type="button" onClick={() => changeSlide(slide + 1)} aria-label={ui("Next lesson")} className="rounded-full border border-white/15 p-2 text-zinc-300 hover:bg-white/10"><ChevronRight size={17} /></button>
        </div>
      </div>}
      <div className={bare ? "" : "p-5 sm:p-6"}>
        {!bare && <div className="mb-4 flex items-center justify-between gap-3" aria-live="polite">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400">{ui("Featured lesson")} / 0{slide + 1}</p><h3 className="mt-1 font-serif text-2xl text-white">{ui(current.title)}</h3></div>
          <div className="flex gap-1.5" aria-label={ui("Select lesson")}>{slides.map((item, index) => <button key={item.title} type="button" onClick={() => changeSlide(index)} aria-label={ui(item.title)} aria-current={slide === index ? "true" : undefined} className={`h-2 rounded-full transition-all ${slide === index ? "w-7 bg-amber-400" : "w-2 bg-white/25 hover:bg-white/50"}`} />)}</div>
        </div>}
        <div className={`learning-preview__stage${bare ? " learning-preview__stage--bare" : ""}`}>
        {slide === 0 ? (
          <div key="puzzle" className="learning-preview__lesson rounded-2xl border border-white/10 bg-zinc-900/65 p-3 sm:p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">{ui("Sample puzzle")}</span><span className="rounded-full border border-sky-400/15 bg-sky-400/[0.06] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-sky-300">{ui("Elo")} 1200</span></div><h4 className="mt-1 font-serif text-xl font-semibold text-[#f5e8cf]">{ui("Queen and bishop mate")}</h4><p className="mt-1 text-xs text-zinc-500">{ui("Find the best continuation.")}</p></div>
              <div className="flex gap-2"><span className="rounded-full border border-violet-400/15 bg-violet-400/[0.06] px-2.5 py-1 text-[10px] font-black text-violet-300">{ui("Easy")}</span><span className="rounded-full border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-1 text-[10px] font-black text-amber-300">{ui("Checkmate")}</span></div>
            </div>
            <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(150px,.8fr)]">
            <ChessPreviewBoard fen={game.fen()} selected={selected} legalSquares={legalSquares} lastMove={solved ? ["h5", "f7"] : null} wrongSquare={wrongMove?.[1]} wrongFrom={wrongMove?.[0]} correctSquare={wrongMove ? "f7" : null} correctFrom={wrongMove ? "h5" : null} animatedMove={animatedMove} onSquareClick={chooseSquare} onMoveAttempt={attemptMove} label={ui("Chess puzzle: white to move")} />
            <div aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">{ui("White to move")}</p>
              <p className="mt-2 font-serif text-xl text-white">{solved ? ui("Checkmate!") : ui("Find mate in one.")}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{solved ? ui("The queen lands on f7, protected by the bishop on c4.") : ui("Tap the white queen, then the square that ends the game.")}</p>
              {!solved && <button type="button" onClick={() => setHint(true)} className="mt-4 text-xs font-semibold text-amber-300 underline underline-offset-4 hover:text-amber-200">{ui("Need a hint?")}</button>}
              {hint && !solved && <p className="mt-2 text-xs text-amber-200">{ui("Look at f7 beside the black king.")}</p>}
              {feedback && <p className="mt-2 text-xs text-amber-200">{ui(feedback)}</p>}
              {solved && <button type="button" onClick={() => { setSolved(false); setHint(false); setSelected(null); setWrongMove(null); setFeedback(""); }} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-amber-300 hover:text-amber-200"><RotateCcw size={14} />{ui("Try again")}</button>}
            </div>
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
        {!bare && <Link to={current.route} className="mt-5 inline-flex w-full items-center justify-between rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20">{ui(current.action)}<ArrowRight size={16} /></Link>}
      </div>
    </section>
  );
}
