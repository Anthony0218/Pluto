import { ui, useUiLanguage } from "@/i18n/ui";
import { useState, type ReactNode } from "react";

import { ReviewQualityIcon } from "./singleplayer/ReviewQualityBadge";
import { qualityColor, type ReviewVisualQuality } from "./singleplayer/reviewQualityVisuals";
import { CLASSIC_HISTORY_SIDES, type MoveHistorySide } from "./moveHistorySides";

export type MoveHistoryEntry = {
  ply: number;
  /** Key of the side that moved; entries of unknown sides get a full-width row in "All". */
  side: string | null;
  /** Printed move number; defaults to the round the entry falls into. */
  moveNumber?: number;
  content: ReactNode;
  trailing?: ReactNode;
  /** Chess Coach grade, shown as a small icon. */
  quality?: ReviewVisualQuality | null;
  /** Listed but not previewable (e.g. hidden Fog of War moves). */
  disabled?: boolean;
  /** Tooltip, e.g. the full notation when a narrow column truncates it. */
  title?: string;
};

type Round = {
  number: number;
  cells: (MoveHistoryEntry | null)[];
  /** An entry that belongs to no side (e.g. a variant event). */
  event?: MoveHistoryEntry;
};

/**
 * One round per row: the first side on the left, each following side in its own column.
 * A new round starts whenever a side moves that already had its turn in the current one.
 */
function toRounds(entries: MoveHistoryEntry[], sides: MoveHistorySide[]) {
  const rounds: Round[] = [];
  let current: Round | null = null;
  let lastIndex = -1;

  for (const entry of entries) {
    const index = sides.findIndex((side) => side.key === entry.side);

    if (index < 0) {
      rounds.push({ number: entry.moveNumber ?? rounds.length + 1, cells: [], event: entry });
      current = null;
      lastIndex = -1;
      continue;
    }

    if (!current || index <= lastIndex) {
      current = { number: entry.moveNumber ?? rounds.length + 1, cells: sides.map(() => null) };
      rounds.push(current);
    }

    current.cells[index] = entry;
    lastIndex = index;
  }

  return rounds;
}

function QualityMark({ quality }: { quality: ReviewVisualQuality }) {
  useUiLanguage();
  return (
    <span className="group/quality shrink-0" style={{ color: qualityColor(quality) }} title={ui(quality)}>
      <ReviewQualityIcon quality={quality} size={11} />
    </span>
  );
}

/**
 * Move list shared by the chess games: "All" shows the sides side by side
 * (White left, Black right), the side tabs list only that side's moves.
 */
