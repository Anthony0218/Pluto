import { Link } from "react-router-dom";
import { canReviewGoGame } from "../../games/go/reviewAvailability";
import { loadGoGame } from "../../games/go/storage";
type Props = { game: "go" | "shogi"; title: string; subtitle: string; mark: string };
export default function StrategyModeMenu({ game, title, subtitle, mark }: Props) {
  const hasFinishedGoGame = game === "go" && canReviewGoGame(loadGoGame());
  const modes = [
    { path: "ai", title: "Vs Bot", text: "Play solo with Easy, Medium, or Hard AI.", style: "border-sky-400/25 hover:border-sky-300/60" },
    { path: "hotseat", title: "Hotseat", text: "Two local players share this device.", style: "border-amber-400/25 hover:border-amber-300/60" },
    { path: "multiplayer", title: "Multiplayer", text: game === "go" ? "Invite a friend or play ranked Go with byo-yomi clocks." : "Create or join a live Pluto room.", style: "border-emerald-400/25 hover:border-emerald-300/60" },
    ...(hasFinishedGoGame ? [{ path: "analysis", title: "Game Review", text: "Review your latest finished game with KataGo.", style: "border-teal-400/25 hover:border-teal-300/60" }] : []),
  ];
  return <main className="relative left-1/2 h-[var(--app-height)] w-screen -translate-x-1/2 overflow-y-auto bg-[#07090b] px-5 py-5 text-zinc-100 sm:py-8">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,.1),transparent_30%),linear-gradient(to_bottom,#0b0e11,#050607)]" />
    <div className="relative mx-auto flex h-full max-w-5xl flex-col">
      <div className="flex shrink-0 items-center justify-between"><Link to="/games" className="text-sm text-zinc-500 hover:text-white">← All games</Link><Link to={"/games/" + game + "/rules"} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-300/40 hover:text-white">Rules</Link></div>
      <div className="grid min-h-0 flex-1 items-center gap-4 py-3 sm:gap-6 lg:grid-cols-[.8fr_1.2fr] lg:gap-10">
        <header>
          <p className="text-xs font-black uppercase tracking-[.3em] text-amber-400">Classic strategy</p>
          <h1 className="mt-2 font-serif text-4xl text-white sm:mt-4 sm:text-6xl lg:text-7xl">{title}</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400 sm:mt-5 sm:text-lg sm:leading-8">{subtitle}</p>
          <div className="mt-3 hidden text-8xl text-amber-200/10 sm:block lg:mt-8 lg:text-9xl" aria-hidden="true">{mark}</div>
        </header>
        <section className="space-y-2 sm:space-y-3" aria-label={title + " game modes"}>
          {modes.map((mode) => <Link key={mode.path} to={"/games/" + game + "/" + mode.path} className={"group block rounded-2xl border bg-white/[.035] p-3 transition hover:-translate-y-1 hover:bg-white/[.06] sm:p-5 " + mode.style}>
            <p className="text-xs font-black uppercase tracking-[.25em] text-zinc-500">{mode.path === "multiplayer" || mode.path === "ranked" ? "Online" : mode.path === "analysis" ? "Post-game" : "Singleplayer"}</p>
            <div className="mt-1 flex items-center justify-between gap-4"><div><h2 className="font-serif text-2xl text-white sm:text-3xl">{mode.title}</h2><p className="mt-1 text-xs text-zinc-500 sm:mt-2 sm:text-sm">{mode.text}</p></div><span className="text-2xl text-amber-300">→</span></div>
          </Link>)}
        </section>
      </div>
    </div>
  </main>;
}
