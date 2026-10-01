import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useLocalMatch, type LobbySeat } from "@/games/cards/client/useLocalMatch";
import type { GameDefinition, SettingValue } from "@/games/cards/engine/types";
import { Button, Chip, Panel, Toggle } from "@/components/chessCustom/ui";
import EventLog from "../game/EventLog";
import GameTable from "../game/GameTable";

export type SimulationMode = "ai" | "player";

/**
 * One live game: every seat a bot ("AI vs AI"), or seat 1 is you ("Player vs AI").
 * Remount (key) to start over with new options.
 */
export default function LiveSimulation({
  def,
  mode,
  players,
  settings,
  seed,
  showAll,
  onShowAll,
  onRestart,
}: {
  def: GameDefinition;
  mode: SimulationMode;
  players: number;
  settings: Record<string, SettingValue>;
  seed: number;
  showAll: boolean;
  onShowAll: (value: boolean) => void;
  onRestart: () => void;
}) {
  const seats: LobbySeat[] = Array.from({ length: players }, (_, index) =>
    mode === "player" && index === 0 ? { id: "you", name: "You", isBot: false } : { id: `bot-${index + 1}`, name: `Bot ${mode === "player" ? index : index + 1}`, isBot: true },
  );
  const match = useLocalMatch(def, { seats, settings, seed });
  const state = match.state;
  if (!state) {
    return (
      <p role="alert" className="text-sm text-red-300">
        The game could not start{match.error ? `: ${match.error}` : "."}
      </p>
    );
  }
  const viewer = mode === "player" ? "you" : null;
  const speeds = [
    { delay: 1200, label: "Slow" },
    { delay: 450, label: "Normal" },
    { delay: 120, label: "Fast" },
    { delay: 20, label: "Turbo" },
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <GameTable def={def} state={state} viewerId={viewer} revealAll={mode === "ai" && showAll} error={match.error} onAction={(request) => viewer && match.act(viewer, request)} />
      </div>
      <aside className="space-y-3">
        <Panel title={mode === "ai" ? "AI vs AI" : "Player vs AI"} eyebrow="Controls">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" tone={match.autoBots ? "ghost" : "primary"} onClick={() => match.setAutoBots(!match.autoBots)}>
                {match.autoBots ? <Pause size={14} /> : <Play size={14} />} {match.autoBots ? "Pause" : "Resume"}
              </Button>
              <Button size="sm" onClick={match.botStep} disabled={!match.nextBot}>
                <SkipForward size={14} /> Step
              </Button>
              <Button size="sm" onClick={onRestart}>
                <RotateCcw size={14} /> New game
              </Button>
            </div>
            <div role="radiogroup" aria-label="Bot speed" className="flex flex-wrap gap-1">
              {speeds.map((speed) => (
                <button
                  key={speed.label}
                  type="button"
                  role="radio"
                  aria-checked={match.botDelay === speed.delay}
                  onClick={() => match.setBotDelay(speed.delay)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${match.botDelay === speed.delay ? "bg-amber-300 text-zinc-950" : "border border-white/10 text-zinc-400 hover:text-white"}`}
                >
                  {speed.label}
                </button>
              ))}
            </div>
            {mode === "ai" && <Toggle checked={showAll} onChange={onShowAll} label="Show every card" description="Watch the bots' hidden cards." />}
            <div className="flex flex-wrap gap-1.5">
              <Chip>seed {seed}</Chip>
              <Chip>{state.revision} actions</Chip>
              {state.status === "finished" && <Chip tone="emerald">finished</Chip>}
            </div>
          </div>
        </Panel>
        <Panel title="Events & rules" eyebrow="Log">
          <EventLog state={state} />
        </Panel>
      </aside>
    </div>
  );
}
