import GoRankedLeaderboard from "@/components/ranked/GoRankedLeaderboard";
import { GO_RANKED_DEFAULT_MODE, goTimeControls, isGoTimeControl } from "@/games/go/ranked/config";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { ui, useUiLanguage } from "@/i18n/ui";
import LeaderboardTable, { type LeaderboardRow } from "@/components/social/LeaderboardTable";
import { isTimeControl, timeControlLabel, timeControls, type TimeControl } from "@/games/chess/ranked/timeControls";

type EloRow = { rank: number; user_id: string; username: string; avatar_id: string | null; rating: number; rated_games: number };
type WinsRow = { rank: number; user_id: string; username: string; avatar_id: string | null; wins: number; games: number };

const games = [
  { id: "chess", label: "Chess" },
  { id: "schafkopf", label: "Schafkopfen" },
  { id: "watten", label: "Watten" },
  { id: "atlas", label: "Atlas Arena" },
  { id: "go", label: "Go" },
  { id: "shogi", label: "Shogi" },
  { id: "eat-it", label: "Eat It" },
] as const;
type GameId = typeof games[number]["id"];
type Board = { rows: LeaderboardRow[]; error: string | null };
type ChessBoard = TimeControl | "puzzles";
/** Chess has one Elo board per ranked time control. */
type BoardKey = Exclude<GameId, "chess"> | `chess:${TimeControl}`;

const tabClass = (selected: boolean) => `shrink-0 rounded-xl border px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-amber-300 ${selected ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/20 text-slate-300 hover:text-white"}`;

async function loadBoard(key: BoardKey): Promise<Board> {
  if (key.startsWith("chess:")) {
    const { data, error } = await supabase.rpc("get_chess_elo_leaderboard", { p_time_control: key.slice(6) });
    return { rows: ((data ?? []) as EloRow[]).map(row => ({ rank: row.rank, user_id: row.user_id, username: row.username, avatar_id: row.avatar_id, value: row.rating })), error: error?.message ?? null };
  }
  const { data, error } = await supabase.rpc("get_game_wins_leaderboard", { p_game: key });
  return {
    rows: ((data ?? []) as WinsRow[]).map(row => ({ rank: row.rank, user_id: row.user_id, username: row.username, avatar_id: row.avatar_id, value: row.wins, detail: `${row.games} ${ui("multiplayer games")}` })),
    error: error ? ui("This leaderboard is not available yet.") : null,
  };
}

