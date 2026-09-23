import type {
  HorrorMoveRecord,
  HorrorState,
} from "./horrorChess";

export type HorrorStats = {
  currentInfected: number;
  currentCursed: number;
  currentHot: number;
  currentlyFrozen: boolean;
  currentlyDoomed: number;

  infectionSpreads: number;
  curseTriggers: number;
  fireTriggers: number;
  freezeTriggers: number;
  deaths: number;

  mostChaoticMove:
    | HorrorMoveRecord
    | null;

  moments: HorrorMoveRecord[];
};

export function buildHorrorStats(
  records: HorrorMoveRecord[],
  state: HorrorState,
): HorrorStats {
  let mostChaoticMove:
    | HorrorMoveRecord
    | null = null;

  let mostChaos = -1;

  const moments: HorrorMoveRecord[] = [];

  for (const record of records) {
    const event = record.event;

    const chaos =
      event.infectionsAdded.length +
      (event.becameCursed ? 2 : 0) +
      (event.curseTriggered ? 3 : 0) +
      (event.fireTriggered ? 3 : 0) +
      (event.frozenSquare ? 2 : 0) +
      event.deaths.length * 4 +
      event.hotSpawned.length;

    if (chaos > mostChaos) {
      mostChaos = chaos;
      mostChaoticMove = record;
    }

    if (
      event.curseTriggered ||
      event.fireTriggered ||
      event.frozenSquare ||
      event.deaths.length > 0 ||
      event.hotSpawned.length > 0 ||
      event.infectionsAdded.length > 0 ||
      event.becameCursed
    ) {
      moments.push(record);
    }
  }

  return {
    currentInfected:
      state.infectedSquares.length,

    currentCursed:
      state.cursedSquares.length,

    currentHot:
      state.hotSquares.length,

    currentlyFrozen:
      state.frozen !== null,

    currentlyDoomed:
      state.doomed.length,

    infectionSpreads:
      state.infectionSpreadCount,

    curseTriggers:
      state.curseTriggers,

    fireTriggers:
      state.fireTriggers,

    freezeTriggers:
      state.freezeTriggers,

    deaths:
      state.deaths,

    mostChaoticMove:
      mostChaos > 0
        ? mostChaoticMove
        : null,

    moments,
  };
}
