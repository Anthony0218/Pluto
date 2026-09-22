import { FACTION_TURN_ORDER } from "./clanData";

import { TERRAIN } from "./terrain";

import type {
  AttackResult,
  BattleState,
  DamageRange,
  DefenseActionId,
  FactionId,
  HitEffect,
  MovementResult,
  MultiAttackResult,
  Position,
  Trap,
  Unit,
} from "./types";

import type { TerrainMask } from "./terrainMask";

export function distance(
  a: Position,
  b: Position,
  mapAspectRatio: number,
): number {
  const dx = b.x - a.x;

  const dy = (b.y - a.y) * mapAspectRatio;

  return Math.hypot(dx, dy);
}

export function angleFromTo(
  a: Position,
  b: Position,
  mapAspectRatio: number,
): number {
  const dx = b.x - a.x;

  const dy = (b.y - a.y) * mapAspectRatio;

  return ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
}

function angularDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;

  return Math.min(diff, 360 - diff);
}

export function getMovementPath(
  start: Position,
  end: Position,
  samples = 100,
): Position[] {
  const points: Position[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;

    points.push({
      x: start.x + (end.x - start.x) * t,

      y: start.y + (end.y - start.y) * t,
    });
  }

  return points;
}

function livingFactions(state: BattleState): FactionId[] {
  return FACTION_TURN_ORDER.filter((faction) =>
    state.units.some((unit) => unit.faction === faction),
  );
}

function updateWinnerByElimination(state: BattleState): BattleState {
  const living = livingFactions(state);

  if (living.length === 1) {
    return {
      ...state,
      winner: living[0],
    };
  }

  return state;
}

function trapAtPosition(
  state: BattleState,
  unit: Unit,
  position: Position,
  mapAspectRatio: number,
): Trap | null {
  return (
    state.traps.find(
      (trap) =>
        trap.ownerFaction !== unit.faction &&
        distance(trap.position, position, mapAspectRatio) <= trap.radius,
    ) ?? null
  );
}

export function moveUnitWithTerrain(
  state: BattleState,
  unitId: string,
  target: Position,
  terrainMask: TerrainMask,
  mapAspectRatio: number,
): MovementResult {
  const unit = state.units.find((current) => current.id === unitId);

  if (
    !unit ||
    unit.faction !== state.activeFaction ||
    unit.hasMoved ||
    state.winner
  ) {
    return {
      state,
      moved: false,
      died: false,
      message: "This unit cannot move now.",
    };
  }

  const path = getMovementPath(unit.position, target);

  let movementCost = 0;

  for (let i = 1; i < path.length; i++) {
    const previous = path[i - 1];

    const current = path[i];

    const terrainType = terrainMask.getTerrainAtPosition(current);

    const terrain = TERRAIN[terrainType];

    if (!terrain.walkable) {
      return {
        state,
        moved: false,
        died: false,
        message: "The route is blocked.",
      };
    }

    if (terrain.lethal) {
      return {
        state: updateWinnerByElimination({
          ...state,

          units: state.units.filter(
            (currentUnit) => currentUnit.id !== unit.id,
          ),
        }),

        moved: true,
        died: true,
        message: `${unit.name} fell into the gorge.`,
      };
    }

    movementCost +=
      distance(previous, current, mapAspectRatio) * terrain.movementMultiplier;

    if (movementCost > unit.moveRange) {
      return {
        state,
        moved: false,
        died: false,
        message: `${unit.name} cannot move that far.`,
      };
    }
  }

  const facing = angleFromTo(unit.position, target, mapAspectRatio);

  const trap = trapAtPosition(state, unit, target, mapAspectRatio);

  const trapDamage = trap?.damage ?? 0;

  let units = state.units
    .map((current) =>
      current.id === unit.id
        ? {
            ...current,
            position: target,
            hasMoved: true,
            facingAngle: facing,
            defenseMode: null,
            guardTargetId: null,
            health: Math.max(0, current.health - trapDamage),
          }
        : current,
    )
    .filter((current) => current.health > 0);

  const nextState = updateWinnerByElimination({
    ...state,
    units,
    traps: trap
      ? state.traps.filter((currentTrap) => currentTrap.id !== trap.id)
      : state.traps,
  });

  return {
    state: nextState,
    moved: true,
    died: !nextState.units.some((current) => current.id === unit.id),
    trapTriggered: Boolean(trap),
    trapDamage,
    message: trap
      ? `${unit.name} triggered a rune trap and took ${trapDamage} damage.`
      : `${unit.name} moved.`,
  };
}

