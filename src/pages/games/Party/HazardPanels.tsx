import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { animalRegistry } from "../../../games/party/animals/registry.ts";
import { statusRegistry } from "../../../games/party/status/effects.ts";
import type {
  AnimalPhaseState,
  Match,
  Player,
} from "../../../games/party/types.ts";

// Always-visible status and summoned-animal details for one player card (no hover needed).
export function StatusChips({ match, player }: { match: Match; player: Player }) {
  useGameLanguage();
  const animals = match.animals.filter((a) => a.ownerPlayerId === player.id);
  if (!player.statusEffects.length && !animals.length) return null;
  return (
    <ul className="pp-status-chips" aria-label={`${player.name} effects`}>
      {player.statusEffects.map((effect) => {
        const definition = statusRegistry.get(effect.id);
        return (
          <li key={effect.id} className={`pp-status pp-status-${effect.id}`}>
            <b>
              {gameUi(definition.icon)} {gameUi(definition.name.toUpperCase())}
            </b>
            <span>
              {gameUi(effect.remainingTurns > 0
                ? `${effect.remainingTurns} turn${effect.remainingTurns === 1 ? "" : "s"}`
                : "final turn")}
            </span>
            <small>{gameUi(definition.summary)}</small>
          </li>
        );
      })}
      {animals.map((animal) => {
        const definition = animalRegistry.get(animal.type);
        return (
          <li key={animal.id} className="pp-status pp-status-animal">
            <b>
              {gameUi(definition.icon)} {gameUi(definition.name.toUpperCase())}
            </b>
            <span>{gameUi(animal.remainingRounds)}{gameUi(" rounds")}</span>
            <small>
              {gameUi(animal.movementPerPhase)}{gameUi(" spaces · ")}{gameUi(animal.damage)}{gameUi(" dmg · hunts others ")}</small>
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
  useGameLanguage();
  const name = (id: string | null) => match.players.find((p) => p.id === id)?.name ?? "—";
  return (
    <section className="pp-animal-phase" aria-live="polite">
      <span className="pp-eyebrow">{gameUi("ANIMAL PHASE")}</span>
      <h2>{gameUi("The wild things move.")}</h2>
      <p>{gameUi("Summoned animals hunt the nearest opponent. The minigame starts right after.")}</p>
      <ol>
        {phase.steps.map((step) => {
          const definition = animalRegistry.get(step.type);
          return (
            <li key={step.animalId}>
              <strong>
                {gameUi(definition.icon)} {gameUi(name(step.ownerPlayerId))}’s {gameUi(definition.name)}
              </strong>
              <small>
                {gameUi(step.path.length
                  ? `Moved ${step.path.length} space${step.path.length === 1 ? "" : "s"}`
                  : "Stayed put")}
                {gameUi(step.targetPlayerId ? ` toward ${name(step.targetPlayerId)}` : "")}
              </small>
              {step.hits.map((hit) => (
                <small key={hit.playerId} className="pp-animal-hit">{gameUi(" 💥 Hit ")}{gameUi(name(hit.playerId))}{gameUi(" for ")}{gameUi(hit.damage)}{gameUi(" HP ")}{gameUi(hit.knockedOut ? " · KO!" : "")}
                </small>
              ))}
              {step.despawned && <small>{gameUi("💨 Despawned — its time is up.")}</small>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
