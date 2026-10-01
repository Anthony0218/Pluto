import { Box, FlipVertical2, Library, ScrollText, Settings, SlidersHorizontal, Swords, type LucideIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CameraCommand } from "@/components/chess3d/Board3DScene";
import { AI_KINDS, type AiKind } from "@/games/chess/custom/engine/ai";
import { isChess3DPieceSkin, type Chess3DCameraPreset, type Chess3DCameraView } from "@/games/chess/3d/chess3dAppearance";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { gameplaySignature } from "@/games/chess/custom/editor/editorUtils";
import { useGameSession, type PlayerKind } from "@/games/chess/custom/editor/useGameSession";
import { usePieceSelection } from "@/games/chess/custom/editor/usePieceSelection";
import { getBoardTheme } from "@/games/chess/custom/themes";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ui } from "@/i18n/ui";
import MoveHistoryList from "../play/MoveHistoryList";
import PromotionPicker from "../play/PromotionPicker";
import Board2D from "../Board2D";
import ThemeSelector from "../ThemeSelector";
import CameraControls from "./CameraControls";
import PieceInspector from "./PieceInspector";
import SimulationControls from "./SimulationControls";
import { LibraryDrawer, PlayDrawer, RulesDrawer, SettingsDrawer, type Drawer, type SimulationSettings } from "./SimulationDrawers";
import { useSimulationVisuals } from "./useSimulationVisuals";

const NAV: { id: Drawer | "customize"; label: string; icon: LucideIcon }[] = [
  { id: "play", label: "Play", icon: Swords },
  { id: "customize", label: "Customize", icon: SlidersHorizontal },
  { id: null, label: "Board", icon: Box },
  { id: "rules", label: "Rules", icon: ScrollText },
  { id: "library", label: "Library", icon: Library },
  { id: "settings", label: "Settings", icon: Settings },
];

// The 3D engine is only downloaded when the 3D tab is shown.
const Board3DCanvas = lazy(() => import("@/components/chess3d/Board3DScene"));

export type SimulationViewMode = "3d" | "2d";
type MatchMode = "hva" | "hvh" | "ava";
const MATCH_MODES: { id: MatchMode; label: string }[] = [
  { id: "hva", label: "Player vs AI" },
  { id: "hvh", label: "Player vs Player" },
  { id: "ava", label: "AI vs AI" },
];
const DEFAULT_AI: AiKind = "strategist";

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The simulation: one game, two views. The 3D and 2D tabs share the session,
 * players and controls, so switching tabs never interrupts a game.
 */
