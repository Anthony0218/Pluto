import type {
  Army,
  Battle,
  BattleOrder,
  BattlePlan,
  BattlePosition,
  Campaign,
  Formation,
  UnitKind,
} from "./types.ts";
import {
  UNIT_STATS,
  armyHealth,
  commandHouse,
  finishBattle,
  troopCount,
  woundedCount,
} from "./battle.ts";
import { armyLoyalty } from "./politics.ts";
import { castleBonus } from "./estates.ts";
import { neighbors } from "./world.ts";
import { commandBonus } from "./realm.ts";

export const UNIT_KINDS: UnitKind[] = [
  "levies",
  "spearmen",
  "archers",
  "heavy",
  "cavalry",
];
export const UNIT_NAMES: Record<UnitKind, string> = {
  levies: "Footsoldiers",
  spearmen: "Spearmen",
  archers: "Archers",
  heavy: "Heavy infantry",
  cavalry: "Cavalry",
};
export const ORDER_NAMES: Record<BattleOrder, string> = {
  hold: "Hold",
  advance: "Advance",
  flank: "Flank",
  volley: "Volley",
  retreat: "Retreat",
};
export const ORDER_HELP: Record<BattleOrder, string> = {
  hold: "Brace the front, protect the rear, and recover fatigue. Spearmen stop cavalry charges.",
  advance:
    "Press the front line. Cavalry charges on open ground; exposed archers fight poorly in melee.",
  flank:
    "Flank-position troops try to reach the enemy rear. Spearmen and difficult terrain can stop cavalry.",
  volley:
    "Archers concentrate fire while infantry protects them. Forests shorten their reach.",
  retreat:
    "Leave the field with survivors and wounded. Enemy cavalry can inflict pursuit losses.",
};
export const UNIT_HELP: Record<
  UnitKind,
  { strong: string; weak: string; position: BattlePosition }
> = {
  levies: {
    strong: "Exposed archers; affordable front-line protection",
    weak: "Heavy infantry and flanking cavalry",
    position: "front",
  },
  spearmen: {
    strong: "Cavalry, especially when holding the front",
    weak: "Archers and heavy infantry",
    position: "front",
  },
  archers: {
    strong: "Footsoldiers and spearmen from a protected rear",
    weak: "Cavalry or infantry reaching them; forests",
    position: "rear",
  },
  heavy: {
    strong: "Footsoldiers and spearmen; holding the front",
    weak: "Rear attacks; fatigue and slow movement",
    position: "front",
  },
  cavalry: {
    strong: "Exposed archers and flanks on open ground; pursuit",
    weak: "Braced spearmen, forests, mountains, rivers, castles",
    position: "flank",
  },
};
export const defaultPosition = (kind: UnitKind): BattlePosition =>
  UNIT_HELP[kind].position;
