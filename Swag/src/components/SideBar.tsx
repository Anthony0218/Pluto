import {
  BarChart3,
  Home,
  Settings,
  Trophy,
  Users,
  LogOut,
  UserRoundPlus,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navigation = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Profile",
    href: "/profile",
    icon: Users,
  },
  {
    label: "Friends",
    href: "/friends",
    icon: UserRoundPlus,
  },
  {
    label: "Games",
    href: "/games",
    icon: Trophy,
  },
  {
    label: "Chess",
    href: "/games/chess",
    icon: BarChart3,
  },
  {
    label: "Watten",
    href: "/games/watten",
    icon: BarChart3,
  },
  {
    label: "Medieval Kingdoms",
    href: "/games/medieval-kingdoms",
    icon: Trophy,
  },
  {
    label: "Credits",
    href: "/credits",
    icon: Trophy,
  },
];

export default function SideBar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-16 items-center border-b border-zinc-200 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-indigo-600">
            <img
              src="/pluto-icon.png"
              alt="Pluto icon"
              className="h-full w-full object-cover"
            />
          </div>

          <span className="text-lg font-bold tracking-tight text-zinc-900">
            Pluto
          </span>
        </div>
      </div>

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
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={19} />
          Log out
        </button>
      </div>
    </aside>
  );
}
