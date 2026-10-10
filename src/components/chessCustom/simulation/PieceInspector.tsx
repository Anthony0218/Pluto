import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { Crown } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import type { Chess3DPieceSkin } from "@/games/chess/3d/chess3dAppearance";
import { getCell, squareName } from "@/games/chess/custom/engine/board";
import type { MoveExplanation } from "@/games/chess/custom/engine/game";
import type { GameState, GameVariant, PieceInstance } from "@/games/chess/custom/engine/types";
import { describeRule } from "@/games/chess/custom/editor/editorUtils";
import { TILE_STYLES } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";
import MovementGrid from "../MovementGrid";
import PieceToken from "../PieceToken";
import RuleDebugger from "../play/RuleDebugger";

// Three.js loads only when a 3D preview is actually shown.
const PiecePreview3D = lazy(() => import("./PiecePreview3D"));

export default function PieceInspector({
  variant,
  state,
  piece,
  explanations,
  skin,
  reducedMotion,
  show3D,
}: {
  variant: GameVariant;
  state: GameState;
  piece: PieceInstance | null;
  explanations: MoveExplanation[];
  skin: Chess3DPieceSkin;
  reducedMotion: boolean;
  show3D: boolean;
}) {
  useGameLanguage();
  const [tab, setTab] = useState<"inspector" | "debugger">("inspector");
  const def = piece ? variant.pieces.find((entry) => entry.id === piece.type) : undefined;
  const team = piece ? variant.teams.find((entry) => entry.id === piece.team) : undefined;
  const cell = piece ? getCell(state.board, piece) : null;

  return (
    <section aria-label={ui("Selected piece")} className="flex min-h-0 flex-col rounded-2xl border border-white/[0.09] bg-black/55 shadow-[0_20px_50px_rgba(0,0,0,.45)] backdrop-blur-xl">
      <div className="flex border-b border-white/[0.07] p-1" role="tablist">
        {(
          [
            ["inspector", "Selected Piece"],
            ["debugger", "Rule Debugger"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] transition ${tab === id ? "bg-amber-300/15 text-amber-100" : "text-zinc-500 hover:text-zinc-200"}`}
          >
            {ui(label)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {gameUi(tab === "debugger" ? (
          <RuleDebugger variant={variant} state={state} piece={piece} explanations={explanations} dark />
        ) : !piece || !def ? (
          <p className="py-6 text-center text-xs leading-5 text-zinc-500">{ui("Click a piece on the board to inspect it.")}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 font-serif text-xl text-white">
                  {gameUi(def.name)}
                  {def.royal && <Crown size={15} className="text-amber-300" aria-label={gameUi("Royal")} />}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {gameUi(team?.name)} · {gameUi(squareName(piece))} · {ui("value")} {gameUi(def.value)}
                  {gameUi(cell && cell.tile !== "normal" ? ` · ${TILE_STYLES[cell.tile].label} tile` : "")}
                </p>
              </div>
            </div>
            {gameUi(show3D ? (
              <Suspense fallback={<div className="h-36 rounded-xl border border-white/[0.08]" />}>
                <PiecePreview3D def={def} set={team?.modelSet ?? "light"} skin={skin} reducedMotion={reducedMotion} />
              </Suspense>
            ) : (
              <div className="flex h-28 items-center justify-center rounded-xl border border-white/[0.08] bg-[radial-gradient(circle_at_50%_40%,rgba(251,191,36,.12),transparent_65%)]">
                <span className="h-20 w-20">
                  <PieceToken def={def} team={team} />
                </span>
              </div>
            ))}
            {def.description && <p className="text-xs leading-5 text-zinc-400">{gameUi(def.description)}</p>}
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Movement preview")}</p>
              <MovementGrid piece={def} team={team} moveRules={def.movement} captureRules={def.captureSameAsMove ? def.movement : def.capture} radius={3} compact />
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{ui("Custom rules")}</p>
              <ul className="space-y-1 text-[11px] leading-4 text-zinc-300">
                {def.movement.map((rule) => (
                  <li key={rule.id}>
                    <span className="text-sky-300">{ui(def.captureSameAsMove ? "Move & capture" : "Move")}</span> · {gameUi(describeRule(rule, ui))}
                  </li>
                ))}
                {gameUi(!def.captureSameAsMove &&
                  def.capture.map((rule) => (
                    <li key={rule.id}>
                      <span className="text-red-300">{ui("Capture")}</span> · {gameUi(describeRule(rule, ui))}
                    </li>
                  )))}
                {def.abilities.map((ability) => (
                  <li key={ability}>
                    <span className="text-amber-300">{ui("Ability")}</span> · {gameUi(ability)}
                  </li>
                ))}
                {gameUi(def.promotion && (
                  <li>
                    <span className="text-amber-300">{ui("Promotes")}</span> · {gameUi(def.promotion.options.map((option) => variant.pieces.find((entry) => entry.id === option)?.name ?? option).join(", "))}
                  </li>
                ))}
                {gameUi(state.ruleOverrides[def.id] && (
                  <li>
                    <span className="text-fuchsia-300">{ui("Event")}</span> · {ui("moves like a")} {gameUi(variant.pieces.find((entry) => entry.id === state.ruleOverrides[def.id])?.name)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
