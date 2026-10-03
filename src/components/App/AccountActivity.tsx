import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { games } from "../../data/games";
import { supabase } from "../../lib/supabase";
import { activityForPath } from "../social/activity";

export default function AccountActivity() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const userId = user?.id;
  const game = [...games]
    .sort((a, b) => b.route.length - a.route.length)
    .find(
      (item) =>
        pathname === item.route || pathname.startsWith(`${item.route}/`),
    );

  const activity = activityForPath(pathname);
  const activityGame = activity?.game ?? null;
  const activityMode = activity?.mode ?? null;

  useEffect(() => {
    if (!userId) return;
    // Friends see the game and mode; the route stays server-side so an
    // accepted spectate request can find the room.
    const heartbeat = () => {
      if (document.visibilityState !== "visible") return;
      void supabase
        .rpc("update_presence", { p_game: activityGame, p_mode: activityMode, p_route: pathname })
        .then(({ error }) => {
          // Databases without the social migration still track online status.
          if (error) void supabase.rpc("dashboard_heartbeat").then(() => {});
        });
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [userId, activityGame, activityMode, pathname]);

  useEffect(() => {
    if (!userId || !game) return;
    const visit = () => {
      if (document.visibilityState === "visible")
        void supabase
          .rpc("record_dashboard_visit", { p_game_route: game.route })
          .then(() => {});
    };
    visit();
    // Also records activity across UTC midnight during a long session.
    const timer = window.setInterval(visit, 60_000);
    return () => window.clearInterval(timer);
  }, [userId, game]);
  const resourceRoute = pathname === "/games/schafkopf" && new URLSearchParams(search).get("rules") === "open"
    ? "/games/schafkopf?rules=open#rules"
    : pathname === "/games/chess/rules" && new URLSearchParams(search).get("tab") === "puzzles"
      ? null
      : ["/games/chess/rules", "/games/watten/rules", "/games/go/rules", "/games/chess/variants"].includes(pathname) ? pathname : null;
  useEffect(() => {
    if (!userId || !resourceRoute) return;
    const visit = () => {
      if (document.visibilityState === "visible") void supabase.rpc("record_dashboard_resource_visit", { p_route: resourceRoute }).then(() => {});
    };
    visit();
    const timer = window.setInterval(visit, 60_000);
    document.addEventListener("visibilitychange", visit);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visit); };
  }, [userId, resourceRoute]);
  return null;
}
