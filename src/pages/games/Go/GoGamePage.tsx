import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Lightbulb, RotateCcw } from "lucide-react";
import GoBoard from "../../../components/strategy/GoBoard";
import GoGameReview from "../../../components/strategy/GoGameReview";
import { goBot, type BotDifficulty } from "../../../games/go/bot";
import { analyzeGo, goCoordinate, parseGoCoordinate } from "../../../games/go/analysis";
import { saveGoGame } from "../../../games/go/storage";
import { canReviewGoGame } from "../../../games/go/reviewAvailability";
import { applyGoMove, createInitialGoState, isLegalGoMove, scoreGo, type GoMove, type GoState } from "../../../games/go/rules";

type SuggestedMove = { coordinate: string; move: GoMove };
type BestMoves = { position: GoState; status: "loading" | "ready" | "error"; moves: SuggestedMove[]; selected: number; error?: string };

export default function GoGamePage({ mode }: { mode: "ai" | "hotseat" }) {
  const [boardSize, setBoardSize] = useState<GoState["boardSize"]>(9);
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [state, setState] = useState(() => createInitialGoState(9));
  const [tab, setTab] = useState<"play" | "analysis">("play");
  const [helpMode, setHelpMode] = useState(false);
  const [bestMoves, setBestMoves] = useState<BestMoves | null>(null);
  const helpRequest = useRef<AbortController | null>(null);
  const thinking = mode === "ai" && tab === "play" && state.status === "playing" && state.currentPlayer === "white";
  const [botName, setBotName] = useState("KataGo");
  const restart = useCallback((size = boardSize) => { helpRequest.current?.abort(); setBestMoves(null); setState(createInitialGoState(size)); setTab("play"); }, [boardSize]);
  const play = useCallback((move: GoMove) => setState(current => {
    if (mode === "ai" && current.currentPlayer === "white") return current;
    return isLegalGoMove(current, move) ? applyGoMove(current, move) : current;
  }), [mode]);
  useEffect(() => { if (state.moveHistory.length) saveGoGame(state); }, [state]);
  useEffect(() => () => { helpRequest.current?.abort(); }, [state, tab]);
  useEffect(() => {
    if (mode !== "ai" || tab !== "play" || state.status !== "playing" || state.currentPlayer !== "white") return;
    const controller = new AbortController();
    async function choose() {
      let move: GoMove;
      try {
        const analysis = await analyzeGo(state, controller.signal);
        const candidates = analysis.moveInfos.slice().sort((a, b) => a.order - b.order);
        const candidate = candidates[Math.min(candidates.length - 1, difficulty === "easy" ? 2 : difficulty === "medium" ? 1 : 0)];
        if (!candidate) throw new Error("No engine move");
        move = parseGoCoordinate(candidate.move, state.boardSize);
        if (!isLegalGoMove(state, move)) throw new Error("Invalid engine move");
        if (!controller.signal.aborted) setBotName("KataGo");
      } catch (error) {
        if (controller.signal.aborted) throw error;
        move = await goBot.chooseMove(state, difficulty, controller.signal);
        if (!controller.signal.aborted) setBotName("Local bot");
      }
      if (!controller.signal.aborted) setState(current => current === state ? applyGoMove(current, move) : current);
    }
    void choose().catch(error => { if (!controller.signal.aborted) console.error(error); });
    return () => controller.abort();
  }, [state, difficulty, mode, tab]);
  const score = useMemo(() => scoreGo(state), [state]);
  const disabled = state.status !== "playing" || (mode === "ai" && state.currentPlayer === "white");
  const reviewAvailable = canReviewGoGame(state);
  const visibleBestMoves = helpMode && tab === "play" && bestMoves?.position === state ? bestMoves : null;
  const showBestMoves = async () => {
    helpRequest.current?.abort();
    const controller = new AbortController();
    helpRequest.current = controller;
    setBestMoves({ position: state, status: "loading", moves: [], selected: 0 });
    try {
      const analysis = await analyzeGo(state, controller.signal);
      if (controller.signal.aborted) return;
      const seen = new Set<string>();
      const moves = analysis.moveInfos.slice().sort((a, b) => a.order - b.order).flatMap(candidate => {
        if (seen.has(candidate.move)) return [];
        try {
          const move = parseGoCoordinate(candidate.move, state.boardSize);
          if (!isLegalGoMove(state, move)) return [];
          seen.add(candidate.move);
          return [{ coordinate: candidate.move, move }];
        } catch { return []; }
      }).slice(0, 3);
      setBestMoves({ position: state, status: "ready", moves, selected: 0 });
    } catch (error) {
      if (!controller.signal.aborted) setBestMoves({ position: state, status: "error", moves: [], selected: 0, error: error instanceof Error ? error.message : "Could not analyze this position." });
    } finally {
      if (helpRequest.current === controller) helpRequest.current = null;
    }
  };
  const toggleHelp = () => {
    if (helpMode) { helpRequest.current?.abort(); setBestMoves(null); }
    setHelpMode(!helpMode);
  };
  return <main className="go-page">
    <header className="go-page-header">
      <Link to="/games/go"><ArrowLeft size={16} /> Go</Link>
      <h1>Go · {mode === "ai" ? "Singleplayer" : "Hotseat"}</h1>
      <Link to="/games/go/rules"><BookOpen size={16} /> Rules</Link>
    </header>
    <div className="go-game-toolbar">
      <div className="go-tabs" role="tablist" aria-label="Go views"><button role="tab" aria-selected={tab === "play"} onClick={() => setTab("play")}>Play</button>{reviewAvailable && <button role="tab" aria-selected={tab === "analysis"} onClick={() => setTab("analysis")}>Game Review</button>}</div>
      <label>Board <select value={boardSize} onChange={event => { const size = Number(event.target.value) as GoState["boardSize"]; setBoardSize(size); restart(size); }}><option value={9}>9 × 9</option><option value={13}>13 × 13</option><option value={19}>19 × 19</option></select></label>
      {mode === "ai" && <label>Difficulty <select value={difficulty} onChange={event => setDifficulty(event.target.value as BotDifficulty)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>}
      <button className="go-action" onClick={() => restart()}><RotateCcw size={16} /> New game</button>
    </div>
    {tab === "analysis" && reviewAvailable ? <GoGameReview key={state.boardSize + ":" + state.moveHistory.length} game={state} /> : <div className="go-play-layout">
      <section><GoBoard state={state} onMove={play} disabled={disabled} help={helpMode} suggestions={visibleBestMoves?.moves.map(candidate => candidate.move)} selectedSuggestion={visibleBestMoves?.selected} /></section>
      <aside>
        <h2 className="capitalize" role="status">{state.result ?? (thinking && disabled ? "White is thinking..." : state.currentPlayer + " to move")}</h2>
        <p className="go-muted">Move {state.moveHistory.length + 1} · Komi {state.komi}{mode === "ai" ? " · " + botName : ""}</p>
        <div className="go-score-grid"><div>Black<strong>{state.captures.black}</strong><span>captured stones</span></div><div>White<strong>{state.captures.white}</strong><span>captured stones</span></div></div>
        <div className="go-help-panel">
          <button type="button" className="go-action" aria-pressed={helpMode} onClick={toggleHelp}><Lightbulb size={16} /> Help mode {helpMode ? "on" : "off"}</button>
          {helpMode && <>
            <p className="go-muted">Inspect liberties and atari on the board. Get suggestions for the current player.</p>
            <button type="button" className="go-action" disabled={disabled || visibleBestMoves?.status === "loading"} onClick={() => void showBestMoves()}>Best moves</button>
            {visibleBestMoves?.status === "loading" && <p role="status" className="go-muted">Finding the best moves…</p>}
            {visibleBestMoves?.status === "error" && <p role="alert" className="go-engine-error">{visibleBestMoves.error}</p>}
            {visibleBestMoves?.status === "ready" && (visibleBestMoves.moves.length ? <>
              <p className="go-muted">Select a move to highlight it. Click its point on the board, or play the selected move.</p>
              <div className="go-best-moves" aria-label="Best moves">{visibleBestMoves.moves.map((candidate, index) => <button key={candidate.coordinate} type="button" aria-pressed={visibleBestMoves.selected === index} onClick={() => setBestMoves(current => current?.position === state ? { ...current, selected: index } : current)}><span className="go-best-rank">{index + 1}</span><span>{candidate.coordinate}</span></button>)}</div>
              <button type="button" className="go-action" disabled={disabled} onClick={() => play(visibleBestMoves.moves[visibleBestMoves.selected].move)}>Play selected move</button>
            </> : <p className="go-muted">No legal suggestions are available for this position.</p>)}
          </>}
        </div>
        {state.status === "finished" && !state.result?.includes("resignation") && <p>Final area score: Black {score.black} · White {score.white}</p>}
        {reviewAvailable && <button className="go-action" onClick={() => setTab("analysis")}>Game Review</button>}
        <div className="go-controls"><button disabled={disabled} onClick={() => play({ type: "pass" })}>Pass</button><button disabled={disabled} onClick={() => play({ type: "resign" })}>Resign</button></div>
        <h3>Moves</h3><ol className="go-game-history">{state.moveHistory.map((entry, index) => <li key={index}><span>{index + 1}. {entry.player === "black" ? "B" : "W"} {goCoordinate(entry, state.boardSize)}</span>{!!entry.captured && <span>+{entry.captured}</span>}</li>)}</ol>
      </aside>
    </div>}
  </main>;
}
