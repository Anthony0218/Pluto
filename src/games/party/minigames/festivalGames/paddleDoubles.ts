import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import { applyMove, base, BOT_REACTION, clamp, control, parseMove, random, type Mover, type MoveInput, type MovingState } from "./common.ts";
export interface DoublesState extends MovingState { players: Record<string, Mover & { team: number; lane: number; returns: number }>; teamScores: [number, number]; ball: { x: number; y: number; vx: number; vy: number; value: number }; serveAt: number; serves: number; bots: Record<string, number>; }
function serve(s: DoublesState, toward: number, at: number) { s.serves++; s.ball = { x: 50, y: 50, vx: toward * (33 + Math.min(12, s.serves)), vy: (random(s) - .5) * 25, value: s.serves % 3 === 0 ? 2 : 1 }; s.serveAt = at + 800; }
function create(c: MinigameCreateContext): DoublesState {
  const s: DoublesState = { ...base(c), players: {}, teamScores: [0, 0], ball: { x: 50, y: 50, vx: 30, vy: 10, value: 1 }, serveAt: c.startedAt + 800, serves: 0, bots: {} };
  const ids = c.participants.map((p) => p.id); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  ids.forEach((id, i) => { const team = Math.floor(i / 2), lane = i % 2; s.players[id] = { x: team ? 92 : 8, y: lane ? 75 : 25, team, lane, returns: 0, score: 0, stunnedUntil: 0 }; }); serve(s, random(s) < .5 ? -1 : 1, c.startedAt); return s;
}
export const paddleDoubles: MinigameDefinition<DoublesState, MoveInput> = {
  id: "paddle-doubles", name: "Paddle Doubles", description: "Share a goal with your teammate. Cover your half and return the comet together.",
  instructions: ["Two teams, two paddles each. You cover either the upper or lower half of your goal.", "Move vertically to intercept the comet. The bounce direction depends on where it hits your paddle.", "Every third serve is a golden comet worth 2 points. Regular comets score 1.", "First team to 7 points wins; otherwise the leading team wins at 60 seconds. Teammates earn equal rewards."], controls: "W / S or ↑ / ↓ · touch Up and Down", durationSeconds: 60, gameType: "main", supportsBots: true, snapshotIntervalMs: 50, create, parseInput: parseMove, applyInput: applyMove,
  teamOf: (s, id) => String(s.players[id].team),
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime) return false;
    while (s.simTime < end && Math.max(...s.teamScores) < 7) { const at = Math.min(s.simTime + 10, end), dt = (at - s.simTime) / 1000;
      for (const [id, p] of Object.entries(s.players)) { p.y = clamp(p.y + (control(s, id, at)?.y ?? 0) * 65 * dt, p.lane ? 55 : 10, p.lane ? 90 : 45); p.score = s.teamScores[p.team]; }
      if (at >= s.serveAt) { const b = s.ball, oldX = b.x; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y < 3 || b.y > 97) { b.y = clamp(b.y, 3, 97); b.vy *= -1; }
        for (const p of Object.values(s.players)) { const crossing = p.team === 0 ? b.vx < 0 && oldX >= p.x + 2 && b.x <= p.x + 2 : b.vx > 0 && oldX <= p.x - 2 && b.x >= p.x - 2;
          if (crossing && Math.abs(b.y - p.y) <= 11) { b.x = p.x + (p.team ? -2 : 2); const speed = Math.min(70, Math.abs(b.vx) + 3); b.vx = (p.team ? -1 : 1) * speed; b.vy = (b.y - p.y) * 3.8; p.returns++; break; } }
        if (b.x < 0 || b.x > 100) { const team = b.x < 0 ? 1 : 0; s.teamScores[team] += b.value; serve(s, team ? -1 : 1, at); for (const p of Object.values(s.players)) p.score = s.teamScores[p.team]; }
      } s.simTime = at;
    } return true;
  }, isFinished: (s) => Math.max(...s.teamScores) >= 7,
  botInputs(s, bot, now, rng) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now < (s.bots[bot.id] ?? 0)) return []; s.bots[bot.id] = now + BOT_REACTION[bot.difficulty];
    const b = s.ball, travel = (p.x - b.x) / b.vx; let predicted = b.y + b.vy * Math.max(0, travel);
    predicted = ((predicted - 3) % 188 + 188) % 188; predicted = predicted > 94 ? 191 - predicted : predicted + 3;
    const error = { beginner: 25, easy: 18, medium: 12, hard: 8, extreme: .6 }[bot.difficulty]; const target = clamp(predicted + (rng() - .5) * error, p.lane ? 55 : 10, p.lane ? 90 : 45);
    return [{ at: now, input: { type: "FESTIVAL_MOVE", x: 0, y: Math.abs(target - p.y) < 2 ? 0 : Math.sign(target - p.y), action: false } }];
  }, scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, s.teamScores[p.team]])),
  rank: (s, ids) => [...ids].sort((a, b) => s.teamScores[s.players[b].team] - s.teamScores[s.players[a].team] || s.players[a].team - s.players[b].team || ids.indexOf(a) - ids.indexOf(b)),
  publicView: (s) => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: structuredClone(s.players), teamScores: [...s.teamScores], ball: { ...s.ball }, serveAt: s.serveAt }),
};
