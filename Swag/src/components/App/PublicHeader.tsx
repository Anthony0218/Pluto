import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { LanguageSelector } from "@/games/chess/i18n/chessLanguage";
import { useState } from "react";
import { House, Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import FriendAvatar from "../social/FriendAvatar";
import { useTheme } from "../../context/ThemeContext";
import NavigationDrawer from "./NavigationDrawer";

export function PlutoHomeLink({ className = "" }: { className?: string }) {
  useUiLanguage();
  return <Link to="/" className={`shrink-0 text-lg font-bold tracking-tight text-indigo-100 hover:text-white ${className}`}>{ui("Pluto")}</Link>;
}

export function NavigationControls() {
  useUiLanguage();
  const { user, profile } = useAuth();
  const { language, setLanguage } = useAppLanguage();
  const [open, setOpen] = useState(false);
  return <>
    <div className="navigation-controls flex min-w-0 items-center gap-1.5 sm:gap-2">
      <div className="public-header-language"><LanguageSelector language={language} onChange={setLanguage} /></div>
      <Link to="/dashboard" aria-label={ui("Home")} title={ui("Home")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/10"><House size={18} /></Link>
      {user ? <Link to="/profile" className="flex h-10 max-w-28 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-xs font-semibold hover:bg-white/10 sm:max-w-44 sm:px-2.5"><FriendAvatar profile={profile ?? { display_name: user.email?.split("@")[0] ?? ui("Player"), username: null, avatar_url: null, avatar_id: null }} size="sm" /><span className="min-w-0 truncate">{profile?.display_name?.trim() || profile?.username?.trim() || user.email?.split("@")[0] || ui("Player")}</span></Link> : <Link to="/login" className="flex h-10 items-center rounded-xl bg-indigo-500 px-3 text-xs font-semibold hover:bg-indigo-400">{ui("Log in")}</Link>}
      <button id="navigation-toggle" type="button" aria-label={ui("Open navigation")} aria-expanded={open} aria-controls="app-navigation" onClick={() => setOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-200 hover:bg-white/10"><Menu size={19} /></button>
    </div>
    {open && <NavigationDrawer onClose={() => setOpen(false)} />}
  </>;
}

export default function PublicHeader({ compact = false }: { compact?: boolean }) {
  const { plutoMode } = useTheme();
  const dashboard = useLocation().pathname === "/dashboard";
  return <header className={compact ? "compact-app-header absolute inset-x-0 top-0 z-[200] h-[var(--public-header-height)] text-white" : `fixed inset-x-0 top-0 z-[200] h-[var(--public-header-height)] border-b border-white/[0.08] text-white backdrop-blur-xl ${plutoMode ? "bg-[#060816]/95" : "bg-zinc-950/95"}`}>
    <div className="mx-auto flex h-full max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 sm:flex-nowrap sm:px-6 sm:py-0">
      <PlutoHomeLink />
      {dashboard && <div id="dashboard-sidebar-toggle-slot" className="shrink-0" />}
      {dashboard && <div id="dashboard-search-slot" className="order-3 min-w-0 basis-full sm:order-none sm:mx-auto sm:flex-1 sm:basis-auto" />}
      {!dashboard && <div className="flex-1" />}
      <div className="ml-auto"><NavigationControls /></div>
    </div>
  </header>;
}
