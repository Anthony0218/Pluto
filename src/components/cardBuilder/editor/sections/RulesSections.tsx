import { useState } from "react";
import { Code2, Copy, Plus, Trash2 } from "lucide-react";
import { EVENT_LABELS } from "@/games/cards/engine/describe";
import { effectEmits } from "@/games/cards/engine/effects";
import { END_CONDITION_LABELS, describeEndCondition } from "@/games/cards/engine/endConditions";
import { describeRule } from "@/games/cards/engine/rulebook";
import { END_CONDITION_TYPES, GAME_EVENT_TYPES, type EndConditionDefinition, type GameEventType, type RuleDefinition } from "@/games/cards/engine/types";
import { Button, Chip, Field, NumberField, Panel, Toggle, inputClass } from "@/components/chessCustom/ui";
import ConditionBuilder from "../ConditionBuilder";
import EffectListEditor from "../EffectListEditor";
import { useCardEditor, useIssuesFor } from "../editorContext";
import { OptionalCondition, PlayerSetEditor, ValueEditor } from "../fields";
import SectionShell, { IssueList } from "../SectionShell";

/** The example from the brief: WHEN a card is played, IF it is a 7 AND the target is an Ace, THEN … */
const exampleRule = (id: string): RuleDefinition => ({
  id,
  name: "7 beats Ace",
  trigger: "CARD_PLAYED",
  priority: 100,
  stopProcessing: true,
  condition: { type: "and", children: [{ type: "rankEquals", card: "played", rank: "7" }, { type: "rankEquals", card: "target", rank: "A" }] },
  effects: [{ type: "incrementScore", player: "eventPlayer", amount: 1 }],
});

