/**
 * Event dispatcher + rule engine: WHEN event, IF condition, THEN effects.
 *
 * Events are queued and processed in order. For each event the matching rules
 * run from highest to lowest priority (ties keep their definition order). A
 * rule with `stopProcessing` consumes the event for lower-priority rules —
 * this is how a special rule ("7 beats Ace", priority 100) overrides a
 * general one ("higher rank wins", priority 10).
 */
import { evaluateCondition } from "./conditions.ts";
import { EVENT_LABELS } from "./describe.ts";
import { runEffects } from "./effects.ts";
import type { Runtime, Scope } from "./runtime.ts";
import type { GameDefinition, GameEvent, RuleDefinition } from "./types.ts";

/** Rules for an event type in evaluation order. */
export function rulesFor(def: GameDefinition, type: GameEvent["type"]): RuleDefinition[] {
  return def.rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.enabled !== false && rule.trigger === type)
    .sort((a, b) => (b.rule.priority ?? 0) - (a.rule.priority ?? 0) || a.index - b.index)
    .map(({ rule }) => rule);
}

export function scopeForEvent(event: GameEvent): Scope {
  return { event, played: event.cardId, target: event.targetCardId, actor: event.type.startsWith("ACTION") || event.type.startsWith("CARD_PLAY") ? event.playerId : undefined };
}

/** Processes queued events (and the events their rules cause) until the queue is empty. */
export function drainEvents(rt: Runtime) {
  while (rt.queue.length) {
    const event = rt.queue.shift()!;
    rt.tick(`event ${event.type}`);
    const rules = rulesFor(rt.def, event.type);
    if (!rules.length) continue;
    const previousDepth = rt.depth;
    rt.depth = event.depth;
    try {
      for (const rule of rules) {
        const scope = scopeForEvent(event);
        rt.tick(`rule “${rule.name}”`);
        if (!evaluateCondition(rule.condition, rt, scope)) continue;
        rt.log("rule", `Rule “${rule.name}” (priority ${rule.priority ?? 0}) fired when ${EVENT_LABELS[event.type]}.`, { ruleId: rule.id, event: event.type, playerId: event.playerId });
        runEffects(rule.effects, rt, scope);
        if (rule.stopProcessing || rt.endRequest || rt.state.status === "finished") break;
      }
    } finally {
      rt.depth = previousDepth;
    }
    if (rt.state.status === "finished") {
      rt.queue.length = 0;
      return;
    }
  }
}
