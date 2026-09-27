import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import GoBoard from "../../../components/strategy/GoBoard";
import { goBot, type BotDifficulty } from "../../../games/go/bot";
import { applyGoMove, createInitialGoState, scoreGo, type GoMove, type GoState } from "../../../games/go/rules";
export default function GoGamePage({ mode }: { mode: "ai" | "hotseat" }) {
  const [boardSize, setBoardSize] = useState<GoState["boardSize"]>(9);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [state, setState] = useState(() => createInitialGoState(9));
  const [thinking, setThinking] = useState(false);
  const generation = useRef(0);
  const restart = useCallback((size = boardSize) => { generation.current += 1; setThinking(false); setState(createInitialGoState(size)); }, [boardSize]);
  const play = useCallback((move: GoMove) => setState((current) => {
    if (mode === "ai" && current.currentPlayer === "white") return current;
    try { return applyGoMove(current, move); } catch { return current; }
  }), [mode]);
  useEffect(() => {
    if (mode !== "ai" || state.status !== "playing" || state.currentPlayer !== "white") return;
    const controller = new AbortController(), currentGeneration = generation.current;
    setThinking(true);
    void goBot.chooseMove(state, difficulty, controller.signal).then((move) => {
      if (generation.current === currentGeneration) setState((current) => current.currentPlayer === "white" && current.status === "playing" ? applyGoMove(current, move) : current);
    }).catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error); }).finally(() => { if (generation.current === currentGeneration) setThinking(false); });
    return () => controller.abort();
  }, [state, difficulty, mode]);
  const score = useMemo(() => scoreGo(state), [state]);
  const disabled = state.status !== "playing" || thinking || (mode === "ai" && state.currentPlayer === "white");
  return <main className="relative left-1/2 h-[var(--app-height)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] px-3 py-3 text-zinc-100 sm:px-4 sm:py-4">
    <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden">
      <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2"><Link to="/games/go" className="text-sm text-zinc-500 hover:text-white">← Go</Link><div className="flex flex-wrap gap-2">
        <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">Board <select value={boardSize} onChange={(event) => { const size = Number(event.target.value) as GoState["boardSize"]; setBoardSize(size); restart(size); }} className="ml-2 bg-transparent"><option className="bg-zinc-900">9</option><option className="bg-zinc-900">13</option><option className="bg-zinc-900">19</option></select></label>
        {mode === "ai" && <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">Bot <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as BotDifficulty)} className="ml-2 bg-transparent"><option className="bg-zinc-900">easy</option><option className="bg-zinc-900">medium</option><option className="bg-zinc-900">hard</option></select></label>}
        <button type="button" onClick={() => restart()} className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-black">New game</button>
      </div></header>
      <div className="grid min-h-0 flex-1 content-center gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5">
        <section className="flex min-h-0 items-center justify-center"><GoBoard state={state} onMove={play} disabled={disabled} /></section>
        <aside className="space-y-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] p-3 lg:self-center lg:space-y-4 lg:rounded-3xl lg:p-5">
          <div className="hidden lg:block"><p className="text-xs font-black uppercase tracking-[.2em] text-amber-400">Chinese area rules</p><h1 className="mt-2 font-serif text-3xl">Go · {mode === "ai" ? "Vs Bot" : "Hotseat"}</h1></div>
          <div role="status" className="rounded-2xl bg-black/25 p-4"><p className="font-bold capitalize">{state.result ?? (thinking ? "White is thinking…" : state.currentPlayer + " to move")}</p><p className="mt-1 text-xs text-zinc-500">Turn {state.moveHistory.length + 1} · Komi {state.komi}</p></div>
          <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-black/20 p-3">Black<br/><b>{score.black}</b> · {state.captures.black} captures</div><div className="rounded-xl bg-white/10 p-3">White<br/><b>{score.white}</b> · {state.captures.white} captures</div></div>
          <div className="grid grid-cols-2 gap-2"><button type="button" disabled={disabled} onClick={() => play({ type: "pass" })} className="min-h-11 rounded-xl border border-white/15 hover:bg-white/10 disabled:opacity-40">Pass</button><button type="button" disabled={disabled} onClick={() => play({ type: "resign" })} className="min-h-11 rounded-xl border border-red-400/20 text-red-300 hover:bg-red-400/10 disabled:opacity-40">Resign</button></div>
          <details className="hidden text-sm text-zinc-400 lg:block"><summary className="cursor-pointer font-bold text-zinc-300">Moves ({state.moveHistory.length})</summary><ol className="mt-2 max-h-48 overflow-auto pl-5">{state.moveHistory.map((entry, index) => <li key={index}>{entry.player}: {entry.type === "place" ? (entry.col + 1) + "," + (entry.row + 1) : entry.type}{entry.captured ? " ×" + entry.captured : ""}</li>)}</ol></details>
        </aside>
      </div>
    </div>
  </main>;
}
