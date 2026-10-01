import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AI_KINDS } from "@/games/chess/custom/engine/ai";
import { KING_BEHAVIORS, KING_CONSEQUENCE_INFO, matchKingBehavior, PRESETS } from "@/games/chess/custom/engine/presets";
import type { GameVariant } from "@/games/chess/custom/engine/types";
import { VICTORY_LABELS } from "@/games/chess/custom/engine/victory";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import type { PlayerKind } from "@/games/chess/custom/editor/useGameSession";
import { CHESS_3D_SKINS, type Chess3DPieceSkin } from "@/games/chess/3d/chess3dAppearance";
import type { RenderQuality } from "@/components/chess3d/Board3DScene";
import { ACTION_LABELS, TRIGGER_LABELS } from "@/games/chess/custom/editor/eventLabels";
import { ui } from "@/i18n/ui";
import { Button, Segmented, Toggle } from "../ui";

const RULE_NAMES: Record<string, string> = { castling: "Castling", enPassant: "En passant", forcedCapture: "Forced capture", friendlyFire: "Friendly fire" };

export type Drawer = "play" | "rules" | "library" | "settings" | null;

export interface SimulationSettings {
  quality: RenderQuality;
  motion: "system" | "reduced" | "full";
  showIllegal: boolean;
  skin: Chess3DPieceSkin;
}

function DrawerShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-label={ui(title)} className="flex max-h-full w-[300px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-amber-300/20 bg-[#0b0d10]/95 shadow-[0_24px_60px_rgba(0,0,0,.6)] backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">{ui(title)}</p>
        <button type="button" onClick={onClose} aria-label={ui("Close")} className="text-zinc-500 hover:text-white">
          <X size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">{children}</div>
    </div>
  );
}

