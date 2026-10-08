import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import { applyMove, base, BOT_REACTION, clamp, control, parseMove, random, type Mover, type MoveInput, type MovingState } from "./common.ts";
export const ROPE_GATES = [{ x: 22, target: 30 }, { x: 47, target: 75 }, { x: 72, target: 45 }];
export interface RescueTeam { ids: [string, string]; progress: number; checkpoint: number; lever: number; rescues: number; falls: number; }
export interface RopeState extends MovingState { teams: RescueTeam[]; swapped: boolean; bots: Record<string, number>; players: Record<string, Mover & { team: number; operator: boolean }>; }
function create(c: MinigameCreateContext): RopeState {
  const s: RopeState = { ...base(c), teams: [], swapped: false, bots: {}, players: {} };
  const ids = c.participants.map((p) => p.id); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  for (let team = 0; team < 2; team++) { const pair: [string, string] = [ids[team * 2], ids[team * 2 + 1]]; s.teams.push({ ids: pair, progress: 0, checkpoint: 0, lever: 50, rescues: 0, falls: 0 }); pair.forEach((id, i) => { s.players[id] = { x: 0, y: 50, score: 0, stunnedUntil: 0, team, operator: i === 0 }; }); } return s;
}
export const ropeRescue: MinigameDefinition<RopeState, MoveInput> = {
  id: "rope-rescue", name: "Rope Rescue", description: "A team of two, one mountain rescue. Align the bridges for your partner, then swap roles!",
  instructions: ["Teams are shown in blue and pink. The operator moves the rope lever with W/S or ↑/↓.", "Match the lever to the marked target to open the next bridge. Your partner runs with A/D or ←/→.", "The runner can wait safely. Jumping onto a misaligned bridge drops you to the last checkpoint.", "Reach the camp to rescue one explorer. Roles swap after 30 seconds; most rescues and progress wins."],
  controls: "Operator: W / S or ↑ / ↓ · Runner: A / D or ← / → · Space to jump · touch controls", durationSeconds: 60, gameType: "main", supportsBots: true, snapshotIntervalMs: 100, create, parseInput: parseMove, applyInput: applyMove,
  teamOf: (s, id) => String(s.players[id].team),
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime) return false;
    while (s.simTime < end) { const at = Math.min(s.simTime + 20, end), dt = (at - s.simTime) / 1000;
      if (!s.swapped && at - s.startedAt >= 30000) { s.swapped = true; for (const p of Object.values(s.players)) p.operator = !p.operator; s.controls = {}; }
      for (const team of s.teams) { const operator = team.ids.find((id) => s.players[id].operator)!, runner = team.ids.find((id) => !s.players[id].operator)!;
        const op = control(s, operator, at), run = control(s, runner, at);
        team.lever = clamp(team.lever + (op?.y ?? 0) * 60 * dt);
        if (at >= s.players[runner].stunnedUntil) {
          const target = clamp(team.progress + (run?.x ?? 0) * 24 * dt);
          const gate = ROPE_GATES.find((gate) => team.progress <= gate.x && target > gate.x);
          if (gate && Math.abs(team.lever - gate.target) > 10) { if (run?.action) { team.progress = team.checkpoint; team.falls++; s.players[runner].stunnedUntil = at + 700; } else team.progress = gate.x; }
          else { team.progress = target; if (gate) team.checkpoint = gate.x + 2; }
          if (team.progress >= 98) { team.rescues++; team.progress = 0; team.checkpoint = 0; }
        }
        for (const id of team.ids) { s.players[id].score = team.rescues * 100 + Math.floor(team.progress); s.players[id].x = team.progress; s.players[id].y = team.lever; }
      } s.simTime = at;
    } return true;
  },
  botInputs(s, bot, now) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now < (s.bots[bot.id] ?? 0)) return []; s.bots[bot.id] = now + BOT_REACTION[bot.difficulty];
    const team = s.teams[p.team], gate = ROPE_GATES.find((g) => g.x >= team.progress) ?? ROPE_GATES[0], speed = { beginner: .4, easy: .6, medium: .75, hard: .85, extreme: 1 }[bot.difficulty];
    return [{ at: now, input: { type: "FESTIVAL_MOVE", x: p.operator ? 0 : speed, y: p.operator && Math.abs(team.lever - gate.target) > 3 ? Math.sign(gate.target - team.lever) * speed : 0, action: false } }];
  }, scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])),
  rank: (s, ids) => [...ids].sort((a, b) => s.players[b].score - s.players[a].score || s.players[a].team - s.players[b].team || ids.indexOf(a) - ids.indexOf(b)),
  publicView: (s) => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: structuredClone(s.players), teams: structuredClone(s.teams), swapped: s.swapped }),
};
