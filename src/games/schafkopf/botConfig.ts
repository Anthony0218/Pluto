import type { AiDifficulty } from './schafkopf.ts';
export type BotLevel = Exclude<AiDifficulty, 'normal'>;
export const botLevel = (level: AiDifficulty): BotLevel => level === 'normal' ? 'advanced' : level;
export type TipCode = 'T1' | 'T2' | 'T3a' | 'T3b' | 'T3c' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10' | 'T11' | 'T12';
export type BotConfig = {
  reliability: Record<BotLevel, Record<TipCode, number>>;
  announcementError: Record<BotLevel, number>;
  deducedR6: Record<BotLevel, number>; r6b: Record<BotLevel, number>;
  r4aMinTrumps: number; r4aRemainingTrumps: number; r4aRemainingHigh: number;
  manyTrumps: number; manyHigh: number; manyCourt: number;
  legendIterations: number; legendTimeMs: number; announcementSamples: number;
  amateurSpritzChance: number; proError: number;
  sauspielWithBremserMin: number; sauspielWithoutBremserMin: number;
  soloMinTrumps: number; soloMinOber: number; farbwenzMinTrumps: number; farbwenzMinUnter: number;
};
const rates = (values: number[]): Record<TipCode, number> => Object.fromEntries(['T1','T2','T3a','T3b','T3c','T4','T5','T6','T7','T8','T9','T10','T11','T12'].map((key, index) => [key, values[index]])) as Record<TipCode, number>;
export const DEFAULT_BOT_CONFIG: BotConfig = {
  reliability: {
    beginner: rates(Array(14).fill(0)),
    amateur: rates([0,.6,0,0,0,0,0,.75,.75,0,.25,0,0,.9]),
    advanced: rates([.85,.85,.55,.55,.6,.85,.7,1,1,.55,.5,.8,.6,.95]),
    pro: rates(Array(14).fill(.98).map((rate,index) => index === 8 ? 1 : index === 10 ? .75 : rate)),
    legend: rates(Array(14).fill(1)),
  },
  announcementError: { beginner: .2, amateur: .1, advanced: 0, pro: 0, legend: 0 },
  deducedR6: { beginner: 0, amateur: 0, advanced: .5, pro: .75, legend: 1 },
  r6b: { beginner: 0, amateur: 0, advanced: .75, pro: .9, legend: 1 },
  r4aMinTrumps: 3, r4aRemainingTrumps: 4, r4aRemainingHigh: 1,
  manyTrumps: 5, manyHigh: 2, manyCourt: 4,
  legendIterations: 200, legendTimeMs: 180, announcementSamples: 64,
  amateurSpritzChance: .08, proError: .02,
  sauspielWithBremserMin: 4, sauspielWithoutBremserMin: 6,
  soloMinTrumps: 6, soloMinOber: 2, farbwenzMinTrumps: 5, farbwenzMinUnter: 2,
};
/** Every random choice accepts this reproducible PRNG (also used by simulations). */
export function seededRandom(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function botConfig(overrides?: Partial<BotConfig>): BotConfig {
  const config = { ...DEFAULT_BOT_CONFIG, ...overrides };
  const bounded = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  for (const key of ['sauspielWithBremserMin','sauspielWithoutBremserMin','soloMinTrumps','soloMinOber','farbwenzMinTrumps','farbwenzMinUnter','r4aMinTrumps','r4aRemainingTrumps','r4aRemainingHigh','manyTrumps','manyHigh','manyCourt','legendIterations','legendTimeMs','announcementSamples'] as const) config[key] = Math.round(bounded(config[key], DEFAULT_BOT_CONFIG[key], 1, key === 'legendIterations' ? 1000 : key === 'legendTimeMs' ? 2000 : key === 'announcementSamples' ? 200 : 8));
  config.proError = bounded(config.proError, .02, 0, 1);
  config.amateurSpritzChance = bounded(config.amateurSpritzChance, .08, 0, 1);
  for (const key of ['announcementError','deducedR6','r6b'] as const) config[key] = Object.fromEntries(Object.keys(DEFAULT_BOT_CONFIG[key]).map(level => [level, bounded(config[key]?.[level as BotLevel], DEFAULT_BOT_CONFIG[key][level as BotLevel], 0, 1)])) as Record<BotLevel, number>;
  config.reliability = Object.fromEntries(Object.keys(DEFAULT_BOT_CONFIG.reliability).map(level => [level, Object.fromEntries(Object.keys(DEFAULT_BOT_CONFIG.reliability.beginner).map(tip => [tip, bounded(config.reliability?.[level as BotLevel]?.[tip as TipCode], DEFAULT_BOT_CONFIG.reliability[level as BotLevel][tip as TipCode], 0, 1)]))])) as BotConfig['reliability'];
  // Explicit search rates supersede older saved matrices; the menu shows these as fixed values.
  for (const level of Object.keys(config.reliability) as BotLevel[]) config.reliability[level].T9 = DEFAULT_BOT_CONFIG.reliability[level].T9;
  return config;
}
