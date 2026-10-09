import { AtlasMastery } from "../../../components/atlas/AtlasMastery";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, Globe2, Info, CircleHelp, Shuffle, Trophy, User, Users, Wifi, X } from "lucide-react";
import { chooseRandomModes, seriesLabel, type SeriesLength } from "../../../games/atlas/randomSeries";
import { bestKey } from "../../../games/atlas/arenaStorage";
import { ARENA_MODES, ONLINE_ARENA_MODES, isOnlineMode, type ArenaModeDef } from "../../../games/atlas/modeCatalog";
import { DIFFICULTY_LABELS } from "../../../games/atlas/soloSettings";
import type { AtlasDifficulty } from "../../../games/atlas/types";
import { useAtlasData } from "../../../games/atlas/useAtlasData";
import { MODE_ICONS, useArenaStore } from "./useArenaStore";
import { AtlasRankedTab } from "./AtlasRankedTab";
import "./atlas-arena.css";
import "../../../components/atlas/trials/atlas-trials.css";

const DIFFICULTIES: { id: AtlasDifficulty; note: string }[] = [
  { id: "beginner", note: "Well-known countries · easy AI" },
  { id: "intermediate", note: "Most countries · normal AI" },
  { id: "expert", note: "Every country · hard AI" },
];
type Launch = "solo" | "online" | "hotseat";

