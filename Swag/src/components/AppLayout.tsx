import { useEffect, useState } from "react";
import { Menu, X, Moon, Orbit } from "lucide-react";
import { Outlet } from "react-router-dom";
import SideBar from "./SideBar";

type AppTheme = "black" | "pluto";

const THEME_STORAGE_KEY = "app-theme";

function getInitialTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "pluto";
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);

  return saved === "pluto" ? "pluto" : "black";
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const plutoMode = theme === "pluto";

  return (
    <div
      className={`
        relative
        min-h-screen
        w-full
        overflow-x-hidden
        text-zinc-100
        ${plutoMode ? "bg-[#060816]" : "bg-zinc-950"}
      `}
    >
      {/* PLUTO BACKGROUND */}
      {plutoMode && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <div
            className="
              absolute
              inset-0
              bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.16),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(236,72,153,0.12),_transparent_30%),linear-gradient(180deg,_#070b1a_0%,_#090d1f_38%,_#050712_100%)]
            "
          />

          <div className="absolute left-[8%] top-16 h-60 w-60 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="absolute right-[8%] top-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />

          <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

          <div
            className="
              absolute
              inset-0
              bg-[radial-gradient(circle,_rgba(255,255,255,0.6)_1px,_transparent_1px)]
              bg-[size:46px_46px]
              opacity-20
            "
          />
        </div>
      )}

      {/* MENU BUTTON */}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className={`
            fixed
            left-4
            top-4
            z-[200]
            mt-3
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            border
            shadow-lg
            transition
            ${
              plutoMode
                ? "border-sky-200/10 bg-[#0b1024]/85 text-zinc-200 shadow-black/30 backdrop-blur-md hover:border-sky-300/25 hover:bg-[#111834]"
                : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            }
          `}
        >
          <Menu size={22} />
        </button>
      )}

      {/* THEME TOGGLE */}
      <div
        className={`
          fixed
          right-4
          top-4
          z-[200]
          flex
          items-center
          gap-1
          rounded-xl
          border
          p-1
          shadow-lg
          backdrop-blur-md
          ${
            plutoMode
              ? "border-sky-200/10 bg-[#0b1024]/85"
              : "border-zinc-800 bg-zinc-900/95"
          }
        `}
      >
        <button
          type="button"
          onClick={() => setTheme("black")}
          title="Black mode"
          className={`
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            transition
            ${
              theme === "black"
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:bg-white/10 hover:text-white"
            }
          `}
        >
          <Moon size={17} />
        </button>

        <button
          type="button"
          onClick={() => setTheme("pluto")}
          title="Pluto mode"
          className={`
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-lg
            transition
            ${
              theme === "pluto"
                ? "bg-gradient-to-br from-sky-500 via-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/30"
                : "text-zinc-500 hover:bg-white/10 hover:text-white"
            }
          `}
        >
          <Orbit size={17} />
        </button>
      </div>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-[210] bg-black/50 backdrop-blur-[2px]"
            onClick={() => setSidebarOpen(false)}
          />

          <aside className="fixed inset-y-0 left-0 z-[220] w-64">
            <div className="relative h-full">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="absolute right-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>

              <SideBar />
            </div>
          </aside>
        </>
      )}

      {/* CONTENT */}
      <div className="relative z-10 min-h-screen bg-transparent">
        <div className="mx-auto w-full max-w-[1800px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
