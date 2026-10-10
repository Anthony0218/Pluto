import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

/** One reward per game, even after undoing or opening its review. */
export function useClassicChessXp({ finished, eligible, mode }: {
  finished: boolean;
  eligible: boolean;
  mode: "singleplayer" | "hotseat";
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const [session, setSession] = useState<{ id: string; coachUsed: boolean }>(() => ({ id: crypto.randomUUID(), coachUsed: false }));
  const [saved, setSaved] = useState<{ id: string; userId: string; amount: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  function markCoachUsed() {
    if (!finished) setSession(current => current.coachUsed ? current : { ...current, coachUsed: true });
  }

  function reset(coachEnabled: boolean, sourceId?: string) {
    setSession({ id: sourceId ?? crypto.randomUUID(), coachUsed: coachEnabled });
    setSaved(null);
    setFailed(false);
  }

  useEffect(() => {
    if (!finished || !eligible || !userId) return;
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("claim_local_chess_xp", {
          p_session_id: session.id, p_mode: mode, p_coach_used: session.coachUsed,
        });
        if (error || typeof data !== "number") throw error ?? new Error("Missing XP reward");
        if (active) {
          setSaved({ id: session.id, userId, amount: data });
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => { active = false; };
  }, [finished, eligible, userId, session.id, session.coachUsed, mode, attempt]);

  const amount = saved?.id === session.id && saved.userId === user?.id ? saved.amount : 0;
  return {
    markCoachUsed, reset, sessionId: session.id, coachUsed: session.coachUsed,
    reward: {
      amount,
      pending: !!user && eligible && finished && !amount && !failed,
      reason: failed ? "XP could not be saved. Try again." : !eligible ? "Practice game · no profile XP." : session.coachUsed || amount === 50 ? "Chess Coach used · 50% XP." : undefined,
      onRetry: failed ? () => { setFailed(false); setAttempt(current => current + 1); } : undefined,
    },
  };
}
