import { ui, useUiLanguage } from "@/i18n/ui";
import { useId, useState, type ReactNode } from "react";
import {
  ChevronRight,
  type LucideIcon,
  CornerDownRight,
  BookOpen,
  Gamepad2,
  House,
  LayoutDashboard,
  LogOut,
  UserRound,
  Users,
  Trophy,
  Heart,
  FileText,
  Grid2X2,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { games } from "../../data/games";
import { learningSubjects, subjectRoute } from "@/data/learningCatalog";
import { toolApps, toolRoute } from "@/data/toolCatalog";
import ThemeToggle from "./ThemeToggle";

const links = [
  { label: "Home", href: "/home", icon: House },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Friends", href: "/friends", icon: Users },
  { label: "Clans", href: "/clans", icon: Users },
  { label: "Leaderboards", href: "/leaderboards", icon: Trophy },
];
const sidebarTools = toolApps.filter(tool => tool.status === "available");
const sidebarGames = ["chess", "watten", "schafkopf", "go", "eat-it", "atlas-arena", "natura"].flatMap(slug => games.filter(game => game.route === `/games/${slug}`));

/** On short screens the rows tighten up, so the whole list (down to Imprint) stays in view without scrolling. */
const rowClass = "flex items-center gap-3 rounded-xl px-3 py-3 [@media(max-height:800px)]:py-2 text-sm font-medium";
const subLink = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/5";

/**
 * A section of the sidebar: the first click opens its list, a second click on the title goes to the section's page.
 * The chevron only folds the list.
 */
function NavGroup({ label, href, icon: Icon, onNavigate, children }: { label: string; href: string; icon: LucideIcon; onNavigate: () => void; children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => pathname === href || pathname.startsWith(`${href}/`));
  const listId = useId();
  return <div className="rounded-xl border border-white/[0.06] bg-white/[0.025]">
    <div className="flex items-center">
      <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => { if (!open) setOpen(true); else { navigate(href); onNavigate(); } }}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 [@media(max-height:800px)]:py-2 text-left text-sm font-medium text-zinc-300 hover:text-white"><Icon size={18} aria-hidden />{label}</button>
      <button type="button" aria-label={`${open ? ui("Collapse") : ui("Expand")} ${label}`} aria-expanded={open} aria-controls={listId} onClick={() => setOpen(value => !value)}
        className="mr-1 rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"><ChevronRight size={16} className={`transition-transform ${open ? "rotate-90" : ""}`} aria-hidden /></button>
    </div>
    {open && <div id={listId} className="border-t border-white/[0.06] p-1.5">{children}</div>}
  </div>;
}

export default function SideBar({ onNavigate, onInvite, invitePanel }: { onNavigate: () => void; onInvite: () => void; invitePanel: boolean }) {
  useUiLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const itemClass = ({ isActive }: { isActive: boolean }) => `${subLink} ${isActive ? "text-indigo-200" : "text-zinc-400 hover:text-white"}`;
  return (
    <div className="flex h-full flex-col bg-[#080d1c] text-white">
      <nav
        aria-label={ui("Main navigation")}
        className="flex-1 space-y-2 [@media(max-height:800px)]:space-y-1 overflow-y-auto p-4 pt-16 [@media(max-height:800px)]:pt-14"
      >
        {links.slice(0, 2).map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            onClick={onNavigate}
            className={({ isActive }) =>
              `${rowClass} ${isActive ? "bg-indigo-500/15 text-indigo-200" : "text-zinc-300 hover:bg-white/5"}`
            }
          >
            <Icon size={18} />
            {ui(label)}
          </NavLink>
        ))}
        <NavGroup label={ui("Games")} href="/games" icon={Gamepad2} onNavigate={onNavigate}>
          <Link to="/games" onClick={onNavigate} className={`${subLink} text-indigo-200`}>{ui("All games")}</Link>
          {sidebarGames.map(game => <NavLink key={game.route} to={game.route} onClick={onNavigate} className={itemClass}><CornerDownRight size={13} aria-hidden />{ui(game.title)}</NavLink>)}
        </NavGroup>
        <NavGroup label={ui("Tools")} href="/tools" icon={Grid2X2} onNavigate={onNavigate}>
          <Link to="/tools" onClick={onNavigate} className={`${subLink} text-indigo-200`}>{ui("All tools")}</Link>
          {sidebarTools.map(tool => <NavLink key={tool.id} to={toolRoute(tool.id)} onClick={onNavigate} className={itemClass}><CornerDownRight size={13} aria-hidden />{ui(tool.title)}</NavLink>)}
        </NavGroup>
        <NavGroup label={ui("Learn")} href="/learn" icon={BookOpen} onNavigate={onNavigate}>
          <Link to="/learn" onClick={onNavigate} className={`${subLink} text-indigo-200`}>{ui("All subjects")}</Link>
          {learningSubjects.map(subject => <NavLink key={subject.id} to={subjectRoute(subject.id)} onClick={onNavigate} className={itemClass}><CornerDownRight size={13} aria-hidden />{ui(subject.title)}</NavLink>)}
        </NavGroup>
        <button type="button" aria-expanded={invitePanel} aria-controls="invite-panel" onClick={onInvite} className={`${rowClass} w-full border border-indigo-300/20 ${invitePanel ? "bg-indigo-500/25" : "bg-indigo-500/10"} text-indigo-200 hover:bg-indigo-500/20`}><Gamepad2 size={18} />{ui("Invite a friend")}</button>
        {links.slice(2).map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            onClick={onNavigate}
            className={({ isActive }) =>
              `${rowClass} ${isActive ? "bg-indigo-500/15 text-indigo-200" : "text-zinc-300 hover:bg-white/5"}`
            }
          >
            <Icon size={18} />
            {ui(label)}
          </NavLink>
        ))}
        {[{ href: "/credits", label: "Credits", Icon: Heart }, { href: "/imprint", label: "Imprint", Icon: FileText }].map(({ href, label, Icon }) => (
          <NavLink key={href} to={href} onClick={onNavigate} className={({ isActive }) => `${rowClass} ${isActive ? "bg-indigo-500/15 text-indigo-200" : "text-zinc-300 hover:bg-white/5"}`}><Icon size={18} aria-hidden />{ui(label)}</NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-white/10 p-3">
        <ThemeToggle />
        {user ? (
          <button
            type="button"
            onClick={async () => {
              await signOut();
              onNavigate();
              navigate("/login");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={18} />{ui("Log out")}</button>
        ) : (
          <Link
            to="/login"
            onClick={onNavigate}
            className="block rounded-xl bg-indigo-500 px-3 py-2.5 text-center text-sm font-semibold"
          >{ui("Log in")}</Link>
        )}
      </div>
    </div>
  );
}
