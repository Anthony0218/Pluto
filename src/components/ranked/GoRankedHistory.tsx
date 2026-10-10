import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { goTimeControlLabel, isGoTimeControl } from "@/games/go/ranked/config";
import { supabase } from "@/lib/supabase";
type Result = { source_id: string; outcome: string; completed_at: string; details: { code: string; time_control: string; black_id: string; white_id: string; black_name: string; white_name: string; review_available: boolean; result: string; reason: string; board_size: number; komi: number; rating_before: number; rating_after: number } };
export default function GoRankedHistory({ userId }: { userId: string }) {
  useGameLanguage();
  const [history, setHistory] = useState<{ userId: string; rows: Result[]; error: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const result = await supabase.from("user_game_results").select("source_id,outcome,completed_at,details").eq("user_id", userId).eq("game", "go").contains("details", { ranked: true }).order("completed_at", { ascending: false }).limit(20);
      if (alive) setHistory({ userId, rows: (result.data ?? []) as Result[], error: result.error?.message ?? null });
    };
    void load(); window.addEventListener("go-ranked-settled", load);
    return () => { alive = false; window.removeEventListener("go-ranked-settled", load); };
  }, [userId]);
  if (history?.userId !== userId) return null;
  return <section className="mt-5 rounded-[26px] border border-white/10 bg-white/[.035] p-5 text-white"><h2 className="font-serif text-2xl">{gameUi("Go · Game history")}</h2>{history.error ? <p role="alert" className="mt-3 text-red-300">{gameUi(history.error)}</p> : !history.rows.length ? <p className="mt-3 text-sm text-zinc-400">{gameUi("No ranked Go games yet.")}</p> : <div className="mt-4 grid gap-3">{history.rows.map(row => {
    const d = row.details, delta = d.rating_after - d.rating_before;
    return <article key={row.source_id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap justify-between gap-3"><p className="text-xs font-bold uppercase text-amber-200">{gameUi("● Go · Ranked ")}{gameUi(isGoTimeControl(d.time_control) ? goTimeControlLabel(d.time_control) : d.time_control)}</p><time className="text-xs text-zinc-500" dateTime={row.completed_at}>{gameUi(new Date(row.completed_at).toLocaleString())}</time></div><p className="mt-2 capitalize">{gameUi(row.outcome)} · {gameUi(d.reason)}</p><p className="mt-1 text-sm text-zinc-400">{gameUi(d.board_size)} × {gameUi(d.board_size)}{gameUi(" · Komi ")}{gameUi(d.komi)}{gameUi(" · You played ")}{gameUi(d.black_id === userId ? "Black" : "White")}</p><p className="mt-2 text-sm font-bold text-amber-200">{gameUi(d.rating_before)} → {gameUi(d.rating_after)} ({gameUi(delta >= 0 ? "+" : "")}{gameUi(delta)})</p><div className="mt-3 flex flex-wrap gap-4 text-xs"><Link className="text-zinc-400 hover:text-white" to={`/profile/${d.black_id}`}>{gameUi("Black · ")}{gameUi(d.black_name)}</Link><Link className="text-zinc-400 hover:text-white" to={`/profile/${d.white_id}`}>{gameUi("White · ")}{gameUi(d.white_name)}</Link>{d.review_available ? <Link className="font-bold text-amber-300" to={`/games/go/ranked/${d.code}/game?review=1`}>{gameUi("Game Review →")}</Link> : <Link className="font-bold text-amber-300" to={`/games/go/ranked/${d.code}/game`}>{gameUi("View result →")}</Link>}</div></article>;
  })}</div>}</section>;
}
