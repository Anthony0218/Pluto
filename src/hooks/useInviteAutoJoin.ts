import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

/**
 * Runs a lobby's own join routine once when the page was opened from an
 * accepted invite (`?code=XXXXXX&join=1`). The lobby still prefills the code
 * itself, so a failed join leaves the user on the lobby with the error shown.
 */
export function useInviteAutoJoin(join: () => unknown) {
  const { user, loading } = useAuth();
  const latestJoin = useRef(join);
  const started = useRef(false);
  useEffect(() => { latestJoin.current = join; });
  useEffect(() => {
    if (!user || loading || started.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("join") !== "1" || !params.get("code")) return;
    started.current = true;
    params.delete("join");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    void latestJoin.current();
  }, [user, loading]);
}
