import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import type { CameraCommand } from "@/components/chess3d/Board3DScene";
import { AI_KINDS, type AiKind } from "@/games/chess/custom/engine/ai";
import { playChessSound } from "@/games/chess/audio/chessAudio";
import { boardLayers } from "@/games/chess/custom/engine/board";
import { isChess3DPieceSkin, type Chess3DCameraPreset, type Chess3DCameraView } from "@/games/chess/3d/chess3dAppearance";
import { CUSTOMIZE_TARGET, initialSimulationMode, PLAY_MODES, showsPlaybackBar, SIMULATION_MODES, SIMULATION_SIDEBAR, stepNumber, type SimulationMode } from "@/games/chess/custom/library/navigation";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { gameplaySignature } from "@/games/chess/custom/editor/editorUtils";
import { useGameSession, type PlayerKind } from "@/games/chess/custom/editor/useGameSession";
import { usePieceSelection } from "@/games/chess/custom/editor/usePieceSelection";
import type { CellHighlight } from "../Board2D";
import { getBoardTheme } from "@/games/chess/custom/themes";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ui } from "@/i18n/ui";
import MoveHistoryList from "../play/MoveHistoryList";
import PromotionPicker from "../play/PromotionPicker";
import Board2D from "../Board2D";
import { ChevronDownIcon, ChevronUpIcon, EventsIcon, MyGamesIcon, PreviousIcon, RefreshIcon, SaveIcon, UndoIcon, VictoryIcon } from "../icons/ChessCustomIcons";
import { SIMULATION_SIDEBAR_ICONS } from "../icons/stepIcons";
import CameraControls from "./CameraControls";
import PieceInspector from "./PieceInspector";
import SimulationControls from "./SimulationControls";
import { BoardDrawer, PlayDrawer, SettingsDrawer, type Drawer, type SimulationSettings, type StackView } from "./SimulationDrawers";
import { useSimulationVisuals } from "./useSimulationVisuals";

// The 3D engine is only downloaded when the 3D view is shown.
const Board3DCanvas = lazy(() => import("@/components/chess3d/Board3DScene"));

const DEFAULT_AI: AiKind = "strategist";
/** Marks hidden when legal-move highlights are switched off. */
const MOVE_MARKS = new Set<CellHighlight>(["move", "capture", "special", "illegal", "target"]);

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const playersFor = (teams: { id: string }[], mode: SimulationMode, level: AiKind): Record<string, PlayerKind> =>
  Object.fromEntries(teams.map((team, index) => [team.id, mode === "hvh" || (mode === "hva" && index === 0) ? "human" : level]));

/**
 * The focused simulation: one game, two views (3D and 2D). In Create it opens
 * in AI vs AI to watch the variant; from Play it starts in the chosen mode.
 */
