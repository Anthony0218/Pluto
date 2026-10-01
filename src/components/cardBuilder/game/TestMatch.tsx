import { useState } from "react";
import { Bot, Play, RotateCcw, SkipForward, Undo2, User } from "lucide-react";
import { randomSeed, useLocalMatch, type LobbySeat } from "@/games/cards/client/useLocalMatch";
import { resolveSettings } from "@/games/cards/engine/GameEngine";
import type { GameDefinition, SettingValue } from "@/games/cards/engine/types";
import { Button, Chip, Field, NumberField, Panel, Toggle, inputClass } from "@/components/chessCustom/ui";
import EventLog from "./EventLog";
import GameTable from "./GameTable";
import SettingsForm from "./SettingsForm";

const seatsFor = (count: number, previous: LobbySeat[] = []): LobbySeat[] =>
  Array.from({ length: count }, (_, index) => previous[index] ?? { id: `seat-${index + 1}`, name: index === 0 ? "You" : `Bot ${index}`, isBot: index !== 0 });

/** Lobby + local table: used by the Play page and the editor's Preview/Test step. */
export default function TestMatch({ def, autoStart = false }: { def: GameDefinition; autoStart?: boolean }) {
  const [seats, setSeats] = useState<LobbySeat[]>(() => seatsFor(def.players.min));
  const [settings, setSettings] = useState<Record<string, SettingValue>>(() => resolveSettings(def));
  const [seed, setSeed] = useState<number>(() => randomSeed());
  // "Start test game" skips the lobby: the match is created with the defaults on first render.
  const match = useLocalMatch(def, autoStart ? { seats, settings, seed } : undefined);
  const [viewer, setViewer] = useState<string | null>(autoStart ? seats[0].id : null);
  const [showAll, setShowAll] = useState(false);
  const { start } = match;

  const begin = (nextSeed = seed) => {
    const firstHuman = seats.find((seat) => !seat.isBot)?.id ?? null;
    setViewer(firstHuman);
    start({ seats, settings, seed: nextSeed });
  };

  const state = match.state;
  const humans = state?.players.filter((player) => !player.isBot) ?? [];
  const activeViewer = showAll ? null : viewer;

  if (!state) {
    return (
      <Panel title="Set up a test game" eyebrow="Lobby">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Players" hint={`${def.name} allows ${def.players.min === def.players.max ? def.players.min : `${def.players.min}–${def.players.max}`} players.`}>
              <NumberField value={seats.length} min={def.players.min} max={def.players.max} label="Players" onChange={(count) => setSeats((previous) => seatsFor(count, previous))} />
            </Field>
            <ul className="space-y-2">
              {seats.map((seat, index) => (
                <li key={seat.id} className="flex items-center gap-2">
                  <input
                    aria-label={`Seat ${index + 1} name`}
                    className={inputClass}
                    value={seat.name}
                    maxLength={24}
                    onChange={(event) => setSeats((previous) => previous.map((entry, i) => (i === index ? { ...entry, name: event.target.value } : entry)))}
                  />
                  <Button
                    size="sm"
                    tone={seat.isBot ? "ghost" : "blue"}
                    aria-label={`Seat ${index + 1}: ${seat.isBot ? "bot" : "human"} (click to switch)`}
                    onClick={() => setSeats((previous) => previous.map((entry, i) => (i === index ? { ...entry, isBot: !entry.isBot } : entry)))}
                  >
                    {seat.isBot ? <Bot size={14} /> : <User size={14} />}
                    {seat.isBot ? "Bot" : "Human"}
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-500">Several humans play hotseat on this device — switch who you are looking at during the game.</p>
          </div>
          <div className="space-y-4">
            {def.settings?.length ? <SettingsForm def={def} values={settings} onChange={setSettings} /> : <p className="text-sm text-zinc-500">This game has no lobby settings.</p>}
            <Field label="Random seed" hint="The same seed and moves always produce the same game.">
              <div className="flex gap-2">
                <input aria-label="Random seed" className={inputClass} inputMode="numeric" value={seed} onChange={(event) => setSeed(Number(event.target.value.replace(/\D/g, "")) || 0)} />
                <Button size="sm" onClick={() => setSeed(randomSeed())}>
                  New
                </Button>
              </div>
            </Field>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button tone="primary" onClick={() => begin()}>
            <Play size={16} /> Start game
          </Button>
          {match.error && (
            <p role="alert" className="text-sm text-red-300">
              {match.error}
            </p>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Viewing as</span>
          {humans.map((player) => (
            <Button key={player.id} size="sm" tone={!showAll && viewer === player.id ? "primary" : "ghost"} onClick={() => (setShowAll(false), setViewer(player.id))}>
              {player.name}
            </Button>
          ))}
          <Button size="sm" tone={showAll ? "primary" : "ghost"} onClick={() => setShowAll(true)} title="Spectator view (no hidden cards are revealed)">
            Spectator
          </Button>
        </div>
        <GameTable def={def} state={state} viewerId={activeViewer} error={match.error} onAction={(request) => activeViewer && match.act(activeViewer, request)} />
      </div>
      <aside className="space-y-3">
        <Panel title="Test controls" eyebrow="Debug">
          <div className="space-y-3">
            <Toggle checked={match.autoBots} onChange={match.setAutoBots} label="Bots play automatically" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={match.botStep} disabled={!match.nextBot}>
                <SkipForward size={14} /> Bot step
              </Button>
              <Button size="sm" onClick={match.undo} disabled={!match.canUndo}>
                <Undo2 size={14} /> Undo
              </Button>
              <Button size="sm" onClick={() => begin()}>
                <RotateCcw size={14} /> Restart
              </Button>
              <Button size="sm" onClick={() => match.reset()}>
                Lobby
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip>seed {seed}</Chip>
              <Chip>revision {state.revision}</Chip>
              {Object.entries(state.variables)
                .filter(([, value]) => value !== null && value !== false)
                .map(([key, value]) => (
                  <Chip key={key} tone="violet">
                    {key}: {String(state.players.find((player) => player.id === value)?.name ?? value)}
                  </Chip>
                ))}
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
