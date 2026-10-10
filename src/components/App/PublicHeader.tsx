import { useDashboardData } from "@/hooks/useDashboardData";
import FriendNotifications from "./dashboard/FriendNotifications";
import "./dashboard/dashboard.css";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { LanguageSelector } from "@/games/chess/i18n/chessLanguage";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { House, Menu, Sparkles } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import FriendAvatar from "../social/FriendAvatar";
import { useTheme } from "../../context/ThemeContext";
import NavigationDrawer from "./NavigationDrawer";
import { pageBrand } from "./pageBrand";
import { useLandingAnimations, useLandingReducedMotion } from "./landing/motionPreference";
import "./plutoLogo.css";

/** Pluto with its heart-shaped glacier and Charon, its moon. Hovering the logo spins it, makes the heart beat and sends Charon around. */
function PlutoMark() {
  return <svg className="pluto-mark" viewBox="0 0 30 30" aria-hidden="true" focusable="false">
    <circle cx="15" cy="15" r="11" fill="#d9c3a5" />
    <path d="M7 11q3-3 6-1 1 3-2 4-3 1-4-3ZM20 20q3-2 4 0-1 3-4 2Z" fill="#a78466" />
    <path className="pluto-mark-heart" d="M15 12c-1.6-3-6-1.5-4.2 2 1 1.8 3 3.2 4.2 4.2 1.2-1 3.2-2.4 4.2-4.2 1.8-3.5-2.6-5-4.2-2Z" fill="#f6ebdc" />
    <path d="M15 4a11 11 0 0 1 0 22 8 11 0 0 0 0-22Z" fill="#2b2147" opacity=".28" />
    <g className="pluto-mark-charon"><circle cx="27" cy="15" r="2.4" fill="#9aa4c9" /></g>
  </svg>;
}

export function PlutoHomeLink({ className = "" }: { className?: string }) {
  useUiLanguage();
  const { pathname } = useLocation();
  // The landing page's Animations switch also quiets the logo; elsewhere only the system setting applies.
  const still = useLandingReducedMotion() && pathname === "/";
  const name = ui("Pluto");
  return <Link to="/" aria-label={name} data-still={still || undefined} className={`pluto-logo shrink-0 text-lg font-bold tracking-tight text-indigo-100 hover:text-white ${className}`}>
    <PlutoMark />
    <span aria-hidden="true">{Array.from(name).map((letter, index) => <span key={index} className="pluto-logo-letter" style={{ "--i": index } as CSSProperties}>{letter}</span>)}</span>
  </Link>;
}

/** Renders page-specific controls in the shared header, just left of the language selector. */
const noSubscription = () => () => {};
const findHeaderToolsSlot = () => document.getElementById("header-tools-slot");
const noSlotOnServer = () => null;
export function HeaderTools({ children }: { children: ReactNode }) {
  // The slot is committed together with the header, so React re-checks the snapshot right after mount.
  const slot = useSyncExternalStore(noSubscription, findHeaderToolsSlot, noSlotOnServer);
  return slot ? createPortal(children, slot) : null;
}

/** Adds a detail after the mode in the header description, e.g. "Singleplayer · Difficulty: Normal". */
const findHeaderDescriptionSlot = () => document.getElementById("header-description-slot");
export function HeaderDescription({ children }: { children: ReactNode }) {
  const slot = useSyncExternalStore(noSubscription, findHeaderDescriptionSlot, noSlotOnServer);
  return slot ? createPortal(<> · {children}</>, slot) : null;
}

/** Sidebar button → Pluto → game or page name → description; shared by every page header. */
export function HeaderBrand({ name, mode, description }: { name?: string; mode?: string; description?: ReactNode }) {
  useUiLanguage();
  return <div className="chess-header-brand">
    <NavigationToggle />
    <span className="chess-header-logo"><PlutoHomeLink />{name && <span className="chess-header-colon" aria-hidden="true">:</span>}</span>
    {name && <div className="chess-header-text"><span className="chess-header-name">{ui(name)}</span><p className="chess-header-description empty:hidden">{mode && ui(mode)}{mode && description && " · "}{description}<span id="header-description-slot" /></p></div>}
  </div>;
}

/** Landing page only: switches the page's animations off for older devices. */
export function AnimationToggle() {
  useUiLanguage();
  const [on, setOn] = useLandingAnimations();
  return <button type="button" role="switch" aria-checked={on} onClick={() => setOn(!on)} title={ui(on ? "Turn animations off" : "Turn animations on")}
    className={`animation-toggle flex h-10 shrink-0 items-center gap-2 rounded-xl border px-2.5 text-xs font-semibold ${on ? "border-indigo-300/30 bg-indigo-400/15 text-indigo-100 hover:bg-indigo-400/25" : "border-white/10 bg-white/[0.05] text-zinc-400 hover:bg-white/10"}`}>
    <Sparkles size={16} aria-hidden="true" />
    <span className="hidden sm:inline">{ui("Animations")}</span>
    <span className={`animation-toggle-track ${on ? "is-on" : ""}`} aria-hidden="true"><i /></span>
  </button>;
}

