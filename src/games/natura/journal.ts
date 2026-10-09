import type { BotDifficulty, GameResult, ScenarioId } from './naturaData.ts';

export type Medal = 'bronze' | 'silver' | 'gold';
export type RunRecord = { attempts: number; wins: number; bestProgress: number; bestTime: number | null; medal: Medal | null };
export type Journal = { version: 1; runs: Record<string, RunRecord>; quizzes: Partial<Record<ScenarioId, number>>; practice: Partial<Record<ScenarioId, boolean>>; expeditions: Record<string, number> };
export type RunContext = { scenario: ScenarioId; level: number; difficulty: BotDifficulty; challenge?: string; variant?: string; role?: string };
const KEY = 'natura.field-journal.v1';
const rank = { bronze: 1, silver: 2, gold: 3 };
const empty = (): Journal => ({ version: 1, runs: {}, quizzes: {}, practice: {}, expeditions: {} });
export const recordKey = (c: RunContext) => [c.scenario,c.level,c.difficulty,c.challenge??'classic',c.variant??'race',c.role??'default'].join(':');
export function loadJournal(): Journal {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== 1) return empty();
    const data = saved as Journal, result = empty();
    if (data.runs && typeof data.runs === 'object') for (const [key, r] of Object.entries(data.runs)) {
      if (r && Number.isFinite(r.attempts) && Number.isFinite(r.wins) && Number.isFinite(r.bestProgress) && (r.bestTime === null || Number.isFinite(r.bestTime)) && (r.medal === null || Object.hasOwn(rank, r.medal))) result.runs[key] = r;
    }
    if (data.quizzes && typeof data.quizzes === 'object') for (const [key,value] of Object.entries(data.quizzes)) if (Number.isInteger(value) && value >= 0 && value <= 6) result.quizzes[key as ScenarioId] = value;
    if (data.practice && typeof data.practice === 'object') for (const [key,value] of Object.entries(data.practice)) if (value === true) result.practice[key as ScenarioId] = true;
    if (data.expeditions && typeof data.expeditions === 'object') for (const [key,value] of Object.entries(data.expeditions)) if (Number.isFinite(value) && value >= 0 && value <= 300) result.expeditions[key] = value;
    return result;
  } catch { return empty(); }
}
function save(journal: Journal) {
  try { localStorage.setItem(KEY, JSON.stringify(journal)); } catch { /* Storage can be unavailable in private browsing. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('natura-journal'));
  return journal;
}
export function awardMedal(result: GameResult): Medal | null {
  const p = result.performance;
  if (result.winner !== 0 || !p?.completed) return null;
  if (p.health >= 3 || p.health === 0 && p.label.includes('falls') && p.elapsed < 100) return 'gold';
  return p.health >= 2 || p.health === 0 && p.label.includes('falls') ? 'silver' : 'bronze';
}
export function recordRun(context: RunContext, result: GameResult) {
  if (!result.performance) return loadJournal();
  const journal = loadJournal(), key = recordKey(context), p = result.performance;
  const previous = journal.runs[key] ?? { attempts: 0, wins: 0, bestProgress: 0, bestTime: null, medal: null };
  const medal = awardMedal(result);
  journal.runs[key] = { attempts: previous.attempts + 1, wins: previous.wins + Number(result.winner === 0), bestProgress: Math.max(previous.bestProgress, p.progress), bestTime: p.completed && result.winner === 0 ? Math.min(previous.bestTime ?? Infinity, p.elapsed) : previous.bestTime, medal: medal && (!previous.medal || rank[medal] > rank[previous.medal]) ? medal : previous.medal };
  return save(journal);
}
export function recordQuiz(id: ScenarioId, score: number) {
  const journal = loadJournal(); journal.quizzes[id] = Math.max(journal.quizzes[id] ?? 0, Math.min(6, Math.max(0, Math.trunc(score)))); return save(journal);
}
export function recordPractice(id: ScenarioId) { const journal = loadJournal(); journal.practice[id] = true; return save(journal); }
export function recordExpedition(id: string, score: number) { const journal = loadJournal(); journal.expeditions[id] = Math.max(journal.expeditions[id] ?? 0, Math.min(300, Math.max(0, score))); return save(journal); }
export function habitatRecord(journal: Journal, id: ScenarioId) {
  const records = Object.entries(journal.runs).filter(([key]) => key.startsWith(id + ':')).map(([,r]) => r);
  return { attempts: records.reduce((sum,r) => sum+r.attempts,0), wins: records.reduce((sum,r) => sum+r.wins,0), medals: records.filter(r => r.medal).length };
}
export function dailyExpedition(date = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  let seed = 2166136261; for (const char of day) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const pools: ScenarioId[][] = [['cuttlefish','coconut','meadow'], ['bolas','archerfish','trapjaw'], ['flyingfish','jumpingspider','spermwhale']];
  return { id: 'daily:' + day, day, seed, habitats: pools.map((pool,i) => pool[(seed >>> (i*8)) % pool.length]) };
}
export function expeditionPoints(id: ScenarioId, result: GameResult) {
  const p = result.performance; if (!p) return 0;
  const goals: Record<ScenarioId,number> = { meadow: 30, archerfish: 7, flyingfish: 24, bolas: 8, coconut: 6, cuttlefish: 6, trapjaw: 4, jumpingspider: 23, spermwhale: 3 };
  return Math.min(100, Math.round(Math.min(1, p.progress / goals[id])*60 + (result.winner === 0 ? 30 : 0) + Math.min(3, Math.max(0,p.health))*10/3));
}
