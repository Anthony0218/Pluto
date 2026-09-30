import { animalRegistry } from "../../../games/party/animals/registry.ts";
import { statusRegistry } from "../../../games/party/status/effects.ts";
import type {
  AnimalPhaseState,
  Match,
  Player,
} from "../../../games/party/types.ts";

// Always-visible status and summoned-animal details for one player card (no hover needed).
export function StatusChips({ match, player }: { match: Match; player: Player }) {
  const animals = match.animals.filter((a) => a.ownerPlayerId === player.id);
  if (!player.statusEffects.length && !animals.length) return null;
  return (
    <ul className="pp-status-chips" aria-label={`${player.name} effects`}>
      {player.statusEffects.map((effect) => {
        const definition = statusRegistry.get(effect.id);
        return (
          <li key={effect.id} className={`pp-status pp-status-${effect.id}`}>
            <b>
              {definition.icon} {definition.name.toUpperCase()}
            </b>
            <span>
              {effect.remainingTurns > 0
                ? `${effect.remainingTurns} turn${effect.remainingTurns === 1 ? "" : "s"}`
                : "final turn"}
            </span>
            <small>{definition.summary}</small>
          </li>
        );
      })}
      {animals.map((animal) => {
        const definition = animalRegistry.get(animal.type);
        return (
          <li key={animal.id} className="pp-status pp-status-animal">
            <b>
              {definition.icon} {definition.name.toUpperCase()}
            </b>
            <span>{animal.remainingRounds} rounds</span>
            <small>
              {animal.movementPerPhase} spaces · {animal.damage} dmg · hunts others
            </small>
          </li>
        );
      })}
    </ul>
  );
}

// Turn-panel summary while the Animal Phase animates on the board.
export function AnimalPhasePanel({
  match,
  phase,
}: {
  match: Match;
  phase: AnimalPhaseState;
}) {
  const name = (id: string | null) => match.players.find((p) => p.id === id)?.name ?? "—";
  return (
    <section className="pp-animal-phase" aria-live="polite">
      <span className="pp-eyebrow">ANIMAL PHASE</span>
      <h2>The wild things move.</h2>
      <p>Summoned animals hunt the nearest opponent. The minigame starts right after.</p>
      <ol>
        {phase.steps.map((step) => {
          const definition = animalRegistry.get(step.type);
          return (
            <li key={step.animalId}>
              <strong>
                {definition.icon} {name(step.ownerPlayerId)}’s {definition.name}
              </strong>
              <small>
                {step.path.length
                  ? `Moved ${step.path.length} space${step.path.length === 1 ? "" : "s"}`
                  : "Stayed put"}
                {step.targetPlayerId ? ` toward ${name(step.targetPlayerId)}` : ""}
              </small>
              {step.hits.map((hit) => (
                <small key={hit.playerId} className="pp-animal-hit">
                  💥 Hit {name(hit.playerId)} for {hit.damage} HP
                  {hit.knockedOut ? " · KO!" : ""}
                </small>
              ))}
              {step.despawned && <small>💨 Despawned — its time is up.</small>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
