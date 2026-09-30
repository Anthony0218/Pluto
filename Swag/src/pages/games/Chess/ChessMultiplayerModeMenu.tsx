import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import ChessRankedLobby from "./ChessRankedLobby";
import { FriendRoomPanel } from "./ChessMultiplayerLobby";

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
  const inviteCode = searchParams.get("code");
  if (inviteCode) return <Navigate replace to={`/games/chess/classic/multiplayer/friends?code=${encodeURIComponent(inviteCode)}`} />;

  return <main className="chess-menu-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] text-zinc-100">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_13%_68%,rgba(245,158,11,.09),transparent_28%),radial-gradient(circle_at_76%_23%,rgba(255,255,255,.045),transparent_30%),linear-gradient(to_bottom,#0a0d10,#07090b_58%,#040506)]" />
    <div className="relative flex min-h-[var(--app-height)] flex-col">
      <ChessPageHeader className="chess-menu-header" />
      <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,.88fr)_minmax(600px,1.12fr)]">
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
        <div className="relative flex min-h-[560px] min-w-0 items-center border-t border-white/[0.06] px-5 py-8 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-t-0 lg:px-10 lg:py-12 xl:px-14">
          <div className="mx-auto my-auto w-full max-w-[920px] flex-none">
            <ModeTabs activeTab={activeTab} onChange={setActiveTab} />
            {activeTab === 0 && <div role="tabpanel"><FriendRoomPanel embedded /></div>}
            {activeTab === 1 && <div role="tabpanel"><ChessRankedLobby embedded /></div>}
          </div>
        </div>
      </section>
    </div>
  </main>;
}
