import { useTheme } from "@/context/ThemeContext";
import {
  BarChart3,
  Folder,
  Gamepad2,
  Home,
  Settings,
  Trophy,
  Users,
  LogOut,
} from "lucide-react";
import { NavLink } from "react-router";

const navigation = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    label: "Games",
    href: "/games",
    icon: Gamepad2,
  },
  {
    label: "Chess",
    href: "/chessGame",
    icon: Folder,
  },
  {
    label: "Watten",
    href: "/watten",
    icon: Users,
  },
  {
    label: "Leaderboard",
    href: "/leaderboard",
    icon: Trophy,
  },
];

export default function SideBar() {
  const { darkMode, toggleDarkMode } = useTheme();
  return (
    <aside className="flex min-h-screen w-64 flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-16 items-center border-b border-zinc-200 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Gamepad2 size={20} />
          </div>

          <span className="text-lg font-bold tracking-tight text-zinc-900">
            Swag
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-5">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Navigation
        </p>

        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={19}
                    strokeWidth={isActive ? 2.3 : 2}
                    className={
                      isActive
                        ? "text-indigo-600"
                        : "text-zinc-400 group-hover:text-zinc-600"
                    }
                  />

                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <button
        type="button"
        onClick={toggleDarkMode}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <span className="text-xl">{darkMode ? "☀️" : "🌙"}</span>

        <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
      </button>

      <div className="border-t border-zinc-200 p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`
          }
        >
          <Settings size={19} />
          Settings
        </NavLink>

        <button
          type="button"
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={19} />
          Log out
        </button>
      </div>
    </aside>
  );
}
