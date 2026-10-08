import { ui, useUiLanguage } from "@/i18n/ui";
import { Moon, Orbit } from "lucide-react";

import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle() {
  useUiLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label={ui("Appearance")}
      className="
        grid grid-cols-2 gap-0.5
        rounded-lg
        border border-white/[0.07]
        bg-white/[0.025]
        p-0.5
      "
    >
      <button
        type="button"
        onClick={() => setTheme("black")}
        className={`
          flex h-7
          items-center justify-center
          gap-1.5
          rounded-md
          text-xs font-medium
          transition-all
          ${
            theme === "black"
              ? "bg-white/[0.09] text-white"
              : "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
          }
        `}
      >
        <Moon size={13} />{ui("Black")}</button>

      <button
        type="button"
        onClick={() => setTheme("pluto")}
        className={`
          flex h-7
          items-center justify-center
          gap-1.5
          rounded-md
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
        <Orbit size={13} />{ui("Pluto")}</button>
    </div>
  );
}
