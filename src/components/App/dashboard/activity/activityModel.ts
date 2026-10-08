/**
 * Pure data logic for the dashboard's Activity card: days are "YYYY-MM-DD" strings in the user's own time zone,
 * weeks start on Monday, and everything here is deterministic so it can be tested without a browser or a database.
 */

export type Scope = "year" | "month" | "week" | "day";
export const SCOPES: readonly Scope[] = ["year", "month", "week", "day"];

/** What the app records. To count something new, add it here, to the two SQL functions and to `activityCopy.ts`. */
export const KINDS = ["game", "puzzle", "explore"] as const;
export type Kind = (typeof KINDS)[number];
export const isKind = (value: unknown): value is Kind => KINDS.includes(value as Kind);

/** One row of `get_activity_days`: how many events of one kind, for one game or page, on one day. */
export type ActivityRow = { day: string; kind: Kind; label: string; n: number };
/** One row of `get_activity_day`. `at` is null where the time of day is not recorded. */
export type ActivityEvent = { at: string | null; kind: Kind; label: string; detail: string | null };

export type DayTotals = Record<Kind, number> & { total: number };
export const emptyTotals = (): DayTotals => ({ game: 0, puzzle: 0, explore: 0, total: 0 });

const pad = (value: number) => String(value).padStart(2, "0");
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** Noon, so a daylight-saving shift can never move a day. */
export const parseDay = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (key: string, days: number) => { const date = parseDay(key); date.setDate(date.getDate() + days); return dayKey(date); };
/** Monday = 0 … Sunday = 6. */
export const weekday = (key: string) => (parseDay(key).getDay() + 6) % 7;
export const startOfWeek = (key: string) => addDays(key, -weekday(key));
export const daysBetween = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 864e5);
export const eachDay = (from: string, to: string) => Array.from({ length: Math.max(0, daysBetween(from, to) + 1) }, (_, index) => addDays(from, index));

/** The first and last day (inclusive) a view shows for an anchor day. */
export function rangeOf(scope: Scope, anchor: string): { from: string; to: string } {
  const date = parseDay(anchor);
  if (scope === "year") return { from: `${date.getFullYear()}-01-01`, to: `${date.getFullYear()}-12-31` };
  if (scope === "month") return { from: dayKey(new Date(date.getFullYear(), date.getMonth(), 1, 12)), to: dayKey(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)) };
  if (scope === "week") { const from = startOfWeek(anchor); return { from, to: addDays(from, 6) }; }
  return { from: anchor, to: anchor };
}

/** Previous (-1) or next (1) year, month, week or day. A month step lands on the 1st so short months cannot overflow. */
export function shiftAnchor(scope: Scope, anchor: string, steps: number): string {
  const date = parseDay(anchor);
  if (scope === "year") return dayKey(new Date(date.getFullYear() + steps, date.getMonth(), Math.min(date.getDate(), 28), 12));
  if (scope === "month") return dayKey(new Date(date.getFullYear(), date.getMonth() + steps, 1, 12));
  return addDays(anchor, (scope === "week" ? 7 : 1) * steps);
}

/** The calendar years a range touches: one or two requests cover any view. */
export const yearsOf = (from: string, to: string) => [...new Set([from, to].map(key => parseDay(key).getFullYear()))];

export function indexRows(rows: readonly ActivityRow[]): Map<string, DayTotals> {
  const index = new Map<string, DayTotals>();
  for (const row of rows) {
    if (!isKind(row.kind) || !(row.n > 0)) continue;
    const totals = index.get(row.day) ?? emptyTotals();
    totals[row.kind] += row.n;
    totals.total += row.n;
    index.set(row.day, totals);
  }
  return index;
}

/** 0 = nothing, 4 = a very busy day. */
export const levelOf = (total: number) => (total <= 0 ? 0 : total <= 2 ? 1 : total <= 5 ? 2 : total <= 9 ? 3 : 4);

