import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Square } from "chess.js";
import { ArrowLeft, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import ChessPreviewBoard from "@/components/App/ChessPreviewBoard";
import { ProfileAvatar } from "@/components/social/ProfileAvatarPicker";
import UserLink from "@/components/social/UserLink";

type Snapshot = {
  room: { code: string; status: string; match_kind: string | null; time_control: string | null };
  target_id: string;
  players: { user_id: string; seat: number; display_name: string | null; chosen_color: string | null; username: string | null; avatar_id: string | null }[];
  game: {
    fen: string;
    moves: unknown;
    status: string;
    winner: string | null;
    end_reason: string | null;
    last_move_from: string | null;
    last_move_to: string | null;
  } | null;
};

const POLL_MS = 2_000;

/** Read-only view of a friend's chess game, available after they accepted a spectate request. */
export default function SpectatePage() {
  useUiLanguage();
  const { requestId } = useParams();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !requestId) return;
    let active = true;
    let timer = 0;
    const poll = async () => {
      const { data, error: loadError } = await supabase.rpc("get_spectate_snapshot", { p_request_id: requestId });
      if (!active) return;
      if (loadError) setError(loadError.message);
      else { setError(null); setSnapshot(data as Snapshot); }
      timer = window.setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => { active = false; window.clearTimeout(timer); };
  }, [user, requestId]);

  const game = snapshot?.game;
  const lastMove = game?.last_move_from && game.last_move_to ? [game.last_move_from as Square, game.last_move_to as Square] as [Square, Square] : null;
  const moveCount = Array.isArray(game?.moves) ? game.moves.length : 0;
  const finished = game?.status === "finished";
  const turn = game?.fen.split(" ")[1] === "b" ? "Black" : "White";
  const seatFor = (color: "white" | "black") => snapshot?.players.find((player) => player.chosen_color === color);
  const players = snapshot ? (["black", "white"] as const).map((color) => ({ color, player: seatFor(color) })) : [];
  const unassigned = snapshot?.players.filter((player) => player.chosen_color !== "white" && player.chosen_color !== "black") ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 text-white sm:px-6">
      <Link to="/friends" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={15} />{ui("Back to friends")}</Link>
      <header className="mt-4 flex flex-wrap items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/15 text-sky-200"><Eye size={20} /></span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.25em] text-sky-300">{ui("Spectating")}</p>
          <h1 className="text-2xl font-black">{ui(snapshot?.room.match_kind === "ranked" ? "Ranked Chess" : "Classic Chess")}</h1>
        </div>
      </header>

      {!user ? <p className="mt-8 text-zinc-400">{ui("Sign in to spectate.")}</p>
        : error && !snapshot ? <p role="alert" className="mt-8 rounded-xl border border-rose-400/30 bg-rose-950/40 p-4 text-rose-200">{ui(error)}</p>
        : !snapshot ? <p className="mt-8 text-zinc-400" role="status">{ui("Loading game…")}</p>
        : <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
          <div className="w-full">
            {game ? <ChessPreviewBoard fen={game.fen} lastMove={lastMove} label={ui("Spectated chess board")} /> : <p className="text-zinc-400">{ui("The game has not started yet.")}</p>}
          </div>
          <aside className="space-y-3">
            {[...players, ...unassigned.map((player) => ({ color: null, player }))].map(({ color, player }, index) => player && (
              <div key={`${player.user_id}-${index}`} className={`flex items-center gap-3 rounded-2xl border p-3 ${player.user_id === snapshot.target_id ? "border-sky-300/40 bg-sky-400/10" : "border-white/10 bg-white/5"}`}>
                <ProfileAvatar avatarId={player.avatar_id ?? "m1"} className="h-10 w-10 rounded-full" />
                <div className="min-w-0 flex-1">
                  <UserLink userId={player.user_id} className="block truncate font-bold text-white">{player.username || player.display_name || ui("Player")}</UserLink>
                  {color && <span className="text-xs text-zinc-400">{ui(color === "white" ? "White" : "Black")}</span>}
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              {finished
                ? <p className="font-bold text-amber-200">{ui("Game over")}{game?.winner ? ` · ${ui(game.winner === "draw" ? "Draw" : game.winner === "white" ? "White wins" : "Black wins")}` : ""}</p>
                : game ? <p className="font-bold">{ui(`${turn} to move`)}</p> : null}
              <p className="mt-1 text-zinc-400">{moveCount} {ui("moves")} · {ui("Updates live")}</p>
              {error && <p className="mt-2 text-xs text-rose-300" role="alert">{ui(error)}</p>}
            </div>
          </aside>
        </div>}
    </main>
  );
}
