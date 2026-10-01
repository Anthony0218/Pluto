import type { VariantCard } from "@/data/chessVariants";

export const accentClasses: Record<VariantCard["accent"], string> = {
  red: "border-red-400/45 bg-red-400/[0.055] text-red-300",
  violet: "border-violet-400/45 bg-violet-400/[0.055] text-violet-300",
  amber: "border-amber-400/45 bg-amber-400/[0.055] text-amber-300",
  rose: "border-rose-400/45 bg-rose-400/[0.055] text-rose-300",
  sky: "border-sky-400/45 bg-sky-400/[0.055] text-sky-300",
  emerald: "border-emerald-400/45 bg-emerald-400/[0.055] text-emerald-300",
  zinc: "border-zinc-400/30 bg-zinc-400/[0.045] text-zinc-300",
  orange: "border-orange-400/45 bg-orange-400/[0.055] text-orange-300",
  cyan: "border-cyan-400/45 bg-cyan-400/[0.055] text-cyan-300",
  fuchsia: "border-fuchsia-400/45 bg-fuchsia-400/[0.055] text-fuchsia-300",
  indigo: "border-indigo-400/45 bg-indigo-400/[0.055] text-indigo-300",
  lime: "border-lime-400/45 bg-lime-400/[0.055] text-lime-300",
  pink: "border-pink-400/45 bg-pink-400/[0.055] text-pink-300",
  teal: "border-teal-400/45 bg-teal-400/[0.055] text-teal-300",
  blue: "border-blue-400/45 bg-blue-400/[0.055] text-blue-300",
};

export const accentGlow: Record<VariantCard["accent"], string> = {
  red: "from-red-500/35 via-red-950/15 to-transparent",
  violet: "from-violet-500/38 via-violet-950/16 to-transparent",
  amber: "from-amber-500/38 via-amber-950/16 to-transparent",
  rose: "from-rose-500/36 via-rose-950/16 to-transparent",
  sky: "from-sky-500/38 via-sky-950/16 to-transparent",
  emerald: "from-emerald-500/38 via-emerald-950/16 to-transparent",
  zinc: "from-zinc-300/20 via-zinc-900/18 to-transparent",
  orange: "from-orange-500/38 via-orange-950/16 to-transparent",
  cyan: "from-cyan-500/38 via-cyan-950/16 to-transparent",
  fuchsia: "from-fuchsia-500/38 via-fuchsia-950/16 to-transparent",
  indigo: "from-indigo-500/38 via-indigo-950/16 to-transparent",
  lime: "from-lime-500/34 via-lime-950/14 to-transparent",
  pink: "from-pink-500/38 via-pink-950/16 to-transparent",
  teal: "from-teal-500/38 via-teal-950/16 to-transparent",
  blue: "from-blue-500/38 via-blue-950/16 to-transparent",
};

export const accentShadow: Record<VariantCard["accent"], string> = {
  red: "shadow-[0_0_30px_rgba(248,113,113,.08)] hover:shadow-[0_0_36px_rgba(248,113,113,.14)]",
  violet:
    "shadow-[0_0_30px_rgba(167,139,250,.08)] hover:shadow-[0_0_36px_rgba(167,139,250,.14)]",
  amber:
    "shadow-[0_0_30px_rgba(251,191,36,.08)] hover:shadow-[0_0_36px_rgba(251,191,36,.14)]",
  rose: "shadow-[0_0_30px_rgba(251,113,133,.08)] hover:shadow-[0_0_36px_rgba(251,113,133,.14)]",
  sky: "shadow-[0_0_30px_rgba(56,189,248,.08)] hover:shadow-[0_0_36px_rgba(56,189,248,.14)]",
  emerald:
    "shadow-[0_0_30px_rgba(52,211,153,.08)] hover:shadow-[0_0_36px_rgba(52,211,153,.14)]",
  zinc: "shadow-[0_0_30px_rgba(212,212,216,.05)] hover:shadow-[0_0_36px_rgba(212,212,216,.09)]",
  orange:
    "shadow-[0_0_30px_rgba(251,146,60,.08)] hover:shadow-[0_0_36px_rgba(251,146,60,.14)]",
  cyan: "shadow-[0_0_30px_rgba(34,211,238,.08)] hover:shadow-[0_0_36px_rgba(34,211,238,.14)]",
  fuchsia:
    "shadow-[0_0_30px_rgba(232,121,249,.08)] hover:shadow-[0_0_36px_rgba(232,121,249,.14)]",
  indigo:
    "shadow-[0_0_30px_rgba(129,140,248,.08)] hover:shadow-[0_0_36px_rgba(129,140,248,.14)]",
  lime: "shadow-[0_0_30px_rgba(163,230,53,.08)] hover:shadow-[0_0_36px_rgba(163,230,53,.14)]",
  pink: "shadow-[0_0_30px_rgba(244,114,182,.08)] hover:shadow-[0_0_36px_rgba(244,114,182,.14)]",
  teal: "shadow-[0_0_30px_rgba(45,212,191,.08)] hover:shadow-[0_0_36px_rgba(45,212,191,.14)]",
  blue: "shadow-[0_0_30px_rgba(96,165,250,.08)] hover:shadow-[0_0_36px_rgba(96,165,250,.14)]",
};

