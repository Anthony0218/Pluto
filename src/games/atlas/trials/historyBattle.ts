import { seededRandom, shuffled } from "../random.ts";
import type { AtlasDifficulty, AtlasHistory, CountryHistory, HistoryEvent } from "../types.ts";

/**
 * History Battle: sourced independence dates, former rulers, founding events and former names.
 * history.json bundles Factbook records plus an attributed UN record for Palestine.
 */
export const HISTORY_BATTLE = { rounds: 12, options: 4, correct: 250, streakBonus: 50, maxStreakBonus: 250, latestYear: 2025 } as const;
export const HISTORY_SOURCE = "The World Factbook";

export type HistoryKind = "year" | "event" | "power" | "member" | "former" | "order";
export const HISTORY_KIND_LABELS: Record<HistoryKind, string> = {
  year: "Independence year", event: "Date the event", power: "Former ruler", member: "Who broke away?", former: "Former name", order: "Order of independence",
};
/** `detail` is revealed with the answer: the year or record behind each option. */
export type HistoryOption = { id: string; label: string; countryId?: string; detail?: string };
export type HistoryRound = {
  kind: HistoryKind; prompt: string;
  /** The country the question names, or null when the countries are the options. */
  subjectId: string | null;
  options: HistoryOption[]; answerId: string;
  /** The country whose sourced record answers the question, and the record shown after answering. */
  countryId: string; fact: string; source?: string;
};
export type HistoryCountry = { id: string; name: string; continent: string; subregion: string };

const KIND_MIX: Record<AtlasDifficulty, HistoryKind[]> = {
  beginner: ["power", "power", "power", "member", "member", "former", "former", "year", "year", "year", "order", "order"],
  intermediate: ["year", "year", "year", "power", "power", "member", "former", "former", "order", "order", "event", "event"],
  expert: ["year", "year", "year", "event", "event", "event", "former", "former", "order", "order", "power", "member"],
};
/** How far the wrong years sit from the right one; older dates are spread wider (see `yearOptions`). */
const YEAR_STEPS: Record<AtlasDifficulty, number[]> = { beginner: [15, 25, 40, 60, 90], intermediate: [4, 7, 11, 16, 24], expert: [1, 2, 3, 5, 8] };
const ORDER_GAP: Record<AtlasDifficulty, number> = { beginner: 20, intermediate: 8, expert: 3 };
/** Empires that broke up on their own continent: wrong options for them come from regions they never reached. */
const LAND_EMPIRES = new Set(["Soviet Union", "Russia", "Ottoman Empire", "Yugoslavia", "Serbia and Montenegro", "Holy Roman Empire"]);
/** States that no longer exist: they cannot be the ruler in a question dated after their last recorded independence. */
const DISSOLVED = new Set(["Soviet Union", "Ottoman Empire", "Yugoslavia", "Serbia and Montenegro", "Holy Roman Empire"]);
/** An empire is a believable wrong answer from about two generations before the first country left it;
 *  a power only one country left (Haiti, Sudan, Malaysia…) was usually young itself, so it gets a short lead. */
const ERA_LEAD_YEARS = { common: 60, rare: 15 } as const;
const WITH_ARTICLE = /^(Bahamas|Central African Republic|Comoros|Democratic Republic of the Congo|Dominican Republic|Gambia|Maldives|Marshall Islands|Philippines|Republic of the Congo|Seychelles|Solomon Islands|United Arab Emirates|United Kingdom|United States|Vatican|Soviet Union|Ottoman Empire|Netherlands|Holy Roman Empire)$/;
const the = (name: string) => name.startsWith("The ") ? `the ${name.slice(4)}` : WITH_ARTICLE.test(name) ? `the ${name}` : name;
export const yearLabel = (year: number) => year < 1000 ? `AD ${year}` : String(year);

