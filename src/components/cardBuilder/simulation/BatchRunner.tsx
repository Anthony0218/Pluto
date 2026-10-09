import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useRef, useState } from "react";
import { FlaskConical, Square } from "lucide-react";
import { simulateGame, summarizeSimulations, type SimulatedGame, type SimulationSummary } from "@/games/cards/engine/simulate";
import type { GameDefinition, SettingValue } from "@/games/cards/engine/types";
import { Button, Chip, Panel, Segmented } from "@/components/chessCustom/ui";

const COUNTS = ["10", "50", "100", "500"] as const;

/**
 * Plays many bot-only games without drawing them, a few per frame so the page
 * stays responsive, and shows how often each seat wins.
 */
export default function BatchRunner({ def, players, settings, seed }: { def: GameDefinition; players: number; settings: Record<string, SettingValue>; seed: number }) {
  useGameLanguage();
  const [count, setCount] = useState<(typeof COUNTS)[number]>("100");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<SimulationSummary | null>(null);
  const cancel = useRef(false);

  useEffect(() => () => void (cancel.current = true), []);

  const run = () => {
    cancel.current = false;
    const total = Number(count);
    const games: SimulatedGame[] = [];
    setSummary(null);
    setProgress({ done: 0, total });
    const step = () => {
      if (cancel.current) return setProgress(null);
      const started = performance.now();
      // Work in ~12 ms slices.
      while (games.length < total && performance.now() - started < 12) games.push(simulateGame(def, { players, settings, seed: seed + games.length }));
      setProgress({ done: games.length, total });
      if (games.length < total) window.setTimeout(step, 0);
      else {
        setSummary(summarizeSimulations(games, players));
        setProgress(null);
      }
    };
    window.setTimeout(step, 0);
  };

  const decided = summary ? summary.finished : 0;
  return (
    <Panel
      title={gameUi("Run many games instantly")}
      eyebrow="Balance check · bots only"
      actions={
        progress ? (
          <Button size="sm" tone="danger" onClick={() => (cancel.current = true)}>
            <Square size={12} /> Stop
          </Button>
        ) : (
          <>
            <Segmented size="sm" label="Number of games" value={count} onChange={setCount} options={COUNTS.map((id) => ({ id, label: id }))} />
            <Button size="sm" tone="primary" onClick={run}>
              <FlaskConical size={14} /> Simulate
            </Button>
          </>
        )
      }
    >
      <p className="text-xs text-zinc-500">{gameUi(" Uses the current players and settings. Seeds ")}{gameUi(seed)}{gameUi(" to ")}{gameUi(seed + Number(count) - 1)}{gameUi(", so the same run gives the same results. ")}</p>
      {gameUi(progress && (
        <div className="mt-3" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-amber-300 transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            {gameUi(progress.done)} / {gameUi(progress.total)}{gameUi(" games ")}</p>
        </div>
      ))}
      {gameUi(summary && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Chip tone="emerald">{gameUi(summary.finished)}{gameUi(" finished")}</Chip>
            {summary.draws > 0 && <Chip>{gameUi(summary.draws)}{gameUi(" draws")}</Chip>}
            {summary.stalled > 0 && <Chip tone="amber">{gameUi(summary.stalled)}{gameUi(" hit the move limit")}</Chip>}
            {summary.errors > 0 && <Chip tone="red">{gameUi(summary.errors)}{gameUi(" errors")}</Chip>}
            <Chip>⌀ {gameUi(summary.averageActions.toFixed(0))}{gameUi(" actions")}</Chip>
            <Chip>⌀ {gameUi(summary.averageRounds.toFixed(1))}{gameUi(" rounds")}</Chip>
          </div>
          {summary.firstError && <p className="text-sm text-red-300">{gameUi("First error: ")}{gameUi(summary.firstError)}</p>}
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{gameUi("Results per seat")}</caption>
            <thead className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              <tr>
                <th className="py-1 font-black">{gameUi("Seat")}</th>
                <th className="py-1 font-black">{gameUi("Won")}</th>
                <th className="py-1 font-black">{gameUi("Lost")}</th>
                <th className="w-1/2 py-1 font-black">{gameUi("Win rate")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.seats.map((seat, index) => {
                const rate = decided ? seat.wins / decided : 0;
                return (
                  <tr key={index} className="border-t border-white/[0.06]">
                    <td className="py-1.5 text-zinc-200">{gameUi("Bot ")}{gameUi(index + 1)}</td>
                    <td className="py-1.5 font-mono text-zinc-300">{gameUi(seat.wins)}</td>
                    <td className="py-1.5 font-mono text-zinc-300">{gameUi(seat.losses)}</td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${rate * 100}%` }} />
                        </span>
                        <span className="w-12 text-right font-mono text-xs text-zinc-400">{gameUi((rate * 100).toFixed(0))}%</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{gameUi("How games ended")}</p>
            <ul className="space-y-1 text-sm text-zinc-300">
              {summary.reasons.map((entry) => (
                <li key={entry.reason} className="flex justify-between gap-3">
                  <span>{gameUi(entry.reason)}</span>
                  <span className="font-mono text-zinc-500">{gameUi(entry.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </Panel>
  );
}
