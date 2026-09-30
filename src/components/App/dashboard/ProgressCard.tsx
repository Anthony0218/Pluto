import { ArrowRight, BarChart3, Flame, Gamepad2, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import type { Profile } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";

export default function ProgressCard({ profile, streak, loading, signedIn }: { profile: Profile | null; streak?: number; loading: boolean; signedIn: boolean }) {
  useUiLanguage();
  const rate = profile?.games_played ? Math.min(100, Math.round(profile.wins / profile.games_played * 100)) : null;
  return <section className="dash-panel"><div className="dash-section-heading"><h2>{ui("Your Progress")}</h2><Link className="dash-text-link" to="/profile">{ui("View details")}<ArrowRight size={13} /></Link></div>
    {!profile ? <p className="dash-empty">{ui(loading ? "Loading profile…" : signedIn ? "Your profile stats are unavailable." : "Log in to see your saved stats.")}</p> : <>
      <div className="progress-overview"><div role="img" aria-label={ui("Win rate") + ": " + (rate === null ? ui("No completed games recorded yet.") : `${rate}%`)} className="progress-ring" style={{ background: `conic-gradient(from -90deg, #818cf8, #6366f1 ${(rate ?? 0) / 2}%, #22d3ee ${rate ?? 0}%, #263454 ${rate ?? 0}% 100%)` }}><div>{rate === null ? "—" : `${rate}%`}</div></div><div><h3 className="font-semibold">{ui("Win rate")}</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">{ui(profile.games_played ? "Every game is a chance to grow." : "No completed games recorded yet.")}</p></div></div>
      <div className="progress-stats">{[
        { Icon: BarChart3, label: "Rating", value: profile.rating, color: "text-violet-400" },
        { Icon: Gamepad2, label: "Games played", value: profile.games_played, color: "text-indigo-400" },
        { Icon: Trophy, label: "Wins", value: profile.wins, color: "text-amber-400" },
        { Icon: Flame, label: "Day streak", value: streak, color: "text-orange-400" },
      ].map(({ Icon, label, value, color }) => <div key={label}><Icon size={24} className={color} /><span><strong>{value?.toLocaleString() ?? "—"}</strong><small>{ui(label)}</small></span></div>)}</div>
      <p className="mt-3 text-center text-xs text-slate-400">{ui("Wins")} {profile.wins} <span className="px-1">·</span> {ui("Draws")} {profile.draws} <span className="px-1">·</span> {ui("Losses")} {profile.losses}</p>
    </>}
  </section>;
}
