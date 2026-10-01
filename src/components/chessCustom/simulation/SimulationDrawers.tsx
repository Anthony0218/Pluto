import { useSyncExternalStore, type ReactNode } from "react";
import { AI_KINDS, type AiKind } from "@/games/chess/custom/engine/ai";
import { boardLayers } from "@/games/chess/custom/engine/board";
import { KING_BEHAVIORS, KING_CONSEQUENCE_INFO, matchKingBehavior } from "@/games/chess/custom/engine/presets";
import type { GameVariant } from "@/games/chess/custom/engine/types";
import { VICTORY_LABELS } from "@/games/chess/custom/engine/victory";
import { SIMULATION_MODES, type SimulationMode } from "@/games/chess/custom/library/navigation";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import type { PlayerKind } from "@/games/chess/custom/editor/useGameSession";
import { PLAYBACK_SPEEDS } from "@/games/chess/custom/editor/useGameSession";
import { CHESS_3D_SKINS, isChess3DPieceSkin } from "@/games/chess/3d/chess3dAppearance";
import { getAudioSettings, setAudioSettings, subscribeAudioSettings } from "@/games/chess/audio/chessAudio";
import type { RenderQuality } from "@/components/chess3d/Board3DScene";
import { ACTION_LABELS, TRIGGER_LABELS } from "@/games/chess/custom/editor/eventLabels";
import { ui } from "@/i18n/ui";
import { CloseIcon, EventsIcon, VictoryIcon } from "../icons/ChessCustomIcons";
import ThemeSelector from "../ThemeSelector";
import { Button, Segmented, Toggle } from "../ui";

const RULE_NAMES: Record<string, string> = { castling: "Castling", enPassant: "En passant", forcedCapture: "Forced capture", friendlyFire: "Friendly fire" };
const heading = "mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500";

export type Drawer = "play" | "board" | "settings" | null;
export type StackView = "full" | "focus" | "isolated" | "exploded" | "compressed";

/** Presentation-only settings; nothing here changes how the variant plays. */
export interface SimulationSettings {
  quality: RenderQuality;
  motion: "system" | "reduced" | "full";
  showIllegal: boolean;
  showMoves: boolean;
  showCoords: boolean;
}

function DrawerShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-label={ui(title)} className="flex max-h-full w-[310px] max-w-[calc(100vw-1.5rem)] flex-col rounded-2xl border border-amber-300/20 bg-[#0b0d10]/95 shadow-[0_24px_60px_rgba(0,0,0,.6)] backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">{ui(title)}</p>
        <button type="button" onClick={onClose} aria-label={ui("Close")} className="rounded-lg p-1 text-zinc-500 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300">
          <CloseIcon size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">{children}</div>
    </div>
  );
}

function RulesAtAGlance({ variant }: { variant: GameVariant }) {
  const { goToStep } = useEditor();
  const behavior = KING_BEHAVIORS.find((entry) => entry.id === matchKingBehavior(variant.settings));
  const events = variant.events.filter((event) => event.enabled);
  return (
    <details className="group rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-300 marker:text-zinc-600">{ui("Rules at a glance")}</summary>
      <div className="mt-3 space-y-3 text-xs">
        <div>
          <p className={heading}>{ui("King")}</p>
          <p className="text-zinc-200">{ui(behavior?.label ?? "Custom")}</p>
          <p className="text-zinc-500">
            {ui("When captured")}: {ui(KING_CONSEQUENCE_INFO[variant.settings.kingCapture.consequence].label)}
          </p>
        </div>
        <div>
          <p className={heading}>
            {ui("Victory")} ({variant.settings.victoryMode === "all" ? ui("all of") : ui("any of")})
          </p>
          <ul className="space-y-0.5 text-zinc-300">
            {variant.victoryConditions
              .filter((condition) => condition.enabled)
              .map((condition) => (
                <li key={condition.id} className="flex items-center gap-1.5">
                  <VictoryIcon size={13} className="text-amber-300" />
                  {ui(VICTORY_LABELS[condition.type])}
                </li>
              ))}
          </ul>
        </div>
        <div>
          <p className={heading}>{ui("Events")}</p>
          <ul className="space-y-1 text-zinc-300">
            {events.map((event) => (
              <li key={event.id}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <EventsIcon size={13} className="text-sky-300" />
                  {event.name}
                </span>
                <span className="block pl-5 text-zinc-500">
                  {ui(TRIGGER_LABELS[event.trigger.type])} → {event.actions.map((action) => ui(ACTION_LABELS[action.type])).join(", ")}
                </span>
              </li>
            ))}
            {!events.length && <li className="text-zinc-500">{ui("None")}</li>}
          </ul>
        </div>
        <div>
          <p className={heading}>{ui("Switches")}</p>
          <p className="text-zinc-300">{variant.rules.filter((rule) => rule.enabled).map((rule) => ui(RULE_NAMES[rule.type])).join(", ") || ui("None")}</p>
        </div>
        <Button size="sm" className="w-full" onClick={() => goToStep("rules")}>
          {ui("Edit rules in Create")}
        </Button>
      </div>
    </details>
  );
}

