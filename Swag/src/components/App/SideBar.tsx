import { useEffect, useState } from "react";

import {
  BookOpen,
  ChevronDown,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
  Users,
} from "lucide-react";

import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "./ThemeToggle";

/* ============================================
   GAME CATEGORIES
============================================ */

const gameCategories = [
  {
    label: "Board & Strategy",
    games: [
      {
        label: "Chess",
        href: "/games/chess",
      },
      {
        label: "Natura",
        href: "/games/natura",
      },
      {
        label: "Medieval Kingdoms",
        href: "/games/medieval-kingdoms",
      },
    ],
  },
  {
    label: "Card Games",
    games: [
      {
        label: "Watten",
        href: "/games/watten",
      },
      {
        label: "Schafkopf",
        href: "/games/schafkopf",
      },
    ],
  },
];

/* ============================================
   SIDEBAR
============================================ */

export default function SideBar() {
  const { signOut } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  /*
   * Games should count as active for every
   * route underneath /games.
   *
   * Example:
   * /games/chess/classic/ai
   * still highlights Games.
   */
  const gamesActive =
    location.pathname === "/games" || location.pathname.startsWith("/games/");

  const [gamesOpen, setGamesOpen] = useState(gamesActive);

  /*
   * Automatically open Games when the user
   * enters a game route directly.
   */
  useEffect(() => {
    if (gamesActive) {
      setGamesOpen(true);
    }
  }, [gamesActive]);

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <aside
      className="
        flex
        h-full
        w-64
        flex-col
        border-r
        border-white/[0.07]
        bg-[#060a14]/95
        text-white
        backdrop-blur-xl
      "
    >
      {/* ========================================
          NAVIGATION
      ======================================== */}

      <nav
        className="
          flex-1
          overflow-y-auto
          px-3
          py-5
        "
      >
        <p
          className="
            mb-3
            px-3
            text-[10px]
            font-bold
            uppercase
            tracking-[0.2em]
            text-zinc-600
          "
        >
          Pluto
        </p>

        <div className="space-y-1">
          {/* DASHBOARD */}
          <SidebarLink
            label="Dashboard"
            href="/dashboard"
            icon={LayoutDashboard}
          />

          {/* ====================================
              GAMES
          ==================================== */}

          <div>
            <button
              type="button"
              onClick={() => setGamesOpen((current) => !current)}
              className={`
                group
                flex
                w-full
                items-center
                gap-3
                rounded-xl
                px-3
                py-2.5
                text-left
                text-sm
                font-medium
                transition

                ${
                  gamesActive
                    ? `
                      bg-indigo-500/15
                      text-indigo-200
                    `
                    : `
                      text-zinc-500
                      hover:bg-white/[0.04]
                      hover:text-white
                    `
                }
              `}
            >
              <Gamepad2 size={18} strokeWidth={gamesActive ? 2.3 : 2} />

              <span className="flex-1">Games</span>

              <ChevronDown
                size={15}
                className={`
                  text-zinc-600
                  transition-transform
                  duration-200

                  ${gamesOpen ? "rotate-180" : ""}
                `}
              />
            </button>

            {/* ==================================
                GAMES SUBMENU
            ================================== */}

            <div
              className={`
                grid
                transition-all
                duration-200
                ease-out

                ${
                  gamesOpen
                    ? `
                      grid-rows-[1fr]
                      opacity-100
                    `
                    : `
                      grid-rows-[0fr]
                      opacity-0
                    `
                }
              `}
            >
              <div className="overflow-hidden">
                <div
                  className="
                    ml-[25px]
                    mt-1
                    border-l
                    border-white/[0.07]
                    pb-2
                    pl-3
                  "
                >
                  {/* ALL GAMES */}
                  <NavLink
                    to="/games"
                    end
                    className={({ isActive }) =>
                      `
                        flex
                        items-center
                        rounded-lg
                        px-3
                        py-2
                        text-xs
                        font-medium
                        transition

                        ${
                          isActive
                            ? `
                              bg-white/[0.06]
                              text-white
                            `
                            : `
                              text-zinc-500
                              hover:bg-white/[0.035]
                              hover:text-zinc-300
                            `
                        }
                      `
                    }
                  >
                    All Games
                  </NavLink>

                  {/* CATEGORIES */}
                  {gameCategories.map((category) => (
                    <div key={category.label} className="mt-4">
                      <p
                        className="
                          mb-1
                          px-3
                          text-[9px]
                          font-bold
                          uppercase
                          tracking-[0.18em]
                          text-zinc-700
                        "
                      >
                        {category.label}
                      </p>

                      <div className="space-y-0.5">
                        {category.games.map((game) => {
                          /*
                           * We use pathname manually instead
                           * of NavLink's exact isActive so
                           * Chess remains highlighted on:
                           *
                           * /games/chess/classic
                           * /games/chess/variants/...
                           */
                          const gameActive =
                            location.pathname === game.href ||
                            location.pathname.startsWith(`${game.href}/`);

                          return (
                            <NavLink
                              key={game.href}
                              to={game.href}
                              className={`
                                flex
                                items-center
                                gap-2
                                rounded-lg
                                px-3
                                py-2
                                text-xs
                                font-medium
                                transition

                                ${
                                  gameActive
                                    ? `
                                      bg-indigo-500/10
                                      text-indigo-200
                                    `
                                    : `
                                      text-zinc-500
                                      hover:bg-white/[0.035]
                                      hover:text-zinc-300
                                    `
                                }
                              `}
                            >
                              <span
                                className={`
                                  h-1
                                  w-1
                                  shrink-0
                                  rounded-full

                                  ${
                                    gameActive ? "bg-indigo-300" : "bg-zinc-700"
                                  }
                                `}
                              />

                              <span>{game.label}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* LEARN */}
          <SidebarLink label="Learn" href="/learn" icon={BookOpen} />

          {/* FRIENDS */}
          <SidebarLink label="Friends" href="/friends" icon={Users} />

          {/* PROFILE */}
          <SidebarLink label="Profile" href="/profile" icon={UserRound} />
        </div>
      </nav>

      {/* ========================================
          BOTTOM
      ======================================== */}

      <div
        className="
          space-y-3
          border-t
          border-white/[0.07]
          p-3
        "
      >
        {/* APPEARANCE */}
        <div>
          <p
            className="
              mb-2
              px-2
              text-[10px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-zinc-600
            "
          >
            Appearance
          </p>

          <ThemeToggle />
        </div>

        {/* SETTINGS */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `
              flex
              items-center
              gap-3
              rounded-xl
              px-3
              py-2.5
              text-sm
              font-medium
              transition

              ${
                isActive
                  ? `
                    bg-white/[0.06]
                    text-white
                  `
                  : `
                    text-zinc-500
                    hover:bg-white/[0.04]
                    hover:text-white
                  `
              }
            `
          }
        >
          <Settings size={18} />

          <span>Settings</span>
        </NavLink>

        {/* LOGOUT */}
        <button
          type="button"
          onClick={handleLogout}
          className="
            flex
            w-full
            items-center
            gap-3
            rounded-xl
            px-3
            py-2.5
            text-sm
            font-medium
            text-zinc-500
            transition
            hover:bg-red-500/10
            hover:text-red-300
          "
        >
          <LogOut size={18} />

          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

/* ============================================
   STANDARD MAIN NAVIGATION LINK
============================================ */

function SidebarLink({
  label,
  href,
  icon: Icon,
}: {
  label: string;
  href: string;
  icon: React.ElementType;
}) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        `
          group
          flex
          items-center
          gap-3
          rounded-xl
          px-3
          py-2.5
          text-sm
          font-medium
          transition

          ${
            isActive
              ? `
                bg-indigo-500/15
                text-indigo-200
              `
              : `
                text-zinc-500
                hover:bg-white/[0.04]
                hover:text-white
              `
          }
        `
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} strokeWidth={isActive ? 2.3 : 2} />

          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}