function RuleCard({ rule, index }: { rule: RuleDefinition; index: number }) {
  const { def, edit, mode } = useCardEditor();
  const issues = useIssuesFor(rule.id);
  const [json, setJson] = useState(false);
  const update = (mutate: (draft: RuleDefinition) => void) => edit((draft) => mutate(draft.rules[index]));
  return (
    <Panel
      className={rule.enabled === false ? "opacity-60" : ""}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <input aria-label="Rule name" className="min-w-0 bg-transparent font-bold text-zinc-100 outline-none focus:underline" value={rule.name} onChange={(event) => update((draft) => void (draft.name = event.target.value))} />
          <Chip tone="amber">priority {rule.priority ?? 0}</Chip>
          {rule.stopProcessing && <Chip tone="violet">stops lower rules</Chip>}
        </span>
      }
      actions={
        <>
          {mode === "advanced" && (
            <button type="button" aria-label="Show rule JSON" aria-pressed={json} className={`p-1 ${json ? "text-amber-300" : "text-zinc-500"}`} onClick={() => setJson(!json)}>
              <Code2 size={14} />
            </button>
          )}
          <button type="button" aria-label="Duplicate rule" className="p-1 text-zinc-500 hover:text-white" onClick={() => edit((draft) => void draft.rules.splice(index + 1, 0, { ...structuredClone(rule), id: `${rule.id}-copy-${draft.rules.length}`, name: `${rule.name} (copy)` }))}>
            <Copy size={14} />
          </button>
          <button type="button" aria-label={`Delete rule ${rule.name}`} className="p-1 text-zinc-500 hover:text-red-300" onClick={() => edit((draft) => void draft.rules.splice(index, 1))}>
            <Trash2 size={14} />
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-12 text-xs font-black text-sky-300">WHEN</span>
          <select aria-label="Event" className={`${inputClass} !w-auto py-1 text-sm`} value={rule.trigger} onChange={(event) => update((draft) => void (draft.trigger = event.target.value as GameEventType))}>
            {GAME_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 w-12 shrink-0 text-xs font-black text-sky-300">IF</span>
          <div className="min-w-0 flex-1">
            {rule.condition ? (
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <ConditionBuilder value={rule.condition} onChange={(condition) => update((draft) => void (draft.condition = condition))} />
                </div>
                <button type="button" aria-label="Remove condition" className="text-xs text-zinc-500 hover:text-red-300" onClick={() => update((draft) => void delete draft.condition)}>
                  ✕
                </button>
              </div>
            ) : (
              <OptionalCondition value={undefined} onChange={(condition) => update((draft) => void (draft.condition = condition))} emptyLabel="always" />
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 w-12 shrink-0 text-xs font-black text-emerald-300">THEN</span>
          <div className="min-w-0 flex-1">
            <EffectListEditor value={rule.effects} onChange={(effects) => update((draft) => void (draft.effects = effects))} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-3">
          <span className="flex items-center gap-2 text-sm text-zinc-300">
            Priority
            <NumberField value={rule.priority ?? 0} min={-1000} max={1000} step={10} label="Priority" onChange={(priority) => update((draft) => void (draft.priority = priority))} />
          </span>
          <div className="min-w-[220px]">
            <Toggle checked={Boolean(rule.stopProcessing)} onChange={(stop) => update((draft) => void (draft.stopProcessing = stop))} label="Stop lower-priority rules" />
          </div>
          <div className="min-w-[140px]">
            <Toggle checked={rule.enabled !== false} onChange={(enabled) => update((draft) => void (draft.enabled = enabled))} label="Enabled" />
          </div>
        </div>
        <p className="rounded-lg bg-black/30 px-3 py-2 text-sm italic text-zinc-300">{describeRule(rule, { def })}</p>
        <IssueList issues={issues} />
        {json && <pre className="max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-[11px] text-zinc-400">{JSON.stringify(rule, null, 2)}</pre>}
      </div>
    </Panel>
  );
}

/* 7. Rules */
export function RulesSection() {
  const { def, edit } = useCardEditor();
  const order = def.rules.map((rule, index) => ({ rule, index })).sort((a, b) => (b.rule.priority ?? 0) - (a.rule.priority ?? 0) || a.index - b.index);
  return (
    <SectionShell
      section="rules"
      eyebrow="7 · Rules"
      title="Rules: WHEN · IF · THEN"
      description="Rules react to events. When several rules listen to the same event, higher priority runs first; a rule that “stops lower-priority rules” overrides the general ones below it — e.g. “7 beats Ace” (100) above “higher card wins” (10)."
      actions={
        <>
          <Button size="sm" onClick={() => edit((draft) => void draft.rules.push({ id: `rule${draft.rules.length + 1}`, name: "New rule", trigger: "CARD_PLAYED", priority: 0, effects: [] }))}>
            <Plus size={14} /> Empty rule
          </Button>
          <Button size="sm" tone="blue" onClick={() => edit((draft) => void draft.rules.push(exampleRule(`rule${draft.rules.length + 1}`)))}>
            <Plus size={14} /> Example: 7 beats Ace
          </Button>
        </>
      }
    >
      {!def.rules.length && <p className="text-sm text-zinc-500">No event rules. Many games need none — phases, actions and their conditions do the work.</p>}
      {def.rules.length > 1 && (
        <Panel title="Evaluation order" eyebrow="Highest priority first">
          <ol className="space-y-1 text-sm">
            {order.map(({ rule }) => (
              <li key={rule.id} className="flex items-center gap-2">
                <span className="w-12 text-right font-mono text-amber-200">{rule.priority ?? 0}</span>
                <span className="text-zinc-200">{rule.name}</span>
                <span className="text-xs text-zinc-500">on {EVENT_LABELS[rule.trigger]}</span>
                {rule.stopProcessing && <Chip tone="violet">stops</Chip>}
              </li>
            ))}
          </ol>
        </Panel>
      )}
      <div className="space-y-3">
        {def.rules.map((rule, index) => (
          <RuleCard key={`${rule.id}-${index}`} rule={rule} index={index} />
        ))}
      </div>
    </SectionShell>
  );
}

/* 8. Events */
export function EventsSection() {
  const { def, edit } = useCardEditor();
  const listeners = (type: GameEventType) => def.rules.filter((rule) => rule.trigger === type);
  const causes = (type: GameEventType) => [
    ...def.actions.filter((action) => effectEmits(action.effects).has(type)).map((action) => `action “${action.label}”`),
    ...def.phases.filter((phase) => effectEmits(phase.onEnter).has(type)).map((phase) => `phase “${phase.name}”`),
    ...def.rules.filter((rule) => effectEmits(rule.effects).has(type)).map((rule) => `rule “${rule.name}”`),
  ];
  const note = (type: GameEventType) => def.events.find((event) => event.type === type)?.description ?? "";
  const setNote = (type: GameEventType, description: string) =>
    edit((draft) => {
      const others = draft.events.filter((event) => event.type !== type);
      draft.events = description ? [...others, { type, description }] : others;
    });
  return (
    <SectionShell section="events" eyebrow="8 · Events" title="Events" description="Everything that happens in a game emits an event. This map shows which rules listen to each one and what can cause it. Add a note to explain how your game uses an event.">
      <div className="grid gap-3 lg:grid-cols-2">
        {GAME_EVENT_TYPES.map((type) => {
          const rules = listeners(type);
          const sources = causes(type);
          return (
            <Panel key={type} title={EVENT_LABELS[type]} eyebrow={type}>
              <div className="space-y-2 text-sm">
                <p className="text-zinc-400">
                  {rules.length ? (
                    <>
                      Rules: {rules.map((rule) => <Chip key={rule.id} tone="amber">{rule.name}</Chip>)}
                    </>
                  ) : (
                    "No rule listens to this event."
                  )}
                </p>
                {sources.length > 0 && <p className="text-xs text-zinc-500">Also caused by: {sources.join(", ")}</p>}
                <input aria-label={`Note for ${type}`} className={`${inputClass} py-1 text-xs`} placeholder="How does your game use this event? (optional)" value={note(type)} onChange={(event) => setNote(type, event.target.value)} />
                <Button size="sm" onClick={() => edit((draft) => void draft.rules.push({ id: `rule${draft.rules.length + 1}`, name: `When ${EVENT_LABELS[type]}`, trigger: type, priority: 0, effects: [] }))}>
                  <Plus size={14} /> Rule for this event
                </Button>
              </div>
            </Panel>
          );
        })}
      </div>
    </SectionShell>
  );
}

/* 9. End conditions */
const BASIC_GOALS: { id: string; label: string; description: string; make: () => EndConditionDefinition[] }[] = [
  { id: "empty", label: "Empty your hand", description: "The first player with no cards in hand wins.", make: () => [{ id: "empty-hand", type: "PLAYER_HAND_EMPTY", label: "Empty your hand", outcome: "win" }] },
  { id: "collect", label: "Collect all cards", description: "When only one player still has cards, they win.", make: () => [{ id: "collect-all", type: "LAST_PLAYER_WITH_CARDS", label: "Collect all cards", outcome: "lastWins" }] },
  { id: "points", label: "Reach X points", description: "The first player to reach the target score wins.", make: () => [{ id: "points", type: "FIRST_TO_SCORE", label: "Reach the target score", target: 20 }] },
  { id: "last", label: "Be the last remaining player", description: "Players who are eliminated drop out; the last one in wins.", make: () => [{ id: "last-standing", type: "LAST_ACTIVE_PLAYER", label: "Last player standing", outcome: "lastWins" }] },
  { id: "custom", label: "Custom", description: "Build your own condition with the rule builder.", make: () => [{ id: "custom", type: "CUSTOM_DECLARATIVE_CONDITION", label: "Custom end", when: { type: "roundNumber", op: "gt", value: 10 }, winners: "active" }] },
];

function basicGoal(conditions: EndConditionDefinition[]) {
  if (conditions.length !== 1) return conditions.length ? "custom" : null;
  const [only] = conditions;
  if (only.type === "PLAYER_HAND_EMPTY" && only.outcome !== "finish") return "empty";
  if (only.type === "LAST_PLAYER_WITH_CARDS" && only.outcome !== "lastLoses") return "collect";
  if (only.type === "FIRST_TO_SCORE") return "points";
  if (only.type === "LAST_ACTIVE_PLAYER" && only.outcome !== "lastLoses") return "last";
  return "custom";
}

function EndConditionCard({ condition, index }: { condition: EndConditionDefinition; index: number }) {
  const { def, edit } = useCardEditor();
  const update = (mutate: (draft: EndConditionDefinition) => void) => edit((draft) => mutate(draft.endConditions[index]));
  const zonesField = (key: "zones") => (
    <Field label="Cards counted in">
      <span className="flex flex-wrap gap-2">
        {def.zones
          .filter((zone) => zone.owner === "player")
          .map((zone) => (
            <label key={zone.id} className="inline-flex items-center gap-1 text-xs text-zinc-300">
              <input type="checkbox" checked={(condition[key] ?? []).includes(zone.id)} onChange={(event) => update((draft) => void (draft[key] = event.target.checked ? [...(draft[key] ?? []), zone.id] : (draft[key] ?? []).filter((id) => id !== zone.id)))} />
              {zone.name}
            </label>
          ))}
      </span>
    </Field>
  );
  return (
    <Panel
      title={condition.label || END_CONDITION_LABELS[condition.type]}
      eyebrow={condition.type}
      actions={
        <button type="button" aria-label="Delete end condition" className="p-1 text-zinc-500 hover:text-red-300" onClick={() => edit((draft) => void draft.endConditions.splice(index, 1))}>
          <Trash2 size={14} />
        </button>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <select className={inputClass} value={condition.type} onChange={(event) => update((draft) => void (draft.type = event.target.value as EndConditionDefinition["type"]))}>
              {END_CONDITION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {END_CONDITION_LABELS[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Label">
            <input className={inputClass} value={condition.label ?? ""} onChange={(event) => update((draft) => void (draft.label = event.target.value))} />
          </Field>
        </div>
        {condition.type === "PLAYER_HAND_EMPTY" && (
          <>
            <Field label="Outcome">
              <select className={inputClass} value={condition.outcome ?? "win"} onChange={(event) => update((draft) => void (draft.outcome = event.target.value as EndConditionDefinition["outcome"]))}>
                <option value="win">That player wins (game ends)</option>
                <option value="finish">That player finishes safely (game continues)</option>
              </select>
            </Field>
            {zonesField("zones")}
          </>
        )}
        {(condition.type === "LAST_ACTIVE_PLAYER" || condition.type === "LAST_PLAYER_WITH_CARDS") && (
          <Field label="The last one">
            <select className={inputClass} value={condition.outcome ?? "lastWins"} onChange={(event) => update((draft) => void (draft.outcome = event.target.value as EndConditionDefinition["outcome"]))}>
              <option value="lastWins">wins</option>
              <option value="lastLoses">loses (everyone else wins)</option>
            </select>
          </Field>
        )}
        {condition.type === "LAST_PLAYER_WITH_CARDS" && zonesField("zones")}
        {condition.type === "FIRST_TO_SCORE" && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            Target score <ValueEditor value={condition.target} onChange={(target) => update((draft) => void (draft.target = target))} />
          </div>
        )}
        {(condition.type === "HIGHEST_SCORE" || condition.type === "CUSTOM_DECLARATIVE_CONDITION" || condition.type === "PLAYER_HAND_EMPTY") && (
          <div className="flex flex-wrap items-start gap-2 text-sm text-zinc-300">
            {condition.type === "PLAYER_HAND_EMPTY" ? "Only when" : "When"}
            <OptionalCondition value={condition.when} emptyLabel={condition.type === "PLAYER_HAND_EMPTY" ? "always" : "never"} onChange={(when) => update((draft) => void (when ? (draft.when = when) : delete draft.when))} />
          </div>
        )}
        {condition.type === "CUSTOM_DECLARATIVE_CONDITION" && (
          <div className="grid gap-2 text-sm text-zinc-300">
            <span className="flex flex-wrap items-center gap-2">
              Winners <PlayerSetEditor value={condition.winners} onChange={(winners) => update((draft) => void (draft.winners = winners))} />
            </span>
            <Toggle checked={Boolean(condition.draw)} onChange={(draw) => update((draft) => void (draft.draw = draw))} label="Counts as a draw" />
          </div>
        )}
        <p className="rounded-lg bg-black/30 px-3 py-2 text-sm italic text-zinc-300">{describeEndCondition(condition, { def })}</p>
      </div>
    </Panel>
  );
}

export function EndConditionsSection() {
  const { def, edit, mode } = useCardEditor();
  const goal = basicGoal(def.endConditions);
  return (
    <SectionShell
      section="endConditions"
      eyebrow="9 · End conditions"
      title="How the game ends"
      description="Pick a goal. Several players may finish before the game is over (as in Durak), and a game can also end in a loss for the last player or a draw."
      actions={
        mode === "advanced" ? (
          <Button size="sm" onClick={() => edit((draft) => void draft.endConditions.push({ id: `end${draft.endConditions.length + 1}`, type: "LAST_ACTIVE_PLAYER", outcome: "lastWins" }))}>
            <Plus size={14} /> Add end condition
          </Button>
        ) : undefined
      }
    >
      <div role="radiogroup" aria-label="Winning condition" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {BASIC_GOALS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={goal === option.id}
            onClick={() => edit((draft) => void (draft.endConditions = option.make()))}
            className={`rounded-2xl border p-3 text-left transition ${goal === option.id ? "border-amber-300/60 bg-amber-300/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}
          >
            <span className="block text-sm font-bold text-zinc-100">{option.label}</span>
            <span className="mt-1 block text-xs text-zinc-400">{option.description}</span>
          </button>
        ))}
      </div>
      {goal === "points" && mode === "basic" && (
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          Points to win
          <NumberField value={typeof def.endConditions[0].target === "number" ? def.endConditions[0].target : 20} min={1} max={500} label="Points to win" onChange={(target) => edit((draft) => void (draft.endConditions[0].target = target))} />
        </div>
      )}
      <div className="space-y-3">
        {def.endConditions.map((condition, index) => (
          <EndConditionCard key={`${condition.id}-${index}`} condition={condition} index={index} />
        ))}
      </div>
    </SectionShell>
  );
}
