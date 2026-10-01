/**
 * Generic phase manager. Phases come from the definition; nothing here knows
 * about attack/defend or reveal/compare. Leaving a phase runs its exit
 * effects and emits PHASE_ENDED; entering runs entry effects and emits
 * PHASE_STARTED (rules on that event see the state after the entry effects).
 */
import { evaluateCondition } from "./conditions.ts";
import { runEffects } from "./effects.ts";
import type { Runtime } from "./runtime.ts";

export function enterPhase(rt: Runtime, phaseId: string) {
  const { def, state } = rt;
  const next = def.phases.find((phase) => phase.id === phaseId);
  if (!next) throw new Error(`Phase “${phaseId}” does not exist.`);
  const previous = def.phases.find((phase) => phase.id === state.currentPhase);
  if (previous) {
    runEffects(previous.onExit, rt, {});
    rt.emit({ type: "PHASE_ENDED", phase: previous.id });
  }
  state.currentPhase = next.id;
  rt.log("info", `Phase: ${next.name}.`);
  runEffects(next.onEnter, rt, {});
  rt.emit({ type: "PHASE_STARTED", phase: next.id });
}

/** The first transition of the current phase whose condition holds. */
export function nextTransition(rt: Runtime): string | undefined {
  const phase = rt.def.phases.find((entry) => entry.id === rt.state.currentPhase);
  if (!phase) return undefined;
  for (const transition of phase.transitions) {
    if (evaluateCondition(transition.when, rt, {})) return transition.to;
  }
  return undefined;
}