export default function AtlasArenaPage() {
  const { data } = useAtlasData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { stored, update } = useArenaStore();
  const [selectedMode, setSelectedMode] = useState<ArenaModeDef | null>(null);
  const [rulesFor, setRulesFor] = useState<ArenaModeDef | null>(null);
  const [about, setAbout] = useState(false);
  const [tab, setTab] = useState<"casual" | "ranked" | "modes" | "mastery">(() => searchParams.get("tab") === "mastery" ? "mastery" : searchParams.get("tab") === "ranked" ? "ranked" : searchParams.get("tab") === "modes" ? "modes" : "casual");
  const { difficulty } = stored;
  const launch = (mode: ArenaModeDef, how: Launch, bestOf?: SeriesLength) => {
    const pool = how === "online" ? ONLINE_ARENA_MODES : ARENA_MODES;
    const drawn = isOnlineMode(mode) || how !== "online" ? mode : pool[Math.floor(Math.random() * pool.length)];
    const order = bestOf ? chooseRandomModes(ONLINE_ARENA_MODES.map(item => item.id), bestOf, drawn.id) : undefined;
    const first = order ? ARENA_MODES.find(item => item.id === order[0])! : mode;
    const path = how === "online" ? `/games/atlas-arena/multiplayer?mode=${drawn.online}` : `/games/atlas-arena/${how}/${first.id}`;
    if (!bestOf) { navigate(path); return; }
    navigate(`${path}${how === "online" ? "&" : "?"}random=1&bestOf=${bestOf}&modes=${order!.join(",")}&series=${crypto.randomUUID()}`);
  };

  if (about) return <AboutPanel version={data?.version.atlasDataVersion ?? "…"} onBack={() => setAbout(false)} />;
  return (
    <main className={`atlas-page atlas-trials-hub atlas-hub${tab === "casual" ? " is-play-tab is-fixed-tab" : tab === "ranked" ? " is-ranked-tab is-fixed-tab" : " is-modes-tab"}`}>
      <Link className="atlas-back" to="/games"><ArrowLeft /> Pluto</Link>
      <header className="trials-hub-intro">
        <span className="atlas-eyebrow">Pluto geography laboratory</span>
        <h1>Atlas <em>Arena</em></h1>
      </header>
      <nav className="atlas-tabs" aria-label="Atlas Arena tabs">
        {(["casual", "ranked", "modes", "mastery"] as const).map((item) => <button key={item} type="button" className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </nav>
      {tab === "casual" && <section className="atlas-play-home" aria-label="Casual Atlas Arena">
        <div className="atlas-play-intro"><span className="atlas-eyebrow">Your next expedition</span><h2>How do you want to play?</h2><p>Every Atlas mode is in the mix. Leave the choice to chance or pick your challenge.</p></div>
        <div className="atlas-play-choices">
          <RandomModeChoice onLaunch={launch} />
          <article className="atlas-play-choice is-choose" onClick={event => {
            if (!(event.target as HTMLElement).closest("button, a")) setSelectedMode(null);
          }}>
            <div className="atlas-choice-copy"><span className="atlas-choice-tag"><Check size={14} aria-hidden /> Your call</span>
              <h3>{selectedMode?.title ?? "Choose Mode"}</h3><p className="atlas-choice-description">{selectedMode ? selectedMode.description : "Browse every mode and choose exactly what you want to play."}</p>
              {selectedMode ? <PlayChoiceActions online={isOnlineMode(selectedMode)} onLaunch={how => launch(selectedMode, how)} /> : <button type="button" className="atlas-choose-button" onClick={() => setTab("modes")}>Choose</button>}
            </div>
            <div className="atlas-choice-icons" role="group" aria-label="Choose an Atlas mode">{ARENA_MODES.map(mode => { const Icon = MODE_ICONS[mode.id]; return <button type="button" key={mode.id} title={mode.title} aria-label={mode.title} aria-pressed={selectedMode?.id === mode.id} onClick={() => setSelectedMode(mode)}><Icon aria-hidden /></button>; })}<button type="button" title="Clear mode selection" aria-label="Clear mode selection" onClick={() => setSelectedMode(null)}><X aria-hidden /></button></div>
          </article>
        </div>
      </section>}
      {tab === "ranked" && <AtlasRankedTab />}
      {tab === "mastery" && <AtlasMastery data={data}/>}
      {tab === "modes" && <>
      <div className="trials-difficulty" role="radiogroup" aria-label="Difficulty">
        {DIFFICULTIES.map((item) => (
          <button type="button" role="radio" aria-checked={difficulty === item.id} key={item.id} className={difficulty === item.id ? "active" : ""} onClick={() => update({ difficulty: item.id })}>
            {DIFFICULTY_LABELS[item.id]}<small>{item.note}</small>
          </button>
        ))}
      </div>
      <section className="trials-mode-grid" aria-label="Atlas Arena modes">
        {ARENA_MODES.map((mode, index) => {
          const Icon = MODE_ICONS[mode.id], best = stored.best[bestKey(mode.bestId, difficulty, mode.id==="map-fill"?stored.settings.scope:undefined)];
          return (
            <article key={mode.id} className={`trials-mode-card atlas-hub-card trial-accent-${mode.accent}`} style={{ "--i": index } as CSSProperties} aria-labelledby={`mode-${mode.id}`}>
              <div className="atlas-hub-card-top">
                <span className="trials-mode-icon"><Icon aria-hidden /></span>
                <button type="button" className="atlas-hub-rules" onClick={() => setRulesFor(mode)} aria-label={`${mode.title} rules`}><BookOpen size={14} aria-hidden /> Rules</button>
              </div>
              <span className="atlas-eyebrow">{mode.tagline}</span>
              <strong id={`mode-${mode.id}`}>{mode.title}</strong>
              <small>{mode.description}</small>
              <span className="trials-mode-meta"><span>{mode.meta}</span>{best ? <span className="trials-mode-best"><Trophy size={13} aria-hidden /> {best.toLocaleString("en")}</span> : null}</span>
              <LaunchButtons mode={mode} onLaunch={(how) => launch(mode, how)} />
            </article>
          );
        })}
      </section>
      </>}
      <div className="atlas-home-footer">
        <button type="button" onClick={() => setAbout(true)}><Info size={15} /> Dataset & method</button>
        <Link to="/games"><ArrowLeft size={15} /> Back to Pluto</Link>
        <span>Natural Earth · UN · GeoNames · World Bank · CCKP · Wikidata · World Factbook</span>
      </div>
      {rulesFor && <RulesDialog mode={rulesFor} onClose={() => setRulesFor(null)} onLaunch={(how) => { const mode = rulesFor; setRulesFor(null); launch(mode, how); }} />}
    </main>
  );
}

function RandomModeChoice({ onLaunch }: { onLaunch: (mode: ArenaModeDef, how: Launch, bestOf: SeriesLength) => void }) {
  const [selectedMode, setSelectedMode] = useState<ArenaModeDef | null>(null);
  const [bestOf, setBestOf] = useState<SeriesLength>(3);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

  const reset = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    running.current = false;
    setSpinning(false);
    setSelectedMode(null);
    setHighlight(null);
  };

  const spin = () => {
    if (running.current) return;
    running.current = true;
    setSpinning(true);
    const winner = Math.floor(Math.random() * ONLINE_ARENA_MODES.length);
    const finalStep = ONLINE_ARENA_MODES.length * 2 + winner;
    const advance = (step: number) => {
      setHighlight(step % ONLINE_ARENA_MODES.length);
      if (step === finalStep) {
        setSelectedMode(ONLINE_ARENA_MODES[winner]);
        setSpinning(false);
        running.current = false;
        timer.current = null;
      } else {
        timer.current = setTimeout(() => advance(step + 1), 45 + 280 * (step / finalStep) ** 3);
      }
    };
    advance(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? finalStep : 0);
  };

  return <article className="atlas-play-choice is-random">
    <div className="atlas-choice-copy"><span className="atlas-choice-tag"><Shuffle size={14} aria-hidden /> Surprise me</span>
      <h3>Play Random Mode</h3><p className="atlas-choice-description" role="status" data-selected={Boolean(selectedMode)}>{spinning ? "Choosing your mode…" : selectedMode ? `Selected: ${selectedMode.title}` : `Play now for a random mode, or click ? to spin through all ${ONLINE_ARENA_MODES.length} modes.`}</p>
      <div className="atlas-random-format" role="radiogroup" aria-label="Random match length">{([1, 3, 5] as const).map(length => <button key={length} type="button" role="radio" aria-checked={bestOf === length} className={bestOf === length ? "active" : ""} disabled={spinning} onClick={() => setBestOf(length)}>{seriesLabel(length)}</button>)}</div>
      <p className="atlas-setup-note">{bestOf === 1 ? "One randomly selected game." : `${bestOf} different modes in a shuffled order. The drawn mode starts the series.`}</p>
      <PlayChoiceActions disabled={spinning} onLaunch={how => onLaunch(selectedMode ?? ONLINE_ARENA_MODES[Math.floor(Math.random() * ONLINE_ARENA_MODES.length)], how, bestOf)} />
    </div>
    {highlight === null
      ? <button type="button" className="atlas-random-symbol" aria-label="Spin for a random mode" onClick={spin}><CircleHelp aria-hidden /></button>
      : <div className="atlas-choice-icons atlas-roulette-icons" role="group" aria-label="Random mode roulette" aria-busy={spinning}>{ONLINE_ARENA_MODES.map((mode, index) => {
        const Icon = MODE_ICONS[mode.id];
        return <span key={mode.id} className={highlight === index ? "is-highlighted" : ""} title={mode.title} aria-label={mode.title} aria-disabled="true" aria-current={highlight === index ? "true" : undefined}><Icon aria-hidden /></span>;
      })}<button type="button" className="atlas-roulette-reset" title="Reset random mode" aria-label="Reset random mode" onClick={reset}><X aria-hidden /></button></div>}
  </article>;
}

function LaunchButtons({ mode, onLaunch }: { mode: ArenaModeDef; onLaunch: (how: Launch) => void }) {
  return (
    <div className="atlas-hub-actions" role="group" aria-label={`Play ${mode.title}`}>
      {<button type="button" onClick={() => onLaunch("solo")}><User aria-hidden /><span>Singleplayer</span></button>}
      {isOnlineMode(mode) && <button type="button" onClick={() => onLaunch("online")}><Wifi aria-hidden /><span>Multiplayer</span></button>}
      {<button type="button" onClick={() => onLaunch("hotseat")}><Users aria-hidden /><span>Hotseat</span></button>}
    </div>
  );
}

function RulesDialog({ mode, onClose, onLaunch }: { mode: ArenaModeDef; onClose: () => void; onLaunch: (how: Launch) => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const Icon = MODE_ICONS[mode.id];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onClose]);
  return (
    <div className="atlas-rules-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`atlas-rules trial-accent-${mode.accent}`} role="dialog" aria-modal="true" aria-labelledby="atlas-rules-title">
        <header>
          <span className="trials-mode-icon"><Icon aria-hidden /></span>
          <div><span className="atlas-eyebrow">How to play</span><h2 id="atlas-rules-title">{mode.title}</h2></div>
          <button type="button" className="atlas-icon-button" onClick={onClose} ref={close} aria-label="Close rules"><X /></button>
        </header>
        <div className="atlas-rules-body">
          <p className="atlas-rules-goal">{mode.rules.goal}</p>
          <h3>Playing</h3>
          <ol>{mode.rules.play.map((step) => <li key={step}>{step}</li>)}</ol>
          <h3>Scoring</h3>
          <p>{mode.rules.scoring}</p>
          <div className="atlas-rules-ways">
            <article><h4><User aria-hidden /> Singleplayer</h4><p>{mode.rules.solo}</p></article>
            {isOnlineMode(mode) && <article><h4><Wifi aria-hidden /> Multiplayer · 2–4 players</h4><p>{mode.rules.multiplayer}</p></article>}
            <article><h4><Users aria-hidden /> Hotseat · 2–4 players</h4><p>{mode.rules.hotseat}</p></article>
          </div>
        </div>
        <footer><LaunchButtons mode={mode} onLaunch={onLaunch} /></footer>
      </section>
    </div>
  );
}