export default function ChessMoveHistoryList({
  entries,
  sides = CLASSIC_HISTORY_SIDES,
  selectedPly = null,
  onSelect,
  emptyLabel = "No moves yet",
  leading,
  newestFirst = false,
  className = "",
  listClassName = "",
}: {
  entries: MoveHistoryEntry[];
  sides?: MoveHistorySide[];
  selectedPly?: number | null;
  /** Called with the entry's ply, or null for the newest entry: that one returns to the live board. */
  onSelect?: (ply: number | null) => void;
  emptyLabel?: ReactNode;
  /** Row above the moves, e.g. an "Initial position" entry. */
  leading?: ReactNode;
  newestFirst?: boolean;
  className?: string;
  /** Classes of the scrolling list area (height limits, borders). */
  listClassName?: string;
}) {
  useUiLanguage();
  const [filter, setFilter] = useState<string>("all");
  const activeFilter = filter === "all" || sides.some((side) => side.key === filter) ? filter : "all";
  const sideIndex = (key: string | null) => sides.findIndex((side) => side.key === key);

  const newestPly = entries[entries.length - 1]?.ply;

  const allRounds = toRounds(entries, sides);
  const roundOfPly = new Map<number, number>();
  for (const round of allRounds) {
    for (const entry of [...round.cells, round.event]) {
      if (entry) roundOfPly.set(entry.ply, round.number);
    }
  }

  // More than two sides (Four-Player Chess) leaves narrow columns in "All".
  const compact = sides.length > 2;

  const renderCell = (entry: MoveHistoryEntry, withNumber: boolean) => {
    const selected = selectedPly === entry.ply;
    const number = entry.moveNumber ?? roundOfPly.get(entry.ply);
    // Classic notation: "12." for White, "12..." for Black.
    const suffix = sides.length === 2 && sideIndex(entry.side) > 0 ? "..." : ".";

    return (
      <button
        key={entry.ply}
        type="button"
        disabled={!onSelect || entry.disabled}
        aria-pressed={selected}
        title={entry.title}
        onClick={() => onSelect?.(entry.ply === newestPly ? null : entry.ply)}
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg ${compact && !withNumber ? "px-1" : "px-2"} py-1 text-left transition enabled:hover:bg-white/[0.05] disabled:cursor-default ${entry.disabled ? "opacity-55" : ""} ${
          selected ? "bg-blue-400/15 ring-1 ring-inset ring-blue-300/25" : ""
        }`}
      >
        {withNumber && (
          <span className="w-7 shrink-0 text-[10px] font-black text-zinc-600">
            {number !== undefined && `${number}${suffix}`}
          </span>
        )}
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">{entry.content}</span>
        {entry.trailing && (
          <span className="flex min-w-0 max-w-[50%] shrink-0 items-center justify-end truncate text-[9px]">{entry.trailing}</span>
        )}
        {entry.quality && <QualityMark quality={entry.quality} />}
      </button>
    );
  };

  const filtered = activeFilter === "all" ? entries : entries.filter((entry) => entry.side === activeFilter);
  const orderedRounds = newestFirst ? allRounds.slice().reverse() : allRounds;
  const orderedEntries = newestFirst ? filtered.slice().reverse() : filtered;
  const columns = `2rem repeat(${sides.length}, minmax(0, 1fr))`;

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div
        role="group"
        aria-label={ui("Moves to show")}
        className="mb-1.5 flex shrink-0 gap-1 rounded-lg border border-white/5 bg-black/25 p-0.5"
      >
        {[{ key: "all", label: "All", dotClass: "" }, ...sides].map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={activeFilter === option.key}
            title={ui(option.label)}
            onClick={() => setFilter(option.key)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-black transition ${
              activeFilter === option.key
                ? "bg-[#fff3d5]/[0.12] text-[#f6e6c6] shadow-inner"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
          >
            {option.dotClass && <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full border ${option.dotClass}`} />}
            {/* Four sides only fit as colour dots; the name stays in the tooltip. */}
            <span className={compact && option.dotClass ? "sr-only" : "truncate"}>{ui(option.label)}</span>
          </button>
        ))}
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] ${listClassName}`}>
        {leading}

        {entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-600">
            {typeof emptyLabel === "string" ? ui(emptyLabel) : emptyLabel}
          </div>
        ) : activeFilter === "all" ? (
          <>
            <div
              className="sticky top-0 z-[1] grid gap-1 border-b border-white/5 bg-[#0a121c]/95 px-1 py-0.5 text-[8px] font-black uppercase tracking-wider text-zinc-600 backdrop-blur"
              style={{ gridTemplateColumns: columns }}
            >
              <span className="px-1">#</span>
              {sides.map((side) => (
                <span key={side.key} title={ui(side.label)} className={`flex min-w-0 items-center gap-1 ${compact ? "px-1" : "px-2"}`}>
                  <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full border ${side.dotClass}`} />
                  <span className={compact ? "sr-only" : "truncate"}>{ui(side.label)}</span>
                </span>
              ))}
            </div>

            {orderedRounds.map((round, index) =>
              round.event ? (
                <div key={`event-${round.event.ply}`} className="border-b border-white/5 px-1 py-0.5 last:border-0">
                  {renderCell(round.event, false)}
                </div>
              ) : (
                <div
                  key={`round-${index}-${round.number}`}
                  className="grid items-center gap-1 border-b border-white/5 px-1 py-0.5 last:border-0"
                  style={{ gridTemplateColumns: columns }}
                >
                  <span className="px-1 text-[10px] font-black text-zinc-600">{round.number}.</span>
                  {round.cells.map((entry, cell) =>
                    entry ? (
                      renderCell(entry, false)
                    ) : (
                      // A skipped turn before a later move (e.g. an eliminated player) shows a dash.
                      <span key={`empty-${cell}`} className="px-2 text-[10px] text-zinc-700">
                        {round.cells.slice(cell + 1).some(Boolean) ? "—" : ""}
                      </span>
                    ),
                  )}
                </div>
              ),
            )}
          </>
        ) : orderedEntries.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-600">{ui("No moves yet")}</div>
        ) : (
          <div className="divide-y divide-white/5 px-1">
            {orderedEntries.map((entry) => renderCell(entry, true))}
          </div>
        )}
      </div>
    </div>
  );
}