export type Summary = { total: number; byKind: Record<Kind, number>; activeDays: number; elapsedDays: number; best: { day: string; total: number } | null };
export function summarize(index: ReadonlyMap<string, DayTotals>, from: string, to: string, today: string): Summary {
  const byKind: Record<Kind, number> = { game: 0, puzzle: 0, explore: 0 };
  let total = 0, activeDays = 0, best: Summary["best"] = null;
  for (const day of eachDay(from, to)) {
    const totals = index.get(day);
    if (!totals?.total) continue;
    activeDays++;
    total += totals.total;
    for (const kind of KINDS) byKind[kind] += totals[kind];
    if (!best || totals.total > best.total) best = { day, total: totals.total };
  }
  const last = to < today ? to : today;
  return { total, byKind, activeDays, elapsedDays: Math.max(0, daysBetween(from, last) + 1), best };
}

/**
 * What a row's `label` is about, as one key: results store the game ("atlas"), visits store a route. Lesson and
 * variant pages inside a game belong to that game; everything under /learn is "learning".
 */
export function subjectOf(label: string): string {
  if (label === "atlas") return "atlas-arena";
  const route = /^\/games\/([^/?#]+)/.exec(label);
  if (route) return route[1];
  if (label.startsWith("/learn")) return "learning";
  return label.replace(/^\//, "").split(/[/?#]/)[0] || "other";
}

/** Games the card no longer shows anywhere (Shogi has left the app), so old rows for them are dropped. */
const hiddenSubjects: ReadonlySet<string> = new Set(["shogi"]);
export const isShown = (label: string) => !hiddenSubjects.has(subjectOf(label));

export type Subject = { subject: string; total: number; byKind: Record<Kind, number> };
/** The busiest games and subjects in a range, most active first. */
export function breakdown(rows: readonly ActivityRow[], from: string, to: string, limit = 5): Subject[] {
  const subjects = new Map<string, Subject>();
  for (const row of rows) {
    if (row.day < from || row.day > to || !isKind(row.kind) || !(row.n > 0)) continue;
    const key = subjectOf(row.label);
    const entry = subjects.get(key) ?? { subject: key, total: 0, byKind: { game: 0, puzzle: 0, explore: 0 } };
    entry.total += row.n;
    entry.byKind[row.kind] += row.n;
    subjects.set(key, entry);
  }
  return [...subjects.values()].sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject)).slice(0, limit);
}

/** Events per local hour of a day, split by kind. Events without a time of day are returned separately. */
export function byHour(events: readonly ActivityEvent[]): { hours: DayTotals[]; untimed: ActivityEvent[] } {
  const hours = Array.from({ length: 24 }, emptyTotals);
  const untimed: ActivityEvent[] = [];
  for (const event of events) {
    const hour = event.at ? new Date(event.at).getHours() : NaN;
    if (!isKind(event.kind)) continue;
    if (Number.isNaN(hour)) { untimed.push(event); continue; }
    hours[hour][event.kind]++;
    hours[hour].total++;
  }
  return { hours, untimed };
}

/** Events per game ("chess", "go", …) for one bar, one cell or one day. */
export type Counts = Record<string, number>;

/** Day -> game -> events, for colouring each day by the games played on it. */
export function subjectIndex(rows: readonly ActivityRow[]): Map<string, Counts> {
  const index = new Map<string, Counts>();
  for (const row of rows) {
    if (!isKind(row.kind) || !(row.n > 0)) continue;
    const counts = index.get(row.day) ?? {};
    const subject = subjectOf(row.label);
    counts[subject] = (counts[subject] ?? 0) + row.n;
    index.set(row.day, counts);
  }
  return index;
}

/** The games of a bar, most played first (ties by name), so stacks and colours are stable. */
export const ranked = (counts: Counts | undefined) => Object.entries(counts ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
export const dominantSubject = (counts: Counts | undefined) => ranked(counts)[0]?.[0] ?? null;

/** Events per local hour split by game; events without a time of day are left out. */
export function hourSubjects(events: readonly ActivityEvent[]): Counts[] {
  const hours: Counts[] = Array.from({ length: 24 }, () => ({}));
  for (const event of events) {
    if (!event.at || !isKind(event.kind)) continue;
    const hour = new Date(event.at).getHours(), subject = subjectOf(event.label);
    hours[hour][subject] = (hours[hour][subject] ?? 0) + 1;
  }
  return hours;
}