export default function SimulationView({ context }: { context: "create" | "play" }) {
  const { variant, testSetup, simulationSource, go, goToStep, route, save, dirty, inLibrary, isDirty } = useEditor();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "2d" ? "2d" : "3d";
  const setView = (next: "3d" | "2d") =>
    setParams((current) => {
      const copy = new URLSearchParams(current);
      if (next === "2d") copy.set("view", "2d");
      else copy.delete("view");
      return copy;
    }, { replace: true });
  const systemReduced = useReducedMotion();
  const [settings, setSettings] = useState<SimulationSettings>({ quality: "high", motion: "system", showIllegal: false, showMoves: true, showCoords: true });
  const reducedMotion = settings.motion === "reduced" || (settings.motion === "system" && systemReduced);
  const [players, setPlayers] = useState<Record<string, PlayerKind>>(() => {
    const search = new URLSearchParams(window.location.search);
    const ai = AI_KINDS.find((kind) => kind.id === search.get("ai"))?.id ?? DEFAULT_AI;
    return playersFor(variant.teams, initialSimulationMode(route, search.get("mode")), ai);
  });
  const [flipped, setFlipped] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [gameId, setGameId] = useState(0);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [cameraView, setCameraView] = useState<Chess3DCameraView>({ id: 0, preset: variant.board.layers?.length ? "front" : "classic" });
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>();
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [activeLayer, setActiveLayer] = useState(0);
  const [stackView, setStackView] = useState<StackView>("full");

  const setup = simulationSource === "test" ? testSetup : variant.setup;
  const signature = useMemo(() => gameplaySignature(variant, setup), [variant, setup]);
  const session = useGameSession({ variant, setup, sessionKey: `${signature}:${simulationSource}:${gameId}`, players, speed });
  const heardFrames = useRef(session.frames.length);
  useEffect(() => {
    if (session.frames.length > heardFrames.current) {
      const frame = session.frames.at(-1);
      playChessSound(frame?.state.result?.draw ? "draw" : frame?.state.result?.reason.startsWith("Checkmate") ? "checkmate" : frame?.move?.castle ? "castle" : frame?.move?.captureIds.length ? "capture" : "move");
    }
    heardFrames.current = session.frames.length;
  }, [session.frames]);
  const state = session.current;
  const layers = boardLayers(state.board);
  const shownLayer = layers.find((layer) => layer.z === activeLayer) ?? layers[0];
  const humanTurn = !state.result && (players[state.turn] ?? "human") === "human";
  const selection = usePieceSelection(variant, session, { showIllegal: settings.showIllegal, canMove: humanTurn });
  const visuals = useSimulationVisuals(variant, session);
  const theme = getBoardTheme(variant.theme.boardTheme);
  const skin = isChess3DPieceSkin(variant.theme.pieceSkin) ? variant.theme.pieceSkin : "classic";
  const turnTeam = variant.teams.find((team) => team.id === state.turn);
  const recentMessages = state.messages.filter((message) => message.ply >= state.ply - 1 && message.kind !== "victory").slice(-2);
  const humans = variant.teams.filter((team) => (players[team.id] ?? "human") === "human").length;
  const matchMode: SimulationMode = humans === variant.teams.length ? "hvh" : humans === 0 ? "ava" : "hva";
  const playback = showsPlaybackBar(matchMode);
  const aiLevel = (Object.values(players).find((kind) => kind !== "human") as AiKind | undefined) ?? DEFAULT_AI;
  const setMatch = (mode: SimulationMode, level: AiKind = aiLevel) => setPlayers(playersFor(variant.teams, mode, level));
  const marks = useMemo(() => (settings.showMoves ? selection.marks : new Map([...selection.marks].filter(([, mark]) => !MOVE_MARKS.has(mark)))), [selection.marks, settings.showMoves]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " " && playback) {
        event.preventDefault();
        session.setPlaying(!session.playing);
      } else if (event.key === "ArrowLeft") session.back();
      else if (event.key === "ArrowRight") session.forward();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, playback]);

  const choosePreset = (preset: Chess3DCameraPreset) => setCameraView((current) => ({ id: current.id + 1, preset }));
  const boardPieces = useMemo(() => state.pieces.filter((piece) => (piece.z ?? 0) === activeLayer).map((piece) => ({ key: piece.id, type: piece.type, team: piece.team, x: piece.x, y: piece.y })), [state.pieces, activeLayer]);
  const layerMarks = useMemo(
    () =>
      new Map(
        [...marks].flatMap(([key, mark]) => {
          const [x, y, z = "0"] = key.split(",");
          return Number(z) === activeLayer ? [[`${x},${y}`, mark] as const] : [];
        }),
      ),
    [marks, activeLayer],
  );

  /** Take back to the last position where a human was to move. */
  const takeBack = () => {
    let target = session.cursor - 1;
    while (target > 0 && (players[session.frames[target].state.turn] ?? "human") !== "human") target -= 1;
    session.jumpTo(Math.max(0, target));
  };
  const playLabel = route.view === "play" ? PLAY_MODES.find((mode) => mode.id === route.mode)?.label : undefined;

  return (
    <div className="relative flex-1 overflow-hidden" style={{ background: theme.backdrop }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_110%,rgba(56,189,248,.08),transparent_55%)]" />
      <div className="relative grid h-full min-h-[calc(var(--app-height)-72px)] lg:grid-cols-[220px_minmax(0,1fr)_340px]">
        {/* Left sidebar: Play, Board, Customize, Settings — nothing else. */}
        <aside className="z-20 flex flex-row items-center gap-2 overflow-x-auto border-b border-white/[0.06] bg-black/45 px-3 py-2 backdrop-blur-xl lg:flex-col lg:items-stretch lg:overflow-visible lg:border-b-0 lg:border-r lg:px-3 lg:py-4">
          <div className="hidden px-2 pb-4 lg:block">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-amber-300/70">{context === "create" ? `${ui("Create")} · ${stepNumber("simulation")} ${ui("Simulation")}` : `${ui("Play")} · ${ui(playLabel ?? "")}`}</p>
            <p className="mt-1 truncate font-serif text-lg text-white">{variant.name}</p>
            {context === "create" && <p className="text-[11px] text-zinc-500">{dirty ? ui("Unsaved changes") : inLibrary ? ui("Saved") : ui("Not saved yet")}</p>}
          </div>
          <nav aria-label={ui("Simulation")} className="flex gap-1 lg:flex-col">
            {SIMULATION_SIDEBAR.map(({ id, label }) => {
              const Icon = SIMULATION_SIDEBAR_ICONS[id];
              const active = id !== "customize" && drawer === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={id === "customize" ? undefined : active}
                  aria-expanded={id === "customize" ? undefined : active}
                  data-sim-nav={id}
                  onClick={() => (id === "customize" ? go(CUSTOMIZE_TARGET) : setDrawer(active ? null : id))}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition focus-visible:outline-2 focus-visible:outline-amber-300 ${
                    active ? "bg-gradient-to-r from-amber-300/20 to-transparent font-semibold text-amber-50 shadow-[inset_2px_0_0_#fcd34d]" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <Icon size={18} className={active ? "text-amber-300" : ""} />
                  <span>{ui(label)}</span>
                </button>
              );
            })}
          </nav>
          <div className="ml-auto flex gap-1.5 lg:ml-0 lg:mt-auto lg:flex-col">
            {context === "create" ? (
              <>
                <button type="button" onClick={() => goToStep("position")} className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/25 hover:text-white">
                  <PreviousIcon size={16} />
                  <span className="hidden sm:inline">
                    {ui("Previous")}: {stepNumber("position")} {ui("Position")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (isDirty() || !inLibrary) {
                      if (!(await save())) return;
                    }
                    go({ view: "library" });
                  }}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-300 px-3 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-200"
                >
                  <SaveIcon size={16} />
                  {ui("Save & Finish")}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => go({ view: "library" })} className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-white/25 hover:text-white">
                <MyGamesIcon size={16} />
                <span className="hidden sm:inline">{ui("Back to My Games")}</span>
              </button>
            )}
          </div>
        </aside>

        {/* Centre: the board, with mode and view switches. */}
        <div className="relative flex min-h-0 flex-col">
          <div className="z-20 flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-black/35 px-3 py-2 backdrop-blur-xl">
            <div role="tablist" aria-label={ui("Simulation view")} className="inline-flex rounded-xl border border-white/10 bg-black/40 p-1">
              {(["3d", "2d"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black tracking-wider transition ${view === id ? "bg-amber-300 text-zinc-950 shadow-[0_0_18px_rgba(252,211,77,.3)]" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  {id.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDrawer(drawer === "play" ? null : "play")}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
              aria-label={`${ui("Mode")}: ${ui(SIMULATION_MODES.find((mode) => mode.id === matchMode)?.label ?? "")}. ${ui("Change in Play")}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" />
              {ui(SIMULATION_MODES.find((mode) => mode.id === matchMode)?.label ?? "")}
              {matchMode !== "hvh" && <span className="text-sky-200/60">· {ui(AI_KINDS.find((kind) => kind.id === aiLevel)?.label ?? "")}</span>}
            </button>
            {layers.length > 1 && (
              <span className="text-[11px] text-zinc-400">
                {ui("Layer")} {shownLayer.name}
              </span>
            )}
            <span className="ml-auto hidden text-[11px] text-zinc-500 xl:inline">{simulationSource === "test" ? ui("From your test position") : ui("From the starting position")}</span>
          </div>

          <div className="relative h-[56vh] min-h-[360px] lg:h-auto lg:flex-1">
            {view === "3d" ? (
              <Suspense fallback={<p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">{ui("Loading the 3D board…")}</p>}>
                <Board3DCanvas
                  className="absolute! inset-0"
                  width={state.board.width}
                  height={state.board.height}
                  cells={state.board.cells}
                  layers={state.board.layers}
                  layerSpacing={stackView === "exploded" ? 4.2 : stackView === "compressed" ? 1.9 : 2.8}
                  visibleLayers={stackView === "isolated" ? [activeLayer] : undefined}
                  focusLayer={stackView === "focus" ? activeLayer : undefined}
                  pieces={visuals.pieces}
                  marks={marks}
                  selectedPieceId={selection.selectedId}
                  theme={theme}
                  skin={skin}
                  cameraView={cameraView}
                  cameraCommand={cameraCommand}
                  cameraShake={visuals.shake}
                  cameraScale={1.3}
                  autoOrbit={autoOrbit}
                  enablePan
                  reducedMotion={reducedMotion}
                  quality={settings.quality}
                  effects={visuals.effects}
                  trail={visuals.trail}
                  trailJump={visuals.trailJump}
                  onCellClick={(x, y, z = 0) => {
                    setActiveLayer(z);
                    selection.clickSquare({ x, y, z });
                  }}
                />
              </Suspense>
            ) : (
              <div className={`absolute inset-0 flex items-center justify-center px-4 pt-16 ${playback ? "pb-4 lg:pb-32" : "pb-4 lg:pb-24"}`} style={{ containerType: "size" } as CSSProperties}>
                <div style={{ width: `min(100cqw, calc(100cqh * ${state.board.width / state.board.height}))` }}>
                  <Board2D board={shownLayer} variant={variant} theme={theme} pieces={boardPieces} highlights={layerMarks} flipped={flipped} showCoords={settings.showCoords} label={ui("2D simulation board")} onCellClick={(coord) => selection.clickSquare({ ...coord, z: activeLayer })} />
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-3" aria-live="polite">
              <div className={`rounded-full border px-4 py-1.5 text-sm shadow-lg backdrop-blur-xl ${state.result ? "border-amber-300/50 bg-amber-300/15 text-amber-50" : "border-white/10 bg-black/55 text-zinc-200"}`}>
                {state.result ? (
                  <span className="flex items-center gap-2 font-semibold">
                    <VictoryIcon size={16} className="text-amber-300" />
                    {state.result.reason}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40" style={{ background: turnTeam?.color }} />
                    <span className="font-semibold">{turnTeam?.name}</span>
                    <span className="text-zinc-400">
                      {ui("to move")} · {players[state.turn] === "human" ? ui("your move") : session.playing || !playback ? ui("AI thinking…") : ui("press Play")}
                    </span>
                  </span>
                )}
              </div>
              {recentMessages.map((message, index) => (
                <div key={`${message.ply}-${index}`} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs backdrop-blur-xl ${message.kind === "warning" ? "border-amber-400/30 bg-amber-500/15 text-amber-100" : "border-sky-400/25 bg-sky-500/10 text-sky-100"}`}>
                  <EventsIcon size={13} />
                  {message.text}
                </div>
              ))}
            </div>

            {drawer && (
              <div className="absolute bottom-3 left-3 top-3 z-30 flex lg:bottom-28">
                {drawer === "play" && (
                  <PlayDrawer
                    variant={variant}
                    mode={matchMode}
                    aiLevel={aiLevel}
                    players={players}
                    onMode={setMatch}
                    onPlayers={setPlayers}
                    canStart={!session.playing && !state.result}
                    onStart={() => {
                      session.setPlaying(true);
                      setDrawer(null);
                    }}
                    onRestart={() => {
                      setGameId((id) => id + 1);
                      setDrawer(null);
                    }}
                    onClose={() => setDrawer(null)}
                  />
                )}
                {drawer === "board" && (
                  <BoardDrawer
                    variant={variant}
                    view={view}
                    onView={setView}
                    activeLayer={activeLayer}
                    onLayer={setActiveLayer}
                    stackView={stackView}
                    onStackView={setStackView}
                    settings={settings}
                    onSettings={setSettings}
                    flipped={flipped}
                    onFlip={setFlipped}
                    onClose={() => setDrawer(null)}
                  />
                )}
                {drawer === "settings" && <SettingsDrawer settings={settings} onChange={setSettings} speed={speed} onSpeed={setSpeed} autoOrbit={autoOrbit} onAutoOrbit={setAutoOrbit} onClose={() => setDrawer(null)} />}
              </div>
            )}

            {selection.pendingPromotion && <PromotionPicker pending={selection.pendingPromotion} variant={variant} team={state.turn} onChoose={selection.choosePromotion} />}
          </div>

          <div className="z-20 flex flex-wrap items-end gap-3 p-3 lg:absolute lg:inset-x-3 lg:bottom-3 lg:p-0">
            {playback ? (
              <div className="min-w-[300px] flex-1" data-playback-bar>
                <SimulationControls session={session} speed={speed} onSpeed={setSpeed} canAutoplay />
              </div>
            ) : (
              // Interactive games get game controls, not a video player.
              <div className="flex flex-1 flex-wrap items-center gap-2" role="group" aria-label={ui("Game controls")}>
                <button
                  type="button"
                  onClick={takeBack}
                  disabled={session.cursor === 0}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.09] bg-black/60 px-3 py-2.5 text-xs font-semibold text-zinc-200 backdrop-blur-xl transition hover:border-amber-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UndoIcon size={15} />
                  {ui("Take back")}
                </button>
                <button
                  type="button"
                  onClick={() => setGameId((id) => id + 1)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.09] bg-black/60 px-3 py-2.5 text-xs font-semibold text-zinc-200 backdrop-blur-xl transition hover:border-amber-300/40 hover:text-white"
                >
                  <RefreshIcon size={15} />
                  {ui("New game")}
                </button>
                {!session.atEnd && (
                  <button type="button" onClick={session.toEnd} className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/40 bg-sky-400/15 px-3 py-2.5 text-xs font-semibold text-sky-100 backdrop-blur-xl">
                    {ui("Back to live position")}
                  </button>
                )}
              </div>
            )}
            {view === "3d" && <CameraControls preset={cameraView.preset} onPreset={choosePreset} onCommand={(kind) => setCameraCommand((current) => ({ id: (current?.id ?? 0) + 1, kind }))} autoOrbit={autoOrbit} onAutoOrbit={setAutoOrbit} />}
          </div>
        </div>

        {/* Right: secondary panels — move history and the selected piece. */}
        <aside className="z-20 flex min-h-0 flex-col gap-3 p-3 lg:max-h-[calc(var(--app-height)-72px)] lg:pl-0">
          <section aria-label={ui("Move history")} className="rounded-2xl border border-white/[0.09] bg-black/55 shadow-[0_20px_50px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen((value) => !value)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/90">{ui("Move History")}</span>
              <span className="flex items-center gap-2 text-[11px] text-zinc-500">
                {ui("Turn")} {state.turnNumber}
                {historyOpen ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
              </span>
            </button>
            {historyOpen && (
              <div className="px-3 pb-3">
                <MoveHistoryList frames={session.frames} cursor={session.cursor} onJump={session.jumpTo} variant={variant} maxHeight="max-h-44" />
              </div>
            )}
          </section>
          <div className="min-h-[320px] flex-1 lg:min-h-0">
            <PieceInspector variant={variant} state={state} piece={selection.selected} explanations={selection.explanations} skin={skin} reducedMotion={reducedMotion} show3D={view === "3d"} />
          </div>
        </aside>
      </div>
    </div>
  );
}