export function PlayDrawer({
  variant,
  players,
  onPlayers,
  onNewGame,
  onClose,
}: {
  variant: GameVariant;
  players: Record<string, PlayerKind>;
  onPlayers: (players: Record<string, PlayerKind>) => void;
  onNewGame: () => void;
  onClose: () => void;
}) {
  const { simulationSource, setSimulationSource } = useEditor();
  // Quick setups: the first team's player, then everyone else's.
  const modes: { id: string; label: string; first: PlayerKind; others: PlayerKind }[] = [
    { id: "hvh", label: "Human vs Human", first: "human", others: "human" },
    { id: "hva", label: "Human vs AI", first: "human", others: "strategist" },
    { id: "ava", label: "AI vs AI", first: "strategist", others: "strategist" },
    { id: "rnd", label: "Random legal moves", first: "random", others: "random" },
  ];
  const assign = (mode: (typeof modes)[number]) => Object.fromEntries(variant.teams.map((team, index) => [team.id, index === 0 ? mode.first : mode.others]));
  return (
    <DrawerShell title="Match setup" onClose={onClose}>
      <div className="grid gap-2">
        {modes.map((mode) => {
          const active = variant.teams.every((team, index) => (players[team.id] ?? "human") === (index === 0 ? mode.first : mode.others));
          return (
            <button
              key={mode.id}
              type="button"
              aria-pressed={active}
              onClick={() => onPlayers(assign(mode))}
              className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${active ? "border-amber-300/60 bg-amber-300/10 text-amber-50" : "border-white/10 text-zinc-300 hover:border-white/25"}`}
            >
              {ui(mode.label)}
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        {variant.teams.map((team) => (
          <label key={team.id} className="flex items-center justify-between gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ background: team.color }} />
              {team.name}
            </span>
            <select
              value={players[team.id] ?? "human"}
              onChange={(event) => onPlayers({ ...players, [team.id]: event.target.value as PlayerKind })}
              className="rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-xs text-zinc-100"
            >
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
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Start from")}</p>
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
      <Button tone="primary" className="w-full" onClick={onNewGame}>
        {ui("New game")}
      </Button>
      <p className="text-[11px] leading-5 text-zinc-500">{ui("AIs play with the custom rule engine, so every custom piece, tile and event applies.")}</p>
    </DrawerShell>
  );
}

export function RulesDrawer({ variant, onClose, onEdit }: { variant: GameVariant; onClose: () => void; onEdit: () => void }) {
  const behavior = KING_BEHAVIORS.find((entry) => entry.id === matchKingBehavior(variant.settings));
  return (
    <DrawerShell title="Rules" onClose={onClose}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("King")}</p>
        <p className="mt-1 text-zinc-200">{ui(behavior?.label ?? "Custom")}</p>
        <p className="text-xs text-zinc-500">{ui("When captured")}: {ui(KING_CONSEQUENCE_INFO[variant.settings.kingCapture.consequence].label)}</p>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Victory")} ({variant.settings.victoryMode === "all" ? "ALL" : "ANY"})</p>
        <ul className="mt-1 space-y-0.5 text-xs text-zinc-300">
          {variant.victoryConditions.filter((condition) => condition.enabled).map((condition) => (
            <li key={condition.id}>🏆 {ui(VICTORY_LABELS[condition.type])}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Events")}</p>
        <ul className="mt-1 space-y-1 text-xs text-zinc-300">
          {variant.events.filter((event) => event.enabled).map((event) => (
            <li key={event.id}>
              ⚡ <span className="font-semibold">{event.name}</span>
              <span className="block pl-4 text-zinc-500">
                {ui(TRIGGER_LABELS[event.trigger.type])} → {event.actions.map((action) => ui(ACTION_LABELS[action.type])).join(", ")}
              </span>
            </li>
          ))}
          {variant.events.every((event) => !event.enabled) && <li className="text-zinc-500">{ui("None")}</li>}
        </ul>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Switches")}</p>
        <p className="mt-1 text-xs text-zinc-300">{variant.rules.filter((rule) => rule.enabled).map((rule) => ui(RULE_NAMES[rule.type])).join(", ") || ui("None")}</p>
      </div>
      <Button className="w-full" onClick={onEdit}>
        {ui("Edit rules")}
      </Button>
    </DrawerShell>
  );
}

export function LibraryDrawer({ onClose }: { onClose: () => void }) {
  const { saved, openSaved, loadPreset, setSection, dirty } = useEditor();
  // Loading replaces the working variant; keep the user in the simulation.
  const stay = () => setSection("simulation");
  return (
    <DrawerShell title="Library" onClose={onClose}>
      {dirty && <p className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">{ui("Loading replaces your unsaved variant. Save it first from the editor to keep it.")}</p>}
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Presets")}</p>
        <div className="grid gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                loadPreset(preset.id);
                stay();
              }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-white"
            >
              <span className="w-5 text-center">{preset.icon}</span>
              {ui(preset.name)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Saved variants")}</p>
        {saved.length === 0 ? (
          <p className="text-xs text-zinc-500">{ui("Nothing saved yet.")}</p>
        ) : (
          <div className="grid gap-1">
            {saved.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => void openSaved(entry.id).then(stay)}
                className="rounded-lg px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-white"
              >
                {entry.name} <span className="text-zinc-600">· {entry.boardSize}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </DrawerShell>
  );
}

export function SettingsDrawer({ settings, onChange, onClose }: { settings: SimulationSettings; onChange: (settings: SimulationSettings) => void; onClose: () => void }) {
  return (
    <DrawerShell title="Settings" onClose={onClose}>
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Render quality")}</p>
        <Segmented size="sm" label="Render quality" value={settings.quality} onChange={(quality) => onChange({ ...settings, quality })} options={[{ id: "high", label: "High" }, { id: "low", label: "Performance" }]} />
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Motion")}</p>
        <Segmented
          size="sm"
          label="Motion"
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
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Piece finish")}</p>
        <div className="flex flex-wrap gap-1">
          {CHESS_3D_SKINS.map((skin) => (
            <button
              key={skin.id}
              type="button"
              title={ui(skin.description)}
              aria-pressed={settings.skin === skin.id}
              onClick={() => onChange({ ...settings, skin: skin.id })}
              className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${settings.skin === skin.id ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-400 hover:text-white"}`}
            >
              {ui(skin.label)}
            </button>
          ))}
        </div>
      </div>
      <Toggle checked={settings.showIllegal} onChange={(showIllegal) => onChange({ ...settings, showIllegal })} label={ui("Show illegal squares on the board")} description={ui("Grey dots mark squares a selected piece’s rules reach but cannot legally use.")} />
    </DrawerShell>
  );
}