const isPlain = (event: HistoryEvent) => event.label === `independence from ${event.from}`;
const isDeclaration = (event: HistoryEvent) => Boolean(event.declared) && event.label === `independence declared from ${event.from}`;
const yearPrompt = (name: string, event: HistoryEvent) => isPlain(event) ? `In which year did ${the(name)} gain independence from ${event.from}?`
  : isDeclaration(event) ? `In which year did ${the(name)} declare independence from ${event.from}?`
    : `${name} — ${event.label}. In which year?`;

/** Three wrong years around the right one, never one of the country's other recorded dates, listed in order. */
function yearOptions(year: number, avoid: ReadonlySet<number>, difficulty: AtlasDifficulty, random: () => number): HistoryOption[] {
  const factor = year >= 1800 ? 1 : year >= 1400 ? 3 : 8;
  const valid = (candidate: number) => candidate >= 100 && candidate <= HISTORY_BATTLE.latestYear && candidate !== year && !avoid.has(candidate);
  const candidates = [...new Set(YEAR_STEPS[difficulty].flatMap((step) => [year - step * factor, year + step * factor]))].filter(valid);
  // Recent dates have little room after them: keep stepping back until there are enough.
  for (let step = 1; candidates.length < HISTORY_BATTLE.options - 1; step += 1) {
    const candidate = year - (YEAR_STEPS[difficulty].at(-1)! + step * YEAR_STEPS[difficulty][0]) * factor;
    if (valid(candidate) && !candidates.includes(candidate)) candidates.push(candidate);
    if (step > 200) throw new Error("Could not spread the years of a history round.");
  }
  return [year, ...shuffled(candidates, random).slice(0, HISTORY_BATTLE.options - 1)].sort((left, right) => left - right).map((value) => ({ id: String(value), label: yearLabel(value) }));
}

/** The one date a country became independent, when its record gives exactly one. */
function independence(entry: CountryHistory): HistoryEvent | null {
  const events = entry.events.filter((event) => event.from || /independen/i.test(event.label));
  return events.length === 1 && events[0].from ? events[0] : null;
}
const farFrom = (country: HistoryCountry) => ["North America", "South America", "Oceania"].includes(country.continent) || (country.continent === "Africa" && country.subregion !== "Northern Africa");

type Context = {
  history: AtlasHistory; pool: readonly HistoryCountry[]; difficulty: AtlasDifficulty; random: () => number;
  used: Set<string>; usedNames: Set<string>;
  /** How many countries became independent from each power, and the first and last year one did. */
  powers: Map<string, { count: number; first: number; last: number }>;
};
const entryOf = (context: Context, id: string): CountryHistory | undefined => context.history.countries[id];
/** Countries not asked about yet in this deck, in random order (everything again once the pool is exhausted). */
function fresh(context: Context): { country: HistoryCountry; entry: CountryHistory }[] {
  const known = context.pool.flatMap((country) => { const entry = entryOf(context, country.id); return entry ? [{ country, entry }] : []; });
  const unused = known.filter(({ country }) => !context.used.has(country.id));
  return shuffled(unused.length ? unused : known, context.random);
}
const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];