export default function LeaderboardsPage() {
  useUiLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("game");
  const game: GameId = games.find(item => item.id === requested)?.id ?? "chess";
  const requestedMode = searchParams.get("mode");
  const chessBoard: ChessBoard = requestedMode === "puzzles" ? "puzzles" : isTimeControl(requestedMode) ? requestedMode : "rapid";
  const goMode = isGoTimeControl(requestedMode) ? requestedMode : GO_RANKED_DEFAULT_MODE;
  const boardKey: BoardKey | null = game === "go" ? null : game !== "chess" ? game : chessBoard === "puzzles" ? null : `chess:${chessBoard}`;
  const [boards, setBoards] = useState<Partial<Record<BoardKey, Board>>>({});
  const board = boardKey ? boards[boardKey] : undefined;

  useEffect(() => {
    if (!user || !boardKey || boards[boardKey]) return;
    let alive = true;
    void loadBoard(boardKey).then(result => { if (alive) setBoards(current => ({ ...current, [boardKey]: result })); });
    return () => { alive = false; };
  }, [user, boardKey, boards]);

  function selectChessBoard(next: ChessBoard) {
    setSearchParams(next === "rapid" ? {} : { mode: next }, { replace: true });
  }

  function selectGame(next: GameId, focus = false) {
    setSearchParams(next === "chess" ? {} : { game: next }, { replace: true });
    if (focus) document.getElementById(`leaderboard-game-${next}`)?.focus();
  }
  const gameLabel = games.find(item => item.id === game)!.label;

  return <main className="mx-auto max-w-4xl px-4 py-10 text-white sm:px-6">
    <header className="rounded-[28px] border-2 border-indigo-300/25 bg-[#101b34] p-7 shadow-[7px_7px_0_#090f20]"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.25em] text-amber-300"><Trophy size={17} /> {ui("Competition")}</p><h1 className="mt-2 text-4xl font-black">{ui("Leaderboards")}</h1><p className="mt-2 text-slate-400">{ui("The top 10 players in every game. Only verified results count.")}</p></header>
    <section className="mt-7 rounded-[28px] border-2 border-indigo-300/25 bg-[#101b34] p-5 shadow-[7px_7px_0_#090f20] sm:p-7">
      <div role="tablist" aria-label={ui("Game")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" onKeyDown={event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const index = games.findIndex(item => item.id === game);
        selectGame(games[(index + (event.key === "ArrowRight" ? 1 : -1) + games.length) % games.length].id, true);
      }}>
        {games.map(item => <button key={item.id} type="button" role="tab" id={`leaderboard-game-${item.id}`} aria-selected={game === item.id} aria-controls="leaderboard-panel" tabIndex={game === item.id ? 0 : -1} onClick={() => selectGame(item.id)} className={tabClass(game === item.id)}>{ui(item.label)}</button>)}
      </div>
      <div role="tabpanel" id="leaderboard-panel" aria-labelledby={`leaderboard-game-${game}`} className="mt-4">
        {game === "go" && <div className="-mx-1 mb-4 overflow-x-auto px-1 pb-1"><div className="inline-flex rounded-xl border border-white/15 p-1" role="group" aria-label="Go leaderboard modes">{goTimeControls.map(mode => <button key={mode.id} type="button" className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${goMode === mode.id ? "bg-amber-300 text-black" : "text-slate-400 hover:text-white"}`} aria-pressed={goMode === mode.id} onClick={() => setSearchParams({ game: "go", mode: mode.id })}>{mode.name}<span className={`ml-1.5 font-mono text-[10px] ${goMode === mode.id ? "text-black/60" : "text-slate-500"}`}>{mode.clock}</span></button>)}</div><Link className="inline-block px-4 py-2 text-sm font-bold text-amber-300" to="/games/go/ranked">Play ranked Go →</Link></div>}
        {game === "chess" && <div className="-mx-1 mb-4 overflow-x-auto px-1 pb-1"><div className="inline-flex rounded-xl border border-white/15 p-1" role="group" aria-label={ui("Chess leaderboard")}>
          {[...timeControls.map(mode => ({ id: mode.id as ChessBoard, label: ui(mode.name), detail: mode.clock })), { id: "puzzles" as ChessBoard, label: ui("Perfect Really Hard puzzles"), detail: null }].map(item => <button key={item.id} type="button" aria-pressed={chessBoard === item.id} onClick={() => selectChessBoard(item.id)} className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${chessBoard === item.id ? "bg-amber-300 text-black" : "text-slate-400 hover:text-white"}`}>{item.label}{item.detail && <span className={`ml-1.5 font-mono text-[10px] ${chessBoard === item.id ? "text-black/60" : "text-slate-500"}`}>{item.detail}</span>}</button>)}
        </div></div>}
        {!user ? <p className="text-slate-400"><Link to="/login" className="text-amber-300 underline">{ui("Sign in")}</Link> {ui("to view leaderboards.")}</p>
          : game === "go" ? <GoRankedLeaderboard mode={goMode} />
          : game === "chess" && chessBoard === "puzzles" ? <p className="rounded-xl border border-white/10 p-5 text-sm text-slate-400">{ui("This board will open when puzzle attempts have server-verified mistake records. Current puzzle completions cannot safely support a competitive ranking.")}</p>
          : !board ? <p className="text-slate-400">{ui("Loading…")}</p>
          : board.error ? <p role="alert" className="text-red-300">{board.error}</p>
          : board.rows.length ? <>
            <p className="mb-3 text-xs text-slate-400">{game === "chess" ? <>{ui("Ranked Elo")} · {timeControlLabel(chessBoard === "puzzles" ? "rapid" : chessBoard, ui)}</> : <>{ui("Ranked by multiplayer wins")} · {ui(gameLabel)}</>}</p>
            <LeaderboardTable rows={board.rows} valueLabel={game === "chess" ? "Elo" : ui("Wins")} currentUserId={user.id} chessRanks={game === "chess"} />
          </>
          : <p className="text-slate-400">{ui(game === "chess" ? "No verified ranked matches yet." : "No multiplayer wins recorded yet.")}</p>}
      </div>
    </section>
  </main>;
}