function AboutPanel({ version, onBack }: { version: string; onBack: () => void }) {
  return <main className="atlas-page atlas-about"><button type="button" className="atlas-back" onClick={onBack}><ArrowLeft /> Atlas Arena</button><span className="atlas-eyebrow">Data & boundaries</span><h1>Built on traceable geography</h1><p>Atlas Arena uses a bundled snapshot—never a live API during a match. Every multiplayer room pins its dataset version so all players generate the same rounds.</p><div className="atlas-source-list"><article><strong>Natural Earth 1:110m</strong><span>Admin-0 boundary geometry · public domain</span></article><article><strong>United Nations M49</strong><span>Identifiers and statistical regions</span></article><article><strong>GeoNames</strong><span>Names, capitals, coordinates, languages and neighbors · CC BY 4.0</span></article><article><strong>World Bank</strong><span>Population (SP.POP.TOTL) and surface area (AG.SRF.TOTL.K2), including observation year</span></article><article><strong>Wikidata</strong><span>Highest summits used by the stat modes</span></article><article><strong>The World Factbook</strong><span>Independence dates, founding events and former names for History Battle · public domain</span></article><article><strong>flag-icons</strong><span>Bundled SVG flags · MIT</span></article></div><div className="atlas-boundary-note"><Globe2 /><p>Natural Earth renders de facto boundaries. Rendering is separate from quiz eligibility: the default game uses an explicit UN 195 scope, while territories remain available in the data. Dataset: <strong>{version}</strong>.</p></div></main>;
}

function PlayChoiceActions({ onLaunch, disabled = false, online = true }: { online?: boolean; onLaunch: (how: Launch) => void; disabled?: boolean }) {
  return <div className="atlas-hub-actions atlas-choice-actions" role="group" aria-label="Choose how to play">{(["solo", "online", "hotseat"] as const).filter(how => online || how !== "online").map(how => { const Icon = how === "solo" ? User : how === "online" ? Wifi : Users; return <button key={how} type="button" disabled={disabled} onClick={() => onLaunch(how)}><Icon aria-hidden /><span>{how === "solo" ? "Singleplayer" : how === "online" ? "Multiplayer" : "Hotseat"}</span></button>; })}</div>;
}
