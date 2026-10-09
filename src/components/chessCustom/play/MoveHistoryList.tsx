import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useRef } from "react";
import type { SessionFrame } from "@/games/chess/custom/editor/useGameSession";
import type { GameVariant } from "@/games/chess/custom/engine/types";
import { ui } from "@/i18n/ui";

/** Every move of the session. Clicking a move rewinds the board to that position. */
export default function MoveHistoryList({ frames, cursor, onJump, variant, maxHeight = "max-h-64" }: { frames: SessionFrame[]; cursor: number; onJump: (index: number) => void; variant: GameVariant; maxHeight?: string }) {
  useGameLanguage();
  const listRef = useRef<HTMLOListElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  // Keep the current move visible by scrolling the list only (never the page).
  useEffect(() => {
    const list = listRef.current;
    const item = activeRef.current;
    if (list && item) list.scrollTop = Math.max(0, item.offsetTop - list.offsetTop - list.clientHeight / 2);
  }, [cursor]);
  const teamColor = (team?: string) => variant.teams.find((entry) => entry.id === team)?.color ?? "#a1a1aa";

  return (
    <ol ref={listRef} className={`${maxHeight} space-y-0.5 overflow-y-auto pr-1 text-sm`} aria-label={ui("Move history")}>
      <li>
        <button
          ref={cursor === 0 ? activeRef : undefined}
          type="button"
          onClick={() => onJump(0)}
          aria-current={cursor === 0 ? "step" : undefined}
          className={`w-full rounded-md px-2 py-1 text-left text-xs transition ${cursor === 0 ? "bg-amber-300/15 text-amber-100" : "text-zinc-500 hover:bg-white/[0.05]"}`}
        >
          {ui("Starting position")}
        </button>
      </li>
      {frames.slice(1).map((frame, index) => {
        const position = index + 1;
        const active = position === cursor;
        return (
          <li key={position}>
            <button
              ref={active ? activeRef : undefined}
              type="button"
              aria-current={active ? "step" : undefined}
              onClick={() => onJump(position)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition ${active ? "bg-amber-300/15 text-amber-50" : position > cursor ? "text-zinc-600 hover:bg-white/[0.04]" : "text-zinc-300 hover:bg-white/[0.05]"}`}
            >
              <span className="w-6 text-right text-[11px] text-zinc-600">{gameUi(position)}.</span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: teamColor(frame.team) }} />
              <span className="font-mono">{gameUi(frame.notation)}</span>
              {frame.state.fired.length > 0 && <span title={gameUi(frame.state.fired.map((entry) => entry.name).join(", "))} className="ml-auto text-[11px] text-amber-300">⚡</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