export function getHitChance(
  attacker: Unit,
  defender: Unit,
  terrainMask: TerrainMask,
  mapAspectRatio: number,
  accuracyModifier = 0,
): number {
  const currentDistance = distance(
    attacker.position,
    defender.position,
    mapAspectRatio,
  );

  if (currentDistance > attacker.attackRange) {
    return 0;
  }

  const rangeRatio = currentDistance / attacker.attackRange;

  let probability =
    0.58 +
    attacker.impact * 0.028 +
    attacker.agility * 0.012 -
    defender.agility * 0.018 -
    rangeRatio * 0.25 +
    accuracyModifier;

  const attackerTerrain = terrainMask.getTerrainAtPosition(attacker.position);

  const defenderTerrain = terrainMask.getTerrainAtPosition(defender.position);

  if (attackerTerrain === "highGround") {
    probability += 0.1;
  }

  if (defenderTerrain === "forest") {
    probability -= 0.12;
  }

  switch (defender.defenseMode) {
    case "brace":
      probability -= 0.05;
      break;

    case "dodge":
      probability -= 0.25;
      break;

    case "counter":
      probability -= 0.04;
      break;

    case "cover":
      probability -= 0.2;
      break;

    case "fortify":
      probability -= 0.12;
      break;

    case "evade":
      probability -= 0.16;
      break;

    case "shield": {
      const incoming = angleFromTo(
        defender.position,
        attacker.position,
        mapAspectRatio,
      );

      if (angularDifference(defender.facingAngle, incoming) <= 60) {
        probability -= 0.3;
      }
      break;
    }
  }

  return Math.max(0.05, Math.min(0.95, probability));
}

export function getDamageRange(
  attacker: Unit,
  defender: Unit,
  damageMultiplier = 1,
): DamageRange {
  let reduction = defender.toughness * 0.035;

  switch (defender.defenseMode) {
    case "brace":
      reduction += 0.16;
      break;

    case "shield":
      reduction += 0.06;
      break;

    case "cover":
      reduction += 0.06;
      break;

    case "fortify":
      reduction += 0.25;
      break;
  }

  const boost = attacker.damageBoostTurns > 0 ? 1.35 : 1;

  const base =
    attacker.damage * boost * damageMultiplier * Math.max(0.3, 1 - reduction);

  return {
    min: Math.max(1, Math.round(base * 0.8)),

    max: Math.max(1, Math.round(base)),
  };
}

export function canAttack(
  attacker: Unit,
  defender: Unit,
  mapAspectRatio: number,
): boolean {
  if (attacker.hasActed || attacker.faction === defender.faction) {
    return false;
  }

  return (
    distance(attacker.position, defender.position, mapAspectRatio) <=
    attacker.attackRange
  );
}

export function canMeleeAttack(
  attacker: Unit,
  defender: Unit,
  mapAspectRatio: number,
): boolean {
  return (
    !attacker.hasActed &&
    attacker.faction !== defender.faction &&
    distance(attacker.position, defender.position, mapAspectRatio) <= 6
  );
}

export function findRayTarget(
  state: BattleState,
  attacker: Unit,
  angle: number,
  mapAspectRatio: number,
  coneHalfAngle = 10,
): Unit | null {
  const normalized = ((angle % 360) + 360) % 360;

  let best: {
    unit: Unit;
    diff: number;
    distance: number;
  } | null = null;

  for (const enemy of state.units.filter(
    (unit) =>
      unit.faction !== attacker.faction &&
      canAttack(attacker, unit, mapAspectRatio),
  )) {
    const enemyAngle = angleFromTo(
      attacker.position,
      enemy.position,
      mapAspectRatio,
    );

    const diff = angularDifference(enemyAngle, normalized);

    const d = distance(attacker.position, enemy.position, mapAspectRatio);

    if (
      diff <= coneHalfAngle &&
      (!best || diff < best.diff || (diff === best.diff && d < best.distance))
    ) {
      best = {
        unit: enemy,
        diff,
        distance: d,
      };
    }
  }

  return best?.unit ?? null;
}

