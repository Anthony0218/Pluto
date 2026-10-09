import type { MinigameCreateContext, MinigameDefinition } from "../types.ts";
import { applyMove, base, BOT_REACTION, clamp, control, distance, move, parseMove, toward, type Mover, type MovingState, type MoveInput } from "../festivalGames/common.ts";

export const KITCHEN_X = { supply: 12, chop: 36, oven: 63, serve: 88 };
export const kitchenY = (team: number) => team === 0 ? 28 : 72;
interface Chef extends Mover { team: number; holding: "raw" | "chopped" | "cooked" | null; chopProgress: number; actionHeld: boolean; }
export interface KitchenPot { readyAt: number; burnsAt: number; }
export interface KitchenState extends MovingState {
  players: Record<string, Chef>;
  teams: { ids: string[]; served: number; burnt: number; pots: (KitchenPot | null)[] }[];
  bots: Record<string, number>;
}
function create(c: MinigameCreateContext): KitchenState {
  const ids = c.participants.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(c.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const teams = [0, 1].map((team) => ({ ids: ids.slice(team * 2, team * 2 + 2), served: 0, burnt: 0, pots: [null, null] as (KitchenPot | null)[] }));
  return { ...base(c), players: Object.fromEntries(teams.flatMap((team, n) => team.ids.map((id, i) => [id, { x: 18 + i * 12, y: kitchenY(n) + (i ? 8 : -8), score: 0, stunnedUntil: 0, team: n, holding: null, chopProgress: 0, actionHeld: false }]))), teams, bots: {} };
}
export const kitchenChaos: MinigameDefinition<KitchenState, MoveInput> = {
  id: "kitchen-chaos", name: "Kitchen Chaos", description: "Two cosmic diners, two teams. Chop moon vegetables, watch the ovens and serve soup before it burns!",
  instructions: ["Your randomly assigned team shares a kitchen and a score. Both chefs can perform any job.", "Tap Space at SUPPLY to take ingredients. Hold Space at CHOP for 1.2 seconds to prepare them.", "Tap Space at an oven to cook chopped ingredients. Cooking takes 2 seconds; retrieve the soup before it burns 5.5 seconds later.", "Either partner can retrieve a cooked pot and serve it at SERVE for 1 team point. A chopped dish can swap with a cooked pot, so full hands never block the kitchen. Both teammates receive equal scores."],
  controls: "WASD / arrows · Space to interact (hold to chop) · touch pad and Interact", durationSeconds: 65, gameType: "main", supportsBots: true, snapshotIntervalMs: 100, create, parseInput: parseMove, applyInput: applyMove,
  teamOf: (s, id) => String(s.players[id].team + 1),
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime) return false;
    while (s.simTime < end) {
      const at = Math.min(s.simTime + 20, end), dt = (at - s.simTime) / 1000;
      for (const team of s.teams) team.pots.forEach((pot, i) => { if (pot && at >= pot.burnsAt) { team.pots[i] = null; team.burnt++; } });
      for (const [id, p] of Object.entries(s.players)) {
        const input = control(s, id, at), team = s.teams[p.team], y = kitchenY(p.team);
        move(p, input, p.holding ? 24 : 29, dt, at); p.y = clamp(p.y, y - 16, y + 16);
        const near = (x: number) => distance(p, { x, y }) <= 8;
        if (p.holding === "raw" && near(KITCHEN_X.chop) && input?.action) {
          p.chopProgress += dt;
          if (p.chopProgress >= 1.2) { p.holding = "chopped"; p.chopProgress = 0; }
        } else p.chopProgress = 0;
        if (input?.action && !p.actionHeld) {
          if (near(KITCHEN_X.supply) && !p.holding) p.holding = "raw";
          else if (near(KITCHEN_X.oven)) {
            const ready = team.pots.findIndex((pot) => pot && at >= pot.readyAt);
            const empty = team.pots.findIndex((pot) => !pot);
            if (p.holding === "chopped" && ready >= 0) { team.pots[ready] = { readyAt: at + 2000, burnsAt: at + 7500 }; p.holding = "cooked"; }
            else if (p.holding === "chopped" && empty >= 0) { team.pots[empty] = { readyAt: at + 2000, burnsAt: at + 7500 }; p.holding = null; }
            else if (!p.holding && ready >= 0) { team.pots[ready] = null; p.holding = "cooked"; }
          } else if (near(KITCHEN_X.serve) && p.holding === "cooked") { team.served++; p.holding = null; }
        }
        p.actionHeld = input?.action ?? false;
      }
      for (const p of Object.values(s.players)) p.score = s.teams[p.team].served;
      s.simTime = at;
    } return true;
  },
  botInputs(s, bot, now) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now >= s.endsAt || now < (s.bots[bot.id] ?? 0)) return [];
    s.bots[bot.id] = now + Math.min(240, BOT_REACTION[bot.difficulty]);
    const team = s.teams[p.team], ready = team.pots.some((pot) => pot && now >= pot.readyAt);
    const x = p.holding === "cooked" ? KITCHEN_X.serve : p.holding === "chopped" || !p.holding && ready ? KITCHEN_X.oven : p.holding === "raw" ? KITCHEN_X.chop : KITCHEN_X.supply;
    const target = { x, y: kitchenY(p.team) };
    return [{ at: now, input: toward(p, target, bot.difficulty, distance(p, target) < 7 && (p.holding === "raw" || !p.actionHeld)) }];
  },
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])),
  rank(s, ids, rng) { const ties = Object.fromEntries(ids.map((id) => [id, rng()])); return [...ids].sort((a, b) => s.players[b].score - s.players[a].score || s.players[a].team - s.players[b].team || ties[b] - ties[a]); },
  publicView: (s) => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: structuredClone(s.players), teams: structuredClone(s.teams) }),
};
