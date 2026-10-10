import GameXpReward from "@/components/games/GameXpReward";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { JANMANN, SPHERE_ASSEMBLY_DURATION_MS, EXTRACTION_RATE_M3, type DividendId, type PieceKind } from "@/games/chess/janmann/config";
import { NODES, TOPOLOGY } from "@/games/chess/janmann/topology";
import { assemblyPhase, dividendPosition, stretchAt } from "@/games/chess/janmann/geometry";
import { applyMove, createGame, eligibleExtractions, finishTurn, getControl, getLegalMoves, getSecuredSectors, isInCheck, type GameState } from "@/games/chess/janmann/rules";
import { ui, useUiLanguage } from "@/i18n/ui";
import Dialog from "@/components/chessCustom/dialogs/Dialog";
import JanmannBoard from "./JanmannBoard";
import VolumeMeasurement from "./VolumeMeasurement";
import UserLink from "@/components/social/UserLink";
import { RulesContent } from "./JanmannRules";

const glyphs: Record<PieceKind, string> = { king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" };
const buttonClass = "rounded-xl border border-amber-100/20 bg-white/5 px-3 py-2 text-xs text-amber-50 transition hover:bg-amber-100/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-amber-200";

function useAssembly(sphere: boolean, reducedMotion: boolean) {
  const [progress, setProgress] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    let frame = 0, last = 0;
    const animate = (now: number) => {
      const delta = last ? Math.min(100, now - last) / SPHERE_ASSEMBLY_DURATION_MS : 0;
      last = now;
      current.current = reducedMotion ? Number(sphere) : sphere ? Math.min(1, current.current + delta) : Math.max(0, current.current - delta);
      setProgress(current.current);
      if (current.current !== Number(sphere)) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [sphere, reducedMotion]);
  return progress;
}

export default function JanmannGame() {
  useUiLanguage();
  const [state, setState] = useState(createGame);
  const [undo, setUndo] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<DividendId | null>("0:0");
  const [sphere, setSphere] = useState(false);
  const [measure, setMeasure] = useState(false);
  const [showControl, setShowControl] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [debug, setDebug] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [cameraReset, setCameraReset] = useState(0);
  const [promotion, setPromotion] = useState<"queen" | "rook" | "bishop" | "knight">("queen");
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const progress = useAssembly(sphere, reducedMotion);
  const control = useMemo(() => getControl(state), [state]);
  const sectors = useMemo(() => getSecuredSectors(control), [control]);
  const legal = useMemo(() => state.phase === "move" && !state.result ? getLegalMoves(state) : [], [state]);
  const eligible = useMemo(() => eligibleExtractions(state), [state]);
  const targets = legal.filter((move) => move.from === selected).map((move) => move.to);
  const node = selected ? NODES[selected] : null;
  const selectedPiece = state.pieces.find((piece) => piece.at === selected);
  const commit = (next: GameState) => { setUndo((previous) => [...previous, state]); setState(next); };
  const select = (id: DividendId) => {
    if (!measure && selected && targets.includes(id)) {
      commit(applyMove(state, { from: selected, to: id, promotion }));
    }
    setSelected(id);
  };
  const extract = () => {
    if (!selected || !eligible.includes(selected)) return;
    commit(finishTurn(state, selected));
    setAnimationKey((value) => value + 1);
    setMeasure(true);
  };
  const reset = () => {
    setState(createGame()); setUndo([]); setSelected("0:0"); setSphere(false); setMeasure(false);
    setAnimationKey(0); setPromotion("queen"); setResetting(false);
    setCameraReset((value) => value + 1);
  };
  const inCheck = isInCheck(state, state.turn);
  const status = state.result
    ? `${state.result.winner ? ui(`${state.result.winner === "white" ? "White" : "Black"} wins`) : ui("Draw")} · ${ui(state.result.reason)}`
    : state.phase === "extract" ? ui("Extract or preserve to finish your turn") : `${ui(`${state.turn === "white" ? "White" : "Black"} to move`)}${inCheck ? ` · ${ui("Check")}` : ""}`;

  return <main className="mx-auto w-full max-w-[1600px] px-4 py-6 text-zinc-100 sm:px-6">
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Link to="/chess-custom/community" className="text-xs text-zinc-400 hover:text-amber-100">← {ui("Community")}</Link>
        <p className="mt-4 text-[10px] uppercase tracking-[.2em] text-amber-200">{ui("Fixed Community variant")} · {ui("Experimental")}</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">{JANMANN.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">{ui("by")} <UserLink username={JANMANN.author} className="font-semibold text-zinc-200">{JANMANN.author}</UserLink> · {ui("Think differently...")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass} onClick={() => setShowRules(true)}>{ui("Rules")}</button>
        <button className={buttonClass} disabled={!undo.length} onClick={() => { const previous = undo.at(-1); if (previous) { setState(previous); setUndo(undo.slice(0, -1)); setMeasure(false); } }}>{ui("Undo")}</button>
        <button className={buttonClass} onClick={() => setResetting(true)}>{ui("Reset")}</button>
      </div>
    </header>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-2xl border border-amber-100/15 bg-[#10141d]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <span className="font-serif text-amber-100">8 {ui("sectors")} · 80 {ui("Dividends")}</span>
            <span className="text-xs text-zinc-400">{ui(assemblyPhase(progress))} · {Math.round(progress * 100)}%</span>
          </div>
          <div className="h-[450px] sm:h-[560px]" aria-label={ui("Interactive Dividend board")}>
            <JanmannBoard state={state} control={control} progress={progress} selected={selected} targets={measure ? [] : targets} eligible={eligible} showControl={showControl} cameraReset={cameraReset} onSelect={select} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-3">
            <button className={buttonClass} aria-pressed={sphere} onClick={() => setSphere((value) => !value)}>{ui(sphere ? "Return to flat" : "Assemble sphere")}</button>
            <button className={buttonClass} aria-pressed={measure} onClick={() => setMeasure((value) => !value)}>{ui(measure ? "Finish measuring" : "Measure")}</button>
            <button className={buttonClass} aria-pressed={showControl} onClick={() => setShowControl((value) => !value)}>{ui("Control overlay")}</button>
            <button className={buttonClass} onClick={() => setCameraReset((value) => value + 1)}>{ui("Reset camera")}</button>
            <span className="ml-auto text-[10px] text-zinc-500">{ui("Drag to orbit · scroll to zoom")}</span>
          </div>
        </section>

        <details className="rounded-2xl border border-white/10 bg-white/[.02] p-4" open>
          <summary className="cursor-pointer font-serif text-amber-100">{ui("Sector board")} <span className="ml-2 font-sans text-xs text-zinc-400">{ui("All 80 Dividends · keyboard accessible")}</span></summary>
          <p className="mt-2 text-xs leading-5 text-zinc-400">{ui(measure ? "Select any Dividend to inspect it. Finish measuring to move pieces." : "Select your piece, then a green destination. Gold outlines mark eligible extractions.")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {sectors.map((secured, sectorId) => <section key={sectorId} className="rounded-xl border border-white/10 bg-black/15 p-2" aria-label={`${ui("Sector")} ${sectorId + 1}`}>
              <p className="mb-2 text-center text-[10px] text-zinc-400">S{sectorId + 1} · {ui(secured === "white" ? "White" : secured === "black" ? "Black" : "Unsecured")}</p>
              {[0, 1, 2, 3].map((row) => <div key={row} className="flex justify-center gap-1 py-0.5">
                {TOPOLOGY.filter((cell) => cell.sectorId === sectorId && cell.dividendIndex >= row * (row + 1) / 2 && cell.dividendIndex < (row + 1) * (row + 2) / 2).map((cell) => {
                  const piece = state.pieces.find((p) => p.at === cell.id);
                  const isTarget = !measure && targets.includes(cell.id);
                  const isVoid = control[cell.id] === "void";
                  return <button key={cell.id} type="button" onClick={() => select(cell.id)} aria-pressed={selected === cell.id}
                    aria-label={`S${sectorId + 1} D${cell.dividendIndex + 1}: ${piece ? `${ui(piece.side)} ${ui(piece.kind)}` : ui(isVoid ? "Void" : "Empty")}, ${state.dividends[cell.id].remainingVolumeM3} m³, ${ui(control[cell.id])}${isTarget ? `, ${ui("Legal move")}` : ""}`}
                    title={`S${sectorId + 1} D${cell.dividendIndex + 1} · ${ui(control[cell.id])}`}
                    className={`relative flex h-8 w-7 items-center justify-center rounded-md border text-xl transition focus-visible:outline-2 focus-visible:outline-amber-200 sm:h-9 sm:w-8 ${selected === cell.id ? "border-amber-100 bg-amber-100/25" : isTarget ? "border-emerald-200 bg-emerald-300/20" : eligible.includes(cell.id) ? "border-amber-300/70 bg-amber-100/5" : "border-white/10 bg-white/5"} ${piece?.side === "white" ? "text-amber-100" : piece ? "text-sky-300" : "text-zinc-500"}`}>
                    {piece ? glyphs[piece.kind] : isVoid ? "×" : isTarget ? "•" : <span className="text-[9px]">{cell.dividendIndex + 1}</span>}
                    {showControl && <span className={`absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full ${control[cell.id] === "white" ? "bg-amber-100" : control[cell.id] === "black" ? "bg-sky-300" : control[cell.id] === "contested" ? "bg-violet-400" : "bg-transparent"}`} />}
                  </button>;
                })}
              </div>)}
            </section>)}
          </div>
          <p className="mt-3 text-[10px] text-zinc-400">{ui("Control")}: <span className="text-amber-100">● {ui("White")}</span> · <span className="text-sky-300">● {ui("Black")}</span> · <span className="text-violet-400">● {ui("Contested")}</span> · × {ui("Void")}</p>
        </details>
        <details className="rounded-xl border border-white/10 p-4 text-xs text-zinc-400"><summary className="cursor-pointer">{ui("Move history")} · {state.ply}</summary><ol className="mt-3 max-h-52 space-y-1 overflow-y-auto">{state.history.map((item, index) => <li key={index}>{item}</li>)}</ol></details>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-amber-100/20 bg-[#181c25] p-4">
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">{ui("Local hotseat")} · {ui("Turn")} {state.ply + 1}</p>
          <h2 role="status" aria-live="polite" className="mt-2 font-serif text-xl text-amber-100">{status}</h2>
          {state.result && <GameXpReward />}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["white", "black"] as const).map((side) => <div key={side} className={`rounded-xl border p-3 ${state.turn === side ? "border-amber-200/40 bg-amber-100/5" : "border-white/10"}`}>
              <p className="text-xs text-zinc-400">{ui(side === "white" ? "White" : "Black")}</p>
              <p className="mt-1 font-serif text-xl">{state.extractedVolumeM3[side]} <span className="text-xs text-zinc-500">/ 50 m³</span></p>
              <p className="mt-1 text-xs text-zinc-300">{sectors.filter((owner) => owner === side).length} / 5 {ui("sectors")}</p>
            </div>)}
          </div>
          {state.phase === "extract" && !state.result && <div className="mt-4 space-y-2">
            <p className="text-xs leading-5 text-zinc-400">{ui("Choose any eligible occupied Dividend, then extract or preserve.")}</p>
            <button className="w-full rounded-xl bg-amber-200 px-3 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40" disabled={!selected || !eligible.includes(selected)} onClick={extract}>{ui("Extract")} {EXTRACTION_RATE_M3} m³</button>
            <button className={`${buttonClass} w-full`} onClick={() => { commit(finishTurn(state)); setMeasure(false); }}>{ui("Preserve & end turn")}</button>
            {selected && eligible.includes(selected) && state.dividends[selected].remainingVolumeM3 <= EXTRACTION_RATE_M3 && <p className="text-xs text-amber-200">{ui("This extraction creates a Void and sacrifices the occupying piece.")}</p>}
            {!eligible.length && <p className="text-xs text-zinc-400">{ui("No uncontested safe extraction is available. Preserve to continue.")}</p>}
          </div>}
          <p className="mt-4 text-xs leading-5 text-zinc-400">{ui("Win by checkmate or 50 m³ plus five secured sectors.")}</p>
        </section>
        {node && <section className="rounded-2xl border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{ui("Selected Dividend")}</p>
          <h2 className="mt-1 font-serif text-xl">S{node.sectorId + 1} · D{node.dividendIndex + 1} {selectedPiece && <span className="ml-2">{glyphs[selectedPiece.kind]}</span>}</h2>
          <p className="mt-2 text-xs text-zinc-400">{ui("Control")}: {ui(control[node.id])} · {ui("Remaining")}: {state.dividends[node.id].remainingVolumeM3} m³</p>
          <p className="mt-1 text-xs text-zinc-400">{ui("Extracted")}: {state.dividends[node.id].minedVolumeM3} m³</p>
          {selectedPiece?.kind === "pawn" && <label className="mt-3 block text-xs text-zinc-400">{ui("Promote to")}
            <select className="ml-2 rounded-lg bg-zinc-800 px-2 py-1 text-zinc-100" value={promotion} onChange={(event) => setPromotion(event.target.value as typeof promotion)}>{(["queen", "rook", "bishop", "knight"] as const).map((kind) => <option key={kind} value={kind}>{ui(kind)}</option>)}</select>
          </label>}
        </section>}
        {measure && selected && <VolumeMeasurement selected={selected} remaining={state.dividends[selected].remainingVolumeM3} animationKey={animationKey} />}
        <blockquote className="px-2 font-serif text-sm italic leading-6 text-zinc-400">{ui("The volume you gain is the surface you lose.")}</blockquote>
        {import.meta.env.DEV && <details onToggle={(event) => setDebug(event.currentTarget.open)} className="text-xs text-zinc-500"><summary className="cursor-pointer">Geometry debug</summary>{debug && node && <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap">{JSON.stringify({ id: node.id, logical: node.logical, barycentric: node.barycentric, world: dividendPosition(node.id, progress), neighbors: node.neighbors, rook: node.rookContinuations, bishop: node.bishopContinuations, pawn: node.pawn, control: control[node.id], volume: state.dividends[node.id], assembly: progress, stretch: stretchAt(progress) }, null, 2)}</pre>}</details>}
      </aside>
    </div>
    <Dialog open={showRules} onClose={() => setShowRules(false)} title={JANMANN.name} eyebrow={ui("Rules")} size="lg"><RulesContent /></Dialog>
    <Dialog open={resetting} onClose={() => setResetting(false)} title={ui("Reset game?")} description={ui("Start again with all pieces and 240 m³ of volume.")} footer={<><button className={buttonClass} onClick={() => setResetting(false)}>{ui("Cancel")}</button><button className={buttonClass} onClick={reset}>{ui("Reset")}</button></>} />
  </main>;
}
