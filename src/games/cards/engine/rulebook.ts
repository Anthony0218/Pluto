/**
 * Facts generated from the structured definition. They are shown next to the
 * creator's own rulebook text (never mixed into it) and power the
 * "How this template is configured" pages.
 */
import { SUIT_NAMES, deckSize, describeRankRange } from "../cards/card.ts";
import { describeCondition } from "./conditions.ts";
import { EVENT_LABELS, describePlayer, describeValue, phaseName, zoneName } from "./describe.ts";
import { describeEffects } from "./effects.ts";
import { describeEndCondition } from "./endConditions.ts";
import type { DescribeContext } from "./params.ts";
import { rulesFor } from "./rules.ts";
import type { ActionDefinition, EffectDefinition, GameDefinition, PhaseDefinition, RuleDefinition, ZoneDefinition } from "./types.ts";

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export const numberWord = (value: number) => NUMBER_WORDS[value] ?? String(value);

export interface RulebookFact {
  topic: "players" | "deck" | "setup" | "phases" | "winning" | "settings";
  text: string;
}

function dealFacts(def: GameDefinition, steps: EffectDefinition[], ctx: DescribeContext): string[] {
  const out: string[] = [];
  for (const step of steps) {
    if (step.type === "deal") {
      const target = zoneName(String(step.to), ctx).toLowerCase();
      if (step.count === "all") out.push(`Deal all cards evenly into each player's ${target}.`);
      else if (typeof step.count === "number") out.push(`Deal ${numberWord(step.count)} card${step.count === 1 ? "" : "s"} to each player.`);
      else {
        const setting = def.settings?.find((entry) => entry.key === (step.count as { setting?: string })?.setting);
        if (setting?.type === "integer") out.push(`Deal ${numberWord(setting.default)} cards to each player (setting “${setting.label}”, ${setting.min}–${setting.max}).`);
        else out.push(`Deal ${describeValue(step.count as never, ctx)} cards to each player.`);
      }
    } else if (step.type === "setTrumpSuit") {
      out.push(step.card ? "Reveal a card from the deck; its suit is trump." : `Trump suit: ${String(step.suit)}.`);
    } else if (step.type === "if" && Array.isArray(step.then)) {
      out.push(...dealFacts(def, step.then as EffectDefinition[], ctx));
    }
  }
  return out;
}

export function generateRulebookFacts(def: GameDefinition): RulebookFact[] {
  const ctx: DescribeContext = { def };
  const facts: RulebookFact[] = [];
  const { min, max } = def.players;
  facts.push({ topic: "players", text: `Players: ${min === max ? min : `${min}–${max}`}` });
  const size = deckSize(def.deck);
  const allSuits = def.deck.suits.length === 4;
  facts.push({
    topic: "deck",
    text: `Deck: ${size} cards — ${describeRankRange(def.deck.ranks)} in ${allSuits ? "all four suits" : def.deck.suits.map((suit) => SUIT_NAMES[suit]).join(", ")}${def.deck.copies > 1 ? `, ${numberWord(def.deck.copies)} copies` : ""}.`,
  });
  facts.push({ topic: "deck", text: `Rank order (low → high): ${def.deck.rankOrder.filter((rank) => def.deck.ranks.includes(rank)).join(" < ")}` });
  if (def.setup.shuffle) facts.push({ topic: "setup", text: "Shuffle the deck." });
  for (const text of dealFacts(def, def.setup.steps, ctx)) facts.push({ topic: "setup", text });
  facts.push({ topic: "setup", text: `${describePlayer(def.setup.startingPlayer ?? { seat: 0 }, ctx).replace(/^the /, "The ")} goes first.` });
  const order = def.phases.map((phase) => phase.name).join(" → ");
  facts.push({ topic: "phases", text: `Turn structure: ${order}.` });
  for (const end of def.endConditions) facts.push({ topic: "winning", text: describeEndCondition(end, ctx) });
  for (const setting of def.settings ?? []) {
    const value = setting.type === "boolean" ? (setting.default ? "on" : "off") : setting.type === "select" ? (setting.options.find((option) => option.value === setting.default)?.label ?? setting.default) : String(setting.default);
    facts.push({ topic: "settings", text: `${setting.label}: ${value} by default.` });
  }
  return facts;
}

/** "WHEN a card is played, IF …, THEN …". */
export function describeRule(rule: RuleDefinition, ctx: DescribeContext = {}): string {
  const when = EVENT_LABELS[rule.trigger] ?? rule.trigger;
  const condition = rule.condition ? `, IF ${describeCondition(rule.condition, ctx)}` : "";
  return `WHEN ${when}${condition}, THEN ${describeEffects(rule.effects, ctx)}.`;
}