const BUILDERS: Record<HistoryKind, (context: Context) => HistoryRound | null> = {
  year(context) {
    for (const { country, entry } of fresh(context)) {
      const events = entry.events.filter((event) => event.from);
      if (!events.length) continue;
      const event = pick(events, context.random);
      context.used.add(country.id);
      return { kind: "year", prompt: yearPrompt(country.name, event), subjectId: country.id, countryId: country.id, fact: entry.record,
        options: yearOptions(event.year, new Set(entry.events.map((item) => item.year)), context.difficulty, context.random), answerId: String(event.year) };
    }
    return null;
  },
  event(context) {
    for (const { country, entry } of fresh(context)) {
      const events = entry.events.filter((event) => !event.from);
      if (!events.length) continue;
      const event = pick(events, context.random);
      context.used.add(country.id);
      return { kind: "event", prompt: `${country.name} — ${event.label}. In which year?`, subjectId: country.id, countryId: country.id, fact: entry.record,
        options: yearOptions(event.year, new Set(entry.events.map((item) => item.year)), context.difficulty, context.random), answerId: String(event.year) };
    }
    return null;
  },
  power(context) {
    const ranked = [...context.powers.entries()].sort((left, right) => right[1].count - left[1].count);
    const common = ranked.filter(([, span]) => span.count >= 2).map(([power]) => power), rare = ranked.filter(([, span]) => span.count < 2).map(([power]) => power);
    for (const { country, entry } of fresh(context)) {
      const events = entry.events.filter((event) => event.power && (isPlain(event) || isDeclaration(event)));
      if (!events.length) continue;
      const event = pick(events, context.random), answer = event.power!;
      const inEra = (power: string) => { const span = context.powers.get(power)!; return event.year >= span.first - ERA_LEAD_YEARS[span.count >= 2 ? "common" : "rare"] && (!DISSOLVED.has(power) || event.year <= span.last); };
      const free = (power: string) => power !== answer && power !== country.name && !entry.mentions.includes(power) && inEra(power);
      // Wrong options are the empires players expect; a one-country power among them would stand out, so it gets a rare companion.
      const nearest = rare.filter(free).sort((left, right) => Math.abs(context.powers.get(left)!.first - event.year) - Math.abs(context.powers.get(right)!.first - event.year)).slice(0, 3);
      const companions = common.includes(answer) ? [] : shuffled(nearest, context.random).slice(0, 1);
      const wrong = [...companions, ...shuffled(common.filter(free).slice(0, 6), context.random)].slice(0, HISTORY_BATTLE.options - 1);
      if (wrong.length < HISTORY_BATTLE.options - 1) continue;
      context.used.add(country.id);
      return { kind: "power", prompt: `Which power did ${the(country.name)} ${isPlain(event) ? "gain" : "declare"} independence from in ${event.year}?`, subjectId: country.id, countryId: country.id, fact: entry.record,
        options: shuffled([answer, ...wrong], context.random).map((power) => ({ id: power, label: power })), answerId: answer };
    }
    return null;
  },
  member(context) {
    const candidates = fresh(context);
    for (const { country, entry } of candidates) {
      const event = entry.events.find((item) => item.power && (isPlain(item) || isDeclaration(item)));
      if (!event) continue;
      const power = event.power!;
      const wrong = candidates.filter((other) => other.country.id !== country.id && other.country.name !== power && !other.entry.mentions.includes(power)
        && other.entry.events.some((item) => item.from) && (!LAND_EMPIRES.has(power) || farFrom(other.country))).slice(0, HISTORY_BATTLE.options - 1);
      if (wrong.length < HISTORY_BATTLE.options - 1) continue;
      const option = (item: typeof candidates[number]): HistoryOption => {
        const own = item.entry.events.find((value) => value.from)!;
        return { id: item.country.id, label: item.country.name, countryId: item.country.id, detail: `${yearLabel(own.year)} · from ${own.from}` };
      };
      for (const item of [{ country, entry }, ...wrong]) context.used.add(item.country.id);
      return { kind: "member", prompt: `Which of these countries gained independence from ${the(power)}?`, subjectId: null, countryId: country.id, fact: entry.record,
        options: shuffled([{ ...option({ country, entry }), detail: `${yearLabel(event.year)} · from ${event.from}` }, ...wrong.map(option)], context.random), answerId: country.id };
    }
    return null;
  },
  former(context) {
    for (const { country, entry } of fresh(context)) {
      const names = entry.formerNames.filter((name) => !context.usedNames.has(name));
      if (!names.length) continue;
      const name = pick(names, context.random);
      // "Rhodesia" must not sit next to the country once called Northern Rhodesia.
      const others = shuffled(context.pool.filter((other) => other.id !== country.id && !entryOf(context, other.id)?.formerNames.some((value) => value.includes(name) || name.includes(value))), context.random);
      const near = context.difficulty === "beginner" ? [] : others.filter((other) => other.continent === country.continent);
      const wrong = [...near, ...others.filter((other) => !near.includes(other))].slice(0, HISTORY_BATTLE.options - 1);
      if (wrong.length < HISTORY_BATTLE.options - 1) continue;
      context.used.add(country.id); context.usedNames.add(name);
      return { kind: "former", prompt: `Which country was formerly known as ${/(Islands|States|Republic|Province|Coast|Indies|Hebrides)$/.test(name) ? "the " : ""}${name}?`, subjectId: null, countryId: country.id, fact: `formerly known as ${entry.formerNames.join(", ")}`,
        options: shuffled([country, ...wrong], context.random).map((item) => ({ id: item.id, label: item.name, countryId: item.id })), answerId: country.id };
    }
    return null;
  },
  order(context) {
    const dated = fresh(context).flatMap((item) => { const event = independence(item.entry); return event ? [{ ...item, event }] : []; });
    const chosen: typeof dated = [];
    for (const item of dated) {
      if (chosen.every((other) => Math.abs(other.event.year - item.event.year) >= ORDER_GAP[context.difficulty])) chosen.push(item);
      if (chosen.length === HISTORY_BATTLE.options) break;
    }
    if (chosen.length < HISTORY_BATTLE.options) return null;
    const first = context.random() < .5;
    const answer = [...chosen].sort((left, right) => first ? left.event.year - right.event.year : right.event.year - left.event.year)[0];
    for (const item of chosen) context.used.add(item.country.id);
    return { kind: "order", prompt: `Which of these countries became independent ${first ? "first" : "most recently"}?`, subjectId: null, countryId: answer.country.id, fact: answer.entry.record,
      options: chosen.map((item) => ({ id: item.country.id, label: item.country.name, countryId: item.country.id, detail: yearLabel(item.event.year) })), answerId: answer.country.id };
  },
};

