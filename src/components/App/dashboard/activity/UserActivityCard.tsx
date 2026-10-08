import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { games } from "@/data/games";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useActivityCopy, useActivityCount } from "./activityCopy";
import { gameColor } from "./activityColors";
import {
  KINDS, SCOPES, addDays, breakdown, byHour, dayKey, dominantSubject, eachDay, hourSubjects, indexRows, levelOf, parseDay, rangeOf, ranked, shiftAnchor, startOfWeek, subjectIndex, subjectOf, summarize, weekday, yearsOf,
  type ActivityEvent, type Counts, type DayTotals, type Scope,
} from "./activityModel";
import { browserTimeZone, useActivityDay, useActivityYears } from "./useActivityData";
import "./activity.css";

type Copy = ReturnType<typeof useActivityCopy>;
type Formats = ReturnType<typeof makeFormats>;
type Index = ReadonlyMap<string, DayTotals>;
type Games = ReadonlyMap<string, Counts>;

const zero: DayTotals = { game: 0, puzzle: 0, explore: 0, total: 0 };
/** Every game (and learning) draws in its own colour: set `--game` and the CSS does the rest. */
const gameStyle = (subject: string | null, extra?: CSSProperties) => ({ ...(subject ? { "--game": gameColor(subject) } : {}), ...extra }) as CSSProperties;

function makeFormats(locale: string) {
  const format = (options: Intl.DateTimeFormatOptions) => { const f = new Intl.DateTimeFormat(locale, options); return (key: string) => f.format(parseDay(key)); };
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return {
    year: format({ year: "numeric" }), month: format({ month: "long" }), monthShort: format({ month: "short" }), monthYear: format({ month: "long", year: "numeric" }),
    weekdayShort: format({ weekday: "short" }), dayMonth: format({ day: "numeric", month: "short" }), dayShort: format({ weekday: "short", day: "numeric", month: "short" }),
    dayLong: format({ weekday: "long", day: "numeric", month: "long", year: "numeric" }), time: (iso: string) => time.format(new Date(iso)),
  };
}

/** A game or subject's display name: the catalog's title for a game route, otherwise a tidied key. */
function subjectName(subject: string, t: Copy) {
  if (subject === "learning") return t("learning");
  const game = games.find(item => item.route === `/games/${subject}`);
  return game ? ui(game.title) : subject.replace(/-/g, " ").replace(/^./, letter => letter.toUpperCase());
}

function describeDay(key: string, counts: Counts | undefined, f: Formats, t: Copy) {
  const parts = ranked(counts).map(([subject, n]) => `${subjectName(subject, t)} ${n}`);
  return `${f.dayShort(key)} · ${parts.length ? parts.join(" · ") : "–"}`;
}

function describeEvent(event: ActivityEvent, t: Copy) {
  const name = subjectName(subjectOf(event.label), t);
  if (event.kind === "explore") return t("opened", { name });
  if (event.kind === "puzzle") return t("puzzleOf", { name });
  return name;
}
function eventDetail(event: ActivityEvent, t: Copy) {
  if (event.kind === "game") return event.detail === "win" ? t("win") : event.detail === "loss" ? t("loss") : event.detail === "draw" ? t("draw") : "";
  if (event.kind === "puzzle") return Number(event.detail) > 0 ? t("mistakes", { n: Number(event.detail) }) : t("noMistakes");
  return "";
}

/** Stacked segments for one bar, one per game; `scale` is the count that fills the full height. */
function Stack({ counts, scale }: { counts: Counts | undefined; scale: number }) {
  return <>{ranked(counts).map(([subject, n]) => <i key={subject} className="act-seg" style={gameStyle(subject, { height: `${(n / scale) * 100}%` })} />)}</>;
}

type ViewProps = { index: Index; games: Games; anchor: string; today: string; f: Formats; t: Copy; open: (day: string) => void; hover: (text: string) => void };

