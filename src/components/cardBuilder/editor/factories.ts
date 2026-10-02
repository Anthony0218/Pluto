import { getConditionType } from "@/games/cards/engine/conditions";
import { getEffectType } from "@/games/cards/engine/effects";
import type { ConditionNode, EffectDefinition } from "@/games/cards/engine/types";

/* New nodes pre-filled with each parameter's registry default. */

export function newCondition(type: string): ConditionNode {
  const definition = getConditionType(type);
  const node: ConditionNode = { type };
  for (const param of definition?.params ?? []) if (!param.optional && param.default !== undefined) (node as Record<string, unknown>)[param.key] = structuredClone(param.default);
  return node;
}

export function newEffect(type: string): EffectDefinition {
  const definition = getEffectType(type);
  const effect: EffectDefinition = { type };
  for (const param of definition?.params ?? []) {
    if (param.optional || param.default === undefined) {
      if (!param.optional && param.kind === "effects") effect[param.key] = [];
      continue;
    }
    effect[param.key] = structuredClone(param.default);
  }
  return effect;
}
