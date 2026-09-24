import { Moon, Orbit } from "lucide-react";

import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="
        grid grid-cols-2 gap-1
        rounded-xl
        border border-white/[0.07]
        bg-white/[0.025]
        p-1
      "
    >
      <button
        type="button"
        onClick={() => setTheme("black")}
        className={`
          flex h-9
          items-center justify-center
          gap-2
          rounded-lg
          text-xs font-medium
          transition-all
          ${
            theme === "black"
              ? "bg-white/[0.09] text-white"
              : "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
          }
        `}
      >
        <Moon size={15} />
        Black
      </button>

      <button
        type="button"
        onClick={() => setTheme("pluto")}
        className={`
          flex h-9
          items-center justify-center
          gap-2
          rounded-lg
          text-xs font-medium
          transition-all
          ${
            theme === "pluto"
              ? `
                bg-gradient-to-r
                from-sky-500/20
                via-indigo-500/20
                to-fuchsia-500/20
                text-indigo-200
                ring-1 ring-indigo-400/20
              `
              : "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
          }
        `}
      >
        <Orbit size={15} />
        Pluto
      </button>
    </div>
  );
}