function randomDamage(range: DamageRange): number {
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

function applyGuardSplit(
  state: BattleState,
  defender: Unit,
  damage: number,
  mapAspectRatio: number,
): {
  units: Unit[];
  defenderDamage: number;
} {
  const guardian = state.units.find(
    (unit) =>
      unit.faction === defender.faction &&
      unit.defenseMode === "guard" &&
      unit.guardTargetId === defender.id &&
      distance(unit.position, defender.position, mapAspectRatio) <= 10,
  );

  if (!guardian) {
    return {
      units: state.units,

      defenderDamage: damage,
    };
  }

  const absorbed = Math.max(1, Math.round(damage * 0.5));

  return {
    defenderDamage: damage - absorbed,

    units: state.units.map((unit) =>
      unit.id === guardian.id
        ? {
            ...unit,
            health: Math.max(0, unit.health - absorbed),
          }
        : unit,
    ),
  };
}

function postAttackDefenseMovement(
  units: Unit[],
  defenderId: string,
  attacker: Unit,
  mapAspectRatio: number,
): Unit[] {
  const defender = units.find((unit) => unit.id === defenderId);

  if (!defender || defender.defenseMode !== "evade") {
    return units;
  }

  const angle = angleFromTo(
    attacker.position,
    defender.position,
    mapAspectRatio,
  );

  const rad = (angle * Math.PI) / 180;

  return units.map((unit) =>
    unit.id === defender.id
      ? {
          ...unit,

          position: {
            x: Math.max(2, Math.min(98, unit.position.x + Math.cos(rad) * 3)),

            y: Math.max(
              2,
              Math.min(
                98,
                unit.position.y + (Math.sin(rad) * 3) / mapAspectRatio,
              ),
            ),
          },
        }
      : unit,
  );
}

function applyCounter(
  units: Unit[],
  defenderBefore: Unit,
  attackerBefore: Unit,
  mapAspectRatio: number,
): Unit[] {
  if (
    defenderBefore.defenseMode !== "counter" ||
    distance(defenderBefore.position, attackerBefore.position, mapAspectRatio) >
      6
  ) {
    return units;
  }

  const counterDamage = Math.max(1, Math.round(defenderBefore.damage * 0.35));

  return units.map((unit) =>
    unit.id === attackerBefore.id
      ? {
          ...unit,

          health: Math.max(0, unit.health - counterDamage),
        }
      : unit,
  );
}

export function attackUnit(
  state: BattleState,
  attackerId: string,
  defenderId: string,
  terrainMask: TerrainMask,
  mapAspectRatio: number,
  options?: {
    damageMultiplier?: number;
    accuracyModifier?: number;
    knockback?: number;
  },
): AttackResult {
  const attacker = state.units.find((unit) => unit.id === attackerId);

  const defender = state.units.find((unit) => unit.id === defenderId);

  if (
    !attacker ||
    !defender ||
    state.winner ||
    attacker.faction !== state.activeFaction ||
    !canAttack(attacker, defender, mapAspectRatio)
  ) {
    return {
      state,
      hit: false,
      damage: 0,
      hitChance: 0,
      targetId: defenderId,
    };
  }

  const hitChance = getHitChance(
    attacker,
    defender,
    terrainMask,
    mapAspectRatio,
    options?.accuracyModifier ?? 0,
  );

  const hit = Math.random() < hitChance;

  const damageRange = getDamageRange(
    attacker,
    defender,
    options?.damageMultiplier ?? 1,
  );

  const damage = hit ? randomDamage(damageRange) : 0;

  const guard = hit
    ? applyGuardSplit(state, defender, damage, mapAspectRatio)
    : {
        units: state.units,
        defenderDamage: 0,
      };

  let units = guard.units.map((unit) => {
    if (unit.id === attacker.id) {
      return {
        ...unit,
        hasActed: true,
        facingAngle: angleFromTo(
          attacker.position,
          defender.position,
          mapAspectRatio,
        ),
      };
    }

    if (unit.id === defender.id && hit) {
      return {
        ...unit,

        health: Math.max(0, unit.health - guard.defenderDamage),
      };
    }

    return unit;
  });

  if (hit && options?.knockback) {
    const angle = angleFromTo(
      attacker.position,
      defender.position,
      mapAspectRatio,
    );

    const rad = (angle * Math.PI) / 180;

    units = units.map((unit) =>
      unit.id === defender.id
        ? {
            ...unit,

            position: {
              x: Math.max(
                1,
                Math.min(
                  99,
                  unit.position.x + Math.cos(rad) * options.knockback!,
                ),
              ),

              y: Math.max(
                1,
                Math.min(
                  99,
                  unit.position.y +
                    (Math.sin(rad) * options.knockback!) / mapAspectRatio,
                ),
              ),
            },
          }
        : unit,
    );
  }

  units = postAttackDefenseMovement(
    units,
    defender.id,
    attacker,
    mapAspectRatio,
  );

  units = applyCounter(units, defender, attacker, mapAspectRatio);

  units = units.filter((unit) => unit.health > 0);

  return {
    state: updateWinnerByElimination({
      ...state,
      units,
    }),

    hit,
    damage,
    hitChance,
    targetId: defender.id,
  };
}

export function meleeAttack(
  state: BattleState,
  attackerId: string,
  defenderId: string,
  timingScore: number,
  terrainMask: TerrainMask,
  mapAspectRatio: number,
): AttackResult {
  const attacker = state.units.find((unit) => unit.id === attackerId);
  const defender = state.units.find((unit) => unit.id === defenderId);

  if (
    !attacker ||
    !defender ||
    !canMeleeAttack(attacker, defender, mapAspectRatio)
  ) {
    return { state, hit: false, damage: 0, hitChance: 0, targetId: defenderId };
  }

  const score = Math.max(0, Math.min(1, timingScore));

  return attackUnit(
    state,
    attackerId,
    defenderId,
    terrainMask,
    mapAspectRatio,
    {
      damageMultiplier: 0.6 + score * 0.95,
      accuracyModifier: -0.05 + score * 0.22,
    },
  );
}

export function sweepAttack(
  state: BattleState,
  attackerId: string,
  angle: number,
  mapAspectRatio: number,
): MultiAttackResult {
  const attacker = state.units.find((unit) => unit.id === attackerId);

  if (!attacker) {
    return {
      state,
      hits: [],
    };
  }

  const hits: HitEffect[] = [];

  const affected = state.units.filter(
    (unit) =>
      unit.faction !== attacker.faction &&
      distance(attacker.position, unit.position, mapAspectRatio) <=
        Math.min(attacker.attackRange, 10) &&
      angularDifference(
        angleFromTo(attacker.position, unit.position, mapAspectRatio),
        angle,
      ) <= 35,
  );

  let units = state.units.map((unit) => {
    const target = affected.find((enemy) => enemy.id === unit.id);

    if (!target) {
      return unit;
    }

    const damage = Math.max(
      1,
      Math.round(
        attacker.damage *
          (attacker.damageBoostTurns > 0 ? 1.35 : 1) *
          0.55 *
          Math.max(0.4, 1 - target.toughness * 0.03),
      ),
    );

    hits.push({
      targetId: target.id,
      damage,
      hit: true,
      position: {
        ...target.position,
      },
    });

    return {
      ...unit,

      health: Math.max(0, unit.health - damage),
    };
  });

  units = units
    .map((unit) =>
      unit.id === attacker.id
        ? {
            ...unit,
            hasActed: true,
            facingAngle: angle,
          }
        : unit,
    )
    .filter((unit) => unit.health > 0);

  return {
    state: updateWinnerByElimination({
      ...state,
      units,
    }),

    hits,
  };
}

export function areaAttackAtPoint(
  state: BattleState,
  attackerId: string,
  impactPoint: Position,
  mapAspectRatio: number,
  radius = 5,
): MultiAttackResult {
  const attacker = state.units.find((unit) => unit.id === attackerId);

  if (!attacker) {
    return {
      state,
      hits: [],
    };
  }

  const hits: HitEffect[] = [];

  let units = state.units.map((unit) => {
    if (unit.faction === attacker.faction) {
      return unit;
    }

    const d = distance(impactPoint, unit.position, mapAspectRatio);

    if (d > radius) {
      return unit;
    }

    const falloff = Math.max(0.45, 1 - d / (radius * 1.5));

    const damage = Math.max(
      1,
      Math.round(
        attacker.damage *
          (attacker.damageBoostTurns > 0 ? 1.35 : 1) *
          0.7 *
          falloff,
      ),
    );

    hits.push({
      targetId: unit.id,
      damage,
      hit: true,
      position: {
        ...unit.position,
      },
    });

    return {
      ...unit,
      health: Math.max(0, unit.health - damage),
    };
  });

  units = units
    .map((unit) =>
      unit.id === attacker.id
        ? {
            ...unit,
            hasActed: true,
          }
        : unit,
    )
    .filter((unit) => unit.health > 0);

  return {
    state: updateWinnerByElimination({
      ...state,
      units,
    }),

    hits,
  };
}

export function archerAttackAtPoint(
  state: BattleState,
  attackerId: string,
  impactPoint: Position,
  mapAspectRatio: number,
): AttackResult {
  const attacker = state.units.find((unit) => unit.id === attackerId);

  if (!attacker) {
    return {
      state,
      hit: false,
      damage: 0,
      hitChance: 0,
      targetId: null,
    };
  }

  const target = state.units
    .filter((unit) => unit.faction !== attacker.faction)
    .map((unit) => ({
      unit,

      d: distance(impactPoint, unit.position, mapAspectRatio),
    }))
    .sort((a, b) => a.d - b.d)
    .find((entry) => entry.d <= 2.8)?.unit;

  if (!target) {
    return {
      state: spendAttackIntoAir(state, attacker.id),

      hit: false,

      damage: 0,

      hitChance: 0,

      targetId: null,
    };
  }

  const range = getDamageRange(attacker, target);

  const damage = randomDamage(range);

  let units = state.units
    .map((unit) => {
      if (unit.id === attacker.id) {
        return {
          ...unit,
          hasActed: true,
        };
      }

      if (unit.id === target.id) {
        return {
          ...unit,
          health: Math.max(0, unit.health - damage),
        };
      }

      return unit;
    })
    .filter((unit) => unit.health > 0);

  return {
    state: updateWinnerByElimination({
      ...state,
      units,
    }),

    hit: true,

    damage,

    hitChance: 1,

    targetId: target.id,
  };
}

export function chargeAttack(
  state: BattleState,
  attackerId: string,
  angle: number,
  terrainMask: TerrainMask,
  mapAspectRatio: number,
): {
  state: BattleState;
  hit: HitEffect | null;
  end: Position;
} {
  const attacker = state.units.find((unit) => unit.id === attackerId);

  if (!attacker) {
    return {
      state,
      hit: null,
      end: {
        x: 0,
        y: 0,
      },
    };
  }

  const range = Math.max(4, Math.min(attacker.moveRange * 0.65, 12));

  const rad = (angle * Math.PI) / 180;

  const end: Position = {
    x: Math.max(1, Math.min(99, attacker.position.x + Math.cos(rad) * range)),

    y: Math.max(
      1,
      Math.min(
        99,
        attacker.position.y + (Math.sin(rad) * range) / mapAspectRatio,
      ),
    ),
  };

  const moved = moveUnitWithTerrain(
    state,
    attacker.id,
    end,
    terrainMask,
    mapAspectRatio,
  );

  if (!moved.moved || moved.died) {
    return {
      state: moved.state,
      hit: null,
      end,
    };
  }

  const movedAttacker = moved.state.units.find(
    (unit) => unit.id === attacker.id,
  );

  if (!movedAttacker) {
    return {
      state: moved.state,
      hit: null,
      end,
    };
  }

  const target = moved.state.units
    .filter((unit) => unit.faction !== movedAttacker.faction)
    .map((unit) => ({
      unit,

      d: distance(movedAttacker.position, unit.position, mapAspectRatio),
    }))
    .sort((a, b) => a.d - b.d)
    .find((entry) => entry.d <= 5)?.unit;

  if (!target) {
    return {
      state: {
        ...moved.state,

        units: moved.state.units.map((unit) =>
          unit.id === attacker.id
            ? {
                ...unit,
                hasActed: true,
              }
            : unit,
        ),
      },

      hit: null,

      end,
    };
  }

  const result = attackUnit(
    moved.state,
    attacker.id,
    target.id,
    terrainMask,
    mapAspectRatio,
    {
      damageMultiplier: 1.25,
      accuracyModifier: 0.08,
    },
  );

  return {
    state: result.state,

    hit: result.hit
      ? {
          targetId: target.id,
          damage: result.damage,
          hit: true,
          position: {
            ...target.position,
          },
        }
      : null,

    end,
  };
}

export function applyDefenseAction(
  state: BattleState,
  unitId: string,
  mode: DefenseActionId,
  guardTargetId: string | null = null,
): BattleState {
  return {
    ...state,

    units: state.units.map((unit) => {
      if (
        unit.id !== unitId ||
        unit.faction !== state.activeFaction ||
        unit.hasActed
      ) {
        return unit;
      }

      return {
        ...unit,

        hasActed: true,

        hasMoved: mode === "fortify" ? true : unit.hasMoved,

        defenseMode: mode,

        guardTargetId: mode === "guard" ? guardTargetId : null,
      };
    }),
  };
}

export function healTarget(
  state: BattleState,
  casterId: string,
  targetId: string,
  amount = 14,
): BattleState {
  const caster = state.units.find((unit) => unit.id === casterId);
  const target = state.units.find((unit) => unit.id === targetId);
  if (
    !caster ||
    !target ||
    caster.faction !== state.activeFaction ||
    caster.hasActed ||
    target.faction !== caster.faction
  )
    return state;
  return {
    ...state,
    units: state.units.map((unit) => {
      if (unit.id === caster.id && unit.id === target.id) {
        return {
          ...unit,
          hasActed: true,
          health: Math.min(unit.maxHealth, unit.health + amount),
        };
      }
      if (unit.id === caster.id) return { ...unit, hasActed: true };
      if (unit.id === target.id)
        return {
          ...unit,
          health: Math.min(unit.maxHealth, unit.health + amount),
        };
      return unit;
    }),
  };
}

export function boostTarget(
  state: BattleState,
  casterId: string,
  targetId: string,
  turns = 2,
): BattleState {
  const caster = state.units.find((unit) => unit.id === casterId);
  const target = state.units.find((unit) => unit.id === targetId);
  if (
    !caster ||
    !target ||
    caster.faction !== state.activeFaction ||
    caster.hasActed ||
    target.faction !== caster.faction
  )
    return state;
  return {
    ...state,
    units: state.units.map((unit) => {
      if (unit.id === caster.id && unit.id === target.id) {
        return {
          ...unit,
          hasActed: true,
          damageBoostTurns: Math.max(unit.damageBoostTurns, turns),
        };
      }
      if (unit.id === caster.id) return { ...unit, hasActed: true };
      if (unit.id === target.id)
        return {
          ...unit,
          damageBoostTurns: Math.max(unit.damageBoostTurns, turns),
        };
      return unit;
    }),
  };
}

export function burnTarget(
  state: BattleState,
  casterId: string,
  targetId: string,
  initialDamage = 7,
  burnDamage = 4,
  burnTurns = 2,
): BattleState {
  const caster = state.units.find((unit) => unit.id === casterId);
  const target = state.units.find((unit) => unit.id === targetId);
  if (
    !caster ||
    !target ||
    caster.faction !== state.activeFaction ||
    caster.hasActed ||
    target.faction === caster.faction
  )
    return state;
  const units = state.units
    .map((unit) => {
      if (unit.id === caster.id) return { ...unit, hasActed: true };
      if (unit.id === target.id)
        return {
          ...unit,
          health: Math.max(0, unit.health - initialDamage),
          burnTurns: Math.max(unit.burnTurns, burnTurns),
          burnDamage: Math.max(unit.burnDamage, burnDamage),
        };
      return unit;
    })
    .filter((unit) => unit.health > 0);
  return updateWinnerByElimination({ ...state, units });
}

export function placeTrap(
  state: BattleState,
  casterId: string,
  position: Position,
): BattleState {
  const caster = state.units.find((unit) => unit.id === casterId);
  if (!caster || caster.faction !== state.activeFaction || caster.hasActed)
    return state;
  const trap: Trap = {
    id: `trap-${state.round}-${casterId}-${state.traps.length + 1}`,
    ownerFaction: caster.faction,
    ownerUnitId: caster.id,
    position,
    radius: 2.7,
    damage: 12,
  };
  return {
    ...state,
    traps: [...state.traps, trap],
    units: state.units.map((unit) =>
      unit.id === caster.id ? { ...unit, hasActed: true } : unit,
    ),
  };
}

export function teleportCaster(
  state: BattleState,
  casterId: string,
  position: Position,
  terrainMask: TerrainMask,
): BattleState {
  const caster = state.units.find((unit) => unit.id === casterId);
  if (!caster || caster.faction !== state.activeFaction || caster.hasActed)
    return state;
  const terrain = TERRAIN[terrainMask.getTerrainAtPosition(position)];
  if (!terrain.walkable || terrain.lethal) return state;
  return {
    ...state,
    units: state.units.map((unit) =>
      unit.id === caster.id
        ? {
            ...unit,
            position,
            hasMoved: true,
            hasActed: true,
            defenseMode: null,
            guardTargetId: null,
          }
        : unit,
    ),
  };
}

export function spendAttackIntoAir(
  state: BattleState,
  attackerId: string,
): BattleState {
  return {
    ...state,

    units: state.units.map((unit) =>
      unit.id === attackerId
        ? {
            ...unit,
            hasActed: true,
          }
        : unit,
    ),
  };
}

export function finishUnit(state: BattleState, unitId: string): BattleState {
  return {
    ...state,

    units: state.units.map((unit) =>
      unit.id === unitId && unit.faction === state.activeFaction
        ? {
            ...unit,
            hasMoved: true,
            hasActed: true,
          }
        : unit,
    ),
  };
}

function factionAtObjective(
  state: BattleState,
  faction: FactionId,
  mapAspectRatio: number,
): boolean {
  return state.units.some(
    (unit) =>
      unit.faction === faction &&
      distance(unit.position, state.objective.position, mapAspectRatio) <=
        state.objective.radius,
  );
}

function nextLivingFaction(state: BattleState): {
  faction: FactionId;
  wrapped: boolean;
} {
  const currentIndex = FACTION_TURN_ORDER.indexOf(state.activeFaction);

  for (let step = 1; step <= FACTION_TURN_ORDER.length; step++) {
    const rawIndex = currentIndex + step;

    const index = rawIndex % FACTION_TURN_ORDER.length;

    const faction = FACTION_TURN_ORDER[index];

    if (state.units.some((unit) => unit.faction === faction)) {
      return {
        faction,

        wrapped: rawIndex >= FACTION_TURN_ORDER.length,
      };
    }
  }

  return {
    faction: state.activeFaction,

    wrapped: false,
  };
}

export function endTurn(
  state: BattleState,
  mapAspectRatio: number,
  victoryMode: "legacy" | "none" = "legacy",
): BattleState {
  if (state.winner) {
    return state;
  }

  const contenders = FACTION_TURN_ORDER.filter((faction) =>
    factionAtObjective(state, faction, mapAspectRatio),
  );

  if (
    victoryMode === "legacy" &&
    contenders.length === 1 &&
    contenders[0] === state.activeFaction
  ) {
    return {
      ...state,

      objective: {
        ...state.objective,
        controlledBy: state.activeFaction,
      },

      winner: state.activeFaction,
    };
  }

  const next = nextLivingFaction(state);

  const transitioned: BattleState = {
    ...state,
    round: next.wrapped ? state.round + 1 : state.round,
    activeFaction: next.faction,
    objective: {
      ...state.objective,
      controlledBy: contenders.length === 1 ? contenders[0] : null,
    },
  };

  const units = transitioned.units
    .map((unit) => {
      if (unit.faction !== next.faction) return unit;
      const burnDamage = unit.burnTurns > 0 ? unit.burnDamage : 0;
      return {
        ...unit,
        health: Math.max(0, unit.health - burnDamage),
        burnTurns: Math.max(0, unit.burnTurns - 1),
        burnDamage: unit.burnTurns > 1 ? unit.burnDamage : 0,
        damageBoostTurns: Math.max(0, unit.damageBoostTurns - 1),
        hasMoved: false,
        hasActed: false,
        defenseMode: null,
        guardTargetId: null,
      };
    })
    .filter((unit) => unit.health > 0);

  return updateWinnerByElimination({ ...transitioned, units });
}
