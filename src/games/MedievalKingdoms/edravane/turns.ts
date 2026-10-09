import type { Actor, Army, Campaign, Command, Reaction } from "./types.ts";
import { NATIONS, hexDistance, neighbors } from "./world.ts";
import { atWar, makeBattle, startCombat, troopCount } from "./battle.ts";
import { resolveSurrender, settlePeace } from "./campaignStrategy.ts";
import { event } from "./realm.ts";
import { updateCampaignOutcome } from "./agreements.ts";

function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
export function initializeTurns(s: Campaign, nation: string) {
  const order = NATIONS.map((n) => n.id),
    first = Math.max(0, order.indexOf(nation));
  s.turns = {
    order: [...order.slice(first), ...order.slice(0, first)],
    index: 0,
    round: 1,
    pending: [],
  };
  s.paused = false;
}
export function activeTurnHouse(s: Campaign) {
  return s.turns
    ? s.titles.find((t) => t.nation === s.turns!.order[s.turns!.index])?.holder
    : undefined;
}
export function reactionController(s: Campaign, house: string) {
  const h = s.houses.find((h) => h.id === house)!;
  return h.liege ?? h.id;
}
export function addReaction(s: Campaign, r: Omit<Reaction, "id" | "created">) {
  require(s.turns, "Turn-based campaign required");
  const reaction = { ...r, id: `reaction-${++s.serial}`, created: s.tick };
  s.turns.pending.push(reaction);
  return reaction;
}
export function authorizeTurn(s: Campaign, actor: Actor, cmd: Command) {
  if (cmd.type === "continueSandbox") {
    require(s.mode === "single" && s.agreements?.campaign.result && s.houses.find((h) => h.id === actor.house)?.reasons.includes("Human commander"), "Only the solo player can continue a completed chronicle");
    return;
  }
  if (
    !s.turns ||
    [
      "stand",
      "retreat",
      "order",
      "battlePause",
      "battlePlan",
      "battleReinforce",
    ].includes(cmd.type)
  )
    return;
  const reaction = s.turns.pending[0];
  if (cmd.type === "respond") {
    require(reaction?.id ===
      cmd.reaction, "Response is stale or already resolved");
    require(reaction.to ===
      actor.house, "Only the receiving player can respond");
    return;
  }
  require(cmd.type !==
    "pause", "Campaign waits for End turn; no campaign timer to pause");
  if (reaction) {
    require(reaction.to ===
      actor.house, "Waiting for the other player to respond");
    require((reaction.kind === "war" || reaction.kind === "attack") &&
      [
        "muster",
        "recruit",
        "upgradeCastle",
        "summon",
        "move",
        "embark",
      ].includes(
        cmd.type,
      ), "Resolve the pending response before taking another action");
  } else {
    require(activeTurnHouse(s) === actor.house, "It is not your turn");
    require(!s.turns.ending, "Your turn is resolving");
  }
}
export function completeTurn(s: Campaign) {
  const t = s.turns;
  if (t) t.pending = t.pending.filter((r) => r.kind !== "attack" || s.armies.some((a) => a.id === r.army && troopCount(a) > 0));
  if (!t?.ending || t.pending.length || s.battles.length) return;
  const ended = t.ending;
  t.index = (t.index + 1) % t.order.length;
  if (!t.index) t.round++;
  delete t.ending;
  delete t.prepared;
  s.log.unshift(
    `${ended} ended its turn. ${t.order[t.index]}'s turn · round ${t.round}.`,
  );
  updateCampaignOutcome(s);
}
export function queueAttack(s: Campaign, a: Army, hex: string) {
  if (!s.turns) return false;
  const d = s.districts.find((d) => d.id === hex)!;
  const enemy = s.armies.find(
    (e) => e.hex === hex && troopCount(e) > 0 && atWar(s, a, e),
  );
  const owner = d.owner
    ? s.houses.find((h) => h.id === (d.occupation ?? d.owner))
    : undefined;
  const hostile =
    owner &&
    s.wars.includes([a.origin, owner.nation].sort().join("|")) &&
    d.occupation !== a.house;
  if (!enemy && !hostile) return false;
  const to = reactionController(s, enemy?.house ?? owner!.id);
  if (!s.turns.pending.some((r) => r.kind === "attack" && r.army === a.id))
    addReaction(s, {
      kind: "attack",
      from: a.pledgedTo ?? a.house,
      to,
      army: a.id,
      hex,
    });
  s.log.unshift(
    `${a.name} threatens ${d.settlement}. The defender must respond before entry.`,
  );
  return true;
}
export function defendingArmies(s: Campaign, r: Reaction) {
  const attacker = s.armies.find((a) => a.id === r.army),
    d = s.districts.find((d) => d.id === r.hex);
  if (!attacker || !d) return [];
  return s.armies
    .filter(
      (a) =>
        troopCount(a) > 0 &&
        atWar(s, attacker, a) &&
        reactionController(s, a.house) === r.to &&
        (a.hex === d.id ||
          (!a.garrison &&
            !a.voyage &&
            hexDistance(s.districts.find((d) => d.id === a.hex)!, d) <= 1)),
    )
    .sort((a, b) => troopCount(b) - troopCount(a));
}
function warKey(s: Campaign, a: string, b: string) {
  return [
    s.houses.find((h) => h.id === a)!.nation,
    s.houses.find((h) => h.id === b)!.nation,
  ]
    .sort()
    .join("|");
}
export function resolveReaction(
  s: Campaign,
  cmd: Extract<Command, { type: "respond" }>,
) {
  const t = s.turns!,
    r = t.pending[0];
  require(r?.id === cmd.reaction, "Response is stale or already resolved");
  const from = s.houses.find((h) => h.id === r.from)!,
    to = s.houses.find((h) => h.id === r.to)!;
  if (r.kind === "surrender") {
    resolveSurrender(s, r, cmd.choice);
    t.pending.shift(); completeTurn(s); return;
  }
  if (cmd.choice === "peace" && (r.kind === "war" || r.kind === "attack")) {
    require(!r.negotiated, "A peace counterproposal was already offered");
    require(s.wars.includes(
      warKey(s, r.from, r.to),
    ), "No diplomatic war to negotiate; defend against the rebel force");
    r.negotiated = true;
    const proposal = addReaction(s, { kind: "peace", from: r.to, to: r.from });
    t.pending.pop();
    t.pending.unshift(proposal);
    s.log.unshift(`${to.name} requests peace in response to ${from.name}.`);
    return;
  }
  if (r.kind === "marriage") {
    const partner = s.houses.find((h) => h.id === (r.partnerHouse ?? r.to))!;
    require(cmd.choice === "accept" ||
      cmd.choice === "decline", "Accept or decline the marriage pact");
    if (cmd.choice === "accept") {
      const a = from.family.find((p) => p.id === r.people?.[0]),
        b = partner.family.find((p) => p.id === r.people?.[1]);
      require(a &&
        b &&
        a.alive &&
        b.alive &&
        !a.spouse &&
        !b.spouse &&
        !a.imprisonedBy &&
        !b.imprisonedBy, "The proposed heirs are no longer eligible");
      require(!s.wars.includes(
        warKey(s, r.from, r.to),
      ), "Make peace before accepting a marriage pact");
      a.spouse = b.id;
      b.spouse = a.id;
      const bonus = from.nation === "ilyr-coast" || partner.nation === "ilyr-coast" ? 35 : 25;
      from.relations[partner.id] = (from.relations[partner.id] ?? 0) + bonus;
      partner.relations[from.id] = (partner.relations[from.id] ?? 0) + bonus;
      partner.opinion = Math.min(100, partner.opinion + 12);
      event(s, { kind: "diplomacy", house: from.id, other: to.id, person: a.id, title: "A marriage binds two houses", detail: `${a.name} and ${b.name} marry. Their living marriage creates an alliance; children retain the mother's house claim.` });
    }
    t.pending.shift();
    s.log.unshift(
      `${to.name} ${cmd.choice === "accept" ? "accepted" : "declined"} ${from.name}'s marriage pact.`,
    );
  } else if (r.kind === "peace") {
    require(cmd.choice === "accept" ||
      cmd.choice === "decline", "Accept or decline the peace offer");
    t.pending.shift();
    if (cmd.choice === "accept") {
      if (s.strategyRules) settlePeace(s, from, to, r.terms);
      const key = warKey(s, r.from, r.to);
      s.wars = s.wars.filter((w) => w !== key);
      for (const i of s.insults ?? []) {
        const sender = s.houses.find((h) => h.id === i.from);
        const receiver = s.houses.find((h) => h.id === i.to);
        if (
          sender &&
          receiver &&
          [sender.nation, receiver.nation].sort().join("|") === key
        )
          i.resolved = true;
      }
      t.pending = t.pending.filter(
        (p) =>
          !(
            ["war", "attack", "surrender"].includes(p.kind) &&
            warKey(s, p.from, p.to) === key
          ),
      );
      for (const a of s.armies.filter(
        (a) => !a.rebel && [from.nation, to.nation].includes(a.origin),
      )) {
        a.path = [];
        a.objective = undefined;
      }
    }
    s.log.unshift(
      `${to.name} ${cmd.choice === "accept" ? "accepted" : "declined"} peace with ${from.name}.`,
    );
  } else if (r.kind === "war") {
    require(cmd.choice === "defend", "Prepare defenses or offer peace");
    t.pending.shift();
    s.log.unshift(`${to.name} prepared defenses against ${from.name}.`);
  } else {
    require(cmd.choice === "defend" ||
      cmd.choice ===
        "withdraw", "Defend the territory, withdraw, or offer peace");
    const a = s.armies.find((a) => a.id === r.army),
      d = s.districts.find((d) => d.id === r.hex);
    require(a && d && troopCount(a) > 0, "Attacking army no longer exists");
    const defenders = defendingArmies(s, r);
    if (cmd.choice === "defend") {
      const defender = cmd.army
        ? defenders.find((a) => a.id === cmd.army)
        : defenders[0];
      require(defender, "No defending force; withdraw to cede the field");
      const approach = a.hex;
      defender.hex = d.id;
      defender.path = [];
      const battle = makeBattle(s, a, defender, approach);
      a.hex = d.id;
      a.path = [];
      a.voyage = undefined;
      battle.stood = [a.id, defender.id];
      startCombat(battle);
      s.battles.push(battle);
      s.log.unshift(
        `${to.name} defends ${d.settlement} with ${defender.name}.`,
      );
    } else {
      const stationed = defenders.filter((v) => v.hex === d.id);
      // Validate every escape before changing any troops or conceding the field.
      const escapes = stationed.map((v) => ({
        army: v,
        hex: neighbors(s.districts, d.id)
          .sort(
            (x, y) =>
              Number(
                s.houses.find((h) => h.id === y.owner)?.nation === v.origin,
              ) -
              Number(
                s.houses.find((h) => h.id === x.owner)?.nation === v.origin,
              ),
          )
          .find(
            (n) =>
              n.owner &&
              n.id !== a.hex &&
              !s.armies.some(
                (e) => e.hex === n.id && troopCount(e) > 0 && atWar(s, v, e),
              ),
          ),
      }));
      require(escapes.every(
        (e) => e.hex,
      ), "No safe withdrawal route; defend the castle");
      for (const e of escapes) {
        e.army.hex = e.hex!.id;
        e.army.garrison = false;
        e.army.path = [];
        e.army.blockading = false;
        for (const k of Object.keys(e.army.troops) as Array<
          keyof Army["troops"]
        >)
          e.army.troops[k] = Math.round(e.army.troops[k] * 0.98);
      }
      a.hex = d.id;
      a.path = [];
      a.voyage = undefined;
      const remaining = s.armies.find(
        (v) => v.hex === d.id && troopCount(v) > 0 && atWar(s, a, v),
      );
      const friendly =
        !a.rebel && s.houses.find((h) => h.id === d.owner)?.nation === a.origin;
      d.occupation = remaining || friendly ? undefined : a.house;
      d.occupiedAt = d.occupation ? s.tick : undefined;
      if (remaining)
        addReaction(s, {
          kind: "attack",
          from: r.from,
          to: reactionController(s, remaining.house),
          army: a.id,
          hex: d.id,
        });
      else d.unrest = Math.min(100, d.unrest + 10);
      s.log.unshift(
        `${to.name} withdrew from ${d.settlement}${remaining ? "; further defenders must respond before occupation" : `; ${from.name} occupies the field`}.`,
      );
    }
    t.pending.shift();
  }
  completeTurn(s);
}
