import { Outlet } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

export default function AppLayout() {
  const { plutoMode } = useTheme();
  return (
    <div
      className={`relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden text-zinc-100 ${plutoMode ? "bg-[#060816]" : "bg-zinc-950"}`}
    >
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

      <div className="relative z-10 mx-auto min-h-[calc(100vh-4rem)] w-full max-w-[1800px]">
        <Outlet />
      </div>
    </div>
  );
}