/** A year of days, one column per week: the shape of a habit. Cells are mouse targets; the Month and Week views are the keyboard route. */
function YearView({ index, games, anchor, today, f, t, open, hover, openMonth }: ViewProps & { openMonth: (day: string) => void }) {
  const year = parseDay(anchor).getFullYear();
  const first = `${year}-01-01`, last = `${year}-12-31`, lead = weekday(first);
  const days = eachDay(first, last);
  return <div className="act-year">
    <div className="act-year-months" aria-hidden="false">{Array.from({ length: 12 }, (_, month) => {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      return <button type="button" key={key} style={{ gridColumn: Math.floor((weekday(first) + eachDay(first, key).length - 1) / 7) + 1 }} onClick={() => openMonth(key)}>{f.monthShort(key)}</button>;
    })}</div>
    <div className="act-year-weekdays" aria-hidden="true">{[0, 2, 4].map(row => <span key={row} style={{ gridRow: row + 1 }}>{f.weekdayShort(addDays(startOfWeek(first), row))}</span>)}</div>
    <div className="act-year-grid">
      {Array.from({ length: lead }, (_, i) => <span key={`pad-${i}`} />)}
      {days.map(day => {
        const totals = index.get(day), level = levelOf(totals?.total ?? 0);
        return <button type="button" key={day} tabIndex={-1} disabled={day > today} style={gameStyle(dominantSubject(games.get(day)))} className={`act-cell lvl-${level}${day === today ? " is-today" : ""}`} aria-label={describeDay(day, games.get(day), f, t)}
          onMouseEnter={() => hover(describeDay(day, games.get(day), f, t))} onFocus={() => hover(describeDay(day, games.get(day), f, t))} onClick={() => open(day)} />;
      })}
    </div>
  </div>;
}

function MonthView({ index, games, anchor, today, f, t, open, hover }: ViewProps) {
  const { from, to } = rangeOf("month", anchor);
  const days = eachDay(startOfWeek(from), addDays(startOfWeek(to), 6));
  const max = Math.max(1, ...days.map(day => index.get(day)?.total ?? 0));
  return <div className="act-month">
    <div className="act-month-head" aria-hidden="true">{days.slice(0, 7).map(day => <span key={day}>{f.weekdayShort(day)}</span>)}</div>
    <div className="act-month-grid">{days.map(day => {
      const totals = index.get(day), total = totals?.total ?? 0;
      return <button type="button" key={day} disabled={day > today} style={gameStyle(dominantSubject(games.get(day)))} className={`act-day${day < from || day > to ? " is-outside" : ""}${day === today ? " is-today" : ""}`} aria-label={describeDay(day, games.get(day), f, t)}
        onMouseEnter={() => hover(describeDay(day, games.get(day), f, t))} onFocus={() => hover(describeDay(day, games.get(day), f, t))} onClick={() => open(day)}>
        <i className="act-day-fill" style={{ height: `${(total / max) * 100}%` }} /><b>{parseDay(day).getDate()}</b><span>{total || ""}</span>
      </button>;
    })}</div>
  </div>;
}

function WeekView({ index, games, anchor, today, f, t, open, hover }: ViewProps) {
  const days = eachDay(...(Object.values(rangeOf("week", anchor)) as [string, string]));
  const max = Math.max(3, ...days.map(day => index.get(day)?.total ?? 0));
  return <div className="act-week">{days.map(day => {
    const totals = index.get(day) ?? zero;
    return <button type="button" key={day} disabled={day > today} className={`act-bar${day === anchor ? " is-selected" : ""}${day === today ? " is-today" : ""}`} aria-label={describeDay(day, games.get(day), f, t)}
      onMouseEnter={() => hover(describeDay(day, games.get(day), f, t))} onFocus={() => hover(describeDay(day, games.get(day), f, t))} onClick={() => open(day)}>
      <span className="act-bar-value">{totals.total || ""}</span>
      <span className="act-bar-track"><span className="act-bar-stack" style={{ height: `${(totals.total / max) * 100}%` }}><Stack counts={games.get(day)} scale={totals.total} /></span></span>
      <span className="act-bar-label">{f.weekdayShort(day)}<small>{parseDay(day).getDate()}</small></span>
    </button>;
  })}</div>;
}