export default function SimulationView({ view }: { view: SimulationViewMode }) {
  const { variant, testSetup, simulationSource, setSection, dispatch } = useEditor();
  const systemReduced = useReducedMotion();
  const [settings, setSettings] = useState<SimulationSettings>(() => ({
    quality: "high",
    motion: "system",
    showIllegal: false,
    skin: isChess3DPieceSkin(variant.theme.pieceSkin) ? variant.theme.pieceSkin : "classic",
  }));
  const reducedMotion = settings.motion === "reduced" || (settings.motion === "system" && systemReduced);
  const [players, setPlayers] = useState<Record<string, PlayerKind>>(() => Object.fromEntries(variant.teams.map((team, index) => [team.id, index === 0 ? "human" : DEFAULT_AI])));
  const [flipped, setFlipped] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [gameId, setGameId] = useState(0);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [cameraView, setCameraView] = useState<Chess3DCameraView>({ id: 0, preset: "classic" });
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>();
  const [autoOrbit, setAutoOrbit] = useState(false);

  const setup = simulationSource === "test" ? testSetup : variant.setup;
  const signature = useMemo(() => gameplaySignature(variant, setup), [variant, setup]);
  const session = useGameSession({ variant, setup, sessionKey: `${signature}:${simulationSource}:${gameId}`, players, speed });
  const state = session.current;
  const humanTurn = !state.result && (players[state.turn] ?? "human") === "human";
  const selection = usePieceSelection(variant, session, { showIllegal: settings.showIllegal, canMove: humanTurn });
  const visuals = useSimulationVisuals(variant, session);
  const theme = getBoardTheme(variant.theme.boardTheme);
  const aiOnly = variant.teams.every((team) => (players[team.id] ?? "human") !== "human");
  const turnTeam = variant.teams.find((team) => team.id === state.turn);
  const recentMessages = state.messages.filter((message) => message.ply >= state.ply - 1 && message.kind !== "victory").slice(-2);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey) return;
      if (event.key === " ") {
        event.preventDefault();
        session.setPlaying(!session.playing);
      } else if (event.key === "ArrowLeft") session.back();
      else if (event.key === "ArrowRight") session.forward();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session]);

  const choosePreset = (preset: Chess3DCameraPreset) => setCameraView((current) => ({ id: current.id + 1, preset }));
  const humans = variant.teams.filter((team) => (players[team.id] ?? "human") === "human").length;
  const matchMode: MatchMode = humans === variant.teams.length ? "hvh" : humans === 0 ? "ava" : "hva";
  const aiLevel = (Object.values(players).find((kind) => kind !== "human") as AiKind | undefined) ?? DEFAULT_AI;
  const setMatch = (mode: MatchMode, level: AiKind = aiLevel) =>
    setPlayers(Object.fromEntries(variant.teams.map((team, index) => [team.id, mode === "hvh" || (mode === "hva" && index === 0) ? "human" : level])));
  const boardPieces = useMemo(() => state.pieces.map((piece) => ({ key: piece.id, type: piece.type, team: piece.team, x: piece.x, y: piece.y })), [state.pieces]);
  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black tracking-wider transition ${active ? "bg-amber-300 text-zinc-950 shadow-[0_0_18px_rgba(252,211,77,.3)]" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`;

  return (
    <div className="relative flex-1 overflow-hidden" style={{ background: theme.backdrop }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_110%,rgba(56,189,248,.08),transparent_55%)]" />
      <div className="relative grid h-full min-h-[calc(var(--app-height)-72px)] lg:grid-cols-[210px_minmax(0,1fr)_340px]">
        {/* Left sidebar */}
        <aside className="z-20 flex flex-row items-center gap-2 overflow-x-auto border-b border-white/[0.06] bg-black/45 px-3 py-2 backdrop-blur-xl lg:flex-col lg:items-stretch lg:overflow-visible lg:border-b-0 lg:border-r lg:px-3 lg:py-4">
          <div className="hidden px-2 pb-3 lg:block">
            <p className="font-serif text-lg text-white">Chess Custom</p>
            <p className="truncate text-[11px] text-amber-200/70">{variant.name}</p>
          </div>
          <nav aria-label={ui("Simulation navigation")} className="flex gap-1 lg:flex-col">
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = id !== "customize" && drawer === id;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => (id === "customize" ? setSection("pieces") : setDrawer(active && id !== null ? null : (id as Drawer)))}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-gradient-to-r from-amber-300/20 to-transparent text-amber-50 shadow-[inset_2px_0_0_#fcd34d]" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"}`}
                >
                  <Icon size={16} className={active ? "text-amber-300" : ""} />
                  <span>{ui(label)}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto hidden lg:block">
            <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">{ui("Board theme")}</p>
            <ThemeSelector compact value={variant.theme.boardTheme} onChange={(boardTheme) => dispatch({ type: "update", recipe: (current) => ({ ...current, theme: { ...current.theme, boardTheme } }) })} />
            <p className="mt-1.5 px-1 text-[11px] text-zinc-500">{theme.name}</p>
          </div>
        </aside>

        {/* Centre: tabs, the board, and controls (overlaid on desktop, stacked on phones). */}
        <div className="relative flex min-h-0 flex-col">
          <div className="z-20 flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-black/35 px-3 py-2 backdrop-blur-xl">
            <div role="tablist" aria-label={ui("Simulation view")} className="inline-flex rounded-xl border border-white/10 bg-black/40 p-1">
              <button type="button" role="tab" aria-selected={view === "3d"} onClick={() => setSection("simulation")} className={tabClass(view === "3d")}>
                <Box size={13} />
                3D
              </button>
              <button type="button" role="tab" aria-selected={view === "2d"} onClick={() => setSection("simulation2d")} className={tabClass(view === "2d")}>
                <span className="grid h-[13px] w-[13px] grid-cols-2 gap-px" aria-hidden="true">
                  <span className="bg-current" />
                  <span className="opacity-40 bg-current" />
                  <span className="opacity-40 bg-current" />
                  <span className="bg-current" />
                </span>
                2D
              </button>
            </div>
            <div role="radiogroup" aria-label={ui("Players")} className="inline-flex flex-wrap rounded-xl border border-white/10 bg-black/40 p-1">
              {MATCH_MODES.map((mode) => (
                <button key={mode.id} type="button" role="radio" aria-checked={matchMode === mode.id} onClick={() => setMatch(mode.id)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${matchMode === mode.id ? "bg-sky-400/20 text-sky-100 ring-1 ring-sky-400/50" : "text-zinc-400 hover:text-white"}`}>
                  {ui(mode.label)}
                </button>
              ))}
            </div>
            {matchMode !== "hvh" && (
              <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                {ui("AI")}
                <select value={aiLevel} onChange={(event) => setMatch(matchMode, event.target.value as AiKind)} className="rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-xs font-semibold text-zinc-100 outline-none">
                  {AI_KINDS.map((kind) => (
                    <option key={kind.id} value={kind.id} className="bg-zinc-900">
                      {ui(kind.label)}
                    </option>
                  ))}
                </select>
              </label>
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
                  pieces={visuals.pieces}
                  marks={selection.marks}
                  selectedPieceId={selection.selectedId}
                  theme={theme}
                  skin={settings.skin}
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
                  onCellClick={(x, y) => selection.clickSquare({ x, y })}
                />
              </Suspense>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-4 pb-4 pt-16 lg:pb-32" style={{ containerType: "size" } as CSSProperties}>
                <div style={{ width: `min(100cqw, calc(100cqh * ${state.board.width / state.board.height}))` }}>
                  <Board2D board={state.board} variant={variant} theme={theme} pieces={boardPieces} highlights={selection.marks} flipped={flipped} label={ui("2D simulation board")} onCellClick={(coord) => selection.clickSquare(coord)} />
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-2 px-3" aria-live="polite">
              <div className={`rounded-full border px-4 py-1.5 text-sm shadow-lg backdrop-blur-xl ${state.result ? "border-amber-300/50 bg-amber-300/15 text-amber-50" : "border-white/10 bg-black/55 text-zinc-200"}`}>
                {state.result ? (
                  <span className="font-semibold">🏁 {state.result.reason}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40" style={{ background: turnTeam?.color }} />
                    <span className="font-semibold">{turnTeam?.name}</span>
                    <span className="text-zinc-400">
                      {ui("to move")} · {players[state.turn] === "human" ? ui("your move") : session.playing || !aiOnly ? ui("AI thinking…") : ui("press Play")}
                    </span>
                  </span>
                )}
              </div>
              {recentMessages.map((message, index) => (
                <div key={`${message.ply}-${index}`} className={`rounded-full border px-3 py-1 text-xs backdrop-blur-xl ${message.kind === "warning" ? "border-amber-400/30 bg-amber-500/15 text-amber-100" : "border-sky-400/25 bg-sky-500/10 text-sky-100"}`}>
                  ⚡ {message.text}
                </div>
              ))}
            </div>

            {drawer && (
              <div className="absolute bottom-3 left-3 top-3 z-30 flex lg:bottom-28">
                {drawer === "play" && (
                  <PlayDrawer
                    variant={variant}
                    players={players}
                    onPlayers={setPlayers}
                    onNewGame={() => {
                      setGameId((id) => id + 1);
                      setDrawer(null);
                    }}
                    onClose={() => setDrawer(null)}
                  />
                )}
                {drawer === "rules" && <RulesDrawer variant={variant} onClose={() => setDrawer(null)} onEdit={() => setSection("rules")} />}
                {drawer === "library" && <LibraryDrawer onClose={() => setDrawer(null)} />}
                {drawer === "settings" && <SettingsDrawer settings={settings} onChange={setSettings} onClose={() => setDrawer(null)} />}
              </div>
            )}

            {selection.pendingPromotion && <PromotionPicker pending={selection.pendingPromotion} variant={variant} team={state.turn} onChoose={selection.choosePromotion} />}
          </div>

          <div className="z-20 flex flex-wrap items-end gap-3 p-3 lg:absolute lg:inset-x-3 lg:bottom-3 lg:p-0">
            <div className="min-w-[300px] flex-1">
              <SimulationControls session={session} speed={speed} onSpeed={setSpeed} canAutoplay={aiOnly} />
            </div>
            {view === "3d" ? (
              <CameraControls
                preset={cameraView.preset}
                onPreset={choosePreset}
                onCommand={(kind) => setCameraCommand((current) => ({ id: (current?.id ?? 0) + 1, kind }))}
                autoOrbit={autoOrbit}
                onAutoOrbit={setAutoOrbit}
              />
            ) : (
              <button
                type="button"
                aria-pressed={flipped}
                onClick={() => setFlipped((value) => !value)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-semibold backdrop-blur-xl transition ${flipped ? "border-sky-400/60 bg-sky-400/15 text-sky-100" : "border-white/[0.09] bg-black/60 text-zinc-300 hover:text-white"}`}
              >
                <FlipVertical2 size={15} />
                {ui("Flip board")}
              </button>
            )}
          </div>
        </div>

        {/* Right: history + inspector */}
        <aside className="z-20 flex min-h-0 flex-col gap-3 p-3 lg:max-h-[calc(var(--app-height)-72px)] lg:pl-0">
          <section aria-label={ui("Move history")} className="rounded-2xl border border-white/[0.09] bg-black/55 p-3 shadow-[0_20px_50px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/90">{ui("Move History")}</p>
              <span className="text-[11px] text-zinc-500">
                {ui("Turn")} {state.turnNumber}
              </span>
            </div>
            <MoveHistoryList frames={session.frames} cursor={session.cursor} onJump={session.jumpTo} variant={variant} maxHeight="max-h-44" />
          </section>
          <div className="min-h-[320px] flex-1 lg:min-h-0">
            <PieceInspector variant={variant} state={state} piece={selection.selected} explanations={selection.explanations} skin={settings.skin} reducedMotion={reducedMotion} show3D={view === "3d"} />
          </div>
          <div className="lg:hidden">
            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">{ui("Board theme")}</p>
            <ThemeSelector compact value={variant.theme.boardTheme} onChange={(boardTheme) => dispatch({ type: "update", recipe: (current) => ({ ...current, theme: { ...current.theme, boardTheme } }) })} />
          </div>
        </aside>
      </div>
    </div>
  );
}
