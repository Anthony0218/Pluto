import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Check, Globe2, Info, Shuffle, Trophy, User, Users, Wifi, X } from "lucide-react";
import { bestKey } from "../../../games/atlas/arenaStorage";
import { ARENA_MODES, hotseatPlayerLimit, onlinePlayerLimit, type ArenaModeDef } from "../../../games/atlas/modeCatalog";
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
  const [rulesFor, setRulesFor] = useState<ArenaModeDef | null>(null);
  const [about, setAbout] = useState(false);
  const [tab, setTab] = useState<"play" | "modes" | "ranked">(() => searchParams.get("tab") === "ranked" ? "ranked" : "play");
  const { difficulty } = stored;
  const launch = (mode: ArenaModeDef, how: Launch) => navigate(how === "online" ? `/games/atlas-arena/multiplayer?mode=${mode.online}` : `/games/atlas-arena/${how}/${mode.id}`);

  if (about) return <AboutPanel version={data?.version.atlasDataVersion ?? "…"} onBack={() => setAbout(false)} />;
  return (
    <main className={`atlas-page atlas-trials-hub atlas-hub${tab === "play" ? " is-play-tab" : ""}`}>
      <Link className="atlas-back" to="/games"><ArrowLeft /> Pluto</Link>
      <header className="trials-hub-intro">
        <span className="atlas-eyebrow">Pluto geography laboratory</span>
        <h1>Atlas <em>Arena</em></h1>
        <p>{ARENA_MODES.length} ways to test what you know about the world — play alone, race friends online, or pass one device around the table.</p>
      </header>
      <nav className="atlas-tabs" aria-label="Atlas Arena tabs">
        {(["play", "modes", "ranked"] as const).map((item) => <button key={item} type="button" className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </nav>
      {tab === "play" && <section className="atlas-play-home" aria-label="Play Atlas Arena">
        <div className="atlas-play-intro"><span className="atlas-eyebrow">Your next expedition</span><h2>How do you want to play?</h2><p>Every Atlas mode is in the mix. Leave the choice to chance or pick your challenge.</p></div>
        <div className="atlas-play-choices">
          <button type="button" className="atlas-play-choice is-random" onClick={() => launch(ARENA_MODES[Math.floor(Math.random() * ARENA_MODES.length)], "solo")}>
            <span className="atlas-choice-top"><span className="atlas-play-choice-mark"><Shuffle aria-hidden /></span><span className="atlas-choice-tag">Surprise me</span></span>
            <strong>Play Random Mode</strong><span className="atlas-choice-description">One of {ARENA_MODES.length} modes is chosen at random when you play.</span>
            <span className="atlas-choice-icons" aria-hidden>{ARENA_MODES.map((mode) => { const Icon = MODE_ICONS[mode.id]; return <span key={mode.id} title={mode.title}><Icon /></span>; })}</span>
            <span className="atlas-choice-bottom"><span><Shuffle size={17} aria-hidden /> Random draw</span><ArrowRight size={20} aria-hidden /></span>
          </button>
          <button type="button" className="atlas-play-choice is-choose" onClick={() => setTab("modes")}>
            <span className="atlas-choice-top"><span className="atlas-play-choice-mark"><Check aria-hidden /></span><span className="atlas-choice-tag">Your call</span></span>
            <strong>Choose Mode</strong><span className="atlas-choice-description">Browse every mode and choose exactly what you want to play.</span>
            <span className="atlas-choice-icons" aria-hidden>{ARENA_MODES.map((mode) => { const Icon = MODE_ICONS[mode.id]; return <span key={mode.id} title={mode.title}><Icon /></span>; })}</span>
            <span className="atlas-choice-bottom"><span><Check size={17} aria-hidden /> You decide</span><ArrowRight size={20} aria-hidden /></span>
          </button>
        </div>
      </section>}
      {tab === "ranked" && <AtlasRankedTab />}
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
          const Icon = MODE_ICONS[mode.id], best = stored.best[bestKey(mode.bestId, difficulty)];
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
        <span>Natural Earth · UN · GeoNames · World Bank · CCKP · Wikidata</span>
      </div>
      {rulesFor && <RulesDialog mode={rulesFor} onClose={() => setRulesFor(null)} onLaunch={(how) => { const mode = rulesFor; setRulesFor(null); launch(mode, how); }} />}
    </main>
  );
}

function LaunchButtons({ mode, onLaunch }: { mode: ArenaModeDef; onLaunch: (how: Launch) => void }) {
  return (
    <div className="atlas-hub-actions" role="group" aria-label={`Play ${mode.title}`}>
      <button type="button" onClick={() => onLaunch("solo")}><User aria-hidden /><span>Singleplayer</span></button>
      <button type="button" onClick={() => onLaunch("online")}><Wifi aria-hidden /><span>Multiplayer</span></button>
      <button type="button" onClick={() => onLaunch("hotseat")}><Users aria-hidden /><span>Hotseat</span></button>
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
  const online = onlinePlayerLimit(mode), local = hotseatPlayerLimit(mode);
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
            <article><h4><Wifi aria-hidden /> Multiplayer · {online === 2 ? "2 players" : `2–${online} players`}</h4><p>{mode.rules.multiplayer}</p></article>
            <article><h4><Users aria-hidden /> Hotseat · {local === 2 ? "2 players" : `2–${local} players`}</h4><p>{mode.rules.hotseat}</p></article>
          </div>
        </div>
        <footer><LaunchButtons mode={mode} onLaunch={onLaunch} /></footer>
      </section>
    </div>
  );
}

function AboutPanel({ version, onBack }: { version: string; onBack: () => void }) {
  return <main className="atlas-page atlas-about"><button type="button" className="atlas-back" onClick={onBack}><ArrowLeft /> Atlas Arena</button><span className="atlas-eyebrow">Data & boundaries</span><h1>Built on traceable geography</h1><p>Atlas Arena uses a bundled snapshot—never a live API during a match. Every multiplayer room pins its dataset version so all players generate the same rounds.</p><div className="atlas-source-list"><article><strong>Natural Earth 1:110m</strong><span>Admin-0 boundary geometry · public domain</span></article><article><strong>United Nations M49</strong><span>Identifiers and statistical regions</span></article><article><strong>GeoNames</strong><span>Names, capitals, coordinates, languages and neighbors · CC BY 4.0</span></article><article><strong>World Bank</strong><span>Population (SP.POP.TOTL) and surface area (AG.SRF.TOTL.K2), including observation year</span></article><article><strong>Wikidata</strong><span>Highest summits used by the stat modes</span></article><article><strong>flag-icons</strong><span>Bundled SVG flags · MIT</span></article></div><div className="atlas-boundary-note"><Globe2 /><p>Natural Earth renders de facto boundaries. Rendering is separate from quiz eligibility: the default game uses an explicit UN 195 scope, while territories remain available in the data. Dataset: <strong>{version}</strong>.</p></div></main>;
}
