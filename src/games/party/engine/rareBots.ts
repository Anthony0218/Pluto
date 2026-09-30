import { BOT_HAZARD_WEIGHTS, DUEL_BOT_SKILL, RULES } from "../config.ts";
import { canSummonAnimal } from "../animals/runtime.ts";
import { irradiatedNodeIds } from "../hazards/radiation.ts";
import { falloutBlastNodes } from "../items/rare.ts";
import type {
  BoardMap,
  GameAction,
  ItemInstance,
  Match,
  Player,
  Settings,
} from "../types.ts";
import type { Random } from "./engine.ts";
import { graphDistances } from "./graph.ts";
import { activeRestrictions } from "./routes.ts";

// Board-bot decisions for Milestone 8 rare items and board hazards. Heuristics only, using only public
// state; every resulting action is validated by the authority like a human request.

const pick = <T,>(items: readonly T[], random: Random): T =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))];
const progress = (p: Player, settings: Settings) =>
  settings.victory === "plutos" ? p.goldenPlutos : p.coins;
const goal = (settings: Settings) =>
  settings.victory === "plutos" ? settings.plutoTarget : settings.coinTarget;
function duelOdds(me: Player, opponent: Player): number {
  const mine = DUEL_BOT_SKILL[me.difficulty],
    theirs = DUEL_BOT_SKILL[opponent.isBot ? opponent.difficulty : "medium"];
  return mine / (mine + theirs);
}

// Pocket Duel: losing costs nothing, but a win for the opponent is a free Pluto for them.
export function pocketDuelAction(
  state: Match,
  me: Player,
  item: ItemInstance,
  random: Random,
  settings: Settings,
): GameAction | null {
  const opponents = state.players.filter((p) => p.id !== me.id);
  if (!opponents.length) return null;
  let target: Player;
  if (me.difficulty === "easy") target = pick(opponents, random);
  else if (me.difficulty === "medium")
    target = [...opponents].sort(
      (a, b) => duelOdds(me, b) - duelOdds(me, a) || a.goldenPlutos - b.goldenPlutos,
    )[0];
  else {
    const plutoGoal = settings.victory === "plutos" ? settings.plutoTarget : Infinity;
    const score = (p: Player) => {
      const odds = duelOdds(me, p);
      // Handing a near-winner their last Pluto is the real risk; winning our own last one is the prize.
      const danger = p.goldenPlutos >= plutoGoal - 1 ? (1 - odds) * 0.8 : 0;
      const prize = me.goldenPlutos >= plutoGoal - 1 ? odds * 0.5 : 0;
      return odds - danger + prize - p.goldenPlutos * 0.01;
    };
    target = [...opponents].sort((a, b) => score(b) - score(a))[0];
  }
  return { type: "USE_ITEM", itemInstanceId: item.instanceId, targetPlayerId: target.id };
}

// Fallout Core: only zones containing at least one opponent are ever considered.
export function falloutCoreAction(
  state: Match,
  map: BoardMap,
  me: Player,
  item: ItemInstance,
  random: Random,
  settings: Settings,
): GameAction | null {
  const opponents = state.players.filter((p) => p.id !== me.id);
  const leaderProgress = Math.max(...opponents.map((p) => progress(p, settings)));
  const irradiated = irradiatedNodeIds(state);
  const candidates: { nodeId: string; score: number }[] = [];
  // ~60 nodes × (1 + degree): cheap enough to evaluate every centre.
  for (const node of map.nodes) {
    const zone = falloutBlastNodes(map, node.id);
    const caught = opponents.filter((p) => zone.includes(p.currentNodeId));
    if (!caught.length) continue;
    let score = 0;
    for (const p of caught) {
      score += 100 + Math.min(p.coins, RULES.koCoins) * 2;
      if (p.hp <= 10) score += 10;
      if (progress(p, settings) === leaderProgress && leaderProgress > 0) score += 40;
    }
    score += zone.filter((id) => state.plutoNodeIds.includes(id)).length * 10;
    score -= zone.filter((id) => irradiated.has(id)).length * 5;
    if (zone.includes(me.currentNodeId)) score -= 25;
    candidates.push({ nodeId: node.id, score });
  }
  if (!candidates.length) return null;
  const detonate = (nodeId: string): GameAction => ({
    type: "USE_ITEM",
    itemInstanceId: item.instanceId,
    targetNodeId: nodeId,
  });
  if (me.difficulty === "easy") return random() < 0.6 ? detonate(pick(candidates, random).nodeId) : null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  // Medium settles for one opponent; hard waits for a juicier blast unless someone is near the goal.
  const nearGoal = leaderProgress >= goal(settings) * 0.6;
  const threshold = me.difficulty === "hard" && !nearGoal && random() < 0.5 ? 180 : 100;
  return best.score >= threshold ? detonate(best.nodeId) : null;
}

export function wildTotemAction(
  state: Match,
  map: BoardMap,
  me: Player,
  item: ItemInstance,
  random: Random,
): GameAction | null {
  if (!canSummonAnimal(state, me.id)) return null;
  const summon: GameAction = { type: "USE_ITEM", itemInstanceId: item.instanceId };
  if (me.difficulty === "easy") return random() < 0.5 ? summon : null;
  if (me.difficulty === "medium") return summon;
  // Hard: summon when opponents are close enough to be hunted soon (or eventually, to avoid hoarding).
  const distances = graphDistances(map, me.currentNodeId, 8);
  const nearby = state.players.some((p) => p.id !== me.id && distances.has(p.currentNodeId));
  return nearby || random() < 0.25 ? summon : null;
}

// Route-scoring penalty for ending a move on `landing`: irradiated spaces and hostile animals nearby.
// Never absolute: a Golden Pluto (+100 in the path scorer) still outweighs it.
export function hazardScorer(
  state: Match,
  map: BoardMap,
  me: Player,
  random: Random,
): (landing: string) => number {
  const difficulty = me.difficulty;
  const ignoreRadiation = random() < BOT_HAZARD_WEIGHTS.ignoreChance[difficulty];
  const irradiated = irradiatedNodeIds(state);
  const weights = BOT_HAZARD_WEIGHTS.animal[difficulty],
    restrictions = activeRestrictions(state);
  const threats = state.animals
    .filter((a) => a.ownerPlayerId !== me.id)
    .map((a) => {
      // Hard bots scale the danger radius with the animal's speed.
      const near = difficulty === "hard" ? Math.max(BOT_HAZARD_WEIGHTS.animalNear, a.movementPerPhase) : BOT_HAZARD_WEIGHTS.animalNear;
      const far = difficulty === "hard" ? near + 3 : BOT_HAZARD_WEIGHTS.animalFar;
      return { near, far, distances: graphDistances(map, a.currentNodeId, far, restrictions) };
    });
  return (landing) => {
    let penalty = 0;
    if (!ignoreRadiation && irradiated.has(landing))
      penalty += BOT_HAZARD_WEIGHTS.radiation[difficulty];
    for (const threat of threats) {
      const d = threat.distances.get(landing);
      if (d === undefined) continue;
      penalty += d <= threat.near ? weights.near : weights.far;
    }
    return penalty;
  };
}
