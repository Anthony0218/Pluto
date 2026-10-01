import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import type { VariantCard } from "@/data/chessVariants";
import { ui, useUiLanguage } from "@/i18n/ui";
import CustomVariantArtwork from "./CustomVariantArtwork";

import { accentClasses, accentGlow, accentShadow } from "./variantCardStyles";

type VariantArtworkSpec = {
  main: string;
  left: string;
  right: string;
  footer: string;
};

const variantArtwork: Record<string, VariantArtworkSpec> = {
  "complete-chaos": {
    main: "♛",
    left: "✦ ♟",
    right: "♜ ✦",
    footer: "PURE CHAOS",
  },
  draft: { main: "⚔", left: "♜ ♞", right: "♝ ♛", footer: "BUILD YOUR ARMY" },
  mirror: { main: "◈", left: "♔", right: "♚", footer: "PERFECT SYMMETRY" },
  "fog-of-war": {
    main: "♚",
    left: "░▒",
    right: "▓░",
    footer: "HIDDEN INFORMATION",
  },
  tectonic: {
    main: "↻",
    left: "A │ B",
    right: "C │ D",
    footer: "ROTATE THE BOARD",
  },
  roulette: {
    main: "🎰",
    left: "? 🎴",
    right: "🌀 ✦",
    footer: "LUCKY SQUARES",
  },
  "four-player": {
    main: "✣",
    left: "♜  ♞",
    right: "♝  ♛",
    footer: "FOUR ARMIES",
  },
  hotpotato: { main: "💣", left: "♟", right: "4…12", footer: "PASS THE BOMB" },
  collapse: {
    main: "⚠",
    left: "▦",
    right: "▣",
    footer: "SURVIVE THE COLLAPSE",
  },
  mutation: { main: "♞", left: "♙ → ♘", right: "→ ♕", footer: "MUTATE" },
  boss: { main: "♚", left: "♥♥♥", right: "⚡🔥", footer: "BOSS POWERS" },
  capitalism: {
    main: "♛",
    left: "◉ ◉",
    right: "♜ + ◉",
    footer: "CAPTURE · EARN · SPEND",
  },
  "3d-chess": { main: "♜", left: "▦", right: "▦", footer: "MULTIPLE LAYERS" },
  "king-of-the-hill": {
    main: "♔",
    left: "△",
    right: "△",
    footer: "CONTROL THE CENTER",
  },
  randomstart: {
    main: "?",
    left: "♜♝♞",
    right: "♛♚♜",
    footer: "RANDOM BACK RANK",
  },
  "three-lives": { main: "♥", left: "♔", right: "♥ ♥", footer: "THREE LIVES" },
  horror: {
    main: "☠",
    left: "♞ ❄",
    right: "♟ 🔥",
    footer: "CURSE · INFECT · SURVIVE",
  },
};

export function VariantArtwork({
  variant,
  compact = false,
}: {
  variant: VariantCard;
  compact?: boolean;
}) {
  useUiLanguage();
  const art = variantArtwork[variant.id] ?? {
    main: variant.icon,
    left: "♜",
    right: "♞",
    footer: "CHESS VARIANT",
  };

  if (variant.customId) return <CustomVariantArtwork variant={variant} compact={compact} />;

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${accentGlow[variant.accent]} ${
        compact ? "h-full min-h-[126px]" : "h-full min-h-[300px]"
      }`}
    >
      <div className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.45)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/75 to-transparent" />
      <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/[0.035] blur-3xl" />
      <span
        className={`absolute left-4 top-4 font-black tracking-widest opacity-45 ${compact ? "text-[10px]" : "text-sm"}`}
      >
        {art.left}
      </span>
      <span
        className={`absolute right-4 top-4 font-black tracking-widest opacity-45 ${compact ? "text-[10px]" : "text-sm"}`}
      >
        {art.right}
      </span>
      <span
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[52%] select-none leading-none drop-shadow-[0_18px_28px_rgba(0,0,0,.65)] transition duration-500 group-hover:scale-105 ${
          compact ? "text-[74px]" : "text-[145px]"
        }`}
      >
        {art.main}
      </span>
      <span
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap font-black uppercase tracking-[0.22em] opacity-45 ${compact ? "text-[7px]" : "text-[9px]"}`}
      >
        {ui(art.footer)}
      </span>
    </div>
  );
}

export function VariantDesignCard({
  variant,
  translate = ui,
  actions,
  badge,
  showConfigure = true,
  number,
}: {
  variant: VariantCard;
  translate?: (key: string) => string;
  actions: ReactNode;
  badge?: ReactNode;
  showConfigure?: boolean;
  number: number;
}) {
  useUiLanguage();
  return (
    <article
      className={`group relative w-full overflow-hidden rounded-[13px] border bg-black/50 transition duration-300 hover:-translate-y-0.5 ${accentClasses[variant.accent]} ${accentShadow[variant.accent]}`}
    >
      <div className="grid min-h-[180px] grid-cols-[34%_minmax(0,1fr)]">
        <div className="relative overflow-hidden border-r border-white/[0.08]">
          <VariantArtwork variant={variant} compact />
        </div>

        <div className="relative flex min-w-0 flex-col p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-zinc-600">
                {String(number).padStart(2, "0")} ·{" "}
                {translate(variant.subtitle)}
              </p>
              <h3 className="mt-1.5 font-serif text-[20px] leading-tight text-white">
                {translate(variant.title)}
              </h3>
            </div>

            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-wider ${
                variant.available
                  ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300"
                  : "border-amber-400/30 bg-amber-400/[0.08] text-amber-300"
              }`}
            >
              {badge ?? translate(variant.customId ? "Configurable" : variant.available ? "Available" : "Coming soon")}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 font-serif text-[12px] leading-[1.45rem] text-zinc-400">
            {translate(variant.description)}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {variant.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={`rounded-full border px-2 py-0.5 text-[8px] font-semibold ${accentClasses[variant.accent]}`}
              >
                {translate(tag)}
              </span>
            ))}
            {showConfigure && variant.configureRoute && <Link to={variant.configureRoute} className="ml-auto text-[9px] font-semibold text-zinc-300 underline underline-offset-2">{translate("Customize")}</Link>}
            {variant.rulesRoute && <Link to={variant.rulesRoute} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[.05] px-2 py-1 text-[9px] font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"><BookOpen size={12} />{translate("Rules")}</Link>}
          </div>

          <div className="mt-auto pt-3">
            {actions}
          </div>
        </div>
      </div>
    </article>
  );
}