function DayView({ events, status, retry, f, t }: { events: ActivityEvent[]; status: string; retry: () => void; f: Formats; t: Copy }) {
  const { hours, untimed } = useMemo(() => byHour(events), [events]);
  const perGame = useMemo(() => hourSubjects(events), [events]);
  const max = Math.max(2, ...hours.map(hour => hour.total));
  const timed = events.filter(event => event.at);
  if (status === "error" && !events.length) return <div className="act-note"><p>{t("unavailable")}</p><button type="button" className="dash-button" onClick={retry}>{t("retry")}</button></div>;
  return <div className="act-dayview">
    <div className="act-hours" role="img" aria-label={t("title")}>
      {hours.map((hour, index) => <span key={index} className="act-hour" title={`${String(index).padStart(2, "0")}:00 · ${hour.total}`}><span className="act-hour-stack" style={{ height: `${(hour.total / max) * 100}%` }}><Stack counts={perGame[index]} scale={hour.total} /></span></span>)}
    </div>
    <div className="act-hours-axis" aria-hidden="true">{hours.map((_, index) => <span key={index}>{index % 3 === 0 ? String(index).padStart(2, "0") : ""}</span>)}</div>
    {status === "loading" && !events.length ? <p className="act-muted">{t("loading")}</p> : !timed.length && !untimed.length ? <p className="act-muted">{t("noEvents")}</p> : <ul className="act-events">
      {timed.map((event, i) => <li key={`t${i}`} style={gameStyle(subjectOf(event.label))}><time>{f.time(event.at!)}</time><span>{describeEvent(event, t)}</span><small>{eventDetail(event, t)}</small></li>)}
      {untimed.map((event, i) => <li key={`u${i}`} style={gameStyle(subjectOf(event.label))}><time>–</time><span>{describeEvent(event, t)}</span><small>{t("untimed")}</small></li>)}
    </ul>}
  </div>;
}

/**
 * The dashboard's Activity card: one control that zooms between a year, a month, a week and a day of the signed-in
 * account's own activity. Counts, not minutes: the app records completed games, solved puzzles and opened games or
 * lessons, and nothing else is shown. Data logic is in `activityModel.ts`; the two RPCs are in the activity migration.
 */
