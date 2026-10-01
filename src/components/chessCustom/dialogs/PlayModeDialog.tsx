import { PLAY_MODES, type PlayMode } from "@/games/chess/custom/library/navigation";
import { ui } from "@/i18n/ui";
import { NextIcon } from "../icons/ChessCustomIcons";
import { PLAY_MODE_ICONS } from "../icons/stepIcons";
import Dialog from "./Dialog";

/** Play a variant: Singleplayer (vs AI), Multiplayer (online) or Hotseat (same device). */
export default function PlayModeDialog({ open, variantName, onChoose, onClose }: { open: boolean; variantName: string; onChoose: (mode: PlayMode) => void; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} eyebrow={ui("Play variant")} title={variantName} description={ui("Choose how you want to play.")}>
      <ul className="grid gap-2.5" aria-label={ui("Game modes")}>
        {PLAY_MODES.map((mode) => {
          const Icon = PLAY_MODE_ICONS[mode.id];
          return (
            <li key={mode.id}>
              <button
                type="button"
                data-play-mode={mode.id}
                onClick={() => onChoose(mode.id)}
                className="group flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-transparent p-3.5 text-left transition hover:border-amber-300/40 hover:from-amber-300/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-[radial-gradient(circle_at_30%_20%,rgba(252,211,77,.18),rgba(0,0,0,.35))] text-amber-200 transition group-hover:text-amber-100">
                  <Icon size={34} strokeWidth={1.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg text-white">{ui(mode.label)}</span>
                  <span className="block text-sm text-zinc-400">{ui(mode.detail)}</span>
                </span>
                <NextIcon size={18} className="shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-amber-300" />
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
