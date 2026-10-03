import { ui, useUiLanguage } from "@/i18n/ui";
import { Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { ReviewQualityIcon } from "./ReviewQualityBadge";
import { qualityColor, type ReviewVisualQuality } from "./reviewQualityVisuals";

const classifications: Array<{ quality: ReviewVisualQuality; range: string; description: string }> = [
  { quality: "Book", range: "Opening", description: "A move leading to a position in a known opening line from the Lichess opening database, within the first 30 plies." },
  { quality: "Best", range: "Engine's #1", description: "The strongest move Stockfish found in this position." },
  { quality: "Excellent", range: "≤ 0.25", description: "Almost as strong as the best move; practically no advantage lost." },
  { quality: "Good", range: "≤ 0.60", description: "A solid move that gives away only a little of the evaluation." },
  { quality: "Inaccuracy", range: "≤ 1.20", description: "A weaker move: playable, but a better option was available." },
  { quality: "Mistake", range: "≤ 2.50", description: "A clear error that hands over a noticeable part of your advantage." },
  { quality: "Blunder", range: "> 2.50", description: "A serious error that often loses material or the game." },
  { quality: "Missed Win", range: "Game Review", description: "Stockfish estimated a winning advantage (at least +5 or a forced mate), then +0.75 or less after your move. This estimate does not prove a forced win; missing mate while still winning does not qualify." },
];

/** Small info button that opens a window explaining the Chess Coach move classifications. */
export default function MoveClassificationGuide() {
  useUiLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={ui("Move classifications")}
        aria-label={ui("Move classifications")}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-amber-300/30 hover:bg-amber-300/10 hover:text-amber-200"
      >
        <Info size={14} strokeWidth={2.5} />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={ui("Move classifications")}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-400/15 bg-[linear-gradient(145deg,rgba(10,18,28,.98),rgba(5,10,17,.97))] p-5 shadow-2xl shadow-black/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-[#f6ead1]">{ui("Move classifications")}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {ui("Opening book matches are marked Book. Other moves are graded by evaluation lost compared to the best move (in pawns).")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={ui("Close")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <ul className="mt-4 space-y-2">
                {classifications.map(({ quality, range, description }) => {
                  const color = qualityColor(quality);
                  return (
                    <li
                      key={quality}
                      className="group/quality flex items-start gap-3 rounded-2xl border bg-black/20 p-3"
                      style={{ borderColor: `${color}33` }}
                    >
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                        style={{ color, background: `${color}1a` }}
                      >
                        <ReviewQualityIcon quality={quality} size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black" style={{ color }}>{ui(quality)}</p>
                          <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-400">
                            {ui(range)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">{ui(description)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
