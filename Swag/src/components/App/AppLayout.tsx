import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import SideBar from "./SideBar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const location = useLocation();
  const { plutoMode } = useTheme();

  /* ============================================
     CLOSE MOBILE SIDEBAR AFTER NAVIGATION
  ============================================ */

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div
      className={`
        relative
        min-h-[calc(100vh-4rem)]
        w-full
        overflow-x-hidden
        text-zinc-100

        ${plutoMode ? "bg-[#060816]" : "bg-zinc-950"}
      `}
    >
      {/* ========================================
          BACKGROUND
      ======================================== */}

      {plutoMode && (
        <div
          className="
            pointer-events-none
            fixed inset-0
            z-0
          "
        >
          {/* MAIN GRADIENT */}
          <div
            className="
              absolute inset-0

              bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(236,72,153,0.10),_transparent_30%),linear-gradient(180deg,_#070b1a_0%,_#090d1f_38%,_#050712_100%)]
            "
          />

          {/* BLUE GLOW */}
          <div
            className="
              absolute
              left-[8%]
              top-24

              h-60
              w-60

              rounded-full
              bg-sky-500/10

              blur-3xl
            "
          />

          {/* PURPLE GLOW */}
          <div
            className="
              absolute
              right-[8%]
              top-28

              h-72
              w-72

              rounded-full
              bg-fuchsia-500/10

              blur-3xl
            "
          />

          {/* BOTTOM GLOW */}
          <div
            className="
              absolute
              bottom-0
              left-1/2

              h-80
              w-80

              -translate-x-1/2

              rounded-full
              bg-indigo-500/10

              blur-3xl
            "
          />

          {/* SUBTLE STAR GRID */}
          <div
            className="
              absolute inset-0

              bg-[radial-gradient(circle,_rgba(255,255,255,0.5)_1px,_transparent_1px)]
              bg-[size:46px_46px]

              opacity-[0.12]
            "
          />
        </div>
      )}

      {/* ========================================
          DESKTOP SIDEBAR

          PublicHeader = 64px high,
          therefore sidebar starts at top-16.
      ======================================== */}

      <aside
        className="
          fixed
          bottom-0
          left-0
          top-16

          z-40

          hidden
          w-64

          lg:block
        "
      >
        <SideBar />
      </aside>

      {/* ========================================
          MOBILE SIDEBAR BUTTON
      ======================================== */}

      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
          className="
            fixed
            left-4
            top-20

            z-[200]

            flex
            h-10
            w-10
            items-center
            justify-center

            rounded-xl

            border
            border-white/[0.08]

            bg-[#0b1024]/85

            text-zinc-300

            shadow-lg
            shadow-black/30

            backdrop-blur-xl

            transition

            hover:border-white/[0.14]
            hover:bg-[#111834]
            hover:text-white

            lg:hidden
          "
        >
          <Menu size={20} />
        </button>
      )}

      {/* ========================================
          MOBILE SIDEBAR
      ======================================== */}

      {sidebarOpen && (
        <div className="lg:hidden">
          {/* BACKDROP */}
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="
              fixed
              inset-x-0
              bottom-0
              top-16

              z-[210]

              bg-black/60

              backdrop-blur-[3px]
            "
          />

          {/* SIDEBAR */}
          <aside
            className="
              fixed
              bottom-0
              left-0
              top-16

              z-[220]

              w-64

              shadow-2xl
              shadow-black/50
            "
          >
            <div className="relative h-full">
              {/* CLOSE BUTTON */}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation"
                className="
                  absolute
                  right-3
                  top-3

                  z-50

                  flex
                  h-8
                  w-8
                  items-center
                  justify-center

                  rounded-lg

                  text-zinc-500

                  transition

                  hover:bg-white/[0.06]
                  hover:text-white
                "
              >
                <X size={18} />
              </button>

              <SideBar />
            </div>
          </aside>
        </div>
      )}

      {/* ========================================
          PAGE CONTENT
      ======================================== */}

      <div
        className="
          relative
          z-10

          min-h-[calc(100vh-4rem)]

          lg:pl-64
        "
      >
        <div
          className="
            mx-auto
            w-full
            max-w-[1800px]
          "
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
