import { Bug } from "lucide-react";
import { useState } from "react";
import { getCell, squareName } from "@/games/chess/custom/engine/board";
import type { MoveExplanation } from "@/games/chess/custom/engine/game";
import type { GameState, GameVariant, PieceInstance } from "@/games/chess/custom/engine/types";
import { TILE_STYLES } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";

type Filter = "all" | "legal" | "capture" | "illegal";

const ABILITY_NAMES: Record<string, string> = { castling: "Castling", castlePartner: "Castle partner", enPassant: "En passant", invulnerable: "Invulnerable", explosive: "Explosive" };

const ROYAL_MODE_TEXT = {
  checkmate: "Standard checkmate: royal pieces may not be left in check",
  capture: "Capturable kings: royal pieces may move into danger",
  none: "No king requirement",
};

/** Explains every square the selected piece's rules touch, plus the rules in play. */
export default function RuleDebugger({ variant, state, piece, explanations, dark = false }: { variant: GameVariant; state: GameState; piece: PieceInstance | null; explanations: MoveExplanation[]; dark?: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  if (!piece) {
    return (
      <p className="flex items-center gap-2 text-xs leading-5 text-zinc-500">
        <Bug size={14} />
        {ui("Select any piece to inspect its legal and illegal moves.")}
      </p>
    );
  }
  const def = variant.pieces.find((entry) => entry.id === piece.type);
  const override = state.ruleOverrides[piece.type];
  const cell = getCell(state.board, piece);
  const sorted = [...explanations].sort((a, b) => Number(b.legal) - Number(a.legal) || a.to.y - b.to.y || a.to.x - b.to.x);
  const visible = sorted.filter((entry) => filter === "all" || (filter === "legal" ? entry.legal && entry.kind !== "capture" : filter === "capture" ? entry.legal && entry.kind === "capture" : !entry.legal));
  const counts = {
    legal: explanations.filter((entry) => entry.legal && entry.kind !== "capture").length,
    capture: explanations.filter((entry) => entry.legal && entry.kind === "capture").length,
    illegal: explanations.filter((entry) => !entry.legal).length,
  };
  const colorOf = (entry: MoveExplanation) => (!entry.legal ? "text-zinc-500" : entry.kind === "capture" ? "text-red-300" : entry.kind === "special" ? "text-amber-300" : "text-sky-300");
  const relevant = [
    ui(ROYAL_MODE_TEXT[state.royalMode]),
    cell && cell.tile !== "normal" ? `${ui("Standing on a tile:")} ${ui(TILE_STYLES[cell.tile].label)} — ${ui(TILE_STYLES[cell.tile].description)}` : null,
    state.suddenDeath ? ui("Sudden death is active: the next capture wins") : null,
    ...variant.rules.filter((rule) => rule.enabled).map((rule) => `${ui(rule.type === "enPassant" ? "En passant" : rule.type === "forcedCapture" ? "Forced capture" : rule.type === "friendlyFire" ? "Friendly fire" : "Castling")}: ${ui("on")}`),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3 text-xs">
      <div>
        <p className="font-semibold text-zinc-100">
          {variant.teams.find((team) => team.id === piece.team)?.name} {def?.name} · {squareName(piece)}
        </p>
        <p className="mt-0.5 text-zinc-500">
          {piece.team !== state.turn ? ui("Not this team's turn — showing what it could do on its move.") : ui("Moves shown are fully legal right now.")}
          {override && ` ${ui("Moves like a")} ${variant.pieces.find((entry) => entry.id === override)?.name} (event).`}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["all", `${ui("All")} ${explanations.length}`],
            ["legal", `${ui("Moves")} ${counts.legal}`],
            ["capture", `${ui("Captures")} ${counts.capture}`],
            ["illegal", `${ui("Illegal")} ${counts.illegal}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`rounded-md px-2 py-0.5 font-semibold transition ${filter === id ? "bg-sky-400/20 text-sky-100" : "text-zinc-400 hover:bg-white/[0.06]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className={`max-h-56 space-y-0.5 overflow-y-auto rounded-lg p-1.5 font-mono ${dark ? "bg-black/40" : "bg-black/25"}`}>
        {visible.length === 0 && <li className="px-1 py-1 text-zinc-500">{ui("Nothing here.")}</li>}
        {visible.map((entry) => (
          <li key={`${entry.to.x},${entry.to.y}`} className="flex gap-2 px-1 py-0.5 leading-4">
            <span className="w-7 shrink-0 font-bold text-zinc-200">{squareName(entry.to)}</span>
            <span className={`w-14 shrink-0 ${colorOf(entry)}`}>{ui(entry.legal ? (entry.kind === "capture" ? "Capture" : entry.kind === "special" ? "Special" : "Legal") : "Illegal")}</span>
            <span className="text-zinc-400">{entry.reason}</span>
          </li>
        ))}
      </ul>
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Active abilities")}</p>
        <p className="text-zinc-300">{def?.abilities.length ? def.abilities.map((ability) => ui(ABILITY_NAMES[ability])).join(", ") : ui("None")}{def?.royal ? ` · ${ui("royal")}` : ""}</p>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Relevant rules")}</p>
        <ul className="list-disc space-y-0.5 pl-4 text-zinc-400">
          {relevant.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Triggered by the last move")}</p>
        {state.fired.length ? (
          <ul className="space-y-0.5 text-zinc-300">
            {state.fired.map((entry, index) => (
              <li key={`${entry.eventId}-${index}`}>
                ⚡ {entry.name} <span className="text-zinc-500">({ui(entry.branch === "scheduled" ? "scheduled" : entry.branch === "then" ? "conditions met" : "else branch")})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-500">{ui("No events fired.")}</p>
        )}
      </div>
    </div>
  );
}