/**
 * A full run: `count` questions in a mix set by difficulty, no country asked about twice.
 * The same seed, pool and difficulty always deal the same deck, so online rooms and hotseat turns can be compared.
 */
export function historyDeck(history: AtlasHistory, pool: readonly HistoryCountry[], seed: string, difficulty: AtlasDifficulty, count: number = HISTORY_BATTLE.rounds): HistoryRound[] {
  const random = seededRandom(`${seed}:history`);
  const powers: Context["powers"] = new Map();
  for (const entry of Object.values(history.countries)) for (const event of entry.events) if (event.power) {
    const span = powers.get(event.power);
    powers.set(event.power, span ? { count: span.count + 1, first: Math.min(span.first, event.year), last: Math.max(span.last, event.year) } : { count: 1, first: event.year, last: event.year });
  }
  const context: Context = { history, pool, difficulty, random, used: new Set(), usedNames: new Set(), powers };
  const mix = KIND_MIX[difficulty];
  return shuffled(Array.from({ length: count }, (_, index) => mix[index % mix.length]), random).map((kind) => {
    // A kind the pool cannot fill (say, no four dates far enough apart) falls back to a dated question.
    for (const candidate of [kind, "year", "event", "former"] as const) {
      const round = BUILDERS[candidate](context);
      if (round) return { ...round, source: history.countries[round.countryId]?.source?.name };
    }
    throw new Error("Could not build a history round.");
  });
}

export const historyPoints = (streakBefore: number) => HISTORY_BATTLE.correct + Math.min(HISTORY_BATTLE.maxStreakBonus, HISTORY_BATTLE.streakBonus * streakBefore);

/** One line for places without room for the full reveal (the online race feedback). */
export function historyExplanation(round: HistoryRound, nameOf: (id: string) => string): string {
  const details = round.options.filter((option) => option.detail).map((option) => `${option.label} ${option.detail}`).join(" · ");
  return `${details || `${nameOf(round.countryId)}: ${round.fact}`} — ${round.source ?? HISTORY_SOURCE}`;
}
