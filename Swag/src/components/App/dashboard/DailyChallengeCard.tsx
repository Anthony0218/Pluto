import { ArrowRight, BookOpen, Compass, Gamepad2, Puzzle, Sparkles, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import { games } from "@/data/games";
import type { ChallengeCategory, DailyChallenge } from "@/data/dashboard";

const categories = {
  puzzle: { label: "Chess puzzle", Icon: Puzzle }, learning: { label: "Learn", Icon: BookOpen },
  play: { label: "Play", Icon: Gamepad2 }, win: { label: "Win", Icon: Trophy },
  explore: { label: "Explore", Icon: Compass }, social: { label: "Friends", Icon: Users }, variant: { label: "Variant", Icon: Sparkles },
} satisfies Record<ChallengeCategory, { label: string; Icon: typeof Puzzle }>;

export default function DailyChallengeCard({ challenge, now, loading, unavailable, signedIn }: { challenge: DailyChallenge | null; now: number; loading: boolean; unavailable: boolean; signedIn: boolean }) {
  useUiLanguage();
  const category = categories[challenge?.category ?? "explore"] ?? categories.explore;
  const Icon = category.Icon;
  const progress = challenge?.progress == null ? null : Math.max(0, Math.min(challenge.progress, challenge.target));
  const minutes = challenge ? Math.max(0, Math.ceil((Date.parse(challenge.expires_at) - now) / 60_000)) : 0;
  const art = games.find(game => challenge?.route?.startsWith(game.route))?.image;
  return <section className="dash-panel daily-challenge"><div className="dash-section-heading"><h2>{ui("Daily Challenge")}</h2><span className="text-[10px] text-slate-400">{ui("Daily · UTC")}</span></div>
    {loading || !challenge ? <p className="dash-empty">{ui(loading ? "Loading challenge…" : !signedIn ? "Log in to track your daily challenge." : unavailable ? "Your daily challenge is temporarily unavailable." : "No challenge is available today.")}</p> : <>
      <div className="challenge-art">{art && <img src={art} alt="" />}<span><Icon size={27} /></span><p className="dash-eyebrow">{ui(category.label)}</p>{challenge.reward && <small>{ui(challenge.reward)}</small>}</div>
      <h3>{ui(challenge.title)}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{ui(challenge.description)}</p>
      {progress !== null ? <div className="mt-4"><progress aria-label={ui("Daily challenge progress")} value={progress} max={challenge.target} className="h-1.5 w-full accent-indigo-400" /><div className="mt-1 flex justify-between text-xs text-slate-400"><span>{progress} / {challenge.target}{progress >= challenge.target ? ` · ${ui("Completed!")}` : ""}</span><span>{minutes ? `${Math.floor(minutes / 60)}${ui("h")} ${minutes % 60}${ui("m")} ${ui("left")}` : ui("Refreshing…")}</span></div></div> : <p className="mt-3 text-xs text-slate-400">{ui("Progress is unavailable for this challenge.")}</p>}
      <Link className="dash-button primary mt-4 w-full" to={challenge.route ?? "/games"}>{ui(challenge.cta ?? "Choose a game")}<ArrowRight size={16} /></Link>
    </>}
  </section>;
}
