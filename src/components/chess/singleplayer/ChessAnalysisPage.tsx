import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Chess, type Square } from "chess.js";
import { ArrowRight, BarChart3, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, RotateCw } from "lucide-react";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import Board from "./Board";
import ChessGameReview from "./ChessGameReview";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { ui, useUiLanguage } from "@/i18n/ui";
import { ANALYSIS_DEMO_MOVES, analysisPositions } from "./analysisDemo";

type SavedAnalysisGame = {
  id: string;
  name: string | null;
  white_player: string | null;
  black_player: string | null;
  created_at: string;
  moves: string[];
};
const demo: SavedAnalysisGame = {
  id: "analysis-demo", name: "Demo analysis", white_player: "White", black_player: "Black",
  created_at: "", moves: ANALYSIS_DEMO_MOVES,
};
const panel = "rounded-[1.6rem] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(10,18,28,.94),rgba(4,9,15,.92))] shadow-xl shadow-black/20";
const control = "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 transition hover:border-amber-300/40 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-amber-200";

function AnalysisWorkspace({ game, isDemo }: { game: SavedAnalysisGame; isDemo: boolean }) {
  useGameLanguage();
  const replay = useMemo(() => analysisPositions(game.moves), [game.moves]);
  const [ply, setPly] = useState(Math.min(20, replay.positions.length - 1));
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [reviewOpen, setReviewOpen] = useState(false);
  const frame = replay.positions[ply];
  const position = useMemo(() => new Chess(frame.fen), [frame.fen]);
  const pairs = Array.from({ length: Math.ceil(game.moves.length / 2) }, (_, index) => game.moves.slice(index * 2, index * 2 + 2));
  const lastMove = frame.lastMove ? { from: frame.lastMove.from as Square, to: frame.lastMove.to as Square } : null;
  const checkedKing = position.isCheck() ? position.board().flat().find(piece => piece?.type === "k" && piece.color === position.turn())?.square ?? null : null;

  return <>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className={`${panel} p-4 sm:p-6`} aria-label={ui("Game replay")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[9px] font-black uppercase tracking-[.24em] text-amber-300/75">{ui(isDemo ? "50-move example" : "Saved game")}</p><h2 className="mt-1 font-serif text-2xl text-[#f2e4c7]">{gameUi(isDemo ? ui("Demo analysis") : game.name || ui("Untitled game"))}</h2><p className="mt-1 text-xs text-zinc-500">{gameUi(game.white_player || ui("White"))} · {gameUi(game.black_player || ui("Black"))}</p></div>
          <button type="button" className={control} onClick={() => setOrientation(current => current === "white" ? "black" : "white")} aria-label={ui("Flip board")} title={ui("Flip board")}><RotateCw size={17} /></button>
        </div>
        <div className="mx-auto w-full max-w-[620px]">
          <Board board={position.board()} selectedSquare={null} legalMoves={[]} lastMove={lastMove} checkedKingSquare={checkedKing} onSquareClick={() => undefined} orientation={orientation} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button type="button" className={control} onClick={() => setPly(0)} disabled={ply === 0} aria-label={ui("First move")}><ChevronsLeft size={18} /></button>
          <button type="button" className={control} onClick={() => setPly(current => current - 1)} disabled={ply === 0} aria-label={ui("Previous move")}><ChevronLeft size={18} /></button>
          <span className="min-w-28 text-center font-mono text-xs text-zinc-400" aria-live="polite">{gameUi(ply === 0 ? ui("Starting position") : `${Math.ceil(ply / 2)}${ply % 2 ? "." : "…"} ${game.moves[ply - 1]}`)}</span>
          <button type="button" className={control} onClick={() => setPly(current => current + 1)} disabled={ply === replay.positions.length - 1} aria-label={ui("Next move")}><ChevronRight size={18} /></button>
          <button type="button" className={control} onClick={() => setPly(replay.positions.length - 1)} disabled={ply === replay.positions.length - 1} aria-label={ui("Last move")}><ChevronsRight size={18} /></button>
        </div>
      </section>
      <aside className="space-y-4">
        <section className={`${panel} p-5`}>
          <BarChart3 size={22} className="text-amber-200" />
          <h2 className="mt-3 font-serif text-xl text-[#f2e4c7]">{ui("Create an analysis")}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{ui("Review every move with Stockfish. Find your best moves, mistakes and missed opportunities.")}</p>
          <p className="mt-3 text-xs text-zinc-500">{gameUi(Math.ceil(game.moves.length / 2))} {ui("moves")} · {gameUi(game.moves.length)} {ui("plies")}</p>
          {!replay.valid && <p role="alert" className="mt-3 text-sm text-rose-200">{ui(game.moves.length ? "This saved game has an unsupported move history." : "Save a game with moves to analyse it.")}</p>}
          <button type="button" disabled={!replay.valid} onClick={() => setReviewOpen(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/40 bg-gradient-to-br from-amber-200 to-amber-400 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">{ui(isDemo ? "Analyse demo game" : "Analyse saved game")}<ArrowRight size={16} /></button>
          {isDemo && <p className="mt-3 text-xs leading-5 text-zinc-500">{ui("Explore this sample while you build your own game library.")}</p>}
        </section>
        <section className={`${panel} overflow-hidden`}>
          <h2 className="border-b border-white/[0.06] px-4 py-3 font-serif text-lg text-[#f2e4c7]">{ui("Move history")}</h2>
          <div className="max-h-[440px] overflow-y-auto p-2 [scrollbar-width:thin]">
            {pairs.map((pair, index) => <div key={index} className={`grid grid-cols-[36px_1fr_1fr] items-center gap-1 rounded-lg px-2 py-1 ${index % 2 ? "bg-white/[0.025]" : ""}`}>
              <span className="font-mono text-[11px] text-zinc-600">{gameUi(index + 1)}.</span>
              {pair.map((san, side) => { const movePly = index * 2 + side + 1; return <button key={side} type="button" disabled={movePly >= replay.positions.length} onClick={() => setPly(movePly)} aria-pressed={ply === movePly} aria-label={`${index + 1}${side ? "…" : "."} ${san}`} className={`rounded-lg px-2 py-2 text-left font-mono text-xs transition hover:bg-amber-300/10 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-30 ${ply === movePly ? "bg-amber-300/15 text-amber-200" : "text-zinc-300"}`}>{san}</button>; })}
            </div>)}
          </div>
        </section>
      </aside>
    </div>
    {reviewOpen && <ChessGameReview moves={game.moves} orientation={orientation} open onClose={() => setReviewOpen(false)} />}
  </>;
}

export default function ChessAnalysisPage() {
  useUiLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [library, setLibrary] = useState<{ owner: string | null; request: number; games: SavedAnalysisGame[]; status: "ready" | "loading" | "error" }>({ owner: null, request: -1, games: [], status: "ready" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.from("games").select("id,name,white_player,black_player,created_at,moves").eq("user_id", userId).order("created_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) setLibrary({ owner: userId, request: refresh, games: (data ?? []).map(game => ({ ...game, moves: Array.isArray(game.moves) ? game.moves : [] })), status: "ready" });
      } catch {
        if (!cancelled) setLibrary({ owner: userId, request: refresh, games: [], status: "error" });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [userId, refresh]);
  const games = userId && library.owner === userId ? library.games : [];
  const status = !userId ? "ready" : library.owner === userId && library.request === refresh ? library.status : "loading";
  const selected = games.find(game => game.id === selectedId) ?? games[0] ?? demo;

  return <main className="relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 overflow-x-hidden bg-[#03070d] text-zinc-100">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_17%_12%,rgba(181,132,46,.11),transparent_30%),radial-gradient(circle_at_82%_24%,rgba(52,83,116,.10),transparent_28%)]" />
    <div className="relative mx-auto max-w-[1640px] px-4 pb-12 pt-4 sm:px-6 lg:px-8">
      <ChessPageHeader title={gameUi("Chess Analysis")} className="border-b border-white/[0.06] pb-4"><Link to="/games/chess" className="text-xs font-bold text-zinc-500 transition hover:text-amber-200">← {ui("Back to Chess")}</Link></ChessPageHeader>
      <header className="flex flex-wrap items-end justify-between gap-5 py-7 sm:py-9">
        <div><p className="text-[10px] font-black uppercase tracking-[.34em] text-amber-300/85">{ui("Learn Chess")}</p><h1 className="mt-3 font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-none tracking-[-.04em] text-[#f2e4c7]">{ui("Chess Analysis")}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">{ui("Every game has something to teach you. Revisit your moves and find your next improvement.")}</p></div>
        <div className="flex gap-2"><Link to="/games/chess/puzzles" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-zinc-400 transition hover:border-amber-300/30 hover:text-amber-200">{ui("Puzzles")}</Link><Link to="/games/chess/rules" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-zinc-400 transition hover:border-amber-300/30 hover:text-amber-200">{ui("Rules & Tips")}</Link></div>
      </header>
      <section className={`${panel} mb-5 p-4 sm:p-5`} aria-label={ui("Saved games")}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-xl text-[#f2e4c7]">{ui("Your saved games")}</h2>{userId && <button type="button" disabled={status === "loading"} onClick={() => setRefresh(current => current + 1)} className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-amber-200 disabled:opacity-40"><RefreshCw size={14} />{ui("Refresh")}</button>}</div>
        {gameUi(status === "loading" ? <p role="status" className="mt-3 text-sm text-zinc-400">{ui("Loading saved games…")}</p> : status === "error" ? <p role="alert" className="mt-3 text-sm text-rose-200">{ui("Could not load saved games. Try refreshing.")}</p> : games.length ? <label className="mt-3 block"><span className="sr-only">{ui("Choose a saved game")}</span><select value={selected.id} onChange={event => setSelectedId(event.target.value)} className="w-full rounded-xl border border-amber-300/20 bg-[#08111c] px-4 py-3 text-sm text-zinc-200 outline-none focus:border-amber-300/60 [color-scheme:dark]">{games.map(game => <option key={game.id} value={game.id}>{gameUi(game.name || ui("Untitled game"))} · {gameUi(game.white_player || ui("White"))} / {gameUi(game.black_player || ui("Black"))} · {gameUi(new Date(game.created_at).toLocaleDateString())}</option>)}</select></label> : <div className="mt-3 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-amber-100/90">{ui("Start a game and save it to start the analysis here")}</p><p className="mt-1.5 text-xs text-zinc-500">{ui("A 50-move demo is ready to explore below.")}</p></div><Link to="/games/chess/classic" className="inline-flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-2.5 text-xs font-bold text-amber-200 transition hover:bg-amber-300/15">{ui("Start a game")}<ArrowRight size={14} /></Link></div>)}
      </section>
      {status !== "loading" && <AnalysisWorkspace key={`${userId ?? "guest"}:${selected.id}:${selected.moves.join("|")}`} game={selected} isDemo={selected === demo} />}
    </div>
  </main>;
}
