import type { Army, Battle, Campaign, Formation, UnitKind } from "./types.ts";
import { BIOMES, NATIONS, center, neighbors } from "./world.ts";
import { armyLoyalty } from "./politics.ts";
import {
  defaultPosition,
  resolveBattleRound,
  botBattlePlan,
} from "./battleRounds.ts";
export const UNIT_STATS: Record<
  UnitKind,
  {
    power: number;
    speed: number;
    range: number;
    cost: number;
  }
> = {
  levies: { power: 0.65, speed: 2.5, range: 5, cost: 1 },
  spearmen: { power: 1, speed: 2.2, range: 6, cost: 2 },
  archers: { power: 0.85, speed: 2.5, range: 32, cost: 3 },
  heavy: { power: 1.4, speed: 1.8, range: 5, cost: 4 },
  cavalry: { power: 1.7, speed: 5, range: 6, cost: 5 },
};
export const commandHouse = (s: Campaign, a: Army) =>
  a.pledgedTo && a.delay === 0 && a.serviceUntil > s.tick
    ? a.pledgedTo
    : a.house;
export const hasHumanParticipant = (s: Campaign, b: Battle) =>
  b.armies.some((id) => {
    const a = s.armies.find((a) => a.id === id);
    return (
      !!a &&
      !a.rebel &&
      !!s.houses
        .find((h) => h.id === commandHouse(s, a))
        ?.reasons.includes("Human commander")
    );
  });
export const troopCount = (a: Army) =>
  Object.values(a.troops).reduce((a, b) => a + b, 0);
export const woundedCount = (a: Army) =>
  Object.values(a.wounded ?? {}).reduce((n, v) => n + (v ?? 0), 0);
export const armyHealth = (a: Army) =>
  Math.round(
    (100 * troopCount(a)) / Math.max(1, troopCount(a) + woundedCount(a)),
  );
export const atWar = (s: Campaign, a: Army, b: Army) =>
  a.rebel || b.rebel
    ? a.rebel !== b.rebel &&
      s.houses.find((h) => h.id === a.house)?.nation ===
        s.houses.find((h) => h.id === b.house)?.nation
    : a.house !== b.house &&
      s.wars.includes([a.origin, b.origin].sort().join("|"));