export const defaultPlan = (order: BattleOrder = "advance"): BattlePlan => ({
  order,
  positions: Object.fromEntries(UNIT_KINDS.map((k) => [k, defaultPosition(k)])),
});
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export function unitCounter(kind: UnitKind, enemy: UnitKind, braced = false) {
  if (kind === "spearmen" && enemy === "cavalry") return braced ? 1.6 : 1.3;
  if (kind === "cavalry" && enemy === "spearmen") return braced ? 0.5 : 0.7;
  if (kind === "cavalry" && enemy === "archers") return 1.45;
  if (kind === "archers" && ["levies", "spearmen"].includes(enemy)) return 1.2;
  if (kind === "heavy" && ["levies", "spearmen"].includes(enemy)) return 1.25;
  if (kind === "levies" && enemy === "heavy") return 0.8;
  return 1;
}
export function terrainPower(
  s: Campaign,
  hex: string,
  kind: UnitKind,
  defender: boolean,
) {
  const d = s.districts.find((d) => d.id === hex)!;
  let value = 1;
  if (kind === "cavalry") {
    if (d.biome === "forest") value *= 0.65;
    else if (d.biome === "mountains") value *= 0.6;
    else if (d.biome === "hills") value *= 0.85;
    else if (d.biome === "river" && !defender) value *= d.road ? 0.8 : 0.6;
    else if (d.biome === "plains") value *= 1.15;
    if (!defender && d.castle) value *= 0.75;
  }
  if (kind === "archers" && d.biome === "forest") value *= 0.75;
  if (defender && ["hills", "mountains"].includes(d.biome))
    value *= kind === "archers" ? 1.25 : 1.15;
  if (!defender && d.biome === "river") value *= d.road ? 0.95 : 0.85;
  return value;
}
export function terrainExplanation(s: Campaign, hex: string) {
  const d = s.districts.find((d) => d.id === hex)!;
  const notes = [
    d.biome === "forest"
      ? "Forest: cavalry −35%, archers −25%."
      : d.biome === "mountains"
        ? "Mountains: cavalry −40%; defender infantry +15%, archers +25%."
        : d.biome === "hills"
          ? "Hills: cavalry −15%; defender infantry +15%, archers +25%."
          : d.biome === "river"
            ? `River: attackers slowed${d.road ? "; the road provides a ford" : "; cavalry suffers most"}.`
            : d.biome === "plains"
              ? "Open ground: cavalry +15%."
              : "No special troop terrain bonus.",
  ];
  if (d.castle)
    notes.push(
      `Level ${d.castle.level} castle: defender +${Math.round(castleBonus(d) * 100)}% protection; attacking cavalry −25%.`,
    );
  if (d.city)
    notes.push(
      "Friendly city: food supplies and reserve reinforcements; faster wound recovery afterward.",
    );
  return notes;
}
function fit(f: Formation) {
  return f.count > 0 && !f.routed && !f.escaped;
}
function initialMorale(s: Campaign, a: Army) {
  return clamp(a.morale + (armyLoyalty(s, a) - 50) * 0.15, 0, 100);
}
export function previewArmies(
  s: Campaign,
  a: Army,
  enemy: Army,
  hex: string,
  formations?: Formation[],
) {
  const armies = [a, enemy];
  const powers = armies.map((army, side) => {
    const other = armies[1 - side];
    const targets = UNIT_KINDS.filter((k) => other.troops[k] > 0);
    const power =
      UNIT_KINDS.reduce((n, k) => {
        const f = formations?.find((f) => f.army === army.id && f.kind === k);
        const count = f ? (fit(f) ? f.count : 0) : army.troops[k];
        const counter = targets.length
          ? targets.reduce(
              (v, t) => v + unitCounter(k, t) * other.troops[t],
              0,
            ) / Math.max(1, troopCount(other))
          : 1;
        return (
          n +
          count *
            UNIT_STATS[k].power *
            counter *
            terrainPower(s, hex, k, side === 1) *
            (0.35 + (0.65 * (f?.morale ?? initialMorale(s, army))) / 100) *
            (1 - (f?.fatigue ?? army.fatigue) / 200) *
            (0.55 + 0.45 * army.supply)
            * commandBonus(s, army)
        );
      }, 0) *
      (side === 1
        ? 1 + castleBonus(s.districts.find((d) => d.id === hex)!)
        : 1);
    const live = formations?.filter((f) => f.army === army.id);
    const healthy = live
      ? live.reduce((n, f) => n + Math.floor(f.count), 0)
      : troopCount(army);
    const wounded =
      woundedCount(army) +
      (live?.reduce((n, f) => n + (f.wounded ?? 0), 0) ?? 0);
    const morale = live?.length
      ? live.reduce((n, f) => n + f.count * f.morale, 0) / Math.max(1, healthy)
      : initialMorale(s, army);
    return {
      army: army.id,
      name: army.name,
      healthy,
      wounded,
      health: live
        ? Math.round((100 * healthy) / Math.max(1, healthy + wounded))
        : armyHealth(army),
      morale: Math.round(morale),
      loyalty: Math.round(armyLoyalty(s, army)),
      supply: Math.round(army.supply * 100),
      power: Math.round(power),
    };
  });
  return {
    sides: powers,
    chance: Math.round(
      (100 * powers[0].power) / Math.max(1, powers[0].power + powers[1].power),
    ),
  };
}
export function battleForecast(s: Campaign, b: Battle) {
  return previewArmies(
    s,
    s.armies.find((a) => a.id === b.armies[0])!,
    s.armies.find((a) => a.id === b.armies[1])!,
    b.hex,
    b.formations,
  );
}
export function botBattlePlan(
  s: Campaign,
  b: Battle,
  army: string,
): BattlePlan {
  const own = b.formations.filter((f) => f.army === army && fit(f));
  const enemy = b.formations.filter((f) => f.army !== army && fit(f));
  const count = own.reduce((n, f) => n + f.count, 0);
  const morale =
    own.reduce((n, f) => n + f.count * f.morale, 0) / Math.max(1, count);
  const cavalry = own.find((f) => f.kind === "cavalry")?.count ?? 0;
  const spears = enemy.find((f) => f.kind === "spearmen")?.count ?? 0;
  const d = s.districts.find((d) => d.id === b.hex)!;
  const order: BattleOrder =
    morale < 28
      ? "retreat"
      : cavalry > spears * 1.25 &&
          ["plains", "desert"].includes(d.biome) &&
          !d.castle
        ? "flank"
        : own.some((f) => f.kind === "archers" && f.count > count * 0.25)
          ? "volley"
          : b.armies[1] === army && (b.rounds?.round ?? 1) % 3 !== 0
            ? "hold"
            : "advance";
  return defaultPlan(order);
}
export function recordCasualties(f: Formation, n: number) {
  const loss = Math.min(Math.floor(f.count), Math.max(0, Math.round(n)));
  const dead = Math.round(loss * 0.35);
  f.count -= loss;
  f.dead = (f.dead ?? 0) + dead;
  f.wounded = (f.wounded ?? 0) + loss - dead;
  return loss;
}
function deploy(b: Battle, id: string, plan: BattlePlan) {
  const side = b.armies.indexOf(id);
  for (const f of b.formations.filter((f) => f.army === id)) {
    f.position = plan.positions[f.kind] ?? defaultPosition(f.kind);
    f.x =
      side === 0
        ? f.position === "rear"
          ? 18
          : 38
        : f.position === "rear"
          ? 82
          : 62;
    f.y = f.position === "flank" ? 16 : 35 + UNIT_KINDS.indexOf(f.kind) * 8;
    f.facing = side === 0 ? 0 : 180;
    f.order =
      plan.order === "retreat"
        ? "withdraw"
        : plan.order === "hold"
          ? "hold"
          : plan.order === "flank"
            ? "charge"
            : "attack";
  }
}
export function resolveBattleRound(s: Campaign, b: Battle) {
  const r = b.rounds;
  if (
    !r ||
    b.phase !== "combat" ||
    !b.armies.every((id) => r.committed.includes(id))
  )
    return;
  const lines: string[] = [];
  const armies = b.armies.map((id) => s.armies.find((a) => a.id === id)!);
  for (const a of armies) deploy(b, a.id, r.plans[a.id]);
  const retreats = armies.filter((a) => r.plans[a.id].order === "retreat");
  if (retreats.length) {
    for (const a of retreats) {
      const enemy = armies.find((e) => e.id !== a.id)!;
      const cav = b.formations
        .filter((f) => f.army === enemy.id && f.kind === "cavalry" && fit(f))
        .reduce((n, f) => n + f.count, 0);
      const pursuit =
        retreats.length === 2
          ? 0
          : clamp(
              0.02 + (cav / Math.max(1, troopCount(a))) * 0.025,
              0.02,
              0.08,
            );
      let losses = 0;
      for (const f of b.formations.filter((f) => f.army === a.id)) {
        losses += recordCasualties(f, f.count * pursuit);
        f.escaped = true;
      }
      lines.push(
        `${a.name} retreats: ${losses} pursuit casualties; wounded travel with the survivors.`,
      );
    }
    r.log.unshift(`Round ${r.round}: ${lines.join(" ")}`);
    finishBattle(
      s,
      b,
      retreats.length === 2
        ? undefined
        : armies.find((a) => !retreats.includes(a))!.id,
    );
    return;
  }
  const losses = new Map<string, number>();
  const actualLosses = new Map<string, number>();
  const shocks = new Map<string, number>();
  const gains = new Map<string, number>();
  const frontBroken = (id: string) => {
    const front = b.formations.filter(
      (f) => f.army === id && f.position === "front",
    );
    return (
      !front.length ||
      front.filter(fit).reduce((n, f) => n + f.count, 0) <
        front.reduce((n, f) => n + f.initial, 0) * 0.25
    );
  };
  const foodBoost = new Map<string, number>();
  const d = s.districts.find((d) => d.id === b.hex)!;
  for (const [side, a] of armies.entries()) {
    const h = s.houses.find((h) => h.id === a.house)!;
    const controller = s.houses.find((h) => h.id === (d.occupation ?? d.owner));
    const food =
      side === 1 &&
      d.city &&
      controller?.nation === a.origin &&
      h.stock.grain >= 2;
    foodBoost.set(a.id, food ? 0.1 : 0);
    if (food) {
      h.stock.grain -= 2;
      lines.push(`${a.name} receives 2 food from city supplies.`);
    }
  }
  for (const f of b.formations.filter(fit)) {
    const a = armies.find((a) => a.id === f.army)!;
    const other = armies.find((a) => a.id !== f.army)!;
    const order = r.plans[a.id].order,
      enemyOrder = r.plans[other.id].order;
    const enemies = b.formations.filter((e) => e.army === other.id && fit(e));
    const front = enemies.filter((e) => e.position === "front");
    const flank = r.plans[a.id].order === "flank" && f.position === "flank";
    const spears = front
      .filter((e) => e.kind === "spearmen")
      .reduce((n, e) => n + e.count, 0);
    const protectingSpears = b.formations
      .filter(
        (e) =>
          e.army === a.id &&
          fit(e) &&
          e.position === "front" &&
          e.kind === "spearmen",
      )
      .reduce((n, e) => n + e.count, 0);
    const obstructed =
      f.kind === "cavalry" &&
      (["forest", "mountains", "river"].includes(d.biome) ||
        !!d.castle ||
        (spears >= f.count * 0.6 && enemyOrder === "hold"));
    const successfulFlank = flank && !obstructed;
    const targets =
      successfulFlank || frontBroken(other.id)
        ? enemies.filter((e) => e.position === "rear")
        : front;
    const target = (targets.length ? targets : enemies).sort(
      (a, c) => c.count - a.count,
    )[0];
    if (!target) continue;
    const braced = enemyOrder === "hold" && target.position === "front";
    let modifier =
      unitCounter(f.kind, target.kind, braced) *
      terrainPower(s, b.hex, f.kind, b.armies[1] === a.id);
    const exposed =
      f.kind === "archers" &&
      (f.position !== "rear" ||
        frontBroken(a.id) ||
        (enemyOrder === "flank" &&
          enemies.some(
            (e) =>
              e.position === "flank" &&
              e.kind === "cavalry" &&
              !(order === "hold" && protectingSpears >= e.count * 0.6),
          ) &&
          ["plains", "desert"].includes(d.biome) &&
          !d.castle));
    if (exposed) {
      modifier *= 0.4;
      lines.push(
        `${a.name}'s archers are exposed in melee: effectiveness −60%.`,
      );
    }
    if (successfulFlank) {
      modifier *= 1.3;
      shocks.set(target.id, (shocks.get(target.id) ?? 0) + 5);
      gains.set(f.id, 3);
      lines.push(
        `${a.name}'s ${UNIT_NAMES[f.kind].toLowerCase()} reaches the enemy rear: +30% flank strength and a morale shock.`,
      );
    } else if (flank && obstructed) {
      modifier *= 0.8;
      lines.push(
        `${a.name}'s cavalry flank is stopped by ${spears >= f.count * 0.6 && enemyOrder === "hold" ? "braced spearmen" : d.castle ? "castle defenses" : "difficult terrain"}.`,
      );
    }
    if (order === "volley") modifier *= f.kind === "archers" ? 1.3 : 0.8;
    if (order === "hold") modifier *= 0.85;
    if (order === "advance" && f.kind === "cavalry" && d.biome === "plains")
      modifier *= 1.15;
    if (f.position === "rear" && f.kind !== "archers") modifier *= 0.55;
    let defense = enemyOrder === "hold" ? 1.15 : 1;
    if (b.armies[1] === target.army) defense *= 1 + castleBonus(d);
    const damage =
      (f.count *
        0.13 *
        UNIT_STATS[f.kind].power * commandBonus(s, a) *
        modifier *
        (0.35 + f.morale * 0.0065) *
        (1 - f.fatigue / 200) *
        (0.55 + 0.45 * Math.min(1, a.supply + (foodBoost.get(a.id) ?? 0)))) /
      defense;
    losses.set(target.id, (losses.get(target.id) ?? 0) + damage);
    f.fatigue = clamp(
      f.fatigue + (order === "hold" ? -10 : flank ? 15 : 7),
      0,
      100,
    );
  }
  for (const f of b.formations) {
    const loss = recordCasualties(f, losses.get(f.id) ?? 0);
    actualLosses.set(f.army, (actualLosses.get(f.army) ?? 0) + loss);
    const a = armies.find((a) => a.id === f.army)!;
    const supported = b.formations.some(
      (e) =>
        e.army === f.army && e.id !== f.id && fit(e) && e.position === "front",
    );
    f.morale = clamp(
      f.morale -
        (loss / Math.max(1, f.initial)) * 150 -
        (shocks.get(f.id) ?? 0) +
        (gains.get(f.id) ?? 0) +
        (r.plans[f.army].order === "hold" && supported ? 2 : 0) -
        (a.supply < 0.5 ? 3 : 0),
      0,
      100,
    );
  }
  for (const a of armies) {
    const fs = b.formations.filter((f) => f.army === a.id);
    if (
      fs.reduce((n, f) => n + f.count, 0) <
        fs.reduce((n, f) => n + f.initial, 0) * 0.4 &&
      !r.commandersDown.includes(a.id)
    ) {
      r.commandersDown.push(a.id);
      for (const f of fs) f.morale = Math.max(0, f.morale - 10);
      lines.push(`${a.name}'s commander is incapacitated: morale −10.`);
    }
    for (const f of fs)
      if (f.morale < 20 || f.count < f.initial * 0.15) {
        if (!f.routed)
          lines.push(
            `${a.name}'s ${UNIT_NAMES[f.kind].toLowerCase()} breaks and retreats.`,
          );
        f.routed = true;
      }
    if (frontBroken(a.id))
      lines.push(`${a.name}'s front line has broken; the rear is exposed.`);
    const casualties = actualLosses.get(a.id) ?? 0;
    lines.push(
      `${a.name}: ${Math.round(casualties)} casualties; ${Math.round(
        fs.reduce((n, f) => n + f.count * f.morale, 0) /
          Math.max(
            1,
            fs.reduce((n, f) => n + f.count, 0),
          ),
      )} morale.`,
    );
  }
  r.log.unshift(
    `Round ${r.round} · ${armies.map((a) => `${a.name}: ${ORDER_NAMES[r.plans[a.id].order]}`).join(" vs ")}. ${[...new Set(lines)].join(" ")}`,
  );
  r.log = r.log.slice(0, 20);
  const surviving = armies.filter((a) =>
    b.formations.some((f) => f.army === a.id && fit(f)),
  );
  if (surviving.length < 2 || r.round >= 20) {
    const sorted = armies
      .map((a) => ({
        id: a.id,
        power: b.formations
          .filter((f) => f.army === a.id && fit(f))
          .reduce(
            (n, f) =>
              n +
              f.count * (0.35 + f.morale * 0.0065) * UNIT_STATS[f.kind].power,
            0,
          ),
      }))
      .sort((a, c) => c.power - a.power);
    finishBattle(s, b, sorted[0].power > 0 ? sorted[0].id : undefined);
  } else {
    r.round++;
    r.plans = {};
    r.committed = [];
  }
}
export function commitBattlePlan(
  s: Campaign,
  b: Battle,
  id: string,
  plan: BattlePlan,
) {
  const r = b.rounds!;
  r.plans[id] = structuredClone(plan);
  r.committed.push(id);
  for (const army of b.armies) {
    const a = s.armies.find((a) => a.id === army)!;
    const human =
      !a.rebel &&
      s.houses
        .find((h) => h.id === commandHouse(s, a))
        ?.reasons.includes("Human commander");
    if (!human && !r.committed.includes(army)) {
      r.plans[army] = botBattlePlan(s, b, army);
      r.committed.push(army);
    }
  }
  resolveBattleRound(s, b);
}
export function reinforcementSources(s: Campaign, b: Battle, a: Army) {
  const d = s.districts.find((d) => d.id === b.hex)!;
  const controller = s.houses.find((h) => h.id === (d.occupation ?? d.owner));
  if (
    !d.city ||
    controller?.nation !== a.origin ||
    b.armies[1] !== a.id ||
    b.rounds?.reinforced.includes(a.id)
  )
    return [];
  const nearby = [b.hex, ...neighbors(s.districts, b.hex).map((d) => d.id)];
  return s.armies.filter(
    (r) =>
      r.house === a.house &&
      r.garrison &&
      !b.armies.includes(r.id) &&
      nearby.includes(r.hex) &&
      troopCount(r) >= 600 &&
      !s.armies.some(
        (e) =>
          e.hex === r.hex &&
          e.origin !== a.origin &&
          s.wars.includes([e.origin, a.origin].sort().join("|")),
      ),
  );
}
