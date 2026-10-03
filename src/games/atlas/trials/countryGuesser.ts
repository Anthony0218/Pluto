import { seededRandom } from "../random.ts";
import { COUNTRY_GUESSER } from "./config.ts";
import { generateDistractors, pickOne, sampleUnique, STATS, type TrialCountry } from "./countryStats.ts";

export type GuesserClue = { kind: "region" | "population" | "geography" | "capital" | "final"; text: string };
export type GuesserRound = { answerId: string; optionIds: string[]; clues: GuesserClue[] };
export type GuesserRun = {
  seed: string; roundIndex: number; round: GuesserRound; revealed: number; wrong: string[];
  /** guessing → solved (next round) or over (out of lives / out of rounds). */
  phase: "guessing" | "solved" | "over"; score: number; lives: number; solved: number; lastPoints: number;
  /** Answers already used this run; they are not drawn again. */
  history: string[];
};

const POPULATION_BANDS = [1e6, 5e6, 10e6, 25e6, 50e6, 100e6, 250e6];
const AREA_BANDS = [1_000, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 3_000_000];
const short = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 }).format(value);
const grouped = (value: number) => new Intl.NumberFormat("en").format(value);

/** Places a value inside fixed bands, so the clue narrows the field without quoting the exact figure. */
function band(value: number, edges: number[], format: (edge: number) => string, unit: string) {
  const upper = edges.findIndex((edge) => value < edge);
  if (upper === 0) return `under ${format(edges[0])}${unit}`;
  if (upper === -1) return `over ${format(edges[edges.length - 1])}${unit}`;
  return `between ${format(edges[upper - 1])} and ${format(edges[upper])}${unit}`;
}
/** Capitals like "Kuwait City" or "Tunis" would give the country away before the final clue. */
const capitalNamesCountry = (country: TrialCountry) => {
  const capital = country.capital?.toLowerCase() ?? "", name = country.name.toLowerCase();
  return capital.includes(name.slice(0, 5)) || name.includes(capital.slice(0, 5));
};

/** Five clues from data, broad → specific. None names the country; the last one is decisive. */
export function guesserClues(country: TrialCountry): GuesserClue[] {
  const population = country.stats.population ?? 0, area = country.stats.areaKm2 ?? 0, borders = country.stats.neighborCount ?? 0;
  const capital = country.capital;
  const region = country.subregion === "Australia and New Zealand" ? "Australasia" : country.subregion === "Micronesia" ? "the western Pacific islands" : country.subregion || country.continent;
  return [
    { kind: "region", text: `This country is in ${region}.` },
    { kind: "population", text: `Its population is ${band(population, POPULATION_BANDS, short, "")} people.` },
    { kind: "geography", text: `It covers ${band(area, AREA_BANDS, grouped, " km²")} and ${borders ? `shares land borders with ${borders} ${borders === 1 ? "country" : "countries"}` : "has no land borders at all"}.` },
    capital
      ? { kind: "capital", text: `Its capital's name begins with “${capital[0]}” and has ${capital.replace(/[^\p{L}]/gu, "").length} letters.` }
      : { kind: "capital", text: `It lies in ${country.subregion}.` },
    capital && !capitalNamesCountry(country)
      ? { kind: "final", text: `Its capital is ${capital}.` }
      : capital ? { kind: "final", text: "Its capital city shares its name with the country." }
        : { kind: "final", text: `Its highest point is ${STATS.highestPointM.format(country.stats.highestPointM ?? 0)}.` },
  ];
}

export function generateGuesserRound(pool: readonly TrialCountry[], seed: string, roundIndex: number, avoid: string[] = []): GuesserRound {
  const random = seededRandom(`${seed}:guesser:${roundIndex}`);
  const fresh = pool.filter((country) => !avoid.includes(country.id));
  const answer = pickOne(fresh.length ? fresh : pool, random);
  // Two "capital shares the country's name" options would make the final clue ambiguous (Mexico, Panama, Guatemala).
  const distractorPool = capitalNamesCountry(answer) ? pool.filter((country) => !capitalNamesCountry(country)) : pool;
  const distractors = generateDistractors(answer, distractorPool, COUNTRY_GUESSER.options - 1, random, 1.8);
  // The first regional clue must rule out some of the six suspects.
  const outside = distractorPool.filter((country) => country.subregion !== answer.subregion && country.continent === answer.continent && !distractors.some((item) => item.id === country.id));
  const needed = Math.max(0, 2 - distractors.filter((country) => country.subregion !== answer.subregion).length);
  const replacements = generateDistractors(answer, outside.length >= needed ? outside : distractorPool.filter((country) => country.subregion !== answer.subregion && !distractors.some((item) => item.id === country.id)), needed, random, 1.8);
  for (const replacement of replacements) {
    const position = distractors.findLastIndex((country) => country.subregion === answer.subregion);
    if (position >= 0) distractors[position] = replacement;
  }
  const options = sampleUnique([answer, ...distractors], COUNTRY_GUESSER.options, random);
  return { answerId: answer.id, optionIds: options.map((country) => country.id), clues: guesserClues(answer) };
}

export const guesserPoints = (cluesRevealed: number) => COUNTRY_GUESSER.pointsByClues[Math.min(COUNTRY_GUESSER.pointsByClues.length, Math.max(1, cluesRevealed)) - 1];

export function createGuesserRun(pool: readonly TrialCountry[], seed: string): GuesserRun {
  const round = generateGuesserRound(pool, seed, 0);
  return { seed, roundIndex: 0, round, revealed: 1, wrong: [], phase: "guessing", score: 0, lives: COUNTRY_GUESSER.lives, solved: 0, lastPoints: 0, history: [round.answerId] };
}
export function revealGuesserClue(run: GuesserRun): GuesserRun {
  if (run.phase !== "guessing" || run.revealed >= run.round.clues.length) return run;
  return { ...run, revealed: run.revealed + 1 };
}
/** A repeated, stale or out-of-phase guess returns the same object, so double clicks can't score twice. */
export function submitGuesserGuess(run: GuesserRun, countryId: string): GuesserRun {
  if (run.phase !== "guessing" || run.wrong.includes(countryId) || !run.round.optionIds.includes(countryId)) return run;
  if (countryId === run.round.answerId) {
    const points = guesserPoints(run.revealed);
    return { ...run, phase: "solved", score: run.score + points, solved: run.solved + 1, lastPoints: points };
  }
  const lives = run.lives - 1;
  return { ...run, wrong: [...run.wrong, countryId], lives, phase: lives <= 0 ? "over" : "guessing", lastPoints: 0 };
}
export function nextGuesserRound(run: GuesserRun, pool: readonly TrialCountry[]): GuesserRun {
  if (run.phase !== "solved") return run;
  if (run.roundIndex + 1 >= COUNTRY_GUESSER.rounds) return { ...run, phase: "over" };
  const roundIndex = run.roundIndex + 1, round = generateGuesserRound(pool, run.seed, roundIndex, run.history);
  return { ...run, roundIndex, round, revealed: 1, wrong: [], phase: "guessing", lastPoints: 0, history: [...run.history, round.answerId] };
}
