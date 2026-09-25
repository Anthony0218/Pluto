import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { games } from "../../data/games";
import { supabase } from "../../lib/supabase";

export default function AccountActivity() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const userId = user?.id;
  const game = [...games]
    .sort((a, b) => b.route.length - a.route.length)
    .find(
      (item) =>
        pathname === item.route || pathname.startsWith(`${item.route}/`),
    );

  useEffect(() => {
    if (!userId) return;
    const heartbeat = () => {
      if (document.visibilityState === "visible")
        void supabase.rpc("dashboard_heartbeat").then(() => {});
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [userId]);

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
  return null;
}
