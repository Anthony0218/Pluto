import {
  distance,
  getMovementPath,
} from "./battleEngine";

import type {
  BattlefieldObject,
  BattleState,
  Position,
  Unit,
} from "./types";

const NON_INTERACTIVE_TYPES = new Set<BattlefieldObject["type"]>([
  "cliffEdge",
  "barricade",
  "forest",
  "trapTile",
  "mud",
  "ice",
  "riverCurrent",
  "fogArea",
]);

export function isInteractiveObject(
  object: BattlefieldObject,
): boolean {
  return object.interactive && !NON_INTERACTIVE_TYPES.has(object.type);
}

export function pointInsideObject(
  position: Position,
  object: BattlefieldObject,
  mapAspectRatio: number,
): boolean {
  return (
    distance(
      position,
      object.position,
      mapAspectRatio,
    ) <= object.radius
  );
}

export function unitCanInteractWithObject(
  unit: Unit | null,
  object: BattlefieldObject,
  mapAspectRatio: number,
): boolean {
  if (
    !unit ||
    !isInteractiveObject(object)
  ) {
    return false;
  }

  if (
    object.usesRemaining !== undefined &&
    object.usesRemaining <= 0
  ) {
    return false;
  }

  return (
    distance(
      unit.position,
      object.position,
      mapAspectRatio,
    ) <= object.interactRange
  );
}

export function getObjectMovementRule(
  unit: Unit,
  target: Position,
  objects: BattlefieldObject[],
  mapAspectRatio: number,
): {
  legal: boolean;
  reason: string;
  movementCost: number;
} {
  const path =
    getMovementPath(
      unit.position,
      target,
      80,
    );

  let movementCost = 0;

  for (
    let i = 1;
    i < path.length;
    i++
  ) {
    const previous =
      path[i - 1];

    const current =
      path[i];

    const currentObjects =
      objects.filter(
        (object) =>
          pointInsideObject(
            current,
            object,
            mapAspectRatio,
          ),
      );

    const hardBlock =
      currentObjects.find(
        (object) =>
          object.type === "riverCurrent" ||
          (object.type === "barricade" && object.active !== false) ||
          object.type === "cliffEdge",
      );

    if (hardBlock) {
      return {
        legal: false,
        reason:
          hardBlock.type === "riverCurrent"
            ? "Strong river current"
            : hardBlock.type === "barricade"
              ? "Barricade blocks the route"
              : "Cliff edge",
        movementCost,
      };
    }

    let multiplier = 1;

    if (
      currentObjects.some(
        (object) =>
          object.type === "mud",
      )
    ) {
      multiplier = Math.max(
        multiplier,
        1.65,
      );
    }

    if (
      currentObjects.some(
        (object) =>
          object.type === "forest",
      )
    ) {
      multiplier = Math.max(
        multiplier,
        1.35,
      );
    }

    if (
      currentObjects.some(
        (object) =>
          object.type === "ice",
      )
    ) {
      multiplier = Math.max(
        multiplier,
        1.12,
      );
    }

    movementCost +=
      distance(
        previous,
        current,
        mapAspectRatio,
      ) *
      multiplier;

    if (
      movementCost >
      unit.moveRange
    ) {
      return {
        legal: false,
        reason:
          multiplier > 1
            ? "Terrain slows movement beyond this unit's move range"
            : "Outside move range",
        movementCost,
      };
    }
  }

  return {
    legal: true,
    reason: "Legal move",
    movementCost,
  };
}

export function applyLandingObjectEffects(
  state: BattleState,
  unitId: string,
  position: Position,
  mapAspectRatio: number,
): {
  state: BattleState;
  messages: string[];
  damage: number;
} {
  const unit =
    state.units.find(
      (current) =>
        current.id === unitId,
    );

  if (!unit) {
    return {
      state,
      messages: [],
      damage: 0,
    };
  }

  const zones =
    state.objects.filter(
      (object) =>
        pointInsideObject(
          position,
          object,
          mapAspectRatio,
        ),
    );

  let damage = 0;
  const messages: string[] = [];
  let objects = state.objects;

  const trap =
    zones.find(
      (object) =>
        object.type === "trapTile" &&
        (object.usesRemaining ?? 1) > 0,
    );

  if (trap) {
    damage += 10;
    messages.push(
      `${unit.name} triggered ${trap.name} and took 10 damage.`,
    );

    objects =
      objects.map(
        (object) =>
          object.id === trap.id
            ? {
                ...object,
                usesRemaining: Math.max(
                  0,
                  (object.usesRemaining ?? 1) - 1,
                ),
              }
            : object,
      );
  }

  const grantsCover =
    zones.some(
      (object) =>
        object.type === "forest" ||
        object.type === "fogArea",
    );

  if (grantsCover) {
    messages.push(
      `${unit.name} is concealed and gains Cover.`,
    );
  }

  let units =
    state.units
      .map(
        (current) =>
          current.id === unitId
            ? {
                ...current,
                health: Math.max(
                  0,
                  current.health - damage,
                ),
                defenseMode:
                  grantsCover
                    ? "cover" as const
                    : current.defenseMode,
              }
            : current,
      )
      .filter(
        (current) =>
          current.health > 0,
      );

  return {
    state: {
      ...state,
      units,
      objects,
    },
    messages,
    damage,
  };
}

