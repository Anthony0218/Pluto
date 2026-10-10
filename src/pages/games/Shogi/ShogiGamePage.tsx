import GameXpReward from "@/components/games/GameXpReward";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HeaderDescription } from "@/components/App/PublicHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import ShogiBoard from "../../../components/strategy/ShogiBoard";
import type { BotDifficulty } from "../../../games/go/bot";
import { shogiBot } from "../../../games/shogi/bot";
import { applyShogiMove, createInitialShogiState, type ShogiMove } from "../../../games/shogi/rules";
export default function ShogiGamePage({ mode }: { mode: "ai" | "hotseat" }) {
  useUiLanguage();
  const [state, setState] = useState(createInitialShogiState);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [thinking, setThinking] = useState(false);
  const generation = useRef(0);
  const restart = useCallback(() => { generation.current += 1; setThinking(false); setState(createInitialShogiState()); }, []);
  const play = useCallback((move: ShogiMove) => setState((current) => {
    if (mode === "ai" && current.currentPlayer === "white") return current;
    try { return applyShogiMove(current, move); } catch { return current; }
  }), [mode]);
  useEffect(() => {
    if (mode !== "ai" || state.status !== "playing" || state.currentPlayer !== "white") return;
    const controller = new AbortController(), currentGeneration = generation.current; setThinking(true);
    void shogiBot.chooseMove(state, difficulty, controller.signal).then((move) => {
      if (generation.current === currentGeneration) setState((current) => current.currentPlayer === "white" && current.status === "playing" ? applyShogiMove(current, move) : current);
    }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error); }).finally(() => { if (generation.current === currentGeneration) setThinking(false); });
    return () => controller.abort();
  }, [state, difficulty, mode]);
  const disabled = state.status !== "playing" || thinking || (mode === "ai" && state.currentPlayer === "white");
  const resultLabel = state.winner
    ? `${ui(state.winner === "white" ? "White" : "Black")} ${ui(state.lastMove?.type === "resign" ? "wins by resignation" : state.check ? "wins by checkmate" : "wins (no legal moves)")}`
    : state.result ? ui(state.result) : null;
  return <main className="relative left-1/2 h-[var(--app-height)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] px-3 py-3 text-zinc-100 sm:px-4 sm:py-4"><div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden">
    {mode === "ai" && <HeaderDescription>{ui("Difficulty")}: {ui(difficulty[0].toUpperCase() + difficulty.slice(1))}</HeaderDescription>}
    <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2"><Link to="/games/shogi" className="text-sm text-zinc-500 hover:text-white">← {ui("Shogi")}</Link><div className="flex gap-2">{mode === "ai" && <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">{ui("Bot")} <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)} className="ml-2 bg-transparent"><option className="bg-zinc-900" value="easy">{ui("Easy")}</option><option className="bg-zinc-900" value="medium">{ui("Medium")}</option><option className="bg-zinc-900" value="hard">{ui("Hard")}</option></select></label>}<button type="button" onClick={restart} className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-black">{ui("New Game")}</button></div></header>
    <div className="grid min-h-0 flex-1 content-center gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5"><section className="flex min-h-0 items-center justify-center"><ShogiBoard state={state} onMove={play} disabled={disabled} /></section>
      <aside className="space-y-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] p-3 lg:self-center lg:space-y-4 lg:rounded-3xl lg:p-5"><div className="hidden lg:block"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-400">{ui("Standard Japanese rules")}</p><h1 className="mt-2 font-serif text-3xl">{ui("Shogi")} · {ui(mode === "ai" ? "Vs Bot" : "Hotseat")}</h1></div>
        <div role="status" className="rounded-2xl bg-black/25 p-4"><p className="font-bold">{resultLabel ?? (thinking ? ui("White is thinking…") : ui(state.currentPlayer === "white" ? "White to move" : "Black to move"))}</p><p className="mt-1 text-xs text-zinc-500">{state.check ? `${ui("Check")} · ` : ""}{ui("Move")} {state.moveHistory.length + 1}</p></div>
        {state.status === "finished" && <GameXpReward />}
        <button type="button" disabled={disabled} onClick={() => play({ type: "resign" })} className="min-h-11 w-full rounded-xl border border-red-400/20 text-red-300 hover:bg-red-400/10 disabled:opacity-40">{ui("Resign")}</button>
        <details className="hidden text-sm text-zinc-400 lg:block"><summary className="cursor-pointer font-bold text-zinc-300">{ui("Moves")} ({state.moveHistory.length})</summary><ol className="mt-2 max-h-64 overflow-auto pl-5">{state.moveHistory.map((entry, index) => <li key={index}>{ui(entry.player === "white" ? "White" : "Black")}: {entry.move.type === "move" ? (entry.move.from + 1) + "→" + (entry.move.to + 1) + (entry.move.promote ? "+" : "") : entry.move.type === "drop" ? entry.move.piece + "*" + (entry.move.to + 1) : ui("Resign")}</li>)}</ol></details>
      </aside>
    </div>
  </div></main>;
}
