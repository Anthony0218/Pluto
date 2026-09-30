import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { defaultFavoriteRoutes, normalizeFavorites } from "@/data/dashboard";

function readFavorites(key: string) {
  try { return normalizeFavorites(JSON.parse(localStorage.getItem(key) ?? "null")); }
  catch { return null; }
}
/** Server preferences are authoritative; the cache also preserves intentional empty selections. */
export function useFavoriteGames(userId?: string) {
  const key = userId ? `pluto-favorite-games-${userId}` : "pluto-favorite-games";
  const [routes, setRoutes] = useState(() => readFavorites(key) ?? defaultFavoriteRoutes);
  const [loading, setLoading] = useState(!!userId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function load() {
      try {
        const result = await supabase.rpc("get_favorite_games");
        if (!active) return;
        if (result.error) {
          const legacy = await supabase.from("user_game_favorites").select("game_route").eq("user_id", userId).order("slot");
          if (!active) return;
          if (legacy.error) throw legacy.error;
          setRoutes(legacy.data?.length ? normalizeFavorites(legacy.data.map(item => item.game_route)) ?? defaultFavoriteRoutes : readFavorites(key) ?? defaultFavoriteRoutes);
        } else {
          const saved = normalizeFavorites(result.data) ?? defaultFavoriteRoutes;
          setRoutes(saved);
          try { localStorage.setItem(key, JSON.stringify(saved)); } catch { /* Server remains authoritative. */ }
        }
      } catch { if (active) setError("Your games could not be loaded. Please try again."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [userId, key]);
  async function save(draft: string[]) {
    setSaving(true); setError("");
    try {
      const selection = normalizeFavorites(draft) ?? [];
      if (userId) {
        const { error } = await supabase.rpc("set_favorite_games", { p_routes: selection });
        if (error) throw error;
      }
      try { localStorage.setItem(key, JSON.stringify(selection)); }
      catch { if (!userId) throw new Error("storage"); }
      setRoutes(selection);
      return true;
    } catch (cause) {
      console.error("Saving favorite games failed", cause);
      setError(userId ? "Your games could not be saved. Please try again." : "Your browser could not save this selection.");
      return false;
    } finally { setSaving(false); }
  }
  return { routes, loading, saving, error, save };
}
