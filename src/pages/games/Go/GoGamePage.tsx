import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { ArrowLeft, BookOpen, Lightbulb, RotateCcw, Save, ScanSearch } from "lucide-react";
import GoBoard from "../../../components/strategy/GoBoard";
import { goBot, type BotDifficulty } from "../../../games/go/bot";
import { analyzeGo, goCoordinate, parseGoCoordinate } from "../../../games/go/analysis";
import { getSavedGoGame, saveGoGame, saveGoRecord } from "../../../games/go/storage";
import { uploadGoRecord } from "../../../games/go/cloudStorage";
import { applyGoMove, createInitialGoState, isLegalGoMove, scoreGo, toggleDeadGoGroup, type GoMove, type GoState } from "../../../games/go/rules";

type SuggestedMove = { coordinate: string; move: GoMove };
type BestMoves = { position: GoState; status: "loading" | "ready" | "error"; moves: SuggestedMove[]; selected: number; error?: string };

export default function GoGamePage({ mode }: { mode: "ai" | "hotseat" }) {
  useGameLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const resumed = useMemo(() => getSavedGoGame(params.get("resume") ?? "", user?.id), [params, user?.id]);
  const [boardSize, setBoardSize] = useState<GoState["boardSize"]>(() => resumed?.mode === mode && resumed.game.status === "playing" ? resumed.game.boardSize : 9);
  const [difficulty, setDifficulty] = useState<BotDifficulty>(() => resumed?.difficulty ?? "medium");
  const [state, setState] = useState(() => resumed?.mode === mode && resumed.game.status === "playing" ? resumed.game : createInitialGoState(9));
  const [helpMode, setHelpMode] = useState(false);
  const [bestMoves, setBestMoves] = useState<BestMoves | null>(null);
  const helpRequest = useRef<AbortController | null>(null);
  const savedRecord = useRef<{ position: GoState; id: string } | null>(null);
  const thinking = mode === "ai" && state.status === "playing" && state.currentPlayer === "white";
  const [botName, setBotName] = useState("KataGo");
  const [saveMessage, setSaveMessage] = useState("");
  const [scoreConfirmed, setScoreConfirmed] = useState(false);
  const [savedMoveCount, setSavedMoveCount] = useState(() => resumed?.mode === mode ? resumed.game.moveHistory.length : 0);
  useEffect(() => {
    if (!resumed || resumed.mode !== mode || resumed.game.status !== "playing") return;
    const timer = window.setTimeout(() => {
      setState(current => current.moveHistory.length ? current : resumed.game);
      setBoardSize(resumed.game.boardSize);
      setDifficulty(resumed.difficulty ?? "medium");
      setSavedMoveCount(resumed.game.moveHistory.length);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resumed, mode]);
  const restart = useCallback((size = boardSize) => {
    const unsaved = state.moveHistory.length > savedMoveCount || state.consecutivePasses >= 2 && !scoreConfirmed && savedRecord.current?.position !== state;
    if ((state.status === "playing" || state.consecutivePasses >= 2 && !scoreConfirmed) && unsaved && !window.confirm("Start a new game? Save this game first if you want to keep it.")) return false;
    helpRequest.current?.abort(); savedRecord.current = null; setBestMoves(null); setSaveMessage(""); setSavedMoveCount(0); setScoreConfirmed(false); setState(createInitialGoState(size)); setBoardSize(size); return true;
  }, [boardSize, state, savedMoveCount, scoreConfirmed]);
  const play = useCallback((move: GoMove) => setState(current => {
    if (mode === "ai" && current.currentPlayer === "white") return current;
    return isLegalGoMove(current, move) ? applyGoMove(current, move) : current;
  }), [mode]);
  useEffect(() => { if (state.moveHistory.length) saveGoGame(state); }, [state]);
  useEffect(() => () => { helpRequest.current?.abort(); }, []);
  useEffect(() => {
    if (mode !== "ai" || state.status !== "playing" || state.currentPlayer !== "white") return;
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
  }, [state, difficulty, mode]);
  const score = useMemo(() => scoreGo(state), [state]);
  const scoring = state.status === "finished" && state.consecutivePasses >= 2;
  const disabled = state.status !== "playing" || (mode === "ai" && state.currentPlayer === "white");
  const visibleBestMoves = helpMode && bestMoves?.position === state ? bestMoves : null;
  useEffect(() => {
    if (!helpMode || state.status !== "playing" || thinking) return;
    const controller = new AbortController();
    helpRequest.current = controller;
    async function calculate() { await Promise.resolve(); if (controller.signal.aborted) return; setBestMoves({ position: state, status: "loading", moves: [], selected: 0 }); try {
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
    } }
    void calculate();
    return () => controller.abort();
  }, [helpMode, state, thinking]);
  const toggleHelp = () => {
    if (helpMode) { helpRequest.current?.abort(); setBestMoves(null); }
    setHelpMode(!helpMode);
  };
  function saveCurrent() {
    try {
      if (savedRecord.current?.position !== state) {
        const record = saveGoRecord(state, { mode, players: { black: mode === "ai" ? "You" : "Black", white: mode === "ai" ? botName : "White" }, ...(mode === "ai" ? { difficulty } : {}) }, undefined, user?.id);
        savedRecord.current = { position: state, id: record.id };
        if (user) void uploadGoRecord(record, user.id).then(() => setSaveMessage("Game saved and synced to your account.")).catch(() => setSaveMessage("Game saved on this device; account sync will retry later."));
      }
      setSavedMoveCount(state.moveHistory.length);
      setSaveMessage("Game saved to your Go library on this device.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Could not save this game."); }
  }
  function analyzeCurrent() {
    try {
      if (savedRecord.current?.position !== state) {
        const record = saveGoRecord(state, { mode, players: { black: mode === "ai" ? "You" : "Black", white: mode === "ai" ? botName : "White" }, ...(mode === "ai" ? { difficulty } : {}) }, undefined, user?.id);
        savedRecord.current = { position: state, id: record.id };
        if (user) void uploadGoRecord(record, user.id).catch(() => { /* Analysis opens from the local copy; sync retries in the library. */ });
      }
      navigate(`/games/go/analysis?game=${encodeURIComponent(savedRecord.current.id)}`);
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Could not open this game in analysis."); }
  }
  return <main className="go-page">
    <header className="go-page-header">
      <Link to="/games/go"><ArrowLeft size={16} />{gameUi(" Go")}</Link>
      <h1>{gameUi("Go · ")}{gameUi(mode === "ai" ? "Singleplayer" : "Hotseat")}</h1>
      <div className="go-header-links"><Link to="/games/go/rules"><BookOpen size={16} />{gameUi(" Rules")}</Link><Link to="/games/go/analysis"><ScanSearch size={16} />{gameUi(" Analysis")}</Link></div>
    </header>
    <div className="go-game-toolbar">
      <label>{gameUi("Board ")}<select value={boardSize} onChange={event => { const size = Number(event.target.value) as GoState["boardSize"]; restart(size); }}><option value={9}>9 × 9</option><option value={13}>13 × 13</option><option value={19}>19 × 19</option></select></label>
      {mode === "ai" && <label>{gameUi("Difficulty ")}<select value={difficulty} onChange={event => setDifficulty(event.target.value as BotDifficulty)}><option value="easy">{gameUi("Easy")}</option><option value="medium">{gameUi("Medium")}</option><option value="hard">{gameUi("Hard")}</option></select></label>}
    </div>
    <div className="go-play-layout">
      <section><GoBoard state={state} onMove={play} disabled={disabled} scoring={scoring && !scoreConfirmed} onAttempt={scoring && !scoreConfirmed ? move => { if (move.type === "place") setState(current => toggleDeadGoGroup(current, move.row * current.boardSize + move.col)); } : undefined} help={helpMode && !scoring} suggestions={visibleBestMoves?.moves.map(candidate => candidate.move)} selectedSuggestion={visibleBestMoves?.selected} /></section>
      <aside>
        <h2 className="capitalize" role="status">{gameUi(scoring && !scoreConfirmed ? "Review dead stones" : state.result ?? (thinking && disabled ? "White is thinking..." : state.currentPlayer + " to move"))}</h2>
        <p className="go-muted">{gameUi("Move ")}{gameUi(state.moveHistory.length + 1)}{gameUi(" · Komi ")}{gameUi(state.komi)}{gameUi(mode === "ai" ? " · " + botName : "")}</p>
        <div className="go-score-grid"><div>{gameUi("Black")}<strong>{gameUi(state.captures.black)}</strong><span>{gameUi("captured stones")}</span></div><div>{gameUi("White")}<strong>{gameUi(state.captures.white)}</strong><span>{gameUi("captured stones")}</span></div></div>
        <div className="go-help-panel">
          <button type="button" className="go-action" aria-pressed={helpMode} onClick={toggleHelp}><Lightbulb size={16} />{gameUi(" Help mode ")}{gameUi(helpMode ? "on" : "off")}</button>
          {helpMode && <>
            <p className="go-muted">{gameUi("Liberties and atari appear on the board. The engine recommends a move automatically.")}</p>
            {visibleBestMoves?.status === "loading" && <p role="status" className="go-muted">{gameUi("Finding the best moves…")}</p>}
            {visibleBestMoves?.status === "error" && <p role="alert" className="go-engine-error">{gameUi(visibleBestMoves.error)}</p>}
            {gameUi(visibleBestMoves?.status === "ready" && (visibleBestMoves.moves.length ? <>
              <p className="go-muted">{gameUi(visibleBestMoves.moves[visibleBestMoves.selected].move.type === "pass" ? "The engine recommends passing." : "The ring marks the recommended move. Select another candidate to inspect it.")}</p>
              <div className="go-best-moves" aria-label={gameUi("Best moves")}>{visibleBestMoves.moves.map((candidate, index) => <button key={candidate.coordinate} type="button" aria-pressed={visibleBestMoves.selected === index} onClick={() => setBestMoves(current => current?.position === state ? { ...current, selected: index } : current)}><span className="go-best-rank">{gameUi(index + 1)}</span><span>{gameUi(candidate.coordinate)}</span></button>)}</div>
              <button type="button" className="go-action" disabled={disabled} onClick={() => play(visibleBestMoves.moves[visibleBestMoves.selected].move)}>{gameUi("Play selected move")}</button>
            </> : <p className="go-muted">{gameUi("No legal suggestions are available for this position.")}</p>))}
          </>}
        </div>
        {state.status === "finished" && <div className="go-result"><strong>{gameUi(scoring && !scoreConfirmed ? "Scoring review" : "Game over")} · {gameUi(state.result)}</strong><p>{gameUi("Chinese area · komi ")}{gameUi(state.komi)}{gameUi(" · captures B ")}{gameUi(state.captures.black)}, W {gameUi(state.captures.white)}</p>{scoring && <p>{gameUi(scoreConfirmed ? `${state.deadStones?.length ?? 0} stones marked dead.` : "Tap each dead group to remove it from area scoring, then confirm the result.")}</p>}{!state.result?.includes("resignation") && <p>{gameUi("Area score: Black ")}{gameUi(score.black)}{gameUi(" · White ")}{gameUi(score.white)}</p>}{scoring && <button className="go-action" onClick={() => setScoreConfirmed(!scoreConfirmed)}>{gameUi(scoreConfirmed ? "Edit dead groups" : "Confirm score")}</button>}<div className="go-result-actions"><button className="go-action" disabled={scoring && !scoreConfirmed} onClick={saveCurrent}><Save size={16} />{gameUi(" Save Game")}</button><button className="go-action" disabled={scoring && !scoreConfirmed} onClick={analyzeCurrent}><ScanSearch size={16} />{gameUi(" Analyze Game")}</button></div></div>}
        <div className="go-controls go-game-controls"><button disabled={disabled} onClick={() => play({ type: "pass" })}>{gameUi("Pass")}</button><button disabled={disabled} onClick={() => play({ type: "resign" })}>{gameUi("Resign")}</button><button onClick={() => restart()}><RotateCcw size={16} />{gameUi(" New Game")}</button></div>
        {state.status === "playing" && state.moveHistory.length > 0 && <button className="go-action" onClick={saveCurrent}><Save size={16} />{gameUi(" Save Game")}</button>}
        {saveMessage && <p role="status" className="go-muted">{gameUi(saveMessage)}</p>}
        <h3>{gameUi("Moves")}</h3><ol className="go-game-history">{state.moveHistory.map((entry, index) => <li key={index}><span>{gameUi(index + 1)}. {gameUi(entry.player === "black" ? "B" : "W")} {gameUi(goCoordinate(entry, state.boardSize))}</span>{!!entry.captured && <span>+{gameUi(entry.captured)}</span>}</li>)}</ol>
      </aside>
    </div>
  </main>;
}
