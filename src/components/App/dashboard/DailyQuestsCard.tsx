import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Target } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import CountUp from "./CountUp";
import type { DailyChallenge } from "@/data/dashboard";
import { ui, useUiLanguage } from "@/i18n/ui";

export default function DailyQuestsCard({ quests, loading, unavailable, signedIn }: { quests?: DailyChallenge[]; loading: boolean; unavailable: boolean; signedIn: boolean }) {
  useUiLanguage();
  const [ref, seen] = useInView<HTMLElement>();
  const empty = ui(loading ? "Loading quests…" : !signedIn ? "Log in to track daily quests." : unavailable ? "Daily quests are unavailable." : "No quests today.");
  return <section ref={ref} className={`dash-panel daily-challenge${seen ? " in-view" : ""}`} aria-label={ui("Daily quests")}><div className="dash-section-heading"><h2>{ui("Daily Quests")}</h2><span className="text-[10px] text-slate-400">UTC</span></div>
    {!quests?.length ? <div className="dash-empty-state"><span className="dash-empty-icon"><Target size={26} aria-hidden /></span><p>{empty}</p>{!signedIn && !loading && <Link to="/login" className="dash-button primary">{ui("Log in")}<ArrowRight size={14} aria-hidden /></Link>}</div> :
      <div className="mt-3 space-y-2">{quests.map(quest => { const progress = quest.progress == null ? null : Math.min(quest.target, quest.progress); const done = progress !== null && progress >= quest.target; return <Link key={quest.id} to={quest.route ?? "/games"} aria-label={`${ui(quest.cta ?? "Open game")}: ${ui(quest.title)}`} className={`group block rounded-xl border px-3 py-2.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 motion-reduce:transform-none ${done ? "border-emerald-300/35 bg-emerald-400/10 hover:border-emerald-300/70" : "border-indigo-300/15 bg-indigo-300/5 hover:border-indigo-300/50 hover:bg-indigo-300/10"}`}><div className="flex items-start gap-2"><CheckCircle2 size={17} className={done ? "mt-0.5 shrink-0 text-emerald-300" : "mt-0.5 shrink-0 text-slate-500"} /><div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-white">{ui(quest.title)}</h3><p className="mt-0.5 text-xs leading-4 text-slate-400">{ui(quest.description)}</p></div><ArrowRight size={16} className="shrink-0 text-indigo-200 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" /></div><div className="mt-2 flex items-center gap-2"><div role="progressbar" aria-label={`${ui(quest.title)} ${ui("progress")}`} aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={progress ?? 0} className="dash-bar"><span style={{ "--fill": quest.target > 0 ? (progress ?? 0) / quest.target : 0 } as CSSProperties} /></div><span className="text-[11px] tabular-nums text-slate-300">{progress === null ? "—" : <><CountUp to={progress} active={seen} />/{quest.target}</>}</span></div></Link>; })}</div>}
  </section>;
}