/** Play: who controls each side, where the game starts, and restarting. */
export function PlayDrawer({
  variant,
  mode,
  aiLevel,
  players,
  onMode,
  onPlayers,
  onRestart,
  onStart,
  canStart,
  onClose,
}: {
  variant: GameVariant;
  mode: SimulationMode;
  aiLevel: AiKind;
  players: Record<string, PlayerKind>;
  onMode: (mode: SimulationMode, level?: AiKind) => void;
  onPlayers: (players: Record<string, PlayerKind>) => void;
  onRestart: () => void;
  onStart: () => void;
  canStart: boolean;
  onClose: () => void;
}) {
  const { simulationSource, setSimulationSource } = useEditor();
  return (
    <DrawerShell title="Play" onClose={onClose}>
      <fieldset>
        <legend className={heading}>{ui("Mode")}</legend>
        <div className="grid gap-1.5">
          {SIMULATION_MODES.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber-300 ${
                mode === option.id ? "border-amber-300/60 bg-amber-300/10" : "border-white/10 hover:border-white/25"
              }`}
            >
              <input type="radio" name="simulation-mode" className="sr-only" checked={mode === option.id} onChange={() => onMode(option.id)} />
              <span aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${mode === option.id ? "border-amber-300 bg-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,.2)]" : "border-zinc-600"}`} />
              <span>
                <span className="block text-sm font-semibold text-zinc-100">
                  {ui(option.label)}
                  {option.id === "ava" && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{ui("Default")}</span>}
                </span>
                <span className="block text-xs text-zinc-500">{ui(option.detail)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {mode !== "hvh" && (
        <label className="block">
          <span className={heading}>{ui("AI strength")}</span>
          <select value={aiLevel} onChange={(event) => onMode(mode, event.target.value as AiKind)} className="w-full rounded-lg border border-white/10 bg-black/60 px-2 py-1.5 text-sm text-zinc-100">
            {AI_KINDS.map((kind) => (
              <option key={kind.id} value={kind.id} className="bg-zinc-900">
                {ui(kind.label)}
              </option>
            ))}
          </select>
        </label>
      )}
      <details className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-zinc-300 marker:text-zinc-600">{ui("Players per side")}</summary>
        <div className="mt-3 space-y-2">
          {variant.teams.map((team) => (
            <label key={team.id} className="flex items-center justify-between gap-3 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ background: team.color }} />
                {team.name}
              </span>
              <select value={players[team.id] ?? "human"} onChange={(event) => onPlayers({ ...players, [team.id]: event.target.value as PlayerKind })} className="rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-xs text-zinc-100">
                <option value="human">{ui("Human")}</option>
                {AI_KINDS.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    AI · {ui(kind.label)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </details>
      <div>
        <p className={heading}>{ui("Start from")}</p>
        <Segmented
          size="sm"
          label="Start from"
          value={simulationSource}
          onChange={setSimulationSource}
          options={[
            { id: "start", label: "Starting position" },
            { id: "test", label: "Test position" },
          ]}
        />
      </div>
      <div className="grid gap-2">
        {mode === "ava" && (
          <Button tone="primary" className="w-full" onClick={onStart} disabled={!canStart}>
            {ui("Start Simulation")}
          </Button>
        )}
        <Button tone={mode === "ava" ? "ghost" : "primary"} className="w-full" onClick={onRestart}>
          {mode === "ava" ? ui("Restart Simulation") : ui("New game")}
        </Button>
      </div>
      <RulesAtAGlance variant={variant} />
    </DrawerShell>
  );
}

/** Board: what is shown — layers, theme and highlights. */
export function BoardDrawer({
  variant,
  view,
  onView,
  activeLayer,
  onLayer,
  stackView,
  onStackView,
  settings,
  onSettings,
  flipped,
  onFlip,
  onClose,
}: {
  variant: GameVariant;
  view: "3d" | "2d";
  onView: (view: "3d" | "2d") => void;
  activeLayer: number;
  onLayer: (z: number) => void;
  stackView: StackView;
  onStackView: (view: StackView) => void;
  settings: SimulationSettings;
  onSettings: (settings: SimulationSettings) => void;
  flipped: boolean;
  onFlip: (flipped: boolean) => void;
  onClose: () => void;
}) {
  const { dispatch } = useEditor();
  const layers = boardLayers(variant.board);
  return (
    <DrawerShell title="Board" onClose={onClose}>
      <div>
        <p className={heading}>{ui("View")}</p>
        <Segmented size="sm" label="View" value={view} onChange={onView} options={[{ id: "3d", label: "3D" }, { id: "2d", label: "2D" }]} />
      </div>
      {layers.length > 1 && (
        <>
          <label className="block">
            <span className={heading}>{ui("Layer")}</span>
            <select aria-label={ui("Active layer")} value={activeLayer} onChange={(event) => onLayer(Number(event.target.value))} className="w-full rounded-lg border border-white/10 bg-black/60 px-2 py-1.5 text-sm text-zinc-100">
              {layers.map((layer) => (
                <option key={layer.z} value={layer.z} className="bg-zinc-900">
                  {layer.name} · {layer.width}×{layer.height}
                </option>
              ))}
            </select>
          </label>
          {view === "3d" && (
            <div>
              <p className={heading}>{ui("Stack")}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ["full", "Full Stack"],
                    ["focus", "Focus Layer"],
                    ["isolated", "Isolate Layer"],
                    ["exploded", "Exploded View"],
                    ["compressed", "Compressed View"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={stackView === id}
                    onClick={() => onStackView(id)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${stackView === id ? "border-sky-400/60 bg-sky-400/15 text-sky-100" : "border-white/10 text-zinc-400 hover:text-white"}`}
                  >
                    {ui(label)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <div>
        <p className={heading}>{ui("Board theme")}</p>
        <ThemeSelector compact value={variant.theme.boardTheme} onChange={(boardTheme) => dispatch({ type: "update", recipe: (current) => ({ ...current, theme: { ...current.theme, boardTheme } }) })} />
      </div>
      <div className="space-y-3">
        <Toggle checked={settings.showMoves} onChange={(showMoves) => onSettings({ ...settings, showMoves })} label={ui("Legal move highlights")} description={ui("Mark where a selected piece can move and capture.")} />
        <Toggle checked={settings.showIllegal} onChange={(showIllegal) => onSettings({ ...settings, showIllegal })} label={ui("Show blocked squares")} description={ui("Grey dots mark squares a piece’s rules reach but cannot legally use.")} />
        {view === "2d" && (
          <>
            <Toggle checked={settings.showCoords} onChange={(showCoords) => onSettings({ ...settings, showCoords })} label={ui("Coordinates")} />
            <Toggle checked={flipped} onChange={onFlip} label={ui("Flip board")} />
          </>
        )}
      </div>
    </DrawerShell>
  );
}

/** Settings: presentation only — camera, speed, sound, finish, effects, quality. */
export function SettingsDrawer({
  settings,
  onChange,
  speed,
  onSpeed,
  autoOrbit,
  onAutoOrbit,
  onClose,
}: {
  settings: SimulationSettings;
  onChange: (settings: SimulationSettings) => void;
  speed: number;
  onSpeed: (speed: number) => void;
  autoOrbit: boolean;
  onAutoOrbit: (value: boolean) => void;
  onClose: () => void;
}) {
  const { variant, dispatch } = useEditor();
  const audio = useSyncExternalStore(subscribeAudioSettings, getAudioSettings, getAudioSettings);
  const skin = isChess3DPieceSkin(variant.theme.pieceSkin) ? variant.theme.pieceSkin : "classic";
  return (
    <DrawerShell title="Settings" onClose={onClose}>
      <div className="space-y-3">
        <Toggle checked={autoOrbit} onChange={onAutoOrbit} label={ui("Orbit camera")} description={ui("Slowly circle the board while watching.")} />
        <Toggle
          checked={!audio.muted}
          onChange={(on) => setAudioSettings({ muted: !on })}
          label={ui("Sound")}
          description={ui("Move, capture and check sounds.")}
        />
      </div>
      <label className="block">
        <span className={heading}>{ui("Animation speed")}</span>
        <select value={speed} onChange={(event) => onSpeed(Number(event.target.value))} className="w-full rounded-lg border border-white/10 bg-black/60 px-2 py-1.5 text-sm text-zinc-100">
          {PLAYBACK_SPEEDS.map((value) => (
            <option key={value} value={value} className="bg-zinc-900">
              {value}×
            </option>
          ))}
        </select>
      </label>
      <div>
        <p className={heading}>{ui("Piece finish")}</p>
        <div className="flex flex-wrap gap-1">
          {CHESS_3D_SKINS.map((option) => (
            <button
              key={option.id}
              type="button"
              title={ui(option.description)}
              aria-pressed={skin === option.id}
              onClick={() => dispatch({ type: "update", recipe: (current) => ({ ...current, theme: { ...current.theme, pieceSkin: option.id } }) })}
              className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${skin === option.id ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-400 hover:text-white"}`}
            >
              {ui(option.label)}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500">{ui("Board theme and piece finish are saved with the variant.")}</p>
      </div>
      <div>
        <p className={heading}>{ui("Effects")}</p>
        <Segmented
          size="sm"
          label="Effects"
          value={settings.motion}
          onChange={(motion) => onChange({ ...settings, motion })}
          options={[
            { id: "system", label: "System" },
            { id: "full", label: "Full" },
            { id: "reduced", label: "Reduced" },
          ]}
        />
      </div>
      <div>
        <p className={heading}>{ui("Performance")}</p>
        <Segmented size="sm" label="Render quality" value={settings.quality} onChange={(quality) => onChange({ ...settings, quality })} options={[{ id: "high", label: "High quality" }, { id: "low", label: "Performance" }]} />
      </div>
    </DrawerShell>
  );
}
