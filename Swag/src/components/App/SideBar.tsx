import {
  BookOpen,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  UserRound,
  Users,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { games } from "../../data/games";
import FriendAvatar from "../social/FriendAvatar";
import ThemeToggle from "./ThemeToggle";

const links = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Games", href: "/games", icon: Gamepad2 },
  { label: "Learn", href: "/learn", icon: BookOpen },
  { label: "Friends", href: "/friends", icon: Users },
  { label: "Profile", href: "/profile", icon: UserRound },
];

export default function SideBar({ onNavigate }: { onNavigate: () => void }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col bg-[#080d1c] text-white">
      <div className="border-b border-white/10 p-5 pr-14">
        {profile ? (
          <Link
            to="/profile"
            onClick={onNavigate}
            className="flex items-center gap-3"
          >
            <FriendAvatar profile={profile} />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {profile.username || profile.display_name || "Player"}
              </p>
              <p className="text-xs text-zinc-400">Your Pluto account</p>
            </div>
          </Link>
        ) : (
          <p className="font-semibold">Explore Pluto</p>
        )}
      </div>
      <nav
        aria-label="Main navigation"
        className="flex-1 space-y-1 overflow-y-auto p-3"
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
            {label}
          </NavLink>
        ))}
        <details className="pt-3">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-zinc-400">
            Browse games
          </summary>
          {games.map((game) => (
            <Link
              key={game.route}
              to={game.route}
              onClick={onNavigate}
              className="block rounded-xl px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
            >
              {game.title}
            </Link>
          ))}
        </details>
      </nav>
      <div className="space-y-3 border-t border-white/10 p-4">
        <p className="text-xs text-zinc-400">Appearance</p>
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
            <LogOut size={18} />
            Log out
          </button>
        ) : (
          <Link
            to="/login"
            onClick={onNavigate}
            className="block rounded-xl bg-indigo-500 px-3 py-2.5 text-center text-sm font-semibold"
          >
            Log in
          </Link>
        )}
      </div>
    </div>
  );
}
