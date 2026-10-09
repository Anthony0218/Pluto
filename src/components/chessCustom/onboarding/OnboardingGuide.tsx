import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GUIDE_STEPS, guideKeyAction, type GuideState } from "@/games/chess/custom/library/onboarding";
import { CREATE_STEPS, stepNumber } from "@/games/chess/custom/library/navigation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ui } from "@/i18n/ui";
import { CloseIcon, NextIcon, PreviousIcon } from "../icons/ChessCustomIcons";
import { STEP_ICONS } from "../icons/stepIcons";

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;
const CARD_WIDTH = 340;

function findTarget(targets: string[]) {
  for (const target of targets) {
    const element = [...document.querySelectorAll<HTMLElement>(`[data-guide="${target}"]`)].find((item) => item.getClientRects().length > 0);
    if (element) return element;
  }
  return null;
}

/**
 * Interactive first-visit tour: a spotlight on each part of Chess Custom and a
 * short card. Next/Previous, Skip and Finish; arrows and Escape work too.
 */
export default function OnboardingGuide({ open, onClose }: { open: boolean; onClose: (state: GuideState) => void }) {
  useGameLanguage();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const titleId = useId();
  const bodyId = useId();
  const step = GUIDE_STEPS[index];
  const last = index === GUIDE_STEPS.length - 1;

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setIndex(0);
  }

  const measure = useCallback(() => {
    if (!open) return;
    const target = findTarget(GUIDE_STEPS[index].targets);
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    if (!target) return setRect(null);
    const box = target.getBoundingClientRect();
    setRect({ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 });
  }, [open, index]);

  // Bring the target into view, then follow it on scroll and resize.
  useLayoutEffect(() => {
    if (!open) return;
    const target = findTarget(GUIDE_STEPS[index].targets);
    const behavior = reduced ? "auto" : "smooth";
    if (target && window.innerWidth < 640) {
      // Phones: keep the target in the upper part so the docked card never covers it.
      // (The app scrolls an inner container, so scrollIntoView rather than window.scrollTo.)
      const margin = target.style.scrollMarginTop;
      target.style.scrollMarginTop = "96px";
      target.scrollIntoView({ block: "start", inline: "nearest", behavior });
      target.style.scrollMarginTop = margin;
    } else target?.scrollIntoView({ block: "center", inline: "nearest", behavior });
    let frame = requestAnimationFrame(measure);
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const settle = window.setTimeout(measure, reduced ? 0 : 400);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open, index, measure, reduced]);

  useEffect(() => {
    if (open) primary.current?.focus();
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      const action = guideKeyAction(event.key, index, GUIDE_STEPS.length);
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        if (action === "skip") onClose("dismissed");
        else if (action === "finish") onClose("completed");
        else setIndex((value) => value + (action === "next" ? 1 : -1));
        return;
      }
      // Keep keyboard focus inside the guide card.
      if (event.key === "Tab" && card.current) {
        const items = [...card.current.querySelectorAll<HTMLElement>("button")];
        const first = items[0];
        const lastItem = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          first.focus();
        } else if (!card.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, index, onClose]);

  if (!open) return null;

  // Place the card beside the spotlight; phones get a bottom sheet.
  const narrow = viewport.width < 640;
  let cardStyle: React.CSSProperties;
  if (narrow || !rect) {
    // On phones the card docks to whichever edge leaves the spotlight visible.
    const targetLow = rect ? rect.top + rect.height / 2 > viewport.height / 2 : false;
    cardStyle = narrow ? (targetLow ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: 12 }) : { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: CARD_WIDTH };
  } else {
    const below = rect.top + rect.height + 12;
    const fitsBelow = below + 230 < viewport.height;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - CARD_WIDTH / 2), viewport.width - CARD_WIDTH - 12);
    cardStyle = fitsBelow ? { top: below, left, width: CARD_WIDTH } : { top: Math.max(12, rect.top - 12 - 240), left, width: CARD_WIDTH };
  }
  const transition = reduced ? "" : "transition-all duration-300 ease-out";

  return createPortal(
    <div className="chess-custom-guide fixed inset-0 z-[300]">
      {/* Catch clicks so the page underneath is not changed mid-tour. */}
      <div className="absolute inset-0" aria-hidden="true" />
      {gameUi(rect ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-2xl ring-2 ring-amber-300/90 ${transition}`}
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: "0 0 0 9999px rgba(3,4,6,.72), 0 0 30px rgba(252,211,77,.35)" }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(3,4,6,.72)]" />
      ))}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={`absolute rounded-3xl border border-amber-300/30 bg-[#0d1014] p-5 text-zinc-100 shadow-[0_30px_80px_rgba(0,0,0,.7)] ${transition}`}
        style={cardStyle}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300/80">
              {ui("Guide")} · {gameUi(index + 1)} / {gameUi(GUIDE_STEPS.length)}
            </p>
            <h2 id={titleId} className="mt-1 font-serif text-xl text-white">
              {ui(step.title)}
            </h2>
          </div>
          <button type="button" onClick={() => onClose("dismissed")} aria-label={ui("Skip Guide")} className="-mr-1 -mt-1 rounded-xl p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-white">
            <CloseIcon size={16} />
          </button>
        </div>
        <p id={bodyId} className="mt-2 text-sm leading-6 text-zinc-300">
          {ui(step.body)}
        </p>
        {gameUi(step.showSteps && (
          <ol className="mt-3 grid grid-cols-2 gap-1.5" aria-label={ui("Create steps")}>
            {CREATE_STEPS.slice(0, 4).map(({ id, label }) => {
              const Icon = STEP_ICONS[id];
              return (
                <li key={id} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs">
                  <span className="font-mono text-[10px] text-amber-300">{gameUi(stepNumber(id))}</span>
                  <Icon size={14} className="text-zinc-400" />
                  {ui(label)}
                </li>
              );
            })}
          </ol>
        ))}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {GUIDE_STEPS.map((entry, position) => (
            <span key={entry.id} className={`h-1.5 rounded-full ${transition} ${position === index ? "w-5 bg-amber-300" : position < index ? "w-1.5 bg-amber-300/50" : "w-1.5 bg-white/15"}`} />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={() => onClose("dismissed")} className="mr-auto text-xs font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-200 hover:underline">
            {ui("Skip Guide")}
          </button>
          {gameUi(index > 0 && (
            <button type="button" onClick={() => setIndex((value) => value - 1)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-white/25">
              <PreviousIcon size={15} />
              {ui("Previous")}
            </button>
          ))}
          <button
            ref={primary}
            type="button"
            onClick={() => (last ? onClose("completed") : setIndex((value) => value + 1))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/60 bg-amber-300 px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            {gameUi(last ? ui("Finish") : ui("Next"))}
            {!last && <NextIcon size={15} />}
          </button>
        </div>
        <p className="mt-3 text-[11px] text-zinc-600">{ui("Reopen any time with Show Guide.")}</p>
      </div>
    </div>,
    document.body,
  );
}
