import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { featuredGames } from "@/data/dashboard";
import type { Profile } from "@/context/AuthContext";

export default function DashboardHero({ profile, signedIn, loading, now, challenge }: { profile: Profile | null; signedIn: boolean; loading: boolean; now: number; challenge: ReactNode }) {
  useUiLanguage();
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <section className="dashboard-hero">
    <img className="hero-art" src={featuredGames[0]?.image} alt="" />
    <div className="hero-content">
      <div className="hero-greeting">
        <p className="dash-eyebrow">{ui(greeting)},</p>
        <h1>{profile?.display_name?.trim() || profile?.username?.trim() || ui(loading ? "Loading…" : "Welcome")} <span aria-hidden="true">👋</span></h1>
        <p className="hero-tagline">{ui("Great games. Smart learning. Better progress.")}</p>
        {!signedIn && !loading && <p className="mt-2 text-sm text-slate-300"><Link to="/login" className="underline">{ui("Log in")}</Link> {ui("to see your progress and friends.")}</p>}
        {signedIn && !profile && !loading && <p className="mt-2 text-sm text-slate-300">{ui("Your profile stats are unavailable.")}</p>}
      </div>
      <div className="hero-dashboard-cards"><div className="hero-challenge">{challenge}</div></div>
    </div>
  </section>;
}
