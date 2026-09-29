import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import ChessRankedLobby from "./ChessRankedLobby";

const modes = [
  {
    title: "Play with a friend",
    description: "Create a private room or join your friend's room with a code.",
    eyebrow: "Private game",
    footer: "CREATE · SHARE · PLAY",
    icon: "♔",
    path: "/games/chess/classic/multiplayer/friends",
  },
  {
    title: "Play Ranked",
    description: "Find an opponent near your Elo and compete for the leaderboard.",
    eyebrow: "Competitive game",
    footer: "QUEUE · COMPETE · CLIMB",
    icon: "♚",
    path: "/games/chess/ranked",
  },
];

function ModeTabs({ activeTab, onChange }: { activeTab: 0 | 1; onChange: (tab: 0 | 1) => void }) {
  return <div role="tablist" aria-label={ui("Multiplayer modes")} className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[.04] p-1.5">{modes.map((mode, index) => <button key={mode.path} type="button" role="tab" aria-selected={activeTab === index} onClick={() => onChange(index as 0 | 1)} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${activeTab === index ? "bg-amber-300 text-black shadow-lg shadow-amber-500/20" : "text-zinc-400 hover:bg-white/[.06] hover:text-white"}`}>{ui(mode.title)}</button>)}</div>;
}

export default function ChessMultiplayerModeMenu() {
  useUiLanguage();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [roomCode, setRoomCode] = useState("");
  const inviteCode = searchParams.get("code");
  if (inviteCode) return <Navigate replace to={`/games/chess/classic/multiplayer/friends?code=${encodeURIComponent(inviteCode)}`} />;

  return <main className="chess-menu-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] text-zinc-100">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_13%_68%,rgba(245,158,11,.09),transparent_28%),radial-gradient(circle_at_76%_23%,rgba(255,255,255,.045),transparent_30%),linear-gradient(to_bottom,#0a0d10,#07090b_58%,#040506)]" />
    <div className="relative flex min-h-[var(--app-height)] flex-col">
      <ChessPageHeader className="chess-menu-header" />
      {activeTab === 0 ? <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,.88fr)_minmax(600px,1.12fr)]">
        <header className="relative flex min-h-[430px] flex-col justify-center px-7 py-14 sm:px-10 lg:min-h-0 lg:px-14 lg:py-16 xl:px-20">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />
          <div className="max-w-[620px]">
            <Link to="/games/chess/classic" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-600 transition hover:text-white">← {ui("Classic Chess")}</Link>
            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-400">{ui("Play online")}</p>
            <h1 className="mt-5 font-serif text-[52px] leading-[.94] tracking-[-0.035em] text-white sm:text-[66px] xl:text-[82px]">{ui("Multiplayer")}</h1>
            <p className="mt-6 max-w-[520px] font-serif text-[18px] leading-8 text-zinc-400 sm:text-[20px]">{ui("Choose a private game with a friend or a ranked match against another player.")}</p>
          </div>
          <div className="mt-12 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-700"><span className="h-px w-14 bg-amber-400/45" />{ui("Friends · Ranked")}</div>
        </header>
        <div className="relative flex min-h-[560px] items-center border-t border-white/[0.06] px-5 py-8 sm:px-8 lg:min-h-0 lg:border-t-0 lg:px-10 lg:py-12 xl:px-14">
          <div className="mx-auto w-full max-w-[760px]">
            <ModeTabs activeTab={activeTab} onChange={setActiveTab} />
            {modes.map((mode, index) => activeTab === index && <Link key={mode.path} to={mode.path} role="tabpanel" className={`group relative block overflow-hidden rounded-[22px] border bg-black/20 p-6 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 ${index === 0 ? "border-emerald-400/35 hover:border-emerald-300/65" : "border-amber-400/40 hover:border-amber-300/70"}`}>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(245,158,11,.055),transparent_55%)] opacity-0 transition group-hover:opacity-100" />
              <div className="relative flex h-full flex-col"><div className={`flex h-[74px] w-[74px] items-center justify-center rounded-2xl border text-[37px] ${index === 0 ? "border-emerald-300/30 bg-emerald-400/[.08] text-emerald-100" : "border-amber-300/35 bg-amber-400/[.09] text-amber-100"}`}>{mode.icon}</div>
                <p className="mt-6 text-[9px] font-black uppercase tracking-[.26em] text-amber-300/70">{ui(mode.eyebrow)}</p>
                <h2 className="mt-2 font-serif text-[31px] leading-tight text-white">{ui(mode.title)}</h2>
                <p className="mt-3 min-h-16 text-sm leading-6 text-zinc-500">{ui(mode.description)}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5"><p className="text-[8px] font-black uppercase tracking-[.24em] text-zinc-700">{ui(mode.footer)}</p><span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-xl text-amber-300 transition group-hover:translate-x-1 group-hover:border-amber-300/35">→</span></div>
              </div>
            </Link>)}
            {activeTab === 0 && <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.035] p-4"><label htmlFor="friend-room-code" className="mb-2 block text-xs font-bold text-zinc-300">{ui("Have a room code?")}</label><div className="flex gap-2"><input id="friend-room-code" value={roomCode} onChange={event => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} maxLength={6} placeholder="ABC123" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono text-sm tracking-widest text-white outline-none focus:border-emerald-300/60" /><Link to={`/games/chess/classic/multiplayer/friends?code=${encodeURIComponent(roomCode)}`} aria-disabled={roomCode.length !== 6} tabIndex={roomCode.length === 6 ? 0 : -1} className={`inline-flex items-center rounded-xl px-5 text-sm font-bold ${roomCode.length === 6 ? "bg-emerald-400 text-[#041911] hover:bg-emerald-300" : "pointer-events-none bg-white/10 text-zinc-600"}`}>{ui("Join room")}</Link></div></div>}
          </div>
        </div>
      </section> : <section className="mx-auto w-full max-w-7xl flex-1 px-5 pt-8 sm:px-8"><ModeTabs activeTab={activeTab} onChange={setActiveTab} /><ChessRankedLobby embedded /></section>}
    </div>
  </main>;
}