export default function UserActivityCard({ signedIn }: { signedIn: boolean }) {
  const { language } = useUiLanguage();
  const t = useActivityCopy();
  const count = useActivityCount();
  const locale = language === "bar" ? "de" : language;
  const f = useMemo(() => makeFormats(locale), [locale]);
  const timeZone = useMemo(() => browserTimeZone(), []);
  const [today, setToday] = useState(() => dayKey(new Date()));
  const [scope, setScope] = useState<Scope>("year");
  const [anchor, setAnchor] = useState(today);
  const [hovered, setHovered] = useState("");
  useEffect(() => {
    // The page can stay open across midnight.
    const timer = window.setInterval(() => setToday(dayKey(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { from, to } = rangeOf(scope, anchor);
  const { rows, status, retry } = useActivityYears(signedIn, yearsOf(from, to), timeZone);
  const dayData = useActivityDay(signedIn && scope === "day", scope === "day" ? anchor : null, timeZone);
  const index = useMemo(() => indexRows(rows), [rows]);
  const games = useMemo(() => subjectIndex(rows), [rows]);
  const summary = useMemo(() => summarize(index, from, to, today), [index, from, to, today]);
  const top = useMemo(() => breakdown(rows, from, to), [rows, from, to]);

  if (!signedIn) return <section className="dash-panel activity-card" aria-label={t("title")}>
    <div className="dash-section-heading"><h2>{t("title")}</h2></div>
    <div className="dash-empty-state"><span className="dash-empty-icon"><Activity size={26} aria-hidden /></span><p>{t("loginPrompt")}</p><Link to="/login" className="dash-button primary">{ui("Log in")}<ArrowRight size={14} aria-hidden /></Link></div>
  </section>;

  const open = (day: string) => { setAnchor(day); setScope("day"); setHovered(""); };
  const openMonth = (day: string) => { setAnchor(day); setScope("month"); setHovered(""); };
  const step = (steps: number) => { setAnchor(shiftAnchor(scope, anchor, steps)); setHovered(""); };
  const canGoNext = rangeOf(scope, shiftAnchor(scope, anchor, 1)).from <= today;
  const label = scope === "year" ? f.year(anchor) : scope === "month" ? f.monthYear(anchor) : scope === "week" ? `${f.dayMonth(from)} – ${f.dayMonth(to)}` : f.dayLong(anchor);
  const view: ViewProps = { index, games, anchor, today, f, t, open, hover: setHovered };
  const loading = status === "loading" && !rows.length;
  const failed = status === "error" && !rows.length;
  const cards: [string, string | number][] = scope === "day"
    ? [[t("total"), summary.total], [t("game"), summary.byKind.game], [t("puzzle"), summary.byKind.puzzle]]
    : [[t("total"), summary.total], [t("activeDays"), `${summary.activeDays} / ${summary.elapsedDays}`], [t("bestDay"), summary.best ? `${f.dayMonth(summary.best.day)} · ${summary.best.total}` : "–"]];
  const topMax = Math.max(1, ...top.map(item => item.total));
  // The legend lists the games that appear in what is on screen, in the same order as the ranking.
  const dayGames = [...new Set(dayData.events.map(event => subjectOf(event.label)))];
  const legend = scope === "day" ? dayGames : breakdown(rows, from, to, 12).map(item => item.subject);

  return <section className="dash-panel activity-card" aria-label={t("title")}>
    <div className="dash-section-heading"><h2>{t("title")}</h2>
      <div className="act-seg-control" role="group" aria-label={t("zoom")}>{SCOPES.map(item => <button type="button" key={item} aria-pressed={scope === item} onClick={() => { setScope(item); setHovered(""); }}>{t(item)}</button>)}</div>
    </div>
    <div className="act-nav">
      <button type="button" className="dash-icon-button" aria-label={t("previous")} onClick={() => step(-1)}><ChevronLeft size={17} /></button>
      <strong aria-live="polite">{label}</strong>
      <button type="button" className="dash-icon-button" aria-label={t("next")} disabled={!canGoNext} onClick={() => step(1)}><ChevronRight size={17} /></button>
      <button type="button" className="dash-button" disabled={anchor === today} onClick={() => { setAnchor(today); setHovered(""); }}>{t("today")}</button>
    </div>
    <div className="act-cards">{cards.map(([name, value]) => <div key={name}><small>{name}</small><b>{value}</b></div>)}</div>
    <div className="act-viz">
      {loading ? <div className="act-note"><p>{t("loading")}</p></div>
        : failed ? <div className="act-note"><p>{t("unavailable")}</p><button type="button" className="dash-button" onClick={retry}>{t("retry")}</button></div>
        : scope === "year" ? <YearView {...view} openMonth={openMonth} />
        : scope === "month" ? <MonthView {...view} />
        : scope === "week" ? <WeekView {...view} />
        : <DayView events={dayData.events} status={dayData.status} retry={dayData.retry} f={f} t={t} />}
    </div>
    <p className="act-status" aria-live="off">{hovered || (!loading && !failed && !summary.total && scope !== "day" ? t("empty") : " ")}</p>
    <div className="act-legend">{legend.map(subject => <span key={subject} style={gameStyle(subject)}><i />{subjectName(subject, t)}</span>)}
      {scope === "year" && <span className="act-scale">{t("less")}{[0, 1, 2, 3, 4].map(level => <i key={level} className={`act-cell lvl-${level}`} />)}{t("more")}</span>}</div>
    {scope !== "day" && top.length > 0 && <div className="act-top"><h3>{t("topTitle")}</h3>
      <ul>{top.map(item => <li key={item.subject} title={KINDS.filter(kind => item.byKind[kind]).map(kind => `${t(kind)} ${item.byKind[kind]}`).join(" · ")}><span>{subjectName(item.subject, t)}</span>
        <span className="act-top-bar" style={gameStyle(item.subject, { width: `${(item.total / topMax) * 100}%` })} /><b>{count(item.total)}</b></li>)}</ul></div>}
    <p className="act-footnote">{t("note", { tz: timeZone })}</p>
  </section>;
}
