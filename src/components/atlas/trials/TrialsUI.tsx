import { AtlasFitContent } from "../AtlasFitContent";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronRight, Heart, RotateCcw, Trophy, X } from "lucide-react";
import type { TrialCountry } from "../../../games/atlas/trials/countryStats";
import type { AtlasDifficulty, AtlasHistory } from "../../../games/atlas/types";
import { useTrialSession } from "./trialSession";
import { AtlasResultHero } from "../AtlasResultHero";

/** What every mode receives from the Trials page. `best` is the stored personal best before this run. */
export type TrialModeProps = {
  pool: TrialCountry[]; byId: Map<string, TrialCountry>; seed: string; difficulty: AtlasDifficulty; best: number;
  topology: unknown; history: AtlasHistory;
  onRecord: (score: number) => void; onRestart: () => void; onExit: () => void;
};
export type TrialAccent = "cyan" | "amber" | "violet" | "emerald" | "rose" | "sky";
export type CardState = "idle" | "selected" | "correct" | "wrong" | "missed" | "locked" | "dim";

/** Header, progress rail and page frame shared by all six Trials modes. */
export function TrialShell({ title, accent, roundLabel, score, lives, maxLives, progress, onExit, children, wide = false }: {
  title: string; accent: TrialAccent; roundLabel: string; score?: number; lives?: number; maxLives?: number; progress: number;
  onExit: () => void; children: ReactNode; wide?: boolean;
}) {
  const session = useTrialSession();
  const reportScore = session?.onScore;
  useEffect(() => { if (score !== undefined) reportScore?.(score); }, [reportScore, score]);
  return (
    <main className={`atlas-trials-page trial-accent-${accent}`}>
      <header className="trial-header">
        <button type="button" className="atlas-icon-button" onClick={onExit} aria-label="Back to Atlas Trials"><ArrowLeft /></button>
        <div className="trial-header-title"><span className="atlas-eyebrow">{title}</span><strong>{roundLabel}</strong></div>
        <div className="trial-header-stats">
          {session?.player && <span className="atlas-turn-chip" style={{ "--player": session.player.color } as CSSProperties}><i />{session.player.name}</span>}
          {maxLives !== undefined && lives !== undefined && (
            <span className="trial-lives" aria-label={`${lives} of ${maxLives} lives left`}>
              {Array.from({ length: maxLives }, (_, index) => <Heart key={index} size={16} className={index < lives ? "is-full" : "is-lost"} aria-hidden />)}
            </span>
          )}
          {score !== undefined && <span className="trial-score" aria-label={`Score ${score}`}><Trophy size={16} aria-hidden /><b key={score}>{score.toLocaleString("en")}</b></span>}
        </div>
      </header>
      <div className="trial-progress" aria-hidden><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
      <div className={`trial-stage ${wide ? "is-wide" : ""}`}><AtlasFitContent>{children}</AtlasFitContent></div>
    </main>
  );
}

export function CountryFlag({ country, className = "" }: { country: TrialCountry; className?: string }) {
  return <img className={`trial-flag ${className}`} src={country.flag} alt="" loading="lazy" draggable={false} />;
}

/** A tappable country option: flag, name and an optional detail line, with correct/wrong/locked states. */
export function CountryOptionCard({ country, state = "idle", onSelect, disabled, detail, index = 0, children }: {
  country: TrialCountry; state?: CardState; onSelect?: () => void; disabled?: boolean; detail?: ReactNode; index?: number; children?: ReactNode;
}) {
  const label = state === "correct" ? `${country.name}, correct` : state === "wrong" ? `${country.name}, wrong` : state === "missed" ? `${country.name}, was correct` : country.name;
  return (
    <button type="button" className={`trial-country-card is-${state}`} style={{ "--i": index } as CSSProperties} onClick={onSelect} disabled={disabled} aria-label={label} aria-pressed={state === "selected" || state === "locked" ? true : undefined}>
      <CountryFlag country={country} />
      <span className="trial-country-text"><strong>{country.name}</strong>{detail && <small>{detail}</small>}</span>
      {children}
      {(state === "correct" || state === "locked" || state === "missed") && <Check className="trial-card-mark" aria-hidden />}
      {state === "wrong" && <X className="trial-card-mark" aria-hidden />}
    </button>
  );
}

export function TrialFeedback({ tone, title, detail, action }: { tone: "good" | "bad" | "neutral"; title: ReactNode; detail?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`trial-feedback is-${tone}`} role="status" aria-live="polite">
      <span className="trial-feedback-icon" aria-hidden>{tone === "good" ? <Check /> : tone === "bad" ? <X /> : <Trophy />}</span>
      <div><strong>{title}</strong>{detail && <span>{detail}</span>}</div>
      {action}
    </div>
  );
}

/** Floating "+750" that replays whenever `id` changes. */
export function ScoreBurst({ points, id }: { points: number; id: string | number }) {
  return points > 0 ? <span key={id} className="trial-score-burst" aria-hidden>+{points.toLocaleString("en")}</span> : null;
}

export function GameOverPanel({ title, subtitle, score, best, stats, onRestart, onExit, children }: {
  title: string; subtitle?: string; score: number; best: number; stats: { label: string; value: ReactNode }[];
  onRestart: () => void; onExit: () => void; children?: ReactNode;
}) {
  const session = useTrialSession();
  const newBest = !session?.finish && score > 0 && score >= best;
  const complete = session?.onComplete;
  const reported = useRef(false);
  useEffect(() => {
    if (complete && !reported.current) { reported.current = true; complete(score); }
  }, [complete, score]);
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => { again.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="trial-game-over" aria-labelledby="trial-game-over-title">
      <AtlasResultHero heading="h2" eyebrow={session?.player ? `${session.player.name} · final score` : newBest ? "New personal best" : `Best ${best.toLocaleString("en")}`} title={<span id="trial-game-over-title">{title}</span>} />
      {subtitle && <p>{subtitle}</p>}
      <p className="trial-final-score">{score.toLocaleString("en")} <small>points</small></p>
      <div className="trial-final-stats">{stats.map((stat) => <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
      {children}
      <div className="trial-final-actions">
        {session?.finish
          ? <button type="button" className="atlas-start" onClick={session.finish.onClick} ref={again}>{session.finish.label} <ChevronRight size={18} /></button>
          : <><button type="button" className="atlas-start" onClick={onRestart} ref={again}><RotateCcw size={18} /> Replay</button>
            <button type="button" className="atlas-start atlas-secondary" onClick={onExit}>Back to menu</button></>}
      </div>
    </section>
  );
}