export function makeBattle(
  s: Campaign,
  a: Army,
  b: Army,
  approach: string,
): Battle {
  const from = s.districts.find((d) => d.id === approach)!,
    to = s.districts.find((d) => d.id === b.hex)!;
  const [sx, sy] = center(from),
    [tx, ty] = center(to),
    angle = Math.atan2(ty - sy, tx - sx),
    dx = Math.cos(angle),
    dy = Math.sin(angle);
  return {
    id: `battle-${++s.serial}`,
    hex: b.hex,
    armies: [a.id, b.id],
    approaches: { [a.id]: approach, [b.id]: b.hex },
    phase: "encounter",
    stood: [],
    seconds: 0,
    pauseVotes: [],
    rounds: s.turns
      ? {
          round: 1,
          plans: {},
          committed: [],
          log: [],
          commandersDown: [],
          reinforced: [],
        }
      : undefined,
    formations: [a, b].flatMap((army, side) =>
      (Object.keys(army.troops) as UnitKind[])
        .filter((k) => army.troops[k] > 0)
        .map((kind, i) => {
          const sign = side ? 1 : -1,
            offset = (i - 2) * 12,
            depth = i === 4 ? 38 : 32;
          const x = Math.max(
              4,
              Math.min(96, 50 + sign * dx * depth - dy * offset),
            ),
            y = Math.max(4, Math.min(96, 50 + sign * dy * depth + dx * offset));
          return {
            id: `${army.id}-${kind}`,
            army: army.id,
            kind,
            count: army.troops[kind],
            initial: army.troops[kind],
            x,
            y,
            facing: (angle * 180) / Math.PI + (side ? 180 : 0),
            width: 12,
            morale: Math.max(
              0,
              Math.min(100, army.morale + (armyLoyalty(s, army) - 50) * 0.15),
            ),
            fatigue: army.fatigue,
            order: "hold",
            target: [x, y],
            exit: [50 + sign * dx * 80, 50 + sign * dy * 80],
            routed: false,
            escaped: false,
            reserve: i === 4,
            position: defaultPosition(kind),
            wounded: 0,
            dead: 0,
          };
        }),
    ),
  };
}
export function escapeHex(s: Campaign, b: Battle, a: Army): string | undefined {
  const safe = neighbors(s.districts, b.hex).filter(
    (d) =>
      d.owner &&
      d.biome !== "legacy" &&
      d.biome !== "sea" &&
      !s.armies.some((enemy) => enemy.hex === d.id && atWar(s, a, enemy)),
  );
  return (
    safe.find(
      (d) => s.houses.find((h) => h.id === d.owner)?.nation === a.origin,
    )?.id ?? safe[0]?.id
  );
}
export function battlefield(s: Campaign, b: Battle) {
  const d = s.districts.find((d) => d.id === b.hex)!;
  return {
    terrain: d.biome,
    forest: d.biome === "forest",
    river: d.biome === "river",
    hill: ["hills", "mountains"].includes(d.biome),
    road: d.road,
    settlement: d.settlement,
    obstacles:
      d.biome === "mountains"
        ? [
            { x: 45, y: 10, w: 10, h: 27 },
            { x: 45, y: 63, w: 10, h: 27 },
          ]
        : d.biome === "forest"
          ? [
              { x: 35, y: 10, w: 15, h: 25 },
              { x: 58, y: 65, w: 16, h: 25 },
            ]
          : [],
  };
}
export function startCombat(b: Battle) {
  b.phase = "combat";
  for (const f of b.formations)
    if (f.order === "hold") {
      f.order = "attack";
      f.target = [50, f.y];
    }
}
const facingDiff = (a: number, b: number) =>
  Math.abs(((a - b + 540) % 360) - 180);
