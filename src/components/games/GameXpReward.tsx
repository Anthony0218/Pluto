import { Sparkles } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useContext } from "react";
import { AuthContext } from "@/context/authState";

/** Always show the actual reward, including zero for practice and guest games. */
export default function GameXpReward({ amount = 0, reason, pending = false, onRetry }: {
  amount?: number;
  reason?: string;
  pending?: boolean;
  onRetry?: () => void;
}) {
  useUiLanguage();
  const user = useContext(AuthContext)?.user;
  const earned = user ? amount : 0;
  return <section aria-label={ui("XP gained")} role="status" className="my-3 flex w-full items-center gap-3 rounded-2xl border border-indigo-400/25 bg-indigo-950/80 px-4 py-3 text-left text-indigo-50">
    <Sparkles size={22} className="shrink-0 text-indigo-300" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="text-xs font-bold text-indigo-200">{ui("XP gained")}</p>
      <p className="mt-1 text-xs leading-5 text-indigo-200/80">{ui(!user ? "Sign in to earn XP." : pending ? "Saving XP…" : reason ?? (earned ? "Added to your activity level." : "This game mode does not award profile XP."))}</p>
      {onRetry && user && <button type="button" onClick={onRetry} className="mt-1 text-xs font-bold underline">{ui("Retry saving XP")}</button>}
    </div>
    <strong className="shrink-0 text-xl font-black tabular-nums">{pending ? "…" : `+${earned}`} XP</strong>
  </section>;
}