function updateObject(
  objects: BattlefieldObject[],
  objectId: string,
  updater: (
    object: BattlefieldObject,
  ) => BattlefieldObject,
): BattlefieldObject[] {
  return objects.map(
    (object) =>
      object.id === objectId
        ? updater(object)
        : object,
  );
}

export function applyObjectInteraction(
  state: BattleState,
  object: BattlefieldObject,
  unitId: string,
): {
  state: BattleState;
  message: string;
} {
  const actor =
    state.units.find(
      (unit) =>
        unit.id === unitId,
    );

  if (
    !actor ||
    actor.faction !== state.activeFaction ||
    actor.hasActed ||
    !isInteractiveObject(object)
  ) {
    return {
      state,
      message:
        "This unit cannot interact now.",
    };
  }

  if (
    object.usesRemaining !== undefined &&
    object.usesRemaining <= 0
  ) {
    return {
      state,
      message:
        `${object.name} has already been used.`,
    };
  }

  let message =
    `${actor.name} used ${object.name}.`;

  let objects =
    state.objects;

  let units =
    state.units.map(
      (unit) =>
        unit.id === actor.id
          ? {
              ...unit,
              hasActed: true,
            }
          : unit,
    );

  const consumeUse = () => {
    if (
      object.usesRemaining === undefined
    ) {
      return;
    }

    objects =
      updateObject(
        objects,
        object.id,
        (current) => ({
          ...current,
          usesRemaining:
            Math.max(
              0,
              (current.usesRemaining ?? 1) - 1,
            ),
        }),
      );
  };

  switch (object.type) {
    case "market":
      units =
        units.map(
          (unit) =>
            unit.id === actor.id
              ? {
                  ...unit,
                  health:
                    Math.min(
                      unit.maxHealth,
                      unit.health + 8,
                    ),
                  attackRange:
                    unit.attackRange + 2,
                  moveRange:
                    unit.moveRange + 2,
                }
              : unit,
        );

      message =
        `${actor.name} bought a field bundle: +8 HP, +2 range, +2 move.`;
      break;

    case "highGroundPlatform":
      units =
        units.map(
          (unit) =>
            unit.id === actor.id
              ? {
                  ...unit,
                  attackRange:
                    unit.attackRange + 5,
                }
              : unit,
        );

      message =
        `${actor.name} took the high-ground platform: +5 attack range.`;
      break;

    case "healingShrine":
      units =
        units.map(
          (unit) =>
            unit.id === actor.id
              ? {
                  ...unit,
                  health:
                    Math.min(
                      unit.maxHealth,
                      unit.health + 15,
                    ),
                }
              : unit,
        );

      message =
        `${actor.name} restored 15 HP at ${object.name}.`;
      break;

    case "ballista": {
      const enemies =
        units
          .filter(
            (unit) =>
              unit.faction !== actor.faction,
          )
          .map(
            (unit) => ({
              unit,
              d:
                Math.hypot(
                  unit.position.x -
                    object.position.x,
                  unit.position.y -
                    object.position.y,
                ),
            }),
          )
          .sort(
            (a, b) =>
              a.d - b.d,
          );

      const target =
        enemies[0]?.unit;

      if (target) {
        units =
          units
            .map(
              (unit) =>
                unit.id === target.id
                  ? {
                      ...unit,
                      health:
                        Math.max(
                          0,
                          unit.health - 20,
                        ),
                    }
                  : unit,
            )
            .filter(
              (unit) =>
                unit.health > 0,
            );

        message =
          `${actor.name} fired ${object.name} at ${target.name} for 20 damage.`;
      } else {
        message =
          `${object.name} has no target.`;
      }
      break;
    }

    case "capturePoint":
      return {
        state: {
          ...state,
          units,
          objects,
          objective: {
            ...state.objective,
            controlledBy:
              actor.faction,
          },
        },
        message:
          `${actor.faction} claimed ${object.name}.`,
      };

    case "watchtower":
      units =
        units.map(
          (unit) =>
            unit.id === actor.id
              ? {
                  ...unit,
                  attackRange:
                    unit.attackRange + 3,
                }
              : unit,
        );

      message =
        `${actor.name} surveyed the field: +3 attack range.`;
      break;

    case "blacksmith":
      units =
        units.map(
          (unit) =>
            unit.id === actor.id
              ? {
                  ...unit,
                  toughness:
                    unit.toughness + 2,
                }
              : unit,
        );

      message =
        `${actor.name}'s armor was reinforced: +2 Toughness.`;
      break;

    case "supplyCrate":
      consumeUse();

      units =
        units.map(
          (unit) =>
            unit.id === actor.id
              ? {
                  ...unit,
                  health:
                    Math.min(
                      unit.maxHealth,
                      unit.health + 10,
                    ),
                  moveRange:
                    unit.moveRange + 2,
                }
              : unit,
        );

      message =
        `${actor.name} opened the supply crate: +10 HP and +2 move.`;
      break;

    case "manaShrine":
      units =
        units.map(
          (unit) =>
            unit.id === actor.id
              ? {
                  ...unit,
                  attackRange:
                    unit.attackRange + 2,
                  damageBoostTurns:
                    Math.max(
                      unit.damageBoostTurns,
                      2,
                    ),
                }
              : unit,
        );

      message =
        `${actor.name} received an arcane blessing: +2 range and boosted damage for 2 turns.`;
      break;

    case "bridgeControl": {
      const nextRaised =
        !object.active;

      objects =
        updateObject(
          objects,
          object.id,
          (current) => ({
            ...current,
            active:
              nextRaised,
          }),
        );

      if (
        object.linkedObjectId
      ) {
        objects =
          updateObject(
            objects,
            object.linkedObjectId,
            (current) => ({
              ...current,
              active:
                !nextRaised,
            }),
          );
      }

      message =
        `${actor.name} ${nextRaised ? "raised" : "lowered"} the bridge gate.`;
      break;
    }

    case "bossAltar":
      consumeUse();

      units =
        units.map(
          (unit) =>
            unit.id === actor.id
              ? {
                  ...unit,
                  health:
                    Math.min(
                      unit.maxHealth,
                      unit.health + 12,
                    ),
                  damageBoostTurns:
                    Math.max(
                      unit.damageBoostTurns,
                      3,
                    ),
                }
              : unit,
        );

      message =
        `${actor.name} awakened the altar: +12 HP and a 3-turn damage blessing.`;
      break;

    case "teleportRune":
    case "jumpPad":
      if (
        object.targetPosition
      ) {
        units =
          units.map(
            (unit) =>
              unit.id === actor.id
                ? {
                    ...unit,
                    position: {
                      ...object.targetPosition!,
                    },
                    hasMoved: true,
                  }
                : unit,
          );

        message =
          object.type === "teleportRune"
            ? `${actor.name} vanished through the teleport rune.`
            : `${actor.name} launched from the jump pad.`;
      }
      break;

    case "sacredCircle":
      units =
        units.map(
          (unit) =>
            unit.id === actor.id
              ? {
                  ...unit,
                  health:
                    Math.min(
                      unit.maxHealth,
                      unit.health + 10,
                    ),
                  damageBoostTurns:
                    Math.max(
                      unit.damageBoostTurns,
                      1,
                    ),
                }
              : unit,
        );

      message =
        `${actor.name} received the sacred circle's blessing: +10 HP and empowered damage.`;
      break;

    case "cursedCircle":
      units =
        units
          .map(
            (unit) =>
              unit.id === actor.id
                ? {
                    ...unit,
                    health:
                      Math.max(
                        0,
                        unit.health - 6,
                      ),
                    damageBoostTurns:
                      Math.max(
                        unit.damageBoostTurns,
                        3,
                      ),
                  }
                : unit,
          )
          .filter(
            (unit) =>
              unit.health > 0,
          );

      message =
        `${actor.name} paid 6 HP to the cursed circle for a 3-turn damage blessing.`;
      break;

    case "cliffEdge":
    case "barricade":
    case "forest":
    case "trapTile":
    case "mud":
    case "ice":
    case "riverCurrent":
    case "fogArea":
      break;
  }

  return {
    state: {
      ...state,
      units,
      objects,
    },
    message,
  };
}