export function advanceBattle(s: Campaign, b: Battle, dt: number) {
  if (b.phase !== "combat") return;
  if (b.rounds) return; // Committed orders, never elapsed time, resolve modern battles.
  const humanHouses =
    s.mode === "multi"
      ? s.houses
          .filter((h) => h.reasons.includes("Human commander"))
          .map((h) => h.id)
      : s.houses
          .filter((h) => h.reasons.includes("Human commander"))
          .map((h) => h.id);
  const participantHouses = b.armies
    .map((id) => s.armies.find((a) => a.id === id))
    .filter((a): a is Army => !!a)
    .map((a) => commandHouse(s, a))
    .filter((h) => humanHouses.includes(h));
  if (
    participantHouses.length &&
    participantHouses.every((h) => b.pauseVotes.includes(h))
  )
    return;
  b.seconds += dt;
  const field = battlefield(s, b);
  const active = (f: Formation) => f.count > 0 && !f.escaped;
  const losses = new Map<string, number>();
  for (const f of b.formations.filter(active)) {
    if (f.morale < 18 || f.count < f.initial * 0.15) {
      f.routed = true;
      f.order = "withdraw";
    }
    const enemy = b.formations
      .filter((e) => e.army !== f.army && active(e) && !e.routed)
      .sort(
        (a, c) =>
          Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(c.x - f.x, c.y - f.y),
      )[0];
    const a = s.armies.find((a) => a.id === f.army)!;
    const auto = !humanHouses.includes(commandHouse(s, a));
    if (auto && !f.routed) {
      f.order = f.reserve && b.seconds < 12 ? "hold" : "attack";
      f.width = f.kind === "archers" ? 16 : 12;
    }
    if (f.order === "withdraw") {
      const dx = f.exit[0] - f.x,
        dy = f.exit[1] - f.y,
        len = Math.hypot(dx, dy);
      f.x += (dx / len) * dt * UNIT_STATS[f.kind].speed;
      f.y += (dy / len) * dt * UNIT_STATS[f.kind].speed;
      if (f.x <= 1 || f.x >= 99 || f.y <= 1 || f.y >= 99) f.escaped = true;
      continue;
    }
    if (!enemy) continue;
    const dist = Math.hypot(enemy.x - f.x, enemy.y - f.y);
    const range = field.forest
      ? Math.min(UNIT_STATS[f.kind].range, 16)
      : UNIT_STATS[f.kind].range;
    const attacks =
      f.order === "attack" || f.order === "charge" || f.order === "hold";
    let target = f.target;
    if (f.order === "attack" || f.order === "charge")
      target = [enemy.x, enemy.y];
    if (
      f.order === "move" ||
      ((f.order === "attack" || f.order === "charge") && dist > range)
    ) {
      const dx = target[0] - f.x,
        dy = target[1] - f.y,
        len = Math.hypot(dx, dy);
      if (len > 0.5) {
        let speed =
          UNIT_STATS[f.kind].speed *
          (1 - f.fatigue / 160) *
          (f.order === "charge" ? 1.65 : 1) *
          (field.forest ? 0.65 : 1) *
          (field.hill ? 0.8 : 1);
        if (
          field.river &&
          Math.abs(f.x - 50) < 7 &&
          !(field.road && Math.abs(f.y - 50) < 8)
        )
          speed *= 0.3;
        const nx = f.x + (dx / len) * speed * dt,
          ny = f.y + (dy / len) * speed * dt;
        if (
          !field.obstacles.some(
            (o) => nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h,
          )
        ) {
          f.x = nx;
          f.y = ny;
        } else {
          f.y += dt * speed * (f.y < 50 ? 1 : -1);
        }
        f.facing = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        f.fatigue = Math.min(
          100,
          f.fatigue + dt * (f.order === "charge" ? 3 : 1),
        );
      }
    } else f.fatigue = Math.max(0, f.fatigue - dt * 0.6);
    if (
      (attacks && dist <= range && !f.reserve) ||
      (attacks && dist <= range && b.seconds >= 12)
    ) {
      const angle = (Math.atan2(f.y - enemy.y, f.x - enemy.x) * 180) / Math.PI;
      const flank = facingDiff(enemy.facing, angle) > 100 ? 1.45 : 1;
      const rear =
        facingDiff(
          f.facing,
          (Math.atan2(enemy.y - f.y, enemy.x - f.x) * 180) / Math.PI,
        ) > 100
          ? 0.55
          : 1;
      const counter =
        f.kind === "cavalry" && enemy.kind === "spearmen" ? 0.55 : 1;
      const terrain =
        field.hill && b.armies.indexOf(enemy.army) === 1 ? 0.8 : 1;
      const castleDefense =
        b.armies.indexOf(enemy.army) === 1
          ? 1 / (1 + castleBonus(s.districts.find((d) => d.id === b.hex)!))
          : 1;
      const settlementDefense =
        enemy.x >= 72 && enemy.x <= 86 && enemy.y >= 36 && enemy.y <= 56
          ? field.settlement.endsWith("Keep")
            ? 0.75
            : 0.9
          : 1;
      const damage =
        f.count *
        0.012 *
        UNIT_STATS[f.kind].power *
        (f.morale / 100) *
        (1 - f.fatigue / 150) *
        (0.4 + a.supply * 0.6) *
        flank *
        rear *
        counter *
        terrain *
        settlementDefense *
        castleDefense *
        (f.kind === "archers"
          ? 1
          : Math.max(0.5, Math.min(1.35, f.width / 12))) *
        (f.order === "charge" ? 1.3 : 1) *
        dt;
      losses.set(enemy.id, (losses.get(enemy.id) ?? 0) + damage);
    }
  }
  for (const f of b.formations) {
    const n = losses.get(f.id) ?? 0;
    f.count = Math.max(0, f.count - n);
    f.morale = Math.max(
      0,
      f.morale -
        (n / Math.max(1, f.initial)) * 160 -
        dt * (s.armies.find((a) => a.id === f.army)!.supply < 0.2 ? 0.15 : 0),
    );
  }
  const remaining = b.armies.filter((id) =>
    b.formations.some(
      (f) => f.army === id && f.count > 0 && !f.routed && !f.escaped,
    ),
  );
  if (remaining.length < 2 || b.seconds >= 180) {
    const scores = b.armies
      .map((id) => ({
        id,
        score: b.formations
          .filter((f) => f.army === id && !f.escaped && !f.routed)
          .reduce((n, f) => n + f.count * f.morale, 0),
      }))
      .sort((a, b) => b.score - a.score);
    finishBattle(s, b, scores[0].score > 0 ? scores[0].id : undefined);
  }
}
import { castleBonus } from "./estates.ts";

