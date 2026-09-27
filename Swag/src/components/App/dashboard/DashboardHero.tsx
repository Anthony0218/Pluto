import { BarChart3, Flame, Gamepad2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { featuredGames } from "@/data/dashboard";
import type { Profile } from "@/context/AuthContext";

export default function DashboardHero({ profile, streak, online, signedIn, loading, now, search }: { profile: Profile | null; streak?: number; online?: number; signedIn: boolean; loading: boolean; now: number; search?: ReactNode }) {
  useUiLanguage();
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <section className="dashboard-hero">
    <img className="hero-art" src={featuredGames[0]?.image} alt="" />
    <div className="hero-content">
      <p className="dash-eyebrow">{ui(greeting)},</p>
      <h1>{profile?.display_name?.trim() || profile?.username?.trim() || ui(loading ? "Loading…" : "Welcome")} <span aria-hidden="true">👋</span></h1>
      <p className="hero-tagline">{ui("Great games. Smart learning. Better progress.")}</p>
      {!signedIn && !loading && <p className="mt-2 text-sm text-slate-300"><Link to="/login" className="underline">{ui("Log in")}</Link> {ui("to see your progress and friends.")}</p>}
      {signedIn && !profile && !loading && <p className="mt-2 text-sm text-slate-300">{ui("Your profile stats are unavailable.")}</p>}
      <div className="hero-tools">
        <div className="hero-stats">{[
          { Icon: Flame, value: streak, label: "day activity streak", color: "text-orange-400" },
          { Icon: Gamepad2, value: profile?.games_played, label: "games played", color: "text-indigo-400" },
          { Icon: BarChart3, value: profile?.rating, label: "rating", color: "text-violet-400" },
          { Icon: Users, value: online, label: "friends online", color: "text-sky-400" },
        ].map(({ Icon, value, label, color }) => <div className="hero-stat" key={label}><Icon size={25} className={color} /><div><strong>{value?.toLocaleString() ?? "—"}</strong><small>{ui(label)}</small></div></div>)}</div>
        {search && <div className="hero-search">{search}</div>}
      </div>
    </div>
  </section>;
}
