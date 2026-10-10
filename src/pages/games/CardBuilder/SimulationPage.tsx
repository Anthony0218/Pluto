import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Play } from "lucide-react";
import { randomSeed } from "@/games/cards/client/useLocalMatch";
import { resolveSettings } from "@/games/cards/engine/GameEngine";
import type { GameDefinition, SettingValue } from "@/games/cards/engine/types";
import { useCardGameRepository } from "@/games/cards/storage/useCardGameRepository";
import { TEMPLATES } from "@/games/cards/templates";
import { latestVersion, type GameRecord } from "@/games/cards/versioning";
import SettingsForm from "@/components/cardBuilder/game/SettingsForm";
import BatchRunner from "@/components/cardBuilder/simulation/BatchRunner";
import LiveSimulation, { type SimulationMode } from "@/components/cardBuilder/simulation/LiveSimulation";
import { Button, Field, NumberField, Panel, Segmented, inputClass } from "@/components/chessCustom/ui";
import CardBuilderLayout, { CardBuilderTabs } from "./CardBuilderLayout";

interface Choice {
  id: string;
  label: string;
  def: GameDefinition;
}

/** `/games/card-builder/simulation` — watch bots play any game, or play against them. */
export default function SimulationPage() {
  useGameLanguage();
  const [params, setParams] = useSearchParams();
  const { repository, local } = useCardGameRepository();
  const [saved, setSaved] = useState<GameRecord[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([repository.list().catch(() => []), repository === local ? Promise.resolve([]) : local.list()]).then(([primary, browser]) => {
      if (!cancelled) setSaved([...primary, ...browser.filter((game) => !primary.some((entry) => entry.id === game.id))]);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, local]);

  const choices = useMemo<Choice[]>(
    () => [
      ...TEMPLATES.map((template) => ({ id: `template:${template.id}`, label: template.definition.name, def: template.definition })),
      ...saved.map((record) => {
        const version = latestVersion(record);
        return { id: `game:${record.id}`, label: `${record.name} (v${version.version} ${version.status})`, def: version.definition };
      }),
    ],
    [saved],
  );
  const requested = params.get("game") ? `game:${params.get("game")}` : `template:${params.get("template") ?? "durak-6a"}`;
  const choice = choices.find((entry) => entry.id === requested) ?? choices[0];
  const def = choice.def;

  return (
    <CardBuilderLayout crumbs={[{ label: "Simulation" }]}>
      <header className="mb-5 max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">{gameUi("Card Builder")}</p>
        <h1 className="mt-2 text-4xl font-black">{gameUi("Simulation")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{gameUi("Let bots play each other, or take a seat yourself. The number of seats comes from the player count you choose; bots fill every seat that isn't yours.")}</p>
      </header>
      <CardBuilderTabs active="simulation" />
      {/* Remount the setup when the game changes so its players and settings start from that game's defaults. */}
      <SimulationSetup
        key={choice.id}
        def={def}
        choices={choices}
        choiceId={choice.id}
        onChoose={(id) => {
          const [kind, value] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
          setParams(kind === "game" ? { game: value } : { template: value }, { replace: true });
        }}
      />
    </CardBuilderLayout>
  );
}

function SimulationSetup({ def, choices, choiceId, onChoose }: { def: GameDefinition; choices: Choice[]; choiceId: string; onChoose: (id: string) => void }) {
  useGameLanguage();
  const [players, setPlayers] = useState(def.players.min);
  const [mode, setMode] = useState<SimulationMode>("ai");
  const [settings, setSettings] = useState<Record<string, SettingValue>>(() => resolveSettings(def));
  const [seed, setSeed] = useState(() => randomSeed());
  const [run, setRun] = useState(0);
  const [showAll, setShowAll] = useState(true);
  const restart = () => {
    setSeed(randomSeed());
    setRun((value) => value + 1);
  };

  return (
    <div className="space-y-5">
      <Panel title={gameUi("Setup")} eyebrow="Game, players and mode">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Field label={gameUi("Game")}>
              <select className={inputClass} value={choiceId} onChange={(event) => onChoose(event.target.value)}>
                <optgroup label={gameUi("Templates")} className="bg-zinc-900">
                  {choices
                    .filter((entry) => entry.id.startsWith("template:"))
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {gameUi(entry.label)}
                      </option>
                    ))}
                </optgroup>
                {gameUi(choices.some((entry) => entry.id.startsWith("game:")) && (
                  <optgroup label={gameUi("My games")} className="bg-zinc-900">
                    {choices
                      .filter((entry) => entry.id.startsWith("game:"))
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {gameUi(entry.label)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap items-end gap-6">
              <Field label={gameUi("Players")} hint={def.players.min === def.players.max ? `${def.name} is for exactly ${def.players.min}.` : `${def.players.min}–${def.players.max} allowed.`}>
                <NumberField value={players} min={def.players.min} max={def.players.max} label={gameUi("Players")} onChange={(value) => (setPlayers(value), setRun((current) => current + 1))} />
              </Field>
              <Field label={gameUi("Mode")}>
                <Segmented
                  label={gameUi("Mode")}
                  value={mode}
                  onChange={(value) => (setMode(value), setRun((current) => current + 1))}
                  options={[
                    { id: "ai", label: players === 2 ? "AI vs AI" : `${players} bots` },
                    { id: "player", label: players === 2 ? "You vs AI" : `You vs ${players - 1} bots` },
                  ]}
                />
              </Field>
            </div>
          </div>
          <div className="space-y-3">
            {def.settings?.length ? <SettingsForm def={def} values={settings} onChange={setSettings} /> : <p className="text-sm text-zinc-500">{gameUi("This game has no lobby settings.")}</p>}
            <Button tone="primary" onClick={restart}>
              <Play size={16} />{gameUi(" Start with these settings ")}</Button>
          </div>
        </div>
      </Panel>
      <LiveSimulation key={`${run}:${mode}:${players}`} def={def} mode={mode} players={players} settings={settings} seed={seed} showAll={showAll} onShowAll={setShowAll} onRestart={restart} />
      <BatchRunner def={def} players={players} settings={settings} seed={seed} />
    </div>
  );
}