export function NavigationControls() {
  useUiLanguage();
  const { user, profile } = useAuth();
  const { language, setLanguage } = useAppLanguage();
  const { notifications } = useDashboardData();
  const { pathname } = useLocation();
  return <div className="navigation-controls flex min-w-0 items-center gap-1.5 sm:gap-2">
      {pathname === "/" && <AnimationToggle />}
      <div id="header-tools-slot" className="flex min-w-0 items-center gap-1.5 sm:gap-2 empty:hidden" />
      <div className="public-header-language"><LanguageSelector language={language} onChange={setLanguage} /></div>
      <Link to="/home" aria-label={ui("Home")} title={ui("Home")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/10"><House size={18} /></Link>
      {user && <FriendNotifications key={user.id} items={notifications} userId={user.id} />}
      {user ? <Link to="/profile" aria-label={profile?.display_name?.trim() || profile?.username?.trim() || ui("Player")} className="flex h-10 max-w-28 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-xs font-semibold hover:bg-white/10 sm:max-w-44 sm:px-2.5"><FriendAvatar profile={profile ?? { display_name: user.email?.split("@")[0] ?? ui("Player"), username: null, avatar_url: null, avatar_id: null }} size="sm" /><span className="hidden min-w-0 truncate sm:inline">{profile?.display_name?.trim() || profile?.username?.trim() || user.email?.split("@")[0] || ui("Player")}</span></Link> : <Link to="/login" className="flex h-10 items-center rounded-xl bg-indigo-500 px-3 text-xs font-semibold hover:bg-indigo-400">{ui("Log in")}</Link>}
    </div>;
}

export function NavigationToggle() {
  useUiLanguage();
  const [open, setOpen] = useState(false);
  return <>
    <button id="navigation-toggle" type="button" aria-label={ui("Open navigation")} aria-expanded={open} aria-controls="app-navigation" onClick={() => setOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-200 hover:bg-white/10"><Menu size={19} /></button>
    {open && <NavigationDrawer onClose={() => setOpen(false)} />}
  </>;
}

/** The two Home pages, shown beside the logo while on them. */
const dashboardTabs = [{ to: "/home", label: "Home" }, { to: "/dashboard", label: "Dashboard" }] as const;
export function DashboardTabs({ className = "" }: { className?: string }) {
  useUiLanguage();
  const { pathname } = useLocation();
  return <nav className={`dashboard-tabs ${className}`} aria-label={ui("Dashboard sections")}>
    {dashboardTabs.map(item => <Link key={item.to} to={item.to} aria-current={pathname === item.to ? "page" : undefined} className={pathname === item.to ? "active" : undefined}>{ui(item.label)}</Link>)}
  </nav>;
}

export default function PublicHeader({ compact = false }: { compact?: boolean }) {
  const { plutoMode } = useTheme();
  const { pathname } = useLocation();
  const dashboard = pathname === "/home" || pathname === "/dashboard";
  const explore = /^\/(tools|learn)(\/|$)/.test(pathname) || /^\/games\/?$/.test(pathname);
  const brand = compact && !dashboard ? pageBrand(pathname) : undefined;
  return <header style={{ ...(brand?.surface ? { backgroundColor: brand.surface } : {}), "--chess-header-accent": brand?.accent } as CSSProperties} className={compact ? "compact-app-header absolute inset-x-0 top-0 z-[200] h-[var(--public-header-height)] text-white" : `fixed inset-x-0 top-0 z-[200] h-[var(--public-header-height)] border-b border-white/[0.08] text-white backdrop-blur-xl ${plutoMode ? "bg-[#060816]/95" : "bg-zinc-950/95"}`}>
    <div className="mx-auto flex h-full max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 sm:flex-nowrap sm:px-6 sm:py-0">
      {dashboard || !compact ? <><NavigationToggle /><PlutoHomeLink />{dashboard && <DashboardTabs className="header-dashboard-tabs" />}</> : <HeaderBrand name={brand?.name} mode={brand?.mode} />}
      {explore && <nav className="public-explore-nav" aria-label={ui("Explore Pluto")}>{[["/games", "Games"], ["/tools", "Tools"], ["/learn", "Learn"]].map(([to, label]) => <NavLink key={to} to={to}>{ui(label)}</NavLink>)}</nav>}
      {dashboard && <div id="dashboard-search-slot" className="order-3 min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto" />}
      {!dashboard && !brand && <div className="flex-1" />}
      <div className="ml-auto min-w-0 max-w-full"><NavigationControls /></div>
    </div>
  </header>;
}