export function finishBattle(s: Campaign, b: Battle, winner?: string) {
  if (s.appliedResults.includes(b.id)) return;
  s.appliedResults.push(b.id);
  const winning = s.armies.find((a) => a.id === winner);
  if (b.rounds) {
    s.battleReports ??= [];
    s.battleReports.unshift({
      id: b.id,
      hex: b.hex,
      winner: winning?.name,
      round: b.rounds.round,
      sides: b.armies.map((id) => {
        const a = s.armies.find((a) => a.id === id)!;
        const formations = b.formations.filter((f) => f.army === id);
        return {
          army: id,
          house: commandHouse(s, a),
          name: a.name,
          healthy: formations.reduce((n, f) => n + Math.floor(f.count), 0),
          wounded:
            woundedCount(a) +
            formations.reduce((n, f) => n + (f.wounded ?? 0), 0),
          dead: formations.reduce((n, f) => n + (f.dead ?? 0), 0),
          escaped: id !== winner && !!escapeHex(s, b, a),
          captured: 0,
        };
      }),
      log: [...b.rounds.log],
    });
    s.battleReports = s.battleReports.slice(0, 8);
  }
  for (const id of b.armies) {
    const a = s.armies.find((a) => a.id === id);
    if (!a) continue;
    const before = troopCount(a);
    for (const f of b.formations.filter((f) => f.army === id)) {
      a.troops[f.kind] = Math.floor(f.count);
      if (b.rounds) {
        a.wounded ??= {};
        a.wounded[f.kind] = (a.wounded[f.kind] ?? 0) + (f.wounded ?? 0);
      }
    }
    const armyFormations = b.formations.filter((f) => f.army === id);
    const finalMorale =
      armyFormations.reduce((n, f) => n + f.count * f.morale, 0) /
      Math.max(
        1,
        armyFormations.reduce((n, f) => n + f.count, 0),
      );
    a.morale = b.rounds
      ? Math.max(15, Math.min(100, finalMorale + (id === winner ? 8 : -5)))
      : id === winner
        ? Math.min(100, a.morale + 8)
        : 35;
    a.fatigue = 45;
    a.path = [];
    if (id !== winner) {
      const escape = escapeHex(s, b, a);
      if (escape && (troopCount(a) > 0 || woundedCount(a) > 0)) {
        a.hex = escape;
        a.garrison = false;
        a.name = `${a.name} survivors`;
      } else {
        const report = s.battleReports
          ?.find((r) => r.id === b.id)
          ?.sides.find((side) => side.army === id);
        if (report) {
          report.captured = troopCount(a) + woundedCount(a);
          report.healthy = 0;
          report.wounded = 0;
        }
        for (const k of Object.keys(a.troops) as UnitKind[]) a.troops[k] = 0;
        a.wounded = {};
      }
      if (
        winning &&
        (troopCount(a) === 0 || before - troopCount(a) > before * 0.65)
      ) {
        const commander = s.houses
          .find((h) => h.id === a.house)
          ?.family.find((p) => p.id === a.commander);
        if (commander) commander.imprisonedBy = winning.house;
      }
      const house = s.houses.find((h) => h.id === a.house)!;
      house.opinion = Math.max(0, house.opinion - 8);
      house.legitimacy = Math.max(0, house.legitimacy - 5);
    }
    s.log.unshift(
      `${a.name}: ${before - troopCount(a)} casualties, ${troopCount(a)} survivors${id !== winner ? " retreating" : ""}.`,
    );
  }
  if (winning) {
    if (b.rounds) winning.hex = b.hex;
    const d = s.districts.find((d) => d.id === b.hex)!;
    const friendlyOwner =
      s.houses.find((h) => h.id === d.owner)?.nation === winning.origin &&
      !winning.rebel;
    d.occupation = friendlyOwner ? undefined : winning.house;
    d.occupiedAt = d.occupation ? s.tick : undefined;
    d.unrest = Math.min(100, d.unrest + 15);
    if (
      winning.rebel &&
      b.hex === NATIONS.find((n) => n.id === winning.origin)?.capital
    ) {
      const crown = s.titles.find((t) => t.nation === winning.origin)!;
      crown.holder = winning.house;
      const h = s.houses.find((h) => h.id === winning.house)!;
      h.liege = null;
      h.rebellion = false;
      winning.rebel = false;
      for (const v of s.houses.filter(
        (v) => v.nation === winning.origin && v.id !== h.id,
      )) {
        v.liege = h.id;
        v.legitimacy = 45;
      }
      s.log.unshift(`${h.name} has seized the crown of ${winning.origin}.`);
    }
  }
  s.log.unshift(
    `${b.id} concluded. ${winning?.name ?? "No army"} holds the field. ${s.turns ? "Campaign turn resumes" : "Campaign time +1"}, applied once.`,
  );
  if (!s.turns) s.tick += 1; // Turn campaigns already paid the committed turn; tactical time does not advance the campaign.
  s.battles = s.battles.filter((e) => e.id !== b.id);
  s.armies = s.armies.filter(
    (a) => a.garrison || troopCount(a) > 0 || woundedCount(a) > 0,
  );
  if (s.turns && winning && winner === b.armies[0]) {
    const remaining = s.armies.find(
      (a) =>
        a.hex === b.hex &&
        a.id !== winning.id &&
        troopCount(a) > 0 &&
        atWar(s, winning, a),
    );
    if (remaining) {
      const defender = s.houses.find((h) => h.id === remaining.house)!;
      s.districts.find((d) => d.id === b.hex)!.occupation = undefined;
      s.turns.pending.push({
        id: `reaction-${++s.serial}`,
        kind: "attack",
        from: winning.pledgedTo ?? winning.house,
        to: defender.liege ?? defender.id,
        army: winning.id,
        hex: b.hex,
        created: s.tick,
      });
      s.log.unshift(
        "Further defenders remain; occupation waits for their response.",
      );
    }
  }
}
export function autoResolve(s: Campaign, b: Battle) {
  if (b.rounds) {
    b.phase = "combat";
    for (let i = 0; i < 20 && !s.appliedResults.includes(b.id); i++) {
      for (const id of b.armies) b.rounds.plans[id] = botBattlePlan(s, b, id);
      b.rounds.committed = [...b.armies];
      resolveBattleRound(s, b);
    }
    return;
  }
  const d = s.districts.find((d) => d.id === b.hex)!;
  const scores = b.armies.map((id, i) => {
    const a = s.armies.find((a) => a.id === id)!;
    const power = (Object.keys(a.troops) as UnitKind[]).reduce(
      (n, k) =>
        n +
        a.troops[k] *
          UNIT_STATS[k].power *
          (d.biome === "forest" && k === "cavalry"
            ? 0.7
            : d.biome === "forest" && k === "archers"
              ? 0.75
              : d.biome === "river" && k === "cavalry"
                ? 0.65
                : 1),
      0,
    );
    return (
      ((power *
        (0.5 + a.supply * 0.5) *
        Math.max(
          0,
          Math.min(100, a.morale + (armyLoyalty(s, a) - 50) * 0.15),
        )) /
        100) *
      (1 - a.fatigue / 200) *
      (i === 1 && BIOMES[d.biome].cost > 1 ? 1.2 : 1) *
      (i === 1 ? 1 + castleBonus(d) : 1)
    );
  });
  const winner = scores[0] >= scores[1] ? 0 : 1;
  for (const f of b.formations) {
    f.count *= b.armies.indexOf(f.army) === winner ? 0.82 : 0.38;
    f.routed = b.armies.indexOf(f.army) !== winner;
  }
  finishBattle(s, b, b.armies[winner]);
}
