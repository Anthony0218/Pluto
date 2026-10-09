import type {
  Actor,
  Army,
  Campaign,
  Command,
  House,
  Resource,
  UnitKind,
  WarReason,
} from "./types.ts";
import {
  armyLoyalty,
  armyRebellionRisk,
  insultGrievances,
  conquestTargets,
  recordWar,
  routeBlockers,
  WAR_REASONS,
} from "./politics.ts";
import {
  BALANCE,
  BIOMES,
  COASTAL_ISLANDS,
  NATIONS,
  RESOURCES,
  WORLD_HEX_COUNT,
  findPath,
  hexDistance,
  makeWorld,
  neighbors,
  production,
  stock,
} from "./world.ts";
import {
  UNIT_STATS,
  advanceBattle,
  atWar,
  commandHouse,
  hasHumanParticipant,
  autoResolve,
  escapeHex,
  finishBattle,
  makeBattle,
  startCombat,
  troopCount,
  woundedCount,
} from "./battle.ts";
import {
  UNIT_KINDS,
  commitBattlePlan,
  defaultPosition,
  reinforcementSources,
  recordCasualties,
  botBattlePlan,
} from "./battleRounds.ts";
export const SAVE_KEY = "medieval-kingdoms-edravane-v2";
const roles = ["crown", "resource", "frontier", "trade", "claimant"] as const;
const minorNames = [
  ["Brookmere", "Redwatch", "Larkwell", "Duskridge"],
  ["Ironvein", "Cragshield", "Passwater", "Greyspire"],
  ["Pearlwick", "Tideguard", "Sailhaven", "Deepmar"],
  ["Oakroot", "Briarwatch", "Mossgate", "Ravenholt"],
  ["Pineward", "Frostwatch", "Ambertrail", "Nightmere"],
  ["Thalorin", "Evershade", "Lethariel", "Myrathen"],
  ["Coravel", "Sunwatch", "Velisara", "Theryn"],
  ["Kargath", "Rokhguard", "Zarukai", "Mordazh"],
];
import {
  establishEstates,
  castleBonus,
  HARVEST_COOLDOWN,
  harvestYield,
  splitTroops,
} from "./estates.ts";

import {
  activeTurnHouse,
  addReaction,
  authorizeTurn,
  completeTurn,
  defendingArmies,
  initializeTurns,
  queueAttack,
  resolveReaction,
} from "./turns.ts";
import { advanceRealm, campaignRound, councilSkill, event, growDynasties, initializeStrategy, ruler, season, succeed, successionPreview } from "./realm.ts";
import { feedArmy, realmNation, updateIntelligence } from "./logistics.ts";
import { advanceStrategy, objectiveFor, strategyCommand, truce, validatePeace, warScore } from "./campaignStrategy.ts";
import { validateStrategySave } from "./strategySave.ts";
import { advanceAgreements, agreementBotCommands, agreementCommand, economicFactors, initializeAgreements, integrateTerritory, noteLevies, routeBenefits } from "./agreements.ts";
import { validateAgreementsSave } from "./agreementsSave.ts";
import { ageDue, calendarYear } from "./calendar.ts";

