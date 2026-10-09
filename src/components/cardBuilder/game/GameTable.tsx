import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useMemo, useState, type ReactNode } from "react";
import { SUIT_NAMES, SUIT_SYMBOLS, isSuit } from "@/games/cards/cards/card";
import { getAvailableActions } from "@/games/cards/engine/actions";
import { isCardVisible } from "@/games/cards/engine/GameEngine";
import type { ActionRequest, AvailableAction, GameDefinition, GameState, PlayerState, ZoneDefinition } from "@/games/cards/engine/types";
import { Button, Chip } from "@/components/chessCustom/ui";
import CardView from "./CardView";

interface Props {
  def: GameDefinition;
  state: GameState;
  /** Whose hidden information is shown and who acts (null = spectator). */
  viewerId: string | null;
  onAction: (request: ActionRequest) => void;
  error?: string | null;
  /** Show every player's own cards face up (watching bots in a simulation). Piles stay hidden. */
  revealAll?: boolean;
}

/**
 * Renders any configured game: game zones in the middle, one panel per player.
 * Everything the player may do comes from getAvailableActions — the table has
 * no game logic of its own.
 */
export default function GameTable({ def, state, viewerId, onAction, error, revealAll = false }: Props) {
  useGameLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const available = useMemo(() => (viewerId ? getAvailableActions(def, state, viewerId) : []), [def, state, viewerId]);
  const phase = def.phases.find((entry) => entry.id === state.currentPhase);
  const trump = isSuit(state.variables.trumpSuit) ? state.variables.trumpSuit : null;
  const current = state.players.find((player) => player.id === state.currentPlayerId);

  const cardActions = available.filter((action) => action.options.some((option) => option.cardId));
  const playable = new Set(cardActions.flatMap((action) => action.options.map((option) => option.cardId!)));
  const selection = selected && playable.has(selected) ? selected : null;
  const forSelected = cardActions
    .map((action) => ({ action, options: action.options.filter((option) => option.cardId === selection) }))
    .filter((entry) => entry.options.length);
  const targets = new Map<string, { action: AvailableAction; cardId: string; targetCardId: string }>();
  for (const { action, options } of forSelected) for (const option of options) if (option.targetCardId && !targets.has(option.targetCardId)) targets.set(option.targetCardId, { action, cardId: option.cardId!, targetCardId: option.targetCardId });
  const plainActions = available.filter((action) => !action.options.some((option) => option.cardId));

  const send = (request: ActionRequest) => {
    setSelected(null);
    onAction(request);
  };

  const zoneCards = (key: string, zone: ZoneDefinition, size: "sm" | "md" | "lg") => {
    const cards = state.zones[key]?.cards ?? [];
    const visible = cards.filter((id) => ((revealAll && zone.owner === "player") || isCardVisible(def, state, key, id, viewerId)) && state.cards[id]);
    const hidden = cards.length - visible.length;
    const ownedByViewer = state.zones[key]?.owner === viewerId;
    if (!cards.length) return <span className="flex h-14 items-center text-xs text-zinc-600">{gameUi("empty")}</span>;
    return (
      <div className="flex flex-wrap items-end gap-1.5">
        {gameUi(hidden > 0 && (
          <span className="relative inline-flex items-end">
            <CardView size={size} label={gameUi(`${hidden} face-down card${hidden === 1 ? "" : "s"}`)} />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-zinc-800 px-1.5 text-[10px] font-bold text-zinc-200 ring-1 ring-white/20">{gameUi(hidden)}</span>
          </span>
        ))}
        {visible.map((id) => {
          const isTarget = targets.has(id);
          const isPlayable = ownedByViewer && playable.has(id);
          return (
            <CardView
              key={id}
              card={state.cards[id]}
              size={size}
              marked={Boolean(state.marks[id]?.covered)}
              selectable={isPlayable}
              selected={selection === id}
              target={isTarget}
              dimmed={ownedByViewer && Boolean(selection) && !isPlayable && zone.kind === "hand"}
              onClick={
                isTarget
                  ? () => {
                      const entry = targets.get(id)!;
                      send({ actionId: entry.action.actionId, cardId: entry.cardId, targetCardId: entry.targetCardId });
                    }
                  : isPlayable
                    ? () => setSelected(selection === id ? null : id)
                    : undefined
              }
            />
          );
        })}
      </div>
    );
  };

  const gameZones = def.zones.filter((zone) => zone.owner === "game");
  const playerZones = def.zones.filter((zone) => zone.owner === "player");
  const ordered = [...state.players].sort((a, b) => (a.id === viewerId ? 1 : b.id === viewerId ? -1 : a.seat - b.seat));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm">
        <Chip tone="amber">{gameUi("Phase: ")}{gameUi(phase?.name ?? state.currentPhase)}</Chip>
        <Chip>{gameUi("Round ")}{gameUi(state.roundNumber)}</Chip>
        <Chip>{gameUi("Turn ")}{gameUi(state.turnNumber)}</Chip>
        {current && <Chip tone="sky">{gameUi("Current: ")}{current.name}</Chip>}
        {gameUi(trump && (
          <Chip tone="violet">{gameUi(" Trump: ")}{gameUi(SUIT_SYMBOLS[trump])} {gameUi(SUIT_NAMES[trump])}
          </Chip>
        ))}
        {(def.variables ?? [])
          .filter((variable) => variable.visible)
          .map((variable) => (
            <Chip key={variable.key} tone="emerald">
              {gameUi(variable.label ?? variable.key)}: {gameUi(String(state.players.find((player) => player.id === state.variables[variable.key])?.name ?? state.variables[variable.key] ?? "—"))}
            </Chip>
          ))}
        {state.status === "finished" && <Chip tone="emerald">{gameUi("Game over")}</Chip>}
      </div>

      {gameUi(state.result && (
        <div role="status" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-bold">{gameUi(state.result.draw && !state.result.winners.length ? "Draw" : `Winner${state.result.winners.length === 1 ? "" : "s"}: ${state.result.winners.map((id) => state.players.find((player) => player.id === id)?.name).join(", ") || "—"}`)}</p>
          <p className="mt-1 text-emerald-200/80">{gameUi(state.result.reason)}</p>
        </div>
      ))}

      <section aria-label={gameUi("Table")} className="rounded-3xl border border-emerald-300/10 bg-[radial-gradient(ellipse_at_center,rgba(16,80,60,.55),rgba(6,30,24,.85))] p-4 shadow-inner">
        <div className="flex flex-wrap gap-5">
          {gameZones.map((zone) => (
            <div key={zone.id} className="min-w-[90px]">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/60">
                {gameUi(zone.name)} <span className="font-mono text-emerald-100/40">· {gameUi(state.zones[zone.id]?.cards.length ?? 0)}</span>
              </p>
              {gameUi(zoneCards(zone.id, zone, "md"))}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {ordered.map((player) => (
          <PlayerPanel key={player.id} player={player} isViewer={player.id === viewerId} isCurrent={player.id === state.currentPlayerId} scoreLabel={def.scoreLabel}>
            {playerZones.map((zone) => {
              const key = `${zone.id}:${player.id}`;
              return (
                <div key={zone.id}>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                    {gameUi(zone.name)} <span className="font-mono text-zinc-600">· {gameUi(state.zones[key]?.cards.length ?? 0)}</span>
                  </p>
                  {gameUi(zoneCards(key, zone, player.id === viewerId ? "lg" : "sm"))}
                </div>
              );
            })}
          </PlayerPanel>
        ))}
      </div>

      {gameUi(viewerId && state.status === "playing" && (
        <section aria-label={gameUi("Your actions")} className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/80">{gameUi("Your options")}</p>
          {!available.length && <p className="mt-2 text-sm text-zinc-400">{gameUi("Nothing to do right now — waiting for other players.")}</p>}
          {gameUi(available.length > 0 && (
            <div className="mt-2 space-y-2">
              {cardActions.length > 0 && !selection && <p className="text-sm text-zinc-300">{gameUi("Choose a highlighted card (")}{gameUi(cardActions.map((action) => action.label).join(", "))}).</p>}
              {gameUi(selection && (
                <div className="flex flex-wrap items-center gap-2">
                  {forSelected.filter(({ options }) => options.some((option) => !option.targetCardId)).map(({ action }) => (
                    <Button key={action.actionId} tone="primary" onClick={() => send({ actionId: action.actionId, cardId: selection })}>
                      {gameUi(action.label)} {gameUi(state.cards[selection] ? `${state.cards[selection].rank}${SUIT_SYMBOLS[state.cards[selection].suit]}` : "")}
                    </Button>
                  ))}
                  {targets.size > 0 && <span className="text-sm text-sky-200">{gameUi("Now click a highlighted card on the table to ")}{gameUi(forSelected.find(({ options }) => options.some((option) => option.targetCardId))?.action.label.toLowerCase())}{gameUi(" it.")}</span>}
                  <Button size="sm" onClick={() => setSelected(null)}>{gameUi(" Cancel ")}</Button>
                </div>
              ))}
              {gameUi(plainActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {plainActions.map((action) => (
                    <Button key={action.actionId} tone={action.type === "pass" || action.type === "takeCards" ? "ghost" : "blue"} onClick={() => send({ actionId: action.actionId })}>
                      {gameUi(action.label)}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {gameUi(error && (
            <p role="alert" className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {gameUi(error)}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

function PlayerPanel({ player, isViewer, isCurrent, scoreLabel, children }: { player: PlayerState; isViewer: boolean; isCurrent: boolean; scoreLabel?: string; children: ReactNode }) {
  useGameLanguage();
  return (
    <section
      aria-label={gameUi(`${player.name}${isViewer ? " (you)" : ""}`)}
      className={`rounded-2xl border p-3 ${isViewer ? "border-amber-300/30 bg-amber-300/[0.04] lg:col-span-2" : "border-white/[0.08] bg-[#0d1014]/85"} ${player.status !== "active" ? "opacity-70" : ""}`}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isCurrent ? "bg-amber-300" : "bg-zinc-700"}`} aria-hidden />
        <h3 className="text-sm font-bold text-zinc-100">
          {player.name}
          {isViewer && <span className="text-amber-300">{gameUi(" (you)")}</span>}
          {player.isBot && <span className="text-zinc-500">{gameUi(" · bot")}</span>}
        </h3>
        {player.roles.map((role) => (
          <Chip key={role} tone="sky">
            {gameUi(role)}
          </Chip>
        ))}
        {gameUi((player.score !== 0 || scoreLabel) && (
          <Chip tone="amber">
            {gameUi(scoreLabel ?? "Score")} {gameUi(player.score)}
          </Chip>
        ))}
        {Object.entries(player.variables)
          .filter(([, value]) => typeof value === "string" && value)
          .map(([key, value]) => (
            <Chip key={key} tone="violet">
              {gameUi(String(value))}
            </Chip>
          ))}
        {player.passed && <Chip>{gameUi("passed")}</Chip>}
        {player.status !== "active" && <Chip tone={player.status === "finished" ? "emerald" : "red"}>{gameUi(player.status === "finished" ? `finished #${player.finishPlace}` : player.status)}</Chip>}
        {player.result && <Chip tone={player.result === "winner" ? "emerald" : player.result === "loser" ? "red" : "zinc"}>{gameUi(player.result)}</Chip>}
      </header>
      <div className="flex flex-wrap gap-4">{gameUi(children)}</div>
    </section>
  );
}
