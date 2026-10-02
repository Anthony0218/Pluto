import { ui, useUiLanguage } from "@/i18n/ui";
import {
  BookOpen,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  UserRound,
  Users,
  Trophy,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { games } from "../../data/games";
import { learningResources } from "../../data/navigation";
import ThemeToggle from "./ThemeToggle";

const links = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Friends", href: "/friends", icon: Users },
  { label: "Groups", href: "/groups", icon: Users },
  { label: "Leaderboards", href: "/leaderboards", icon: Trophy },
  { label: "Profile", href: "/profile", icon: UserRound },
];
const sidebarLessons = ["Chess Puzzles", "Chess Analysis", "Chess rules", "Schafkopfen Rules"].flatMap((title) =>
  learningResources.filter((resource) => resource.title === title),
);

export default function SideBar({ onNavigate }: { onNavigate: () => void }) {
  useUiLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col bg-[#080d1c] text-white">
      <nav
        aria-label={ui("Main navigation")}
        className="flex-1 space-y-2 overflow-y-auto p-4 pt-16"
      >
        {links.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${isActive ? "bg-indigo-500/15 text-indigo-200" : "text-zinc-300 hover:bg-white/5"}`
            }
          >
            <Icon size={18} />
            {ui(label)}
          </NavLink>
        ))}
        <details className="rounded-xl border border-white/[0.06] bg-white/[0.025]">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 text-sm font-medium text-zinc-300 marker:content-none hover:text-white"><Gamepad2 size={18} />{ui("Games")}</summary>
          <div className="border-t border-white/[0.06] p-1.5">{games.map((game) => <Link key={game.route} to={game.route} onClick={onNavigate} className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">{ui(game.title)}</Link>)}</div>
        </details>
        <details className="rounded-xl border border-white/[0.06] bg-white/[0.025]">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 text-sm font-medium text-zinc-300 marker:content-none hover:text-white"><BookOpen size={18} />{ui("Learn")}</summary>
          <div className="border-t border-white/[0.06] p-1.5">{sidebarLessons.map((resource) => <Link key={resource.route} to={resource.route} onClick={onNavigate} className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">{ui(resource.title)}</Link>)}</div>
        </details>
      </nav>
      <div className="space-y-3 border-t border-white/10 p-4">
        <p className="text-xs text-zinc-400">{ui("Appearance")}</p>
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
