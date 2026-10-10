import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { ArrowRight, Check } from "lucide-react";
import {
  KING_BEHAVIORS,
  KING_CONSEQUENCE_INFO,
  applyKingBehavior,
  matchKingBehavior,
  withKingConsequence,
} from "@/games/chess/custom/engine/presets";
import { GAME_RULE_TYPES, KING_CONSEQUENCES, type GameRuleType, type GameVariant, type KingCaptureSettings, type RoyalMode } from "@/games/chess/custom/engine/types";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import { Button, NumberField, Panel, SectionHeading, Segmented, Select, Toggle, labelClass } from "../ui";

const RULE_INFO: Record<GameRuleType, { label: string; description: string }> = {
  castling: { label: "Castling", description: "Pieces with the Castling ability may castle with an unmoved Castle-partner piece." },
  enPassant: { label: "En passant", description: "Pieces with the En passant ability may capture a double-stepping piece in passing." },
  forcedCapture: { label: "Forced capture", description: "If any capture is available, the player must capture." },
  friendlyFire: { label: "Friendly fire", description: "Pieces may capture their own team's pieces." },
};

export default function RulesSection() {
  useGameLanguage();
  const { variant, dispatch, goToStep } = useEditor();
  const { settings } = variant;
  const behavior = matchKingBehavior(settings);
  const update = (recipe: (variant: GameVariant) => GameVariant, coalesceKey?: string) => dispatch({ type: "update", recipe, coalesceKey });
  const setConsequence = (patch: Partial<KingCaptureSettings>, coalesceKey?: string) => update((current) => withKingConsequence(current, { ...current.settings.kingCapture, ...patch }), coalesceKey);
  const royalTypes = variant.pieces.filter((piece) => !piece.royal);
  const generated = variant.events.filter((event) => event.source === "kingConsequence").length;

  return (
    <div>
      <SectionHeading
        step="rules"
        eyebrow="Rules"
        title={gameUi("The rulebook")}
        description={ui("Kings don't have to follow standard chess. Choose how royal pieces behave and what happens when one falls — the consequence is compiled into ordinary, editable events.")}
      />

      <Panel title={ui("King behavior")} eyebrow={ui("Pick a starting point")} className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {KING_BEHAVIORS.map((entry) => {
            const active = behavior === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={active}
                onClick={() => update((current) => applyKingBehavior(current, entry.id))}
                className={`relative rounded-xl border p-4 text-left transition ${active ? "border-amber-300/60 bg-amber-300/[0.08] shadow-[0_0_30px_rgba(252,211,77,.08)]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"}`}
              >
                {active && <Check size={16} className="absolute right-3 top-3 text-amber-300" />}
                <p className="font-semibold text-zinc-100">{ui(entry.label)}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">{ui(entry.description)}</p>
              </button>
            );
          })}
        </div>
        {!behavior && <p className="mt-3 text-xs text-sky-300">{ui("Custom combination — fine-tuned below.")}</p>}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <Panel title={ui("Royal pieces")}>
            <p className={labelClass}>{ui("Check rules")}</p>
            <div className="mt-1.5">
              <Segmented<RoyalMode>
                label={gameUi("Royal mode")}
                value={settings.royalMode}
                onChange={(royalMode) => update((current) => ({ ...current, settings: { ...current.settings, royalMode } }))}
                options={[
                  { id: "checkmate", label: "Checkmate", title: "Kings may not move into check; checkmate is possible" },
                  { id: "capture", label: "Capturable", title: "Kings may be captured like other pieces" },
                  { id: "none", label: "No kings", title: "Royal pieces have no special rules" },
                ]}
              />
            </div>
            <div className="mt-4">
              <p className={labelClass}>{ui("With several kings")}</p>
              <div className="mt-1.5">
                <Segmented
                  label={gameUi("Royal scope")}
                  value={settings.royalScope}
                  onChange={(royalScope) => update((current) => ({ ...current, settings: { ...current.settings, royalScope } }))}
                  options={[
                    { id: "every", label: "Every king matters" },
                    { id: "last", label: "Only the last king" },
                  ]}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{ui("Place several royal pieces in Test Position to play with multiple kings.")}</p>
            </div>
          </Panel>

          <Panel title={ui("General rules")}>
            <div className="space-y-3">
              {GAME_RULE_TYPES.map((type) => (
                <Toggle
                  key={type}
                  checked={variant.rules.some((rule) => rule.type === type && rule.enabled)}
                  onChange={(on) => dispatch({ type: on ? "addRule" : "removeRule", ruleType: type })}
                  label={ui(RULE_INFO[type].label)}
                  description={ui(RULE_INFO[type].description)}
                />
              ))}
            </div>
          </Panel>

          <Panel title={ui("Turn flow")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className={labelClass}>{ui("First to move")}</p>
                <Select
                  label={gameUi("First to move")}
                  className="mt-1.5"
                  value={variant.setup.startingTeam}
                  onChange={(startingTeam) => update((current) => ({ ...current, setup: { ...current.setup, startingTeam } }))}
                  options={variant.teams.map((team) => ({ id: team.id, label: team.name }))}
                />
              </div>
              <div>
                <p className={labelClass}>{ui("No legal moves")}</p>
                <Select
                  label={gameUi("No legal moves")}
                  className="mt-1.5"
                  value={settings.noLegalMoves}
                  onChange={(noLegalMoves) => update((current) => ({ ...current, settings: { ...current.settings, noLegalMoves } }))}
                  options={[
                    { id: "draw", label: "Draw (stalemate)" },
                    { id: "lose", label: "That team loses" },
                  ]}
                />
              </div>
              <div>
                <p className={labelClass}>{ui("Turn limit (moves, 0 = none)")}</p>
                <NumberField label={gameUi("Turn limit")} value={settings.maxPlies} min={0} max={2000} step={10} onChange={(maxPlies) => update((current) => ({ ...current, settings: { ...current.settings, maxPlies } }), "max-plies")} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {variant.teams.map((team, index) => (
                <span key={team.id} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-zinc-300">
                  <span className="text-zinc-500">{gameUi(index + 1)}.</span>
                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ background: team.color }} />
                  {gameUi(team.name)}
                </span>
              ))}
              <Button size="sm" onClick={() => goToStep("teams")}>
                {ui("Edit teams")}
                <ArrowRight size={13} />
              </Button>
            </div>
          </Panel>
        </div>

        <Panel
          title={ui("When a king is captured")}
          eyebrow={ui("King capture consequence")}
          actions={
            <Button size="sm" onClick={() => goToStep("events")}>
              {gameUi(generated)} {ui("generated event(s)")}
              <ArrowRight size={13} />
            </Button>
          }
        >
          {gameUi(settings.royalMode === "checkmate" && (
            <p className="mb-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-xs leading-5 text-sky-100">
              {ui("Under Standard Checkmate kings are rarely captured — this still applies to test positions and events.")}
            </p>
          ))}
          <div className="grid gap-2 sm:grid-cols-2">
            {KING_CONSEQUENCES.map((id) => {
              const active = settings.kingCapture.consequence === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setConsequence({ consequence: id })}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-amber-300/60 bg-amber-300/[0.08]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"}`}
                >
                  <p className="text-sm font-semibold text-zinc-100">{ui(KING_CONSEQUENCE_INFO[id].label)}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{ui(KING_CONSEQUENCE_INFO[id].description)}</p>
                </button>
              );
            })}
          </div>
          {gameUi((settings.kingCapture.consequence === "loseAfterTurns" || settings.kingCapture.consequence === "respawn") && (
            <div className="mt-4">
              <p className={labelClass}>{ui("Turns")}</p>
              <NumberField label={gameUi("Turns")} value={settings.kingCapture.turns} min={1} max={30} onChange={(turns) => setConsequence({ turns }, "king-turns")} />
            </div>
          ))}
          {settings.kingCapture.consequence === "successor" && (
            <div className="mt-4">
              <p className={labelClass}>{ui("Preferred successor")}</p>
              <Select
                label={gameUi("Preferred successor")}
                className="mt-1.5"
                value={settings.kingCapture.successor}
                onChange={(successor) => setConsequence({ successor })}
                options={royalTypes.map((piece) => ({ id: piece.id, label: piece.name }))}
              />
              <p className="mt-2 text-xs leading-5 text-zinc-500">{ui("If the team has none left, its highest-value piece becomes the new king.")}</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
