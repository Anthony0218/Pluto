import { gameUi } from "../../../i18n/gameUi.ts";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { ReactNode } from "react";

export type ChessMatchStatusEvent =
  | "turn"
  | "check"
  | "castle"
  | "capture"
  | "promotion"
  | "checkmate"
  | "draw"
  | "variant"
  | "info";

export type ChessMatchEffectTone =
  | "amber"
  | "blue"
  | "emerald"
  | "violet"
  | "red"
  | "zinc";

export type ChessMatchEffect = {
  id?: string;
  label: string;
  value?: ReactNode;
  icon?: ReactNode;
  tone?: ChessMatchEffectTone;
};

type ChessMatchStatusProps = {
  message: ReactNode;
  detail?: ReactNode;
  event?: ChessMatchStatusEvent;
  effects?: ChessMatchEffect[];
  actions?: ReactNode;
  label?: string;
  className?: string;
};

const eventStyles: Record<
  ChessMatchStatusEvent,
  { icon: ReactNode; border: string; iconBox: string; label: string }
> = {
  turn: {
    icon: "●",
    border: "border-amber-400/15",
    iconBox: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    label: "text-amber-300",
  },
  check: {
    icon: "!",
    border: "border-red-400/25",
    iconBox: "border-red-400/25 bg-red-400/10 text-red-300",
    label: "text-red-300",
  },
  castle: {
    icon: "♜",
    border: "border-sky-400/20",
    iconBox: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    label: "text-sky-300",
  },
  capture: {
    icon: "×",
    border: "border-orange-400/20",
    iconBox: "border-orange-400/25 bg-orange-400/10 text-orange-300",
    label: "text-orange-300",
  },
  promotion: {
    icon: "♛",
    border: "border-violet-400/20",
    iconBox: "border-violet-400/25 bg-violet-400/10 text-violet-300",
    label: "text-violet-300",
  },
  checkmate: {
    icon: "♚",
    border: "border-amber-300/30",
    iconBox: "border-amber-300/30 bg-amber-300/10 text-amber-200",
    label: "text-amber-200",
  },
  draw: {
    icon: "½",
    border: "border-zinc-400/20",
    iconBox: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300",
    label: "text-zinc-300",
  },
  variant: {
    icon: "✦",
    border: "border-violet-400/25",
    iconBox: "border-violet-400/25 bg-violet-400/10 text-violet-300",
    label: "text-violet-300",
  },
  info: {
    icon: "i",
    border: "border-white/10",
    iconBox: "border-white/10 bg-white/[0.05] text-zinc-300",
    label: "text-zinc-400",
  },
};

const effectStyles: Record<ChessMatchEffectTone, string> = {
  amber: "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
  blue: "border-sky-400/20 bg-sky-400/[0.08] text-sky-200",
  emerald: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200",
  violet: "border-violet-400/20 bg-violet-400/[0.08] text-violet-200",
  red: "border-red-400/20 bg-red-400/[0.08] text-red-200",
  zinc: "border-white/10 bg-white/[0.04] text-zinc-300",
};

export default function ChessMatchStatus({
  message,
  detail,
  event = "info",
  effects = [],
  actions,
  label = "Match event",
  className = "",
}: ChessMatchStatusProps) {
  useUiLanguage();
  const style = eventStyles[event];

  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className={`
        mt-2
        flex
        min-h-[54px]
        w-full
        flex-col
        gap-3
        rounded-2xl
        border
        bg-[linear-gradient(135deg,rgba(10,17,26,.94),rgba(5,9,15,.92))]
        px-3.5
        py-2.5
        shadow-lg
        shadow-black/20
        backdrop-blur-xl
        sm:flex-row
        sm:items-center
        sm:justify-between
        ${style.border}
        ${className}
      `}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-xl
            border
            text-sm
            font-black
            shadow-inner
            ${style.iconBox}
          `}
        >
          {gameUi(style.icon)}
        </div>

        <div className="min-w-0">
          {gameUi(label && (
            <p
              className={`
                text-[9px]
                font-black
                uppercase
                tracking-[0.2em]
                ${style.label}
              `}
            >
              {ui(label)}
            </p>
          ))}

          <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="min-w-0 text-sm font-semibold text-[#f5e8cf]">
              {gameUi(message)}
            </p>

            {detail && <p className="text-[11px] text-zinc-500">{gameUi(detail)}</p>}
          </div>
        </div>
      </div>

      {gameUi((effects.length > 0 || actions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {gameUi(effects.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
              {effects.map((effect, index) => {
                const tone = effect.tone ?? "zinc";

                return (
                  <span
                    key={effect.id ?? `${effect.label}-${index}`}
                    className={`
                      inline-flex
                      items-center
                      gap-1.5
                      rounded-lg
                      border
                      px-2.5
                      py-1.5
                      text-[10px]
                      font-bold
                      ${effectStyles[tone]}
                    `}
                  >
                    {gameUi(effect.icon && (
                      <span aria-hidden="true">{gameUi(effect.icon)}</span>
                    ))}
                    <span>{ui(effect.label)}</span>
                    {gameUi(effect.value !== undefined && (
                      <span className="font-black text-current">
                        {gameUi(effect.value)}
                      </span>
                    ))}
                  </span>
                );
              })}
            </div>
          ))}

          {gameUi(actions && (
            <div className="flex flex-wrap items-center gap-1.5">{gameUi(actions)}</div>
          ))}
        </div>
      ))}
    </section>
  );
}
