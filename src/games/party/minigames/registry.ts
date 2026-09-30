import { Registry } from "../content/registry.ts";
import type { MinigameType } from "../types.ts";
import type { MinigameDefinition, Random } from "./types.ts";

export class MinigameRegistry extends Registry<MinigameDefinition> {
  register(definition: MinigameDefinition): void {
    if (!definition.id.trim() || !definition.name.trim())
      throw new Error("Minigames need an id and a name.");
    if (!(definition.durationSeconds > 0))
      throw new Error(`${definition.id}: duration must be positive.`);
    super.register(definition);
  }
  pool(gameType: MinigameType): MinigameDefinition[] {
    return this.all().filter((d) => d.gameType === gameType);
  }
}

// Server-side random pick that avoids repeating the previous minigame whenever an alternative exists.
export function selectMinigame(
  pool: readonly Pick<MinigameDefinition, "id">[],
  previousId: string | null,
  random: Random,
): string {
  if (!pool.length) throw new Error("No minigames are registered.");
  const fresh = pool.filter((d) => d.id !== previousId);
  const candidates = fresh.length ? fresh : pool;
  const index = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(random() * candidates.length)),
  );
  return candidates[index].id;
}
