import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { Crown, Gem, Medal, Shield, Sparkles, Star, Trophy } from "lucide-react";
import type { RankFamily } from "@/games/chess/ranked/tiers";

const styles = {
  Bronze: { Icon: Shield, className: "border-amber-800/70 from-amber-950 to-orange-800 text-amber-300" },
  Silver: { Icon: Medal, className: "border-slate-300/60 from-slate-800 to-slate-500 text-slate-100" },
  Gold: { Icon: Crown, className: "border-yellow-300/70 from-amber-900 to-yellow-600 text-yellow-100" },
  Platinum: { Icon: Star, className: "border-cyan-200/70 from-teal-900 to-cyan-500 text-cyan-100" },
  Diamond: { Icon: Gem, className: "border-blue-200/70 from-blue-900 to-sky-500 text-sky-100" },
  Master: { Icon: Trophy, className: "border-fuchsia-300/70 from-purple-900 to-fuchsia-600 text-fuchsia-100" },
  Grandmaster: { Icon: Sparkles, className: "border-rose-200/80 from-rose-950 to-amber-500 text-rose-100" },
} satisfies Record<RankFamily, { Icon: typeof Shield; className: string }>;

export default function RankEmblem({ family, size = "md" }: { family: RankFamily; size?: "sm" | "md" | "lg" }) {
  useGameLanguage();
  const { Icon, className } = styles[family];
  return <span role="img" aria-label={gameUi(`${family} rank emblem`)} className={`inline-grid shrink-0 place-items-center rounded-2xl border bg-gradient-to-br shadow-[inset_0_1px_rgba(255,255,255,.35),0_10px_24px_rgba(0,0,0,.35)] ${className} ${size === "lg" ? "h-20 w-20" : size === "sm" ? "h-9 w-9 rounded-xl" : "h-14 w-14"}`}><Icon size={size === "lg" ? 42 : size === "sm" ? 18 : 28} strokeWidth={1.7} aria-hidden="true" /></span>;
}
