import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthContext, type AuthContextType } from "../src/context/authState";
import { supabase } from "../src/lib/supabase";
import GameXpReward from "../src/components/games/GameXpReward";
import AutoBestMoveToggle from "../src/components/chess/singleplayer/AutoBestMoveToggle";
import { useAutoBestMove } from "../src/components/chess/singleplayer/useAutoBestMove";
import { useClassicChessXp } from "../src/components/chess/singleplayer/useClassicChessXp";
import "../src/index.css";

// Isolated fixture: every RPC is mocked; it never grants real XP.
const awards = new Map<string, number>();
let failNext = false;
Object.assign(supabase, { rpc: async (_name: string, args: { p_session_id: string; p_coach_used: boolean }) => {
  if (failNext) { failNext = false; return { data: null, error: new Error("Offline") }; }
  const amount = Math.min(awards.get(args.p_session_id) ?? 100, args.p_coach_used ? 50 : 100);
  awards.set(args.p_session_id, amount);
  return { data: amount, error: null };
} });
// An old saved preference must never enable automatic help.
localStorage.setItem("chess-coach-auto-best-move", "1");
function Preview() {
  const [coach, setCoach] = useState(false);
  const [finished, setFinished] = useState(false);
  const [fen, setFen] = useState("start");
  const [hints, setHints] = useState(0);
  const [mode, setMode] = useState<"singleplayer" | "hotseat">("singleplayer");
  const xp = useClassicChessXp({ finished, eligible: true, mode });
  const auto = useAutoBestMove({ fen, canShow: coach && !finished, showHelp: () => setHints(n => n + 1) });
  return <main className="mx-auto max-w-md space-y-3 p-5 text-white">
    <h1 className="text-xl font-bold">Classic chess reward checks</h1>
    <select aria-label="Mode" value={mode} onChange={e => setMode(e.target.value as typeof mode)} className="bg-zinc-900 p-2"><option value="singleplayer">Singleplayer</option><option value="hotseat">Hotseat</option></select>
    <button id="coach" className="block rounded-xl bg-zinc-800 p-3" onClick={() => { auto.reset(); if (!coach) xp.markCoachUsed(); setCoach(!coach); }}>Chess Coach {coach ? "on" : "off"}</button>
    {coach && <AutoBestMoveToggle enabled={auto.enabled} onToggle={auto.toggle} />}
    <p id="hints">Hints: {hints}</p>
    <p id="session">{xp.sessionId}</p>
    <div className="flex flex-wrap gap-2">{[
      ["move", "Next move", () => setFen(current => current + "x")],
      ["finish", "Finish game", () => setFinished(true)],
      ["undo", "Undo finish", () => setFinished(false)],
      ["restart", "New game", () => { xp.reset(coach); auto.reset(); setFinished(false); }],
      ["fail", "Fail next save", () => { failNext = true; }],
    ].map(([id, title, onClick]) => <button className="rounded-lg bg-indigo-800 p-2" key={id as string} id={id as string} onClick={onClick as () => void}>{title as string}</button>)}</div>
    {finished && <GameXpReward {...xp.reward} />}
    <p id="total">{[...awards.values()].reduce((sum, amount) => sum + amount, 0)}</p>
  </main>;
}
const guest = new URLSearchParams(location.search).has("guest");
const auth = { user: guest ? null : { id: "xp-test-user" } } as AuthContextType;
createRoot(document.getElementById("root")!).render(<StrictMode><AuthContext.Provider value={auth}><Preview /></AuthContext.Provider></StrictMode>);
