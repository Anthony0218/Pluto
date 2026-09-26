import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { games } from "@/data/games";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function MyGames() {
  useUiLanguage();
  const { user } = useAuth();
  return <FavoriteGames key={user?.id ?? "guest"} userId={user?.id} />;
}
function FavoriteGames({ userId }: { userId?: string }) {
  useUiLanguage();
  const [routes, setRoutes] = useState<string[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!userId) {
        try {
          const saved: unknown = JSON.parse(localStorage.getItem("pluto-favorite-games") ?? "[]");
          if (Array.isArray(saved)) setRoutes(saved.filter((route): route is string => typeof route === "string" && games.some((game) => game.route === route)).slice(0, 3));
        } catch { /* An invalid saved preference can be replaced in the editor. */ }
      } else {
        const { data, error } = await supabase.from("user_game_favorites").select("game_route").eq("user_id", userId).order("slot");
        if (!active) return;
        if (error) setError("Your games could not be loaded. Please try again.");
        else setRoutes((data ?? []).map((item) => item.game_route));
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [userId]);
  async function save() {
    setSaving(true); setError("");
    if (userId) {
      const { error } = await supabase.rpc("set_favorite_games", { p_routes: draft });
      if (error) { setError("Your games could not be saved. Please try again."); setSaving(false); return; }
    } else {
      try { localStorage.setItem("pluto-favorite-games", JSON.stringify(draft)); }
      catch { setError("Your browser could not save this selection."); setSaving(false); return; }
    }
    setRoutes(draft); setEditing(false); setSaving(false);
  }
  return <section className="my-6 rounded-2xl border border-white/[0.08] bg-[#080d1c]/85 p-5">
    <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{ui("My games")}</h2><button type="button" disabled={loading || saving} onClick={() => { setDraft(routes); setEditing(!editing); }} className="rounded-lg px-3 py-2 text-sm text-indigo-300 hover:bg-white/5">{editing ? ui("Cancel") : ui("Edit")}</button></div>
    <p className="mt-1 text-sm text-zinc-400">{ui("Choose up to three games for quick access.")}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{ui(error)}</p>}
    {loading ? <p className="mt-4 text-sm text-zinc-400">Loading...</p> : editing ? <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{games.map((game) => <label key={game.route} className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><input type="checkbox" checked={draft.includes(game.route)} disabled={saving || (draft.length === 3 && !draft.includes(game.route))} onChange={(event) => setDraft(event.target.checked ? [...draft, game.route] : draft.filter((route) => route !== game.route))} /><span>{game.title}</span></label>)}</div>
      <button type="button" disabled={saving} onClick={() => void save()} className="mt-4 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving ? "Saving..." : "Save"} ({draft.length}/3)</button>
    </> : <div className="mt-4 grid gap-3 sm:grid-cols-3">{routes.map((route) => { const game = games.find((item) => item.route === route); return game ? <Link key={route} to={route} className="group overflow-hidden rounded-xl border border-white/10 bg-white/5"><img src={game.image} alt="" className="h-24 w-full object-cover transition group-hover:brightness-110" /><div className="p-3 font-semibold">{game.title}</div></Link> : null; })}{!routes.length && <p className="text-sm text-zinc-400 sm:col-span-3">Select Edit to add your favorite games.</p>}</div>}
  </section>;
}
