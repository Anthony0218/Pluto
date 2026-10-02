import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { createCloudCardGameRepository, localCardGameRepository, type CardGameRepository } from "./repository";

/** Signed-in creators save to their account; everyone else saves in this browser. */
export function useCardGameRepository(): { repository: CardGameRepository; local: CardGameRepository; signedIn: boolean } {
  const { user } = useAuth();
  const userId = user?.id;
  const repository = useMemo(() => (userId ? createCloudCardGameRepository(supabase, userId) : localCardGameRepository), [userId]);
  return { repository, local: localCardGameRepository, signedIn: Boolean(userId) };
}