export function createCampaign(
  nationId = "auremarch",
  mode: Campaign["mode"] = "single",
  chronicle: "council" | "sandbox" = "sandbox",
): Campaign {
  if (!NATIONS.some((n) => n.id === nationId)) throw Error("Unknown nation");
  const districts = makeWorld();
  const houses: House[] = NATIONS.flatMap((n, ni) =>
    roles.map((role, i) => {
      const id = `${n.id}-${i}`,
        female = ["saltmere", "dunwald"].includes(n.id);
      const family = [
        {
          id: `${id}-r`,
          name: `${female ? "Lady" : "Lord"} ${["Alen", "Bren", "Cerys", "Dara", "Elin", "Faen", "Iris", "Gor"][ni]} ${i ? minorNames[ni][i - 1] : n.house}`,
          gender: female ? ("female" as const) : ("male" as const),
          age: 42 + i,
          alive: true,
          parents: [],
        },
        {
          id: `${id}-h1`,
          name: `${["Elara", "Ronan", "Sera", "Maeve", "Neris", "Aerin", "Vela", "Ghra"][ni]} ${i ? minorNames[ni][i - 1] : n.house}`,
          gender: "female" as const,
          age: 21,
          alive: true,
          parents: [`${id}-r`],
          claim: n.id,
        },
        {
          id: `${id}-h2`,
          name: `${["Corin", "Tor", "Mira", "Oryn", "Varen", "Leth", "Tarin", "Rukh"][ni]} ${i ? minorNames[ni][i - 1] : n.house}`,
          gender: "male" as const,
          age: 18,
          alive: true,
          parents: [`${id}-r`],
          claim: n.id,
        },
      ];
      return {
        id,
        name: i ? minorNames[ni][i - 1] : n.house,
        nation: n.id,
        color: i
          ? ["", "#79a276", "#c17768", "#719ea9", "#a689b4"][i]
          : n.color,
        crest: i ? ["", "✿", "⚔", "⚓", "♜"][i] : n.crest,
        role,
        ruler: family[0].id,
        family,
        treasury: i ? 150 : 420,
        stock: { ...stock(i ? 45 : 95), grain: i ? 200 : 500 },
        opinion: i === 4 ? 25 : 70,
        legitimacy: i === 4 ? 35 : 85,
        obligation: i === 2 ? 900 : 500,
        loyalty: i === 4 ? 30 : 78,
        reasons: [],
        ambition: [
          "Keep the crown and secure the succession",
          "Control resource exports",
          "Guard the frontier and earn command",
          "Open protected trade routes",
          "Press an ancestral claim to the crown",
        ][i],
        relations: {},
        liege: i ? `${n.id}-0` : null,
        rebellion: false,
        summons: "No active summons",
      };
    }),
  );
  for (const n of NATIONS) {
    const land = districts
      .filter((d) => d.nation === n.id)
      .sort(
        (a, b) =>
          hexDistance(a, { q: n.anchor[0], r: n.anchor[1] }) -
          hexDistance(b, { q: n.anchor[0], r: n.anchor[1] }),
      );
    // New offshore holdings belong to the crown without moving existing mainland estates.
    const home = land.filter((d) => !COASTAL_ISLANDS.has(d.id));
    const anchors = [
      home[0],
      home[Math.floor(home.length * 0.2)],
      home[Math.floor(home.length * 0.4)],
      home[Math.floor(home.length * 0.65)],
      home[home.length - 1],
    ];
    for (const d of land) {
      let i = anchors.reduce(
        (best, a, j) =>
          hexDistance(d, a) < hexDistance(d, anchors[best]) ? j : best,
        0,
      );
      if (d.id === n.capital || COASTAL_ISLANDS.has(d.id)) i = 0;
      d.owner = `${n.id}-${i}`;
      d.disputed = i === 4;
    }
  }
  // Both optional minigames are immediately reachable in every starting crown domain.
  for (const n of NATIONS) {
    const silver = districts.find(
      (d) => d.owner === `${n.id}-0` && d.id !== n.capital,
    );
    if (silver) silver.bonus = "silver";
  }
  const armies: Army[] = houses.map((h) => ({
    id: `army-${h.id}`,
    name: `${h.name} ${h.role === "crown" ? "Royal Host" : "Retinue"}`,
    house: h.id,
    origin: h.nation,
    hex:
      h.role === "crown"
        ? NATIONS.find((n) => n.id === h.nation)!.capital
        : districts.find((d) => d.owner === h.id)!.id,
    troops: {
      levies: h.role === "crown" ? 100 : 40,
      spearmen: 40,
      archers: 25,
      heavy: h.role === "crown" ? 25 : 8,
      cavalry: h.role === "crown" ? 20 : 6,
    },
    path: [],
    morale: 85,
    loyalty: 85,
    supply: 1,
    fatigue: 0,
    serviceUntil: 0,
    commander: h.ruler,
    rebel: false,
    delay: 0,
  }));
  const s: Campaign = {
    version: 2,
    world: "Edravane",
    mode,
    tick: 0,
    rng: 7319,
    serial: 0,
    paused: false,
    districts,
    houses,
    titles: NATIONS.map((n) => ({
      id: `crown-${n.id}`,
      nation: n.id,
      holder: `${n.id}-0`,
    })),
    armies,
    routes: [],
    wars: [],
    warDeclarations: [],
    insults: [],
    battles: [],
    appliedResults: [],
    challenges: [],
    rewards: {},
    prices: {
      grain: 2,
      timber: 3,
      iron: 5,
      livestock: 3,
      horses: 7,
      herbs: 4,
      luxury: 8,
    },
    config: { maritimeHazard: 0.025, serviceTicks: 24, tickSeconds: 2 },
    log: [
      "The eight crowns gather. Provisional fictional names; no legal clearance claimed.",
    ],
  };
  if (mode === "single")
    houses
      .find((h) => h.id === `${nationId}-0`)!
      .reasons.push("Human commander");
  establishEstates(s, true);
  initializeTurns(s, nationId);
  initializeStrategy(s);
  initializeAgreements(s, chronicle);
  updateIntelligence(s);
  return s;
}
export function random(s: Campaign) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
export function canControl(s: Campaign, actor: Actor, a: Army) {
  return (
    !a.rebel &&
    (a.house === actor.house ||
      (a.pledgedTo === actor.house &&
        a.serviceUntil > s.tick &&
        !a.rebel &&
        a.delay === 0))
  );
}
export function heir(_s: Campaign, h: House) {
  if (_s.strategyRules) {
    const preview = successionPreview(_s, h);
    return preview.recognized ? preview.next : undefined;
  }
  const n = NATIONS.find((n) => n.id === h.nation)!;
  const candidates = h.family
    .filter(
      (p) =>
        p.alive &&
        p.id !== h.ruler &&
        !p.imprisonedBy &&
        p.age >= 16 &&
        (p.parents.includes(h.ruler) || p.claim === h.nation) &&
        (n.succession === "Kings inherit"
          ? p.gender === "male"
          : n.succession === "Queens inherit"
            ? p.gender === "female"
            : true),
    )
    .sort((a, b) => b.age - a.age);
  if (
    (h.nation === "sylvarenne" || h.nation === "graskor") &&
    h.legitimacy < 40
  )
    return undefined;
  return candidates[0];
}
export function loadSave(raw: string): Campaign {
  const s = JSON.parse(raw) as Campaign;
  if (
    s.version !== 2 ||
    s.world !== "Edravane" ||
    s.mode !== "single" ||
    !Array.isArray(s.houses) ||
    !Array.isArray(s.districts) ||
    !Array.isArray(s.armies) ||
    !Number.isFinite(s.tick) ||
    !Array.isArray(s.battles) ||
    !s.config
  )
    throw Error("Not a supported Edravane v2 single-player save");
  if (
    ![241, 301, WORLD_HEX_COUNT].includes(s.districts.length) ||
    !s.houses.every(
      (h) => h.family?.length && h.stock && Number.isFinite(h.treasury),
    ) ||
    !s.armies.every((a) => a.troops && s.districts.some((d) => d.id === a.hex))
  )
    throw Error("Invalid campaign save");
  for (const a of s.armies)
    if (a.wounded !== undefined) {
      need(
        a.wounded &&
          typeof a.wounded === "object" &&
          !Array.isArray(a.wounded) &&
          Object.entries(a.wounded).every(
            ([k, n]) =>
              UNIT_KINDS.includes(k as UnitKind) &&
              Number.isSafeInteger(n) &&
              n >= 0,
          ),
        "Invalid wounded troops",
      );
    }
  for (const b of s.battles) {
    for (const f of b.formations) {
      f.exit ??= [f.x < 50 ? -20 : 120, f.y];
      need(
        f.wounded === undefined ||
          (Number.isSafeInteger(f.wounded) && f.wounded >= 0),
        "Invalid formation wounds",
      );
      need(
        f.dead === undefined || (Number.isSafeInteger(f.dead) && f.dead >= 0),
        "Invalid formation deaths",
      );
    }
    if (b.rounds) {
      const r = b.rounds;
      need(
        Number.isSafeInteger(r.round) &&
          r.round >= 1 &&
          r.round <= 20 &&
          Array.isArray(r.committed) &&
          new Set(r.committed).size === r.committed.length &&
          r.committed.every((id) => b.armies.includes(id)) &&
          Array.isArray(r.log) &&
          r.log.every((l) => typeof l === "string") &&
          Array.isArray(r.commandersDown) &&
          Array.isArray(r.reinforced),
        "Invalid battle rounds",
      );
      need(
        r.plans &&
          typeof r.plans === "object" &&
          !Array.isArray(r.plans) &&
          r.committed.every((id) => !!r.plans[id]) &&
          Object.entries(r.plans).every(
            ([id, plan]) =>
              b.armies.includes(id) &&
              ["hold", "advance", "flank", "volley", "retreat"].includes(
                plan.order,
              ) &&
              plan.positions &&
              typeof plan.positions === "object" &&
              Object.entries(plan.positions).every(
                ([k, p]) =>
                  UNIT_KINDS.includes(k as UnitKind) &&
                  ["front", "rear", "flank"].includes(p),
              ),
          ),
        "Invalid saved battle orders",
      );
    }
  }
  if (s.battleReports !== undefined)
    need(
      Array.isArray(s.battleReports) &&
        s.battleReports.every(
          (r) =>
            typeof r.id === "string" &&
            Array.isArray(r.sides) &&
            Array.isArray(r.log) &&
            r.log.every((l) => typeof l === "string") &&
            r.sides.every(
              (side) =>
                typeof side.house === "string" &&
                typeof side.name === "string" &&
                [side.healthy, side.wounded, side.dead, side.captured].every(
                  (n) => Number.isSafeInteger(n) && n >= 0,
                ),
            ),
        ),
      "Invalid battle reports",
    );
  if (s.turns) {
    const t = s.turns;
    need(
      Array.isArray(t.order) &&
        t.order.length === NATIONS.length &&
        new Set(t.order).size === NATIONS.length &&
        t.order.every((n) => NATIONS.some((v) => v.id === n)) &&
        Number.isInteger(t.index) &&
        t.index >= 0 &&
        t.index < t.order.length &&
        Number.isSafeInteger(t.round) &&
        t.round >= 1 &&
        Array.isArray(t.pending),
      "Invalid turn state",
    );
    need(
      t.pending.every(
        (r) =>
          r &&
          typeof r.id === "string" &&
          ["war", "peace", "marriage", "attack", "surrender"].includes(r.kind) &&
          s.houses.some((h) => h.id === r.from) &&
          s.houses.some((h) => h.id === r.to) &&
          Number.isFinite(r.created) &&
          (r.kind !== "attack" ||
            (s.armies.some((a) => a.id === r.army) &&
              s.districts.some((d) => d.id === r.hex))),
      ) && new Set(t.pending.map((r) => r.id)).size === t.pending.length,
      "Invalid pending response",
    );
    need(!t.ending || t.ending === t.order[t.index], "Invalid resolving turn");
  }
  // Preserve existing mobile forces and balances when upgrading older campaigns.
  if (!s.estateRules) establishEstates(s, false);
  if (!s.turns)
    initializeTurns(
      s,
      s.houses.find((h) => h.reasons.includes("Human commander"))?.nation ??
        NATIONS[0].id,
    );
  need(
    s.houses.every(
      (h) =>
        h.unjustifiedWars === undefined ||
        (Number.isSafeInteger(h.unjustifiedWars) && h.unjustifiedWars >= 0),
    ),
    "Invalid war history",
  );
  need(
    s.armies.every(
      (a) =>
        (a.loyalty === undefined ||
          (Number.isFinite(a.loyalty) && a.loyalty >= 0 && a.loyalty <= 100)) &&
        (a.blockading === undefined || typeof a.blockading === "boolean"),
    ),
    "Invalid army loyalty or blockade",
  );
  need(
    s.warDeclarations === undefined ||
      (Array.isArray(s.warDeclarations) &&
        s.warDeclarations.every(
          (w) =>
            NATIONS.some((n) => n.id === w.from) &&
            NATIONS.some((n) => n.id === w.to) &&
            w.from !== w.to &&
            Object.hasOwn(WAR_REASONS, w.reason) &&
            Number.isFinite(w.tick),
        )),
    "Invalid war history",
  );
  need(
    s.insults === undefined ||
      (Array.isArray(s.insults) &&
        s.insults.every(
          (i) =>
            i &&
            s.houses.some((h) => h.id === i.from) &&
            s.houses.some((h) => h.id === i.to) &&
            i.from !== i.to &&
            Number.isSafeInteger(i.tick) &&
            i.tick >= 0 &&
            i.tick <= s.tick &&
            Number.isSafeInteger(i.round) &&
            i.round >= 0 &&
            (i.resolved === undefined || typeof i.resolved === "boolean"),
        )),
    "Invalid insult history",
  );
  validateStrategySave(s);
  initializeStrategy(s);
  validateAgreementsSave(s);
  initializeAgreements(s);
  return s;
}
function need(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
const ownHouse = (s: Campaign, actor: Actor) => {
  const h = s.houses.find((h) => h.id === actor.house);
  need(h, "Unknown controlling house");
  return h;
};
function authority(s: Campaign, actor: Actor, id: string) {
  const a = s.armies.find((a) => a.id === id);
  need(a && canControl(s, actor, a), "Army is not under your command");
  return a;
}
function spend(h: House, cost: number) {
  need(h.treasury >= cost, `Requires ${cost} coins`);
  h.treasury -= cost;
}
function declareWar(
  s: Campaign,
  h: House,
  nation: string,
  requested?: WarReason,
  hex?: string,
) {
  need(
    s.titles.some((t) => t.holder === h.id),
    "Only a crown holder can declare war",
  );
  need(
    NATIONS.some((n) => n.id === nation) && nation !== h.nation,
    "Invalid opponent",
  );
  const key = [h.nation, nation].sort().join("|");
  need(!s.wars.includes(key), "Already at war");
  const treaty = truce(s, h.nation, nation);
  need(!treaty, `A truce protects this realm through round ${treaty?.until}`);
  const reason = recordWar(s, h, nation, requested, hex);
  s.wars.push(key);
  if (s.strategyRules) {
    (s.conflicts ??= []).push({ id: `war-${++s.serial}`, from: h.nation, to: nation, reason, objective: objectiveFor(s, h, nation, reason, hex), started: campaignRound(s) });
    event(s, { kind: "diplomacy", house: h.id, other: s.titles.find((t) => t.nation === nation)!.holder, hex, title: "War declared", detail: `${h.name}: ${WAR_REASONS[reason]}. The war objective determines what to demand at peace.` });
  }
  if (s.turns)
    addReaction(s, {
      kind: "war",
      from: h.id,
      to: s.titles.find((t) => t.nation === nation)!.holder,
      reason,
      hex,
    });
}
export function applyCommand(
  current: Campaign,
  actor: Actor,
  cmd: Command,
): Campaign {
  const s = structuredClone(current);
  const h = ownHouse(s, actor);
  initializeStrategy(s);
  initializeAgreements(s);
  need(cmd && typeof cmd.type === "string", "Invalid command");
  need(!s.agreements?.campaign.result || cmd.type === "continueSandbox", "This chronicle has ended; review the council's results");
  const battleTypes = [
    "stand",
    "retreat",
    "order",
    "battlePause",
    "battlePlan",
    "battleReinforce",
  ];
  need(
    !s.battles.length || battleTypes.includes(cmd.type),
    "Campaign frozen by queued battle encounters",
  );
  authorizeTurn(s, actor, cmd);
  if (agreementCommand(s, h, cmd)) {
    initializeAgreements(s); completeTurn(s); updateIntelligence(s); return s;
  }
  if (strategyCommand(s, h, cmd)) {
    while (s.battles[0] && !hasHumanParticipant(s, s.battles[0])) autoResolve(s, s.battles[0]);
    initializeAgreements(s); completeTurn(s); updateIntelligence(s); return s;
  }
  switch (cmd.type) {
    case "endTurn": {
      need(s.turns, "Turn-based campaign required");
      s.turns.ending = h.nation;
      s.paused = false;
      const next = advanceCampaign(s, h.nation);
      completeTurn(next);
      return next;
    }
    case "respond":
      resolveReaction(s, cmd);
      break;
    case "peace": {
      need(s.turns, "Turn-based campaign required");
      const target = s.titles.find((t) => t.nation === cmd.nation);
      need(target && target.nation !== h.nation, "Invalid peace partner");
      need(
        s.wars.includes([h.nation, cmd.nation].sort().join("|")),
        "Already at peace",
      );
      const recipient = s.houses.find((v) => v.id === target.holder)!;
      validatePeace(s, h, recipient, cmd.terms);
      addReaction(s, { kind: "peace", from: h.id, to: target.holder, terms: cmd.terms });
      s.log.unshift(`${h.name} proposes peace with ${cmd.nation}.`);
      break;
    }
    case "harvest": {
      const d = s.districts.find((d) => d.id === cmd.hex);
      need(
        d?.owner === h.id && d.farm && !d.occupation,
        "Harvest at your unoccupied farmland",
      );
      need(
        d.harvestedAt === undefined ||
          s.tick - d.harvestedAt >= HARVEST_COOLDOWN,
        "Fields are regrowing; harvest every 6 days",
      );
      const yieldFood = harvestYield(d);
      h.stock.grain = Math.min(999, h.stock.grain + Math.floor(yieldFood * economicFactors(s, h, d, false).output));
      d.harvestedAt = s.tick;
      s.log.unshift(`${h.name} harvested ${yieldFood} food at ${d.name}.`);
      break;
    }
    case "upgradeCastle": {
      const d = s.districts.find((d) => d.id === cmd.hex);
      need(
        d?.owner === h.id && d.castle && !d.occupation,
        "Upgrade your own unoccupied castle",
      );
      need(d.castle.level < 3, "Castle is already level 3");
      const cost = d.castle.level === 1 ? 150 : 300;
      need(
        h.stock.timber >= 30 && h.stock.iron >= 20,
        "Castle needs 30 timber and 20 iron",
      );
      spend(h, cost);
      h.stock.timber -= 30;
      h.stock.iron -= 20;
      d.castle.level = (d.castle.level + 1) as 2 | 3;
      s.log.unshift(`${d.settlement} upgraded to level ${d.castle.level}.`);
      break;
    }
    case "muster": {
      const reserve = authority(s, actor, cmd.army);
      need(
        reserve.garrison && reserve.house === h.id,
        "Raise an army from your own seat or castle reserves",
      );
      need(
        s.districts.find((d) => d.id === reserve.hex)?.owner === h.id &&
          !s.districts.find((d) => d.id === reserve.hex)?.occupation,
        "Seat is occupied",
      );
      need(
        Number.isInteger(cmd.count) && cmd.count >= 100 && cmd.count <= 2000,
        "Raise between 100 and 2,000 troops",
      );
      need(
        troopCount(reserve) - cmd.count >= 500,
        "Keep 500 soldiers to defend the castle",
      );
      need(
        s.armies.filter((a) => a.house === h.id && !a.garrison && !a.pledgedTo)
          .length < 3,
        "Three mobile armies per house; reinforce an existing army",
      );
      const coins = Math.ceil(cmd.count * 0.1),
        food = Math.ceil(cmd.count * 0.04);
      need(h.stock.grain >= food, `Raising this army needs ${food} food`);
      spend(h, coins);
      h.stock.grain -= food;
      const a = {
        ...structuredClone(reserve),
        id: `host-${++s.serial}`,
        name: `${h.name} Field Host ${s.serial}`,
        garrison: false,
        troops: splitTroops(reserve, cmd.count),
        wounded: {},
        path: [],
        provisions: h.nation === "varnesk" ? 4 : 3,
      };
      s.armies.push(a);
      noteLevies(s, h, cmd.count);
      s.log.unshift(
        `${h.name} raised ${cmd.count} troops for ${coins} coins and ${food} food.`,
      );
      break;
    }
    case "pause":
      need(s.mode === "single", "Multiplayer campaign uses synchronized ticks");
      s.paused = !!cmd.paused;
      break;
    case "war": {
      declareWar(s, h, cmd.nation, cmd.reason);
      break;
    }
    case "insult": {
      const target = s.houses.find((v) => v.id === cmd.house);
      need(target && target.id !== h.id, "Choose another house to insult");
      const round = s.turns?.round ?? s.tick;
      need(
        !(s.insults ?? []).some(
          (i) => i.from === h.id && i.to === target.id && i.round === round,
        ),
        "You already insulted this house this round",
      );
      (s.insults ??= []).push({
        from: h.id,
        to: target.id,
        tick: s.tick,
        round,
      });
      h.relations[target.id] = Math.max(
        -100,
        (h.relations[target.id] ?? 0) - 20,
      );
      target.relations[h.id] = Math.max(
        -100,
        (target.relations[h.id] ?? 0) - 20,
      );
      if (target.liege === h.id) {
        target.opinion = Math.max(0, target.opinion - (ruler(target)?.traits?.includes("proud") ? 20 : 15));
        target.loyalty = Math.round(
          target.opinion * 0.55 + target.legitimacy * 0.45,
        );
      }
      s.log.unshift(
        `${h.name} publicly insults House ${target.name}: −20 relations. ${target.nation !== h.nation ? "Their crown may answer with a justified war." : target.liege === h.id ? `Insulting this sworn vassal costs ${ruler(target)?.traits?.includes("proud") ? 20 : 15} opinion.` : "No foreign war reason within your realm."}`,
      );
      event(s, { kind: "diplomacy", house: h.id, other: target.id, title: "A public insult", detail: `${h.name} insults ${target.name}. Relations fall; proud vassals resent the slight more deeply.` });
      break;
    }
    case "blockade": {
      const a = authority(s, actor, cmd.army);
      need(
        !a.garrison && !a.voyage && troopCount(a) >= 1,
        "At least one field troop must be stationed to block trade",
      );
      need(typeof cmd.enabled === "boolean", "Invalid blockade order");
      need(!s.sieges?.some((siege) => siege.army === a.id), "Use Lift siege to release this castle's approaches");
      a.blockading = cmd.enabled;
      a.path = [];
      s.log.unshift(
        `${a.name} ${cmd.enabled ? "blocks foreign trade through its field" : "allows foreign trade to pass"}.`,
      );
      break;
    }
    case "attack": {
      const a = authority(s, actor, cmd.army),
        d = s.districts.find((d) => d.id === cmd.hex);
      need(!s.sieges?.some((siege) => siege.army === a.id), "Lift this host's siege before attacking another field");
      need(
        !a.garrison && !a.voyage && troopCount(a) >= 1,
        "Raise and select a field army to attack",
      );
      need(
        d?.owner && !["sea", "legacy"].includes(d.biome),
        "Select a playable occupied land field",
      );
      const controller = s.houses.find(
        (v) => v.id === (d.occupation ?? d.owner),
      )!;
      const opposing = s.armies.find(
        (v) =>
          v.id !== a.id &&
          v.hex === d.id &&
          troopCount(v) > 0 &&
          (atWar(s, a, v) ||
            (v.blockading &&
              s.houses.find((vHouse) => vHouse.id === (v.pledgedTo ?? v.house))
                ?.nation !== h.nation)),
      );
      const target =
        controller.nation === h.nation && opposing
          ? s.houses.find(
              (v) => v.id === (opposing.pledgedTo ?? opposing.house),
            )!
          : controller;
      const hostileRebel = s.armies.some(
        (v) => v.hex === d.id && atWar(s, a, v),
      );
      need(
        target.nation !== h.nation || hostileRebel,
        "Cannot attack friendly territory",
      );
      const path = a.hex === d.id ? [d.id] : findPath(s.districts, a.hex, d.id);
      need(path.length > 0, "No land path; sail to an island port first");
      if (
        target.nation !== h.nation &&
        !s.wars.includes([h.nation, target.nation].sort().join("|"))
      )
        declareWar(s, h, target.nation, cmd.reason, d.id);
      a.path = path;
      a.blockading = false;
      s.log.unshift(
        `${a.name} will attack ${d.settlement} on End turn; the defender responds before entry.`,
      );
      break;
    }
    case "move": {
      const a = authority(s, actor, cmd.army);
      need(!s.sieges?.some((siege) => siege.army === a.id), "Lift this host's siege before marching");
      need(!a.garrison, "Raise a mobile army from the seat first");
      need(!a.voyage, "Army is already at sea");
      const path = findPath(s.districts, a.hex, cmd.hex);
      need(
        path.length > 0,
        "No contiguous land path (sea and legacy are unavailable)",
      );
      a.path = path;
      a.blockading = false;
      break;
    }
    case "embark": {
      const a = authority(s, actor, cmd.army);
      need(!s.sieges?.some((siege) => siege.army === a.id), "Lift this host's siege before sailing");
      need(!a.garrison, "Raise a mobile army from the seat first");
      need(!a.voyage, "Army is already at sea");
      const from = s.districts.find((d) => d.id === a.hex),
        to = s.districts.find((d) => d.id === cmd.hex);
      need(
        from?.port && from.shipyard && to?.port && to.id !== from.id,
        "Transport needs an origin shipyard and a destination port",
      );
      const path = findPath(s.districts, from.id, to.id, true);
      need(path.length, "No navigable sea passage");
      const ships = Math.ceil(troopCount(a) / 80);
      need(
        h.stock.timber >= ships * 20,
        "Each transport requires 20 timber and carries 80 troops",
      );
      spend(
        h,
        Math.round(
          80 * ships * (from.nation === "saltmere" ? BALANCE.shipCost : 1),
        ),
      );
      h.stock.timber -= ships * 20;
      a.path = [];
      a.blockading = false;
      a.voyage = {
        path: [from.id, ...path],
        progress: 0,
        destination: to.id,
        ships,
      };
      s.log.unshift(`${a.name} embarks on ${ships} transport(s).`);
      break;
    }
    case "objective": {
      let a = s.armies.find((a) => a.id === cmd.army);
      need(
        a && a.house !== h.id && !a.rebel && !a.pledgedTo && !canControl(s, actor, a),
        "Choose an independent friendly commander",
      );
      const v = s.houses.find((v) => v.id === a!.house)!;
      need(
        !v.rebellion && (v.liege === h.id || (h.relations[v.id] ?? 0) >= 20),
        "No diplomatic command relationship",
      );
      need(
        s.districts.some((d) => d.id === cmd.hex && d.owner),
        "Invalid objective",
      );
      if (v.loyalty < 55) {
        v.summons = "Commander declined: low loyalty";
        s.log.unshift(`${v.name} declined your requested objective: loyalty below 55.`);
        break;
      }
      if (a.garrison) {
        need(v.liege === h.id, "Only your vassals can raise a host on request");
        const mobile = s.armies.find((army) => army.house === v.id && !army.garrison && !army.pledgedTo && !army.rebel && !army.voyage && !s.sieges?.some((siege) => siege.army === army.id));
        if (mobile) a = mobile;
        else {
          need(!s.districts.find((d) => d.id === a!.hex)?.occupation, "Vassal seat is occupied");
          need(s.armies.filter((army) => army.house === v.id && !army.garrison && !army.pledgedTo).length < 3, "Vassal already has three field hosts");
          const count = Math.floor(Math.min(1000, v.obligation, troopCount(a) - 500));
          need(count >= 100, "Vassal needs at least 100 available troops beyond 500 castle guards");
          const coins = Math.ceil(count * .1), food = Math.ceil(count * .04);
          need(v.treasury >= coins && v.stock.grain >= food, "Vassal lacks coins or food to raise a host");
          v.treasury -= coins; v.stock.grain -= food;
          a = { ...structuredClone(a), id: `host-${++s.serial}`, name: `${v.name} Vassal Host`, garrison: false, troops: splitTroops(a, count), wounded: {}, path: [], provisions: v.nation === "varnesk" ? 4 : 3 };
          s.armies.push(a);
          s.log.unshift(`${v.name} raised ${count} troops under its own commander for ${coins} coins and ${food} food.`);
        }
      }
      need(!a.voyage && !s.sieges?.some((siege) => siege.army === a!.id), "Commander is at sea or committed to a siege");
      const path = findPath(s.districts, a.hex, cmd.hex);
      need(a.hex === cmd.hex || path.length, "No land route");
      a.objective = cmd.hex;
      a.path = path;
      v.summons = "Commander accepted requested objective";
      s.log.unshift(`${v.name} accepted your request to ${a.hex === cmd.hex ? "hold" : "march to"} ${s.districts.find((d) => d.id === cmd.hex)!.name}; its host remains independent.`);
      break;
    }
    case "summon": {
      const v = s.houses.find((v) => v.id === cmd.house);
      need(v && v.liege === h.id && !v.rebellion, "House is not your vassal");
      const a = s.armies.find((a) => a.house === v.id && !a.pledgedTo);
      need(a, "No available army");
      need(
        !s.armies.some(
          (a) => a.house === v.id && a.pledgedTo && a.serviceUntil > s.tick,
        ),
        "Already pledged",
      );
      const summonLoyalty = v.loyalty + (ruler(v)?.traits?.includes("loyal") ? 5 : 0);
      if (summonLoyalty < 40) {
        v.summons = "Refused: claimant sympathy and weak legitimacy";
        s.log.unshift(`${v.name} refused the royal summons.`);
      } else {
        const delayed = summonLoyalty < 60,
          count = Math.min(
            Math.max(0, troopCount(a) - 500),
            Math.floor(v.obligation * (delayed ? 0.5 : 1)),
          );
        need(count > 0, "No troops available");
        const contingent = structuredClone(a);
        contingent.wounded = {};
        contingent.id = `contingent-${++s.serial}`;
        contingent.name = `${v.name} pledged contingent`;
        contingent.pledgedTo = h.id;
        contingent.serviceUntil =
          s.tick + s.config.serviceTicks + (delayed ? 3 : 0);
        contingent.delay = delayed ? 3 : 0;
        contingent.path = [];
        contingent.garrison = false;
        contingent.provisions = v.nation === "varnesk" ? 4 : 3;
        let remaining = count;
        const total = troopCount(a);
        const kinds = Object.keys(a.troops) as UnitKind[];
        for (const [index, k] of kinds.entries()) {
          const take =
            index === kinds.length - 1
              ? Math.min(remaining, a.troops[k])
              : Math.min(remaining, Math.floor((a.troops[k] / total) * count));
          contingent.troops[k] = take;
          a.troops[k] -= take;
          remaining -= take;
        }
        s.armies.push(contingent);
        v.summons = delayed
          ? `Delayed 3 ticks; half obligation (${count} troops); requests a concession`
          : `${count} contracted troops; command pledged until tick ${contingent.serviceUntil}`;
        s.log.unshift(
          `${v.name} commits ${count} troops${delayed ? " with a delay" : ""}.`,
        );
      }
      break;
    }
    case "concession": {
      const v = s.houses.find((v) => v.id === cmd.house);
      need(v && v.liege === h.id, "Not your vassal");
      spend(h, 40);
      v.treasury += 40;
      v.opinion = Math.min(100, v.opinion + 18);
      v.legitimacy = Math.min(100, v.legitimacy + 8);
      v.loyalty = Math.min(
        100,
        Math.round(v.opinion * 0.55 + v.legitimacy * 0.45),
      );
      v.reasons.push("Royal concession: +18 opinion, +8 legitimacy");
      break;
    }
    case "pretender": {
      const v = s.houses.find((v) => v.id === cmd.house);
      need(
        v &&
          v.nation === h.nation &&
          v.role === "claimant" &&
          v.id !== s.titles.find((t) => t.nation === h.nation)?.holder,
        "No eligible pretender",
      );
      need(
        h.id === v.id || h.liege === v.liege || v.liege === h.id,
        "Cannot support this claim",
      );
      spend(h, 80);
      v.rebellion = true;
      v.liege = null;
      const a = s.armies.find((a) => a.house === v.id);
      if (a) {
        if (a.garrison && troopCount(a) > 500) {
          const force = {
            ...structuredClone(a),
            id: `rebel-${++s.serial}`,
            garrison: false,
            troops: splitTroops(a, Math.min(1000, troopCount(a) - 500)),
            wounded: {},
          };
          s.armies.push(force);
          force.rebel = true;
          force.path = findPath(
            s.districts,
            force.hex,
            NATIONS.find((n) => n.id === h.nation)!.capital,
          );
        }
        a.rebel = true;
        a.pledgedTo = undefined;
        a.path = findPath(
          s.districts,
          a.hex,
          NATIONS.find((n) => n.id === h.nation)!.capital,
        );
      }
      for (const g of s.armies.filter((a) => a.house === v.id && a.garrison))
        g.path = [];
      s.log.unshift(`${v.name} raises a pretender's banner.`);
      break;
    }
    case "marry": {
      const v = s.houses.find((v) => v.id === cmd.house);
      need(v && v.id !== h.id, "Invalid marriage partner");
      const a = h.family.find(
          (p) => p.alive && !p.spouse && p.age >= 18 && p.id !== h.ruler,
        ),
        b = v.family.find(
          (p) => p.alive && !p.spouse && p.age >= 18 && p.id !== v.ruler,
        );
      const first = cmd.people ? h.family.find((p) => p.id === cmd.people![0]) : a;
      const second = cmd.people ? v.family.find((p) => p.id === cmd.people![1]) : b;
      need(first && second && first.alive && second.alive && !first.spouse && !second.spouse && first.age >= 18 && second.age >= 18 && first.id !== h.ruler && second.id !== v.ruler && !first.imprisonedBy && !second.imprisonedBy && !first.parents.includes(second.id) && !second.parents.includes(first.id) && !first.parents.some((parent) => second.parents.includes(parent)), "No unrelated unmarried adult heirs");
      need(
        !s.turns || !s.wars.includes([h.nation, v.nation].sort().join("|")),
        "Make peace before proposing marriage",
      );
      spend(h, 30);
      if (s.turns) {
        addReaction(s, {
          kind: "marriage",
          from: h.id,
          to: v.liege ?? v.id,
          partnerHouse: v.id,
          people: [first.id, second.id],
        });
        s.log.unshift(
          `${h.name} proposed a marriage pact to ${v.name}. Awaiting consent.`,
        );
        break;
      }
      first.spouse = second.id;
      second.spouse = first.id;
      const marriageBonus = h.nation === "ilyr-coast" || v.nation === "ilyr-coast" ? 35 : 25;
      h.relations[v.id] = (h.relations[v.id] ?? 0) + marriageBonus;
      v.relations[h.id] = (v.relations[h.id] ?? 0) + marriageBonus;
      v.opinion = Math.min(100, v.opinion + 12);
      s.log.unshift(`${first.name} married ${second.name}: +${marriageBonus} relationship.`);
      break;
    }
    case "succession": {
      if (s.strategyRules) { succeed(s, h); break; }
      const next = heir(s, h);
      need(
        next,
        "No eligible heir (council or assembly requires 40 legitimacy)",
      );
      h.family.find((p) => p.id === h.ruler)!.alive = false;
      h.ruler = next.id;
      h.legitimacy = Math.max(0, h.legitimacy - 10);
      for (const a of s.armies.filter((a) => a.house === h.id))
        a.commander = next.id;
      s.log.unshift(
        `${next.name} succeeds to House ${h.name}. Claims survive the succession.`,
      );
      break;
    }
    case "recruit": {
      const a = authority(s, actor, cmd.army);
      need(a.house === h.id, "Recruit into your own house army");
      need(cmd.kind in UNIT_STATS, "Unknown unit");
      need(
        s.districts.find((d) => d.id === a.hex)?.owner === h.id,
        "Recruit at your estate",
      );
      const count = cmd.count ?? 20;
      need(count === 20 || count === 100, "Recruit batches of 20 or 100");
      const supplies = count / 2;
      need(
        !s.districts.find((d) => d.id === a.hex)?.occupation,
        "Estate is occupied",
      );
      spend(h, count * UNIT_STATS[cmd.kind].cost);
      need(
        h.stock.grain >= supplies &&
          h.stock.iron >= (cmd.kind === "levies" ? 0 : supplies) &&
          h.stock.horses >= (cmd.kind === "cavalry" ? supplies : 0),
        "Equipment or food shortage",
      );
      h.stock.grain -= supplies;
      if (cmd.kind !== "levies") h.stock.iron -= supplies;
      if (cmd.kind === "cavalry") h.stock.horses -= supplies;
      a.troops[cmd.kind] += count;
      if (cmd.kind === "levies") noteLevies(s, h, count);
      s.log.unshift(
        `${h.name} recruited ${count} ${cmd.kind} for ${count * UNIT_STATS[cmd.kind].cost} coins and ${supplies} food.`,
      );
      break;
    }
    case "annex": {
      integrateTerritory(s, h, cmd.hex, "direct");
      break;
    }
    case "shipyard": {
      const d = s.districts.find((d) => d.id === cmd.hex);
      need(
        d?.owner === h.id && d.port && !d.shipyard,
        "Select an owned port without a shipyard",
      );
      need(h.stock.timber >= 30, "Requires 30 timber");
      spend(h, 100);
      h.stock.timber -= 30;
      d.shipyard = true;
      break;
    }
    case "route": {
      need(RESOURCES.includes(cmd.resource), "Unknown cargo");
      const from = s.districts.find((d) => d.id === cmd.from),
        to = s.districts.find((d) => d.id === cmd.to);
      need(
        from?.owner === h.id && to?.owner && from.id !== to.id,
        "Route starts at your estate and ends at a land estate",
      );
      need(
        !s.wars.includes(
          [h.nation, s.houses.find((v) => v.id === to.owner)!.nation]
            .sort()
            .join("|"),
        ),
        "Cannot trade with an enemy",
      );
      need(
        s.routes.filter((r) => r.house === h.id).length < 6,
        "Six-route limit",
      );
      need(
        !s.routes.some(
          (r) =>
            r.house === h.id &&
            r.from === cmd.from &&
            r.to === cmd.to &&
            r.resource === cmd.resource &&
            !!r.import === !!cmd.import,
        ),
        "Route already exists",
      );
      if (cmd.maritime) {
        need(
          from.port && to.port && from.shipyard,
          "Maritime route requires two ports and an origin shipyard",
        );
        need(h.stock.timber >= 20, "Ship needs 20 timber");
        h.stock.timber -= 20;
        spend(
          h,
          Math.round(
            80 *
              (from.nation === "saltmere" && from.shipyard
                ? BALANCE.shipCost
                : 1),
          ),
        );
      } else spend(h, 25);
      const path = findPath(s.districts, from.id, to.id, cmd.maritime);
      need(path.length, "No navigable route");
      s.routes.push({
        id: `route-${++s.serial}`,
        house: h.id,
        from: from.id,
        to: to.id,
        path: [from.id, ...path],
        maritime: cmd.maritime,
        import: cmd.import === true,
        resource: cmd.resource,
        capacity:
          (cmd.maritime ? 24 : 12) + (from.city ? 12 : 0) + (to.city ? 12 : 0),
        cost: cmd.maritime ? 3 : 1,
        progress: 0,
        delivered: 0,
        status: "Preparing cargo",
      });
      break;
    }
    case "challenge": {
      const d = s.districts.find((d) => d.id === cmd.hex);
      need(d?.bonus && d.owner === h.id, "Challenge must be on your estate");
      const key = `${h.id}|${d.id}`,
        reward = s.rewards[key] ?? { count: 0, next: 0 };
      need(
        reward.count < 3 && s.tick >= reward.next,
        "Challenge cooldown or three-reward lifetime limit",
      );
      need(
        !s.challenges.some(
          (c) => c.house === h.id && c.hex === d.id && !c.done,
        ),
        "Challenge already open",
      );
      const base = 8 + Math.floor(random(s) * 8),
        amount = 3 + Math.floor(random(s) * 4),
        tariff = 2 + Math.floor(random(s) * 4);
      const correct = base * amount - tariff;
      const gold = d.bonus === "gold";
      const answer = gold
        ? Math.floor(random(s) * 3)
        : Math.floor(random(s) * 3);
      const choices = gold
        ? [
            `${correct - amount} coins`,
            `${correct} coins`,
            `${correct + tariff} coins`,
          ]
        : [
            "Brace spearmen on the ford",
            "Keep archers behind woodland cover",
            "Flank tired infantry with cavalry",
          ];
      if (gold) {
        const v = choices[answer];
        choices[answer] = `${correct} coins`;
        if (answer !== 1) choices[1] = v;
      }
      s.challenges.push({
        id: `challenge-${++s.serial}`,
        house: h.id,
        hex: d.id,
        kind: d.bonus,
        question: gold
          ? `Sell ${amount} cargo at ${base} coins each, less a ${tariff}-coin tariff. Choose the fair bid.`
          : [
              "Enemy cavalry charges across a narrow river. Which tournament order wins?",
              "Enemy archers fire from the open. Which tournament order protects your ranged reserve?",
              "Enemy infantry has exhausted its spears. Which tournament order exploits the opening?",
            ][answer],
        choices,
        answer,
        attempts: 0,
        done: false,
        created: s.tick,
      });
      break;
    }
    case "answer": {
      const c = s.challenges.find((c) => c.id === cmd.challenge);
      need(c && c.house === h.id && !c.done, "No unclaimed challenge");
      need(
        Number.isInteger(cmd.choice) && cmd.choice >= 0 && cmd.choice < 3,
        "Invalid choice",
      );
      need(
        s.districts.find((d) => d.id === c.hex)?.owner === h.id,
        "Challenge estate no longer owned",
      );
      c.attempts++;
      c.done = true;
      const key = `${h.id}|${c.hex}`,
        r = s.rewards[key] ?? { count: 0, next: 0 };
      r.next = s.tick + 30;
      if (cmd.choice === c.answer) {
        need(r.count < 3, "Reward cap");
        r.count++;
        if (c.kind === "gold") h.treasury += 60;
        else {
          const a = s.armies.find((a) => a.house === h.id);
          need(a, "No army to receive troops");
          a.troops.levies += 20;
        }
        s.log.unshift(
          `${h.name} won ${c.kind === "gold" ? "60 coins" : "20 levies"} (${r.count}/3 rewards at this field).`,
        );
      } else s.log.unshift("Challenge lost. Retry after 30 campaign ticks.");
      s.rewards[key] = r;
      break;
    }
    case "stand":
    case "retreat":
    case "order":
    case "battlePlan":
    case "battleReinforce":
    case "battlePause": {
      const b = s.battles[0];
      need(
        b && b.id === cmd.battle,
        "Only the first queued encounter is active",
      );
      if (cmd.type === "battlePlan") {
        const a = authority(s, actor, cmd.army);
        need(b.armies.includes(a.id), "Army is not a participant");
        need(b.rounds && b.phase === "combat", "Battle rounds have not begun");
        need(cmd.round === b.rounds.round, "Battle round is stale");
        need(
          !b.rounds.committed.includes(a.id),
          "Orders already committed this round",
        );
        need(
          cmd.plan &&
            ["hold", "advance", "flank", "volley", "retreat"].includes(
              cmd.plan.order,
            ),
          "Unknown battle order",
        );
        need(
          cmd.plan.positions &&
            typeof cmd.plan.positions === "object" &&
            !Array.isArray(cmd.plan.positions) &&
            Object.entries(cmd.plan.positions).every(
              ([k, p]) =>
                UNIT_KINDS.includes(k as UnitKind) &&
                ["front", "rear", "flank"].includes(p),
            ),
          "Invalid battle positions",
        );
        commitBattlePlan(s, b, a.id, cmd.plan);
        break;
      }
      if (cmd.type === "battleReinforce") {
        const a = authority(s, actor, cmd.army);
        need(
          b.rounds && b.armies.includes(a.id),
          "Army is not a round-battle participant",
        );
        need(
          !b.rounds.committed.includes(a.id),
          "Orders already committed this round",
        );
        const reserve = reinforcementSources(s, b, a).find(
          (r) => r.id === cmd.reserve,
        );
        need(reserve, "No eligible city reserves");
        const owner = s.houses.find((h) => h.id === a.house)!;
        spend(owner, 10);
        need(owner.stock.grain >= 10, "Reinforcements need 10 food");
        owner.stock.grain -= 10;
        const troops = splitTroops(reserve, 100);
        for (const k of UNIT_KINDS) {
          a.troops[k] += troops[k];
          const f = b.formations.find((f) => f.army === a.id && f.kind === k);
          if (f) {
            f.count += troops[k];
            f.initial += troops[k];
          } else if (troops[k]) {
            const template = b.formations.find((f) => f.army === a.id)!;
            b.formations.push({
              ...structuredClone(template),
              id: `${a.id}-${k}`,
              kind: k,
              count: troops[k],
              initial: troops[k],
              wounded: 0,
              dead: 0,
              position: defaultPosition(k),
              routed: false,
              escaped: false,
            });
          }
        }
        b.rounds.reinforced.push(a.id);
        b.rounds.log.unshift(
          `${a.name}: 100 city reserve troops join for 10 coins and 10 food; castle guards remain at their post.`,
        );
        break;
      }
      if (cmd.type === "battlePause") {
        need(
          b.armies.some((id) => {
            const a = s.armies.find((a) => a.id === id);
            return a && canControl(s, actor, a);
          }),
          "Only participants may vote",
        );
        b.pauseVotes = b.pauseVotes.filter((id) => id !== h.id);
        if (cmd.approve) b.pauseVotes.push(h.id);
        break;
      }
      if (cmd.type === "order") {
        need(b.phase === "combat", "Combat has not begun");
        const f = b.formations.find((f) => f.id === cmd.formation);
        need(f, "Unknown formation");
        authority(s, actor, f.army);
        need(
          ["move", "face", "hold", "attack", "charge", "withdraw"].includes(
            cmd.order,
          ),
          "Unknown order",
        );
        need(
          [cmd.x, cmd.y, cmd.facing, cmd.width].every(Number.isFinite) &&
            cmd.x >= 0 &&
            cmd.x <= 100 &&
            cmd.y >= 0 &&
            cmd.y <= 100 &&
            cmd.width >= 4 &&
            cmd.width <= 24,
          "Invalid formation geometry",
        );
        f.order = cmd.order;
        f.target = [cmd.x, cmd.y];
        f.width = cmd.width;
        f.facing = ((cmd.facing % 360) + 360) % 360;
        if (cmd.order === "face") f.order = "hold";
        f.reserve = false;
        break;
      }
      const a = authority(s, actor, cmd.army);
      need(b.armies.includes(a.id), "Army is not a participant");
      if (cmd.type === "retreat") {
        need(
          b.phase === "encounter",
          "Use withdraw formation orders during combat",
        );
        const escape = escapeHex(s, b, a);
        need(escape, "No valid escape");
        const opponent = s.armies.find(
          (enemy) => b.armies.includes(enemy.id) && enemy.id !== a.id,
        )!;
        if (troopCount(a) < troopCount(opponent) * 0.5 && a.fatigue > 60) {
          b.stood.push(a.id);
          s.log.unshift("Withdrawal intercepted: exhausted and outnumbered.");
          startCombat(b);
        } else {
          for (const f of b.formations.filter((f) => f.army === a.id)) {
            if (b.rounds) recordCasualties(f, f.count * 0.02);
            else f.count *= 0.95;
            f.escaped = true;
          }
          finishBattle(s, b, opponent.id);
        }
      } else {
        need(b.phase === "encounter", "Already in combat");
        if (!b.stood.includes(a.id)) b.stood.push(a.id);
        if (
          b.armies.every(
            (id) =>
              b.stood.includes(id) ||
              !s.houses
                .find(
                  (h) =>
                    h.id ===
                    commandHouse(s, s.armies.find((a) => a.id === id)!),
                )
                ?.reasons.includes("Human commander"),
          )
        )
          startCombat(b);
      }
      break;
    }
    default:
      throw Error("Unknown command");
  }
  while (s.battles[0] && !hasHumanParticipant(s, s.battles[0]))
    autoResolve(s, s.battles[0]);
  completeTurn(s);
  initializeAgreements(s);
  s.log = s.log.slice(0, 70);
  updateIntelligence(s);
  return s;
}
export function advanceCampaign(
  current: Campaign,
  actingNation?: string,
): Campaign {
  const s = structuredClone(current);
  if (
    s.paused ||
    s.battles.length ||
    (s.turns && (!actingNation || !s.turns.ending || s.turns.pending.length))
  )
    return s;
  s.tick++;
  advanceRealm(s, actingNation);
  advanceAgreements(s, actingNation);
  const ageing = ageDue(s), year = calendarYear(s);
  for (const h of s.houses) {
    const fields = s.districts.filter((d) => d.owner === h.id && !d.occupation);
    for (const d of fields)
      h.stock[d.resource] = Math.min(999, h.stock[d.resource] + production(d) * economicFactors(s, h, d).output);
    // Every realm has a small subsistence harvest; specialisation never removes survival options.
    if (s.agreements && h.nation === actingNation) h.stock.grain = Math.min(999, h.stock.grain + 6);
    if (s.strategyRules && season(s) === "Winter") h.stock.grain = Math.max(0, h.stock.grain - fields.filter((d) => d.farm).length);
    const mouths = fields.length * 0.7;
    h.stock.grain = Math.max(0, h.stock.grain - mouths);
    h.stock.livestock = Math.max(0, h.stock.livestock - fields.length * 0.1);
    h.treasury += fields.reduce((n, d) => n + (1.1 + (d.city === "major" ? 4 : d.city ? 2 : 0)) * economicFactors(s, h, d).income, 0);
    if (s.strategyRules && h.role === "crown") h.treasury += Math.max(0, councilSkill(s, h, "stewardship") - 8) * 0.1;
    if (
      !h.reasons.includes("Human commander") &&
      s.tick % HARVEST_COOLDOWN === 0
    ) {
      for (const d of fields.filter(
        (d) =>
          d.farm &&
          (d.harvestedAt === undefined ||
            s.tick - d.harvestedAt >= HARVEST_COOLDOWN),
      )) {
        h.stock.grain = Math.min(999, h.stock.grain + harvestYield(d));
        d.harvestedAt = s.tick;
      }
    }
    h.loyalty = Math.round(h.opinion * 0.55 + h.legitimacy * 0.45);
    h.reasons = h.reasons.filter(
      (r) => r === "Human commander" || r.startsWith("Royal concession") || r.startsWith("Agreed concession"),
    );
    h.reasons.push(
      `Personal opinion ${h.opinion}/100 (55%)`,
      `Legitimacy ${h.legitimacy}/100 (45%)`,
      `Contract ${h.obligation} troops; separate from loyalty`,
    );
    if (h.stock.grain < 10) h.reasons.push("Food shortage: troops lose supply");
    if (
      h.liege &&
      h.loyalty < 30 &&
      !h.rebellion &&
      s.tick % 24 === 0 &&
      (h.role === "claimant" || random(s) < (30 - h.loyalty) / 60)
    ) {
      h.rebellion = true;
      h.summons = "Supporting a pretender";
      const a = s.armies.find((a) => a.house === h.id);
      if (a) {
        if (a.garrison && troopCount(a) > 500) {
          const force = {
            ...structuredClone(a),
            id: `rebel-${++s.serial}`,
            garrison: false,
            troops: splitTroops(a, Math.min(1000, troopCount(a) - 500)),
            wounded: {},
          };
          s.armies.push(force);
          force.rebel = true;
          force.path = findPath(
            s.districts,
            force.hex,
            NATIONS.find((n) => n.id === h.nation)!.capital,
          );
        }
        a.rebel = true;
        a.pledgedTo = undefined;
        a.path = findPath(
          s.districts,
          a.hex,
          NATIONS.find((n) => n.id === h.nation)!.capital,
        );
      }
      for (const g of s.armies.filter((a) => a.house === h.id && a.garrison))
        g.path = [];
      s.log.unshift(`${h.name} rebels: claimant warning became an uprising.`);
    }
    if (ageing) {
      for (const p of h.family) if (p.alive) p.age += s.agreements ? year - s.agreements.calendar.agedYear : 1;
      const ruler = h.family.find((p) => p.id === h.ruler)!;
      if (ruler.age >= 65 && random(s) < 0.3) {
        const next = heir(s, h);
        if (next) {
          if (s.strategyRules) { succeed(s, h); continue; }
          ruler.alive = false;
          h.ruler = next.id;
          h.legitimacy -= 10;
          s.log.unshift(`${next.name} inherited House ${h.name}.`);
        }
      }
    }
  }
  if (ageing && s.agreements) s.agreements.calendar.agedYear = year;
  growDynasties(s);
  for (const resource of RESOURCES) {
    const total = s.houses.reduce((n, h) => n + h.stock[resource], 0);
    s.prices[resource] =
      Math.round(
        Math.max(
          1,
          Math.min(
            12,
            ((resource === "luxury" ? 9 : resource === "iron" ? 6 : 4) * 1800) /
              Math.max(900, total),
          ),
        ) * 100,
      ) / 100;
  }
  for (const route of s.routes) {
    const h = s.houses.find((h) => h.id === route.house)!,
      target = s.districts.find((d) => d.id === route.to)!,
      origin = s.districts.find((d) => d.id === route.from)!;
    if (origin.owner !== h.id || !target.owner) {
      route.status = "Suspended: estate lost";
      continue;
    }
    const buyer = s.houses.find((h) => h.id === target.owner)!;
    if (s.wars.includes([h.nation, buyer.nation].sort().join("|"))) {
      route.status = "Suspended: destination at war";
      continue;
    }
    const blockers = routeBlockers(s, route);
    if (blockers.length) {
      route.status = `Blockaded: ${blockers.map((a) => s.houses.find((v) => v.id === (a.pledgedTo ?? a.house))!.name).join(", ")} · trade halted`;
      continue;
    }
    route.progress++;
    route.status = `In transit ${route.progress}/${route.path.length}`;
    if (route.progress < route.path.length) continue;
    route.progress = 0;
    const benefits = routeBenefits(s, route.house, route.from, route.to, route.maritime);
    const transportCost = route.cost * benefits.cost;
    if (route.maritime && random(s) < s.config.maritimeHazard * benefits.hazard) {
      route.status = "Storm loss: cargo lost";
      const supplier = route.import ? buyer : h;
      supplier.stock[route.resource] = Math.max(
        0,
        supplier.stock[route.resource] - route.capacity,
      );
      continue;
    }
    const seller = route.import ? buyer : h,
      recipient = route.import ? h : buyer;
    const cargo = Math.max(
      0,
      Math.min(
        route.capacity,
        seller.stock[route.resource] - 15,
        (recipient.treasury - transportCost) / s.prices[route.resource],
      ),
    );
    if (cargo < 1 || h.treasury < transportCost) {
      route.status = "Waiting: cargo or funds shortage";
      continue;
    }
    const producer = route.import ? target : origin;
    const price = s.prices[route.resource],
      income =
        cargo *
        price *
        (producer.nation === "ilyr-coast" &&
        route.resource === "luxury" &&
        seller.nation !== recipient.nation
          ? BALANCE.luxuryIncome
          : 1) * (s.strategyRules && route.maritime && seller.nation === "saltmere" && seller.id !== recipient.id ? 1.1 : 1);
    seller.stock[route.resource] -= cargo;
    recipient.stock[route.resource] = Math.min(
      999,
      recipient.stock[route.resource] + cargo,
    );
    recipient.treasury -= cargo * price;
    seller.treasury += income;
    h.treasury -= transportCost;
    route.delivered += cargo;
    route.status = `${route.import ? "Imported" : "Delivered"} ${Math.floor(cargo)} ${route.resource}, value ${income.toFixed(1)} − ${transportCost.toFixed(1)} transport`;
  }
  for (const a of [...s.armies].sort((a, b) => a.id.localeCompare(b.id))) {
    if (s.battles.some((b) => b.armies.includes(a.id))) continue;
    if (s.strategyRules && s.turns && realmNation(s, a) !== actingNation) continue;
    const h = s.houses.find((h) => h.id === a.house)!,
      d = s.districts.find((d) => d.id === a.hex)!;
    if (a.pledgedTo && a.serviceUntil <= s.tick) {
      const original = s.armies.find(
        (v) => v.house === a.house && !v.pledgedTo && v.id !== a.id,
      );
      if (original) {
        for (const k of Object.keys(a.troops) as UnitKind[]) {
          original.troops[k] += a.troops[k];
          a.troops[k] = 0;
          original.wounded ??= {};
          original.wounded[k] =
            (original.wounded[k] ?? 0) + (a.wounded?.[k] ?? 0);
        }
        a.wounded = {};
      } else a.pledgedTo = undefined;
      a.path = [];
      h.summons = "Service ended: contingent returned to house command";
    }
    const demand =
        (troopCount(a) + woundedCount(a)) * (a.garrison ? 0.0004 : 0.002),
      available = feedArmy(s, a, demand, actingNation);
    a.supply = available;
    if (
      (!s.turns || h.nation === actingNation) &&
      a.supply >= 0.5 &&
      a.wounded &&
      !a.path.length &&
      !a.voyage
    ) {
      const controller = s.houses.find(
        (h) => h.id === (d.occupation ?? d.owner),
      );
      if (
        controller?.nation === a.origin &&
        !s.armies.some((e) => e.hex === a.hex && atWar(s, a, e))
      ) {
        let recovered = 0;
        for (const k of UNIT_KINDS) {
          const wounded = a.wounded[k] ?? 0;
          const healed = Math.min(
            wounded,
            Math.ceil(wounded * (d.city ? 0.25 : d.castle ? 0.2 : 0.1)),
          );
          a.wounded[k] = wounded - healed;
          a.troops[k] += healed;
          recovered += healed;
        }
        if (recovered)
          s.log.unshift(
            `${a.name}: ${recovered} wounded soldiers recover${d.city ? " in the city" : d.castle ? " at the castle" : " at a friendly camp"}.`,
          );
      }
    }
    a.morale = Math.max(
      15,
      Math.min(
        100,
        a.morale + (a.supply < 0.5 ? -3 : 1) + (armyLoyalty(s, a) - 50) / 25,
      ),
    );
    let attr = a.garrison ? 0 : BIOMES[d.biome].attrition;
    if (d.biome === "tundra" || d.biome === "glacier")
      attr *= a.origin === "varnesk" ? BALANCE.winter : 1;
    if (a.supply < 0.5) attr += 0.02;
    if (s.strategyRules && !a.garrison && season(s) === "Winter" && ["tundra", "mountains", "glacier"].includes(d.biome)) attr += a.origin === "varnesk" ? 0.005 : 0.015;
    for (const k of Object.keys(a.troops) as UnitKind[])
      a.troops[k] = Math.max(0, a.troops[k] - Math.floor(a.troops[k] * attr));
    const wages = troopCount(a) * (a.garrison ? 0.0002 : 0.001);
    const paid = Math.min(h.treasury, wages);
    h.treasury -= paid;
    if (paid < wages) {
      a.morale = Math.max(15, a.morale - 2);
      h.reasons.push("Unpaid wages: -2 army morale");
    }
    a.loyalty = Math.max(
      0,
      Math.min(
        100,
        (a.loyalty ?? 85) + (a.supply < 0.5 ? -3 : paid < wages ? -2 : 0.25),
      ),
    );
    const rebellionRisk = armyRebellionRisk(s, a);
    if (
      !a.rebel &&
      rebellionRisk > 0 &&
      (!s.turns || h.nation === actingNation) &&
      random(s) < rebellionRisk
    ) {
      a.rebel = true;
      a.pledgedTo = undefined;
      a.blockading = false;
      a.commander = "";
      a.path = findPath(
        s.districts,
        a.hex,
        NATIONS.find((n) => n.id === h.nation)!.capital,
      );
      s.log.unshift(
        `${a.name} mutinied: low army loyalty and morale turned the host against its crown.`,
      );
    }
    if (a.delay > 0) {
      a.delay--;
      if (a.delay === 0)
        h.summons =
          "Delayed contingent arrived; agreed campaign service active";
      continue;
    }
    if (a.garrison || s.sieges?.some((siege) => siege.army === a.id)) {
      a.path = [];
      a.fatigue = Math.max(0, a.fatigue - 2);
      continue;
    }
    if (
      s.turns &&
      s.houses.find((h) => h.id === commandHouse(s, a))?.nation !== actingNation
    )
      continue;
    if (a.voyage) {
      const voyage = a.voyage,
        seaHex =
          voyage.path[Math.min(voyage.progress + 1, voyage.path.length - 1)];
      const intercept = s.armies.some(
        (enemy) =>
          enemy.id !== a.id &&
          atWar(s, a, enemy) &&
          s.districts.find((d) => d.id === enemy.hex)?.port &&
          neighbors(s.districts, enemy.hex).some((n) => n.id === seaHex),
      );
      if (intercept) {
        s.log.unshift(`${a.name} transport blocked by hostile coastal forces.`);
        continue;
      }
      voyage.progress++;
      if (random(s) < s.config.maritimeHazard)
        for (const k of Object.keys(a.troops) as UnitKind[])
          a.troops[k] = Math.max(
            0,
            a.troops[k] - Math.ceil(a.troops[k] * 0.03),
          );
      if (voyage.progress >= voyage.path.length - 1) {
        if (s.turns && queueAttack(s, a, voyage.destination)) continue;
        const enemy = s.armies.find(
          (e) =>
            e.hex === voyage.destination && troopCount(e) > 0 && atWar(s, a, e),
        );
        a.voyage = undefined;
        if (enemy && !s.battles.some((b) => b.armies.includes(enemy.id))) {
          s.battles.push(makeBattle(s, a, enemy, d.id));
          a.hex = enemy.hex;
        } else {
          a.hex = voyage.destination;
          const dest = s.districts.find((d) => d.id === a.hex)!;
          if (
            dest.owner &&
            s.wars.includes(
              [a.origin, s.houses.find((h) => h.id === dest.owner)!.nation]
                .sort()
                .join("|"),
            )
          ) {
            dest.occupation = a.house;
            dest.occupiedAt = s.tick;
          }
        }
      }
      continue;
    }
    if (a.path.length && (s.turns || s.tick % BIOMES[d.biome].cost === 0)) {
      const target = s.districts.find((d) => d.id === a.path[0]);
      if (
        !target ||
        target.biome === "sea" ||
        target.biome === "legacy" ||
        (target.id !== a.hex &&
          !neighbors(s.districts, a.hex).some((n) => n.id === target.id))
      ) {
        a.path = [];
        continue;
      }
      if (s.turns && queueAttack(s, a, target.id)) continue;
      const enemy = s.armies.find(
        (e) => e.hex === target.id && troopCount(e) > 0 && atWar(s, a, e),
      );
      if (enemy) {
        if (
          !s.battles.some(
            (b) => b.armies.includes(a.id) || b.armies.includes(enemy.id),
          )
        ) {
          const b = makeBattle(s, a, enemy, a.hex);
          s.battles.push(b);
          a.hex = target.id;
          a.path = [];
          s.log.unshift(
            `Encounter queued: ${a.name} meets ${enemy.name} at ${target.name}.`,
          );
        }
        continue;
      }
      a.hex = target.id;
      a.path.shift();
      a.fatigue = Math.min(100, a.fatigue + 4);
      if (
        target.owner &&
        s.wars.includes(
          [a.origin, s.houses.find((h) => h.id === target.owner)!.nation]
            .sort()
            .join("|"),
        )
      ) {
        if (target.occupation !== a.house) {
          target.occupation = a.house;
          target.occupiedAt = s.tick;
        }
        target.unrest = Math.min(100, target.unrest + 5);
      } else if (target.occupation === a.house) target.occupation = undefined;
    } else {
      a.fatigue = Math.max(0, a.fatigue - 2);
      if (h.stock.herbs >= 1 && a.morale < 100) {
        h.stock.herbs -= 1;
        a.morale = Math.min(100, a.morale + 1);
      }
    }
  }
  s.armies = s.armies.filter(
    (a) => a.garrison || troopCount(a) > 0 || woundedCount(a) > 0,
  );
  advanceStrategy(s, actingNation);
  updateIntelligence(s);
  // Deterministic bot commands use the same validated reducer as human commands.
  for (const h of s.houses.filter(
    (h) => !s.turns && !h.reasons.includes("Human commander") && !h.rebellion,
  )) {
    if (s.battles.length) break;
    let a = s.armies.find(
      (a) => a.house === h.id && !a.garrison && !a.pledgedTo,
    );
    if (
      !a &&
      h.role === "crown" &&
      s.tick % 8 === 0 &&
      s.wars.some((w) => w.split("|").includes(h.nation))
    ) {
      const reserve = s.armies.find(
        (v) => v.house === h.id && v.garrison && troopCount(v) >= 1000,
      );
      if (reserve) {
        try {
          const next = applyCommand(
            s,
            { house: h.id },
            { type: "muster", army: reserve.id, count: 500 },
          );
          s.armies = next.armies;
          h.treasury = next.houses.find((v) => v.id === h.id)!.treasury;
          h.stock = next.houses.find((v) => v.id === h.id)!.stock;
          a = s.armies.find(
            (v) => v.house === h.id && !v.garrison && !v.pledgedTo,
          );
        } catch {
          /* Save food and coins before mobilizing. */
        }
      }
    }
    if (!a) a = s.armies.find((v) => v.house === h.id && v.garrison);
    if (!a || a.pledgedTo) continue;
    if (s.tick % 60 === 0 && h.role === "crown" && s.wars.length < 6) {
      const foreign = s.districts.filter(
        (d) =>
          d.nation &&
          d.nation !== h.nation &&
          neighbors(s.districts, d.id).some((n) => n.nation === h.nation),
      );
      const opponent = foreign[Math.floor(random(s) * foreign.length)]?.nation;
      if (opponent) {
        try {
          const next = applyCommand(
            s,
            { house: h.id },
            { type: "war", nation: opponent },
          );
          s.wars = next.wars;
          s.log = next.log;
        } catch {
          /* Already at war. */
        }
      }
    }
    if (
      s.tick % 24 === 0 &&
      h.treasury > 150 &&
      s.districts.find((d) => d.id === a.hex)?.owner === h.id
    ) {
      try {
        const next = applyCommand(
          s,
          { house: h.id },
          { type: "recruit", army: a.id, kind: "spearmen" },
        );
        a.troops = next.armies.find((v) => v.id === a.id)!.troops;
        const nh = next.houses.find((v) => v.id === h.id)!;
        h.treasury = nh.treasury;
        h.stock = nh.stock;
      } catch {
        /* Shortages postpone recruiting. */
      }
    }
    if (s.tick % 8 === 0 && !a.garrison && !a.path.length) {
      const enemy = s.armies
        .filter((e) => atWar(s, a, e))
        .sort(
          (x, y) =>
            hexDistance(
              s.districts.find((d) => d.id === a.hex)!,
              s.districts.find((d) => d.id === x.hex)!,
            ) -
            hexDistance(
              s.districts.find((d) => d.id === a.hex)!,
              s.districts.find((d) => d.id === y.hex)!,
            ),
        )[0];
      if (enemy) {
        a.path = findPath(s.districts, a.hex, enemy.hex);
        if (!a.path.length && !a.voyage) {
          const port = s.districts.find(
            (d) =>
              d.port &&
              d.nation === enemy.origin &&
              findPath(s.districts, a.hex, d.id, true).length,
          );
          if (port) {
            try {
              const next = applyCommand(
                s,
                { house: h.id },
                { type: "embark", army: a.id, hex: port.id },
              );
              a.voyage = next.armies.find((v) => v.id === a.id)!.voyage;
              const nh = next.houses.find((v) => v.id === h.id)!;
              h.treasury = nh.treasury;
              h.stock = nh.stock;
            } catch {
              /* Funds or infrastructure can delay the fleet. */
            }
          }
        }
      }
    }
    if (
      s.tick % 18 === 0 &&
      h.role === "crown" &&
      !s.routes.some((r) => r.house === h.id)
    ) {
      const from = s.districts.find((d) => d.owner === h.id)!,
        to = s.districts.find(
          (d) =>
            d.owner &&
            d.owner !== h.id &&
            !s.wars.includes(
              [h.nation, s.houses.find((v) => v.id === d.owner)!.nation]
                .sort()
                .join("|"),
            ),
        );
      if (to) {
        try {
          const next = applyCommand(
            s,
            { house: h.id },
            {
              type: "route",
              from: from.id,
              to: to.id,
              resource: from.resource,
              maritime: false,
            },
          );
          s.routes = next.routes;
          h.treasury = next.houses.find((v) => v.id === h.id)!.treasury;
          s.serial = next.serial;
        } catch {
          /* Bot retries later when funds or path permit. */
        }
      }
    }
  }
  // AI-only encounters resolve through the same aftermath path without opening combat.
  while (s.battles[0] && !hasHumanParticipant(s, s.battles[0]))
    autoResolve(s, s.battles[0]);
  initializeAgreements(s);
  s.log = s.log.slice(0, 70);
  return s;
}
export function advanceTactical(current: Campaign, dt = 0.25): Campaign {
  const s = structuredClone(current);
  need(Number.isFinite(dt) && dt > 0 && dt <= 1, "Invalid tactical step");
  while (s.battles[0] && !hasHumanParticipant(s, s.battles[0]))
    autoResolve(s, s.battles[0]);
  if (s.battles[0]) advanceBattle(s, s.battles[0], dt);
  const battle = s.battles[0];
  if (
    battle?.rounds &&
    battle.phase === "combat" &&
    battle.rounds.committed.length
  ) {
    for (const id of battle.armies) {
      if (s.appliedResults.includes(battle.id)) break;
      const army = s.armies.find((a) => a.id === id)!;
      const human =
        !army.rebel &&
        s.houses
          .find((h) => h.id === commandHouse(s, army))
          ?.reasons.includes("Human commander");
      if (!human && !battle.rounds.committed.includes(id))
        commitBattlePlan(s, battle, id, botBattlePlan(s, battle, id));
    }
  }
  while (s.battles[0] && !hasHumanParticipant(s, s.battles[0]))
    autoResolve(s, s.battles[0]);
  completeTurn(s);
  return s;
}
export function priceExplanation(s: Campaign, r: Resource) {
  const total = s.houses.reduce((n, h) => n + h.stock[r], 0);
  return `Base ${r === "luxury" ? 9 : r === "iron" ? 6 : 4} × 1800 / max(900, world stock ${Math.floor(total)}), bounded 1–12 coins. Current ${s.prices[r]}.`;
}

/** Run automatic seats only until a human turn, response, or tactical battle. */
export function runAutomaticTurns(current: Campaign): Campaign {
  if (current.agreements?.campaign.result) return current;
  const rebelResponse = (s: Campaign) => {
    const r = s.turns?.pending[0];
    const defenders = r?.kind === "attack" ? defendingArmies(s, r) : [];
    return defenders.length > 0 && defenders.every((a) => a.rebel);
  };
  if (
    !current.turns ||
    !current.houses.some((h) => h.reasons.includes("Human commander") && current.titles.some((t) => t.holder === h.id))
  )
    return current;
  if (current.turns.pending.some((r) => r.kind === "attack" && !current.armies.some((a) => a.id === r.army && troopCount(a) > 0))) {
    const pruned = structuredClone(current); completeTurn(pruned); return runAutomaticTurns(pruned);
  }
  const awaiting = current.turns.pending[0]?.to ?? activeTurnHouse(current);
  if (
    !current.turns.ending &&
    !rebelResponse(current) &&
    current.houses
      .find((h) => h.id === awaiting)
      ?.reasons.includes("Human commander")
  )
    return current;
  let s = structuredClone(current);
  for (let step = 0; step < 64; step++) {
    completeTurn(s);
    if (s.agreements?.campaign.result) break;
    if (s.battles.length) break;
    const r = s.turns!.pending[0];
    if (r) {
      const h = s.houses.find((h) => h.id === r.to)!;
      if (h.reasons.includes("Human commander") && !rebelResponse(s)) break;
      let choice: "accept" | "decline" | "defend" | "withdraw" = "defend";
      if (r.kind === "marriage")
        choice =
          s.wars.includes(
            [h.nation, s.houses.find((h) => h.id === r.from)!.nation]
              .sort()
              .join("|"),
          ) || (h.relations[r.from] ?? 0) < 0
            ? "decline"
            : "accept";
      if (r.kind === "peace") {
        const enemy = s.houses.find((h) => h.id === r.from)!;
        const losingLand = s.districts.some(
          (d) => d.nation === h.nation && d.occupation === enemy.id,
        );
        const strength = (nation: string) =>
          s.armies
            .filter((a) => a.origin === nation)
            .reduce((n, a) => n + troopCount(a), 0);
        choice =
          losingLand &&
          strength(h.nation) > strength(enemy.nation) &&
          h.stock.grain > 30
            ? "decline"
            : "accept";
        if (r.terms && r.terms.kind !== "white") {
          const score = warScore(s, enemy.nation, h.nation);
          choice = score >= (r.terms.kind === "claimant" ? 60 : r.terms.kind === "cede" || r.terms.kind === "tribute" ? 20 : 0) && (!r.terms.coins || h.treasury >= r.terms.coins) ? "accept" : "decline";
        }
      }
      if (r.kind === "surrender") {
        const siege = s.sieges?.find((v) => v.id === r.siege);
        choice = siege && siege.food <= 1 ? "accept" : "decline";
      }
      if (r.kind === "attack") {
        const forces = defendingArmies(s, r),
          attacker = s.armies.find((a) => a.id === r.army);
        choice =
          forces.length &&
          troopCount(forces[0]) *
            (1 + castleBonus(s.districts.find((d) => d.id === r.hex)!, s)) >=
            troopCount(attacker!) * (ruler(h)?.traits?.includes("cautious") ? 0.8 : ruler(h)?.traits?.includes("brave") ? 0.5 : 0.65)
            ? "defend"
            : "withdraw";
      }
      try {
        s = applyCommand(
          s,
          { house: r.to },
          { type: "respond", reaction: r.id, choice },
        );
      } catch (error) {
        if (r.kind === "attack" && choice === "withdraw")
          s = applyCommand(
            s,
            { house: r.to },
            { type: "respond", reaction: r.id, choice: "defend" },
          );
        else if (r.kind === "marriage" && choice === "accept")
          s = applyCommand(
            s,
            { house: r.to },
            { type: "respond", reaction: r.id, choice: "decline" },
          );
        else if (r.kind === "peace" && choice === "accept")
          s = applyCommand(s, { house: r.to }, { type: "respond", reaction: r.id, choice: "decline" });
        else throw Error(`Automatic ${r.kind} response could not resolve: ${error instanceof Error ? error.message : String(error)}`);
      }
      continue;
    }
    const id = activeTurnHouse(s),
      h = s.houses.find((h) => h.id === id);
    if (!h || h.reasons.includes("Human commander")) break;
    const stamp = `${s.turns!.round}:${s.turns!.index}`;
    if (s.turns!.prepared !== stamp) {
      s.turns!.prepared = stamp;
      const commands: Command[] = [];
      commands.push(...agreementBotCommands(s, h));
      const demand = s.houses.find((v) => v.liege === h.id && v.loyalty < 60 && v.demand?.status === "open");
      if (demand?.demand?.kind === "lower-taxes") commands.push({ type: "bargain", house: demand.id, offer: "lower-taxes" });
      if (demand?.demand?.kind === "protect-trade" && h.treasury >= 80) commands.push({ type: "bargain", house: demand.id, offer: "protect-trade" });
      if (demand?.demand?.kind === "council-seat") {
        const office = (["marshal", "steward", "chancellor", "spymaster"] as const).find((o) => !s.houses.some((v) => v.liege === h.id && v.contract?.office === o));
        if (office) commands.push({ type: "bargain", house: demand.id, offer: "council-seat", office });
      }
      const provoker = NATIONS.find(
        (n) => n.id !== h.nation && insultGrievances(s, h, n.id).length,
      );
      const estate = s.districts.find(
        (d) =>
          d.owner === h.id &&
          d.farm &&
          !d.occupation &&
          (d.harvestedAt === undefined ||
            s.tick - d.harvestedAt >= HARVEST_COOLDOWN),
      );
      if (estate) commands.push({ type: "harvest", hex: estate.id });
      if (s.wars.some((w) => w.split("|").includes(h.nation))) {
        const reserve = s.armies.find(
          (a) => a.house === h.id && a.garrison && troopCount(a) >= 1500,
        );
        if (reserve && !s.armies.some((a) => a.house === h.id && !a.garrison))
          commands.push({ type: "muster", army: reserve.id, count: 1000 });
      } else if (provoker) {
        commands.push({ type: "war", nation: provoker.id, reason: "insult" });
      } else if (s.turns!.round >= 4 && s.turns!.round % (ruler(h)?.traits?.includes("ambitious") ? 3 : 4) === 0 && (!ruler(h)?.traits?.includes("cautious") || h.stock.grain >= 80)) {
        const foreign = NATIONS.find((n) => conquestTargets(s, h, n.id).length);
        if (foreign)
          commands.push({
            type: "war",
            nation: foreign.id,
            reason: "territorial-conquest",
          });
      }
      const mobile = s.armies.find(
        (a) => a.house === h.id && !a.garrison && !a.path.length && !a.voyage,
      );
      if (mobile) {
        const siege = s.sieges?.find((v) => v.army === mobile.id);
        if (siege && siege.engines && siege.food > 1) commands.push({ type: "siege", army: mobile.id, hex: siege.hex, stance: "assault" });
        const occupied = s.districts.find(
          (d) =>
            d.id === mobile.hex &&
            d.occupation === h.id &&
            s.tick - (d.occupiedAt ?? s.tick) >= 3,
        );
        if (occupied) commands.push({ type: "annex", hex: occupied.id });
        const enemy = s.districts
          .filter(
            (d) =>
              d.owner &&
              s.wars.includes(
                [h.nation, s.houses.find((h) => h.id === d.owner)!.nation]
                  .sort()
                  .join("|"),
              ),
          )
          .sort(
            (a, b) =>
              hexDistance(s.districts.find((d) => d.id === mobile.hex)!, a) -
              hexDistance(s.districts.find((d) => d.id === mobile.hex)!, b),
          )[0];
        if (enemy && enemy.id !== mobile.hex && !siege) {
          if (enemy.castle && hexDistance(s.districts.find((d) => d.id === mobile.hex)!, enemy) === 1)
            commands.push({ type: "siege", army: mobile.id, hex: enemy.id, stance: "blockade" });
          else commands.push({ type: "move", army: mobile.id, hex: enemy.id });
        }
      }
      if (!s.routes.some((r) => r.house === h.id)) {
        const from = s.districts.find((d) => d.owner === h.id),
          to =
            from &&
            s.districts.find(
              (d) =>
                d.owner !== h.id &&
                d.owner &&
                !s.wars.includes(
                  [h.nation, s.houses.find((h) => h.id === d.owner)!.nation]
                    .sort()
                    .join("|"),
                ) &&
                findPath(s.districts, from.id, d.id).length,
            );
        if (from && to)
          commands.push({
            type: "route",
            from: from.id,
            to: to.id,
            resource: h.stock.grain < 50 ? "grain" : from.resource,
            import: h.stock.grain < 50,
            maritime: false,
          });
      }
      for (const cmd of commands) {
        if (s.turns!.pending.length || s.battles.length) break;
        try {
          s = applyCommand(s, { house: h.id }, cmd);
        } catch {
          /* Unaffordable or blocked plans wait for another turn. */
        }
      }
      if (s.turns!.pending.length) continue;
      // Newly mustered hosts receive an objective before committing the turn.
      for (const a of s.armies.filter(
        (a) => a.house === h.id && !a.garrison && !a.path.length && !s.sieges?.some((v) => v.army === a.id),
      )) {
        const target = s.districts.find(
          (d) =>
            d.owner &&
            d.id !== a.hex &&
            s.wars.includes(
              [h.nation, s.houses.find((v) => v.id === d.owner)!.nation]
                .sort()
                .join("|"),
            ) &&
            findPath(s.districts, a.hex, d.id).length,
        );
        if (target)
          try {
            s = applyCommand(
              s,
              { house: h.id },
              { type: "move", army: a.id, hex: target.id },
            );
          } catch {
            /* Island or hostile obstruction. */
          }
      }
    }
    s = applyCommand(s, { house: h.id }, { type: "endTurn" });
  }
  return s;
}
export function dispatchCommand(s: Campaign, actor: Actor, cmd: Command) {
  return runAutomaticTurns(applyCommand(s, actor, cmd));
}