export function describeAction(action: ActionDefinition, ctx: DescribeContext = {}): string {
  const who = action.actors === "all" ? "Any player" : action.actors === "current" ? "The current player" : `The ${action.actors.roles.join(" or ")}`;
  const parts = [`${who} may “${action.label}”`];
  if (action.source) parts.push(`with a card from their ${zoneName(action.source, ctx).toLowerCase()}`);
  if (action.target) parts.push(`onto a card in ${zoneName(action.target.zone.zone, ctx).toLowerCase()}${action.target.where ? ` where ${describeCondition(action.target.where, ctx)}` : ""}`);
  if (action.condition) parts.push(`when ${describeCondition(action.condition, ctx)}`);
  if (action.cardCondition) parts.push(`if ${describeCondition(action.cardCondition, ctx)}`);
  const then = action.effects.length ? `; then ${describeEffects(action.effects, ctx)}` : "";
  return `${parts.join(" ")}${then}.`;
}

export function describePhase(phase: PhaseDefinition, ctx: DescribeContext = {}): string {
  const actions = phase.automatic ? "Runs automatically." : `Actions: ${phase.allowedActions.map((id) => ctx.def?.actions.find((action) => action.id === id)?.label ?? id).join(", ") || "none"}.`;
  const enter = phase.onEnter.length ? ` On entry: ${describeEffects(phase.onEnter, ctx)}.` : "";
  const exits = phase.transitions.length
    ? ` Then: ${phase.transitions.map((transition) => `${transition.when ? `when ${describeCondition(transition.when, ctx)} → ` : "otherwise → "}${phaseName(transition.to, ctx)}`).join("; ")}.`
    : "";
  return `${actions}${enter}${exits}`;
}

export function describeZoneDefinition(zone: ZoneDefinition): string {
  const owner = zone.owner === "game" ? "Shared" : "One per player";
  const visibility = { public: "everyone sees the cards", owner: "only the owner sees the cards", hidden: "cards are face down" }[zone.visibility];
  return `${owner}; ${visibility}; ${zone.ordering === "ordered" ? "keeps its order" : "order does not matter"}.`;
}

export interface ConfigurationSection {
  id: "deck" | "zones" | "setup" | "phases" | "rules" | "events" | "winning";
  title: string;
  items: { label: string; text: string; badge?: string }[];
}

/** Everything needed for a "How this template is configured" page. */
export function explainConfiguration(def: GameDefinition): ConfigurationSection[] {
  const ctx: DescribeContext = { def };
  const facts = generateRulebookFacts(def);
  const eventsUsed = [...new Set(def.rules.map((rule) => rule.trigger))];
  return [
    { id: "deck", title: "Deck", items: facts.filter((fact) => fact.topic === "deck").map((fact) => ({ label: "Deck", text: fact.text })) },
    { id: "zones", title: "Zones", items: def.zones.map((zone) => ({ label: zone.name, text: describeZoneDefinition(zone), badge: zone.kind })) },
    {
      id: "setup",
      title: "Setup",
      items: [
        { label: "Deck goes to", text: `${zoneName(def.setup.deckZone, ctx)}${def.setup.shuffle ? ", shuffled" : ""}.` },
        ...def.setup.steps.map((step, index) => ({ label: `Step ${index + 1}`, text: `${describeEffects([step], ctx)}.` })),
        { label: "First phase", text: phaseName(def.setup.firstPhase, ctx) },
      ],
    },
    {
      id: "phases",
      title: "Phases & actions",
      items: [
        ...def.phases.map((phase) => ({ label: phase.name, text: describePhase(phase, ctx), badge: phase.automatic ? "automatic" : phase.autoPass ? "auto-pass" : undefined })),
        ...def.actions.map((action) => ({ label: `Action: ${action.label}`, text: describeAction(action, ctx), badge: action.type })),
      ],
    },
    {
      id: "rules",
      title: "Rules",
      items: def.rules.length
        ? eventsUsed.flatMap((event) => rulesFor(def, event).map((rule) => ({ label: rule.name, text: describeRule(rule, ctx), badge: `priority ${rule.priority ?? 0}${rule.stopProcessing ? " · stops lower" : ""}` })))
        : [{ label: "No event rules", text: "Everything happens through phases, actions and their conditions." }],
    },
    {
      id: "events",
      title: "Events",
      items: def.events.length ? def.events.map((event) => ({ label: event.type, text: event.description })) : [{ label: "Default events", text: "The engine emits the standard events; no rules listen to them." }],
    },
    { id: "winning", title: "Win / lose", items: def.endConditions.map((end) => ({ label: end.label ?? end.type, text: describeEndCondition(end, ctx), badge: end.type })) },
  ];
}
