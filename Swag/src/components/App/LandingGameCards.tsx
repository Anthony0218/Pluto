import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";

const games = [
  { title: "Chess", subtitle: "Classic modes", route: "/games/chess/classic", icon: "♟", image: "/images/chess-game-icon.png", accent: "sky" },
  { title: "Watten", subtitle: "Choose a table", route: "/games/watten", icon: "♦", image: "/images/watten-game-icon.png", accent: "rose" },
  { title: "Schafkopfen", subtitle: "Bavarian cards", route: "/games/schafkopf", icon: "♣", image: "/images/watten-game-icon.png", accent: "emerald" },
  { title: "Chess Variants", subtitle: "New rules, new tactics", route: "/games/chess/variants", icon: "♞", image: "/images/chess-variant.png", accent: "amber", variant: true },
] as const;

function LandingGameCard({ title, subtitle, route, icon, image, accent, variant }: (typeof games)[number] & { variant?: boolean }) {
  const accents = {
    sky: "border-sky-300/20 from-sky-400/[0.13] group-hover:border-sky-300/55 group-hover:shadow-sky-500/15",
    rose: "border-rose-300/20 from-rose-400/[0.13] group-hover:border-rose-300/55 group-hover:shadow-rose-500/15",
    emerald: "border-emerald-300/20 from-emerald-400/[0.13] group-hover:border-emerald-300/55 group-hover:shadow-emerald-500/15",
    amber: "border-amber-300/35 from-amber-400/[0.16] group-hover:border-amber-200/70 group-hover:shadow-amber-500/20",
  } as const;

  return <Link to={route} className={`group relative flex aspect-[1.5/1] min-h-28 flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br ${accents[accent]} to-slate-950/80 p-3 shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300 motion-reduce:transform-none`}>
    <img src={image} alt="" className={`pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50 transition duration-500 group-hover:scale-105 group-hover:opacity-65 ${variant ? "object-[center_55%]" : "object-center"}`} />
    <span className={`pointer-events-none absolute inset-0 ${variant ? "bg-[linear-gradient(135deg,rgba(31,15,3,.58),rgba(8,10,20,.24)_48%,rgba(4,7,15,.9))]" : "bg-[linear-gradient(135deg,rgba(4,11,26,.84),rgba(4,11,26,.25)_55%,rgba(4,7,15,.88))]"}`} />
    <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/25 font-serif text-2xl text-white shadow-inner">{icon}</span>
    <span className="relative"><strong className="block font-serif text-base text-white sm:text-lg">{ui(title)}</strong><span className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-300"><span>{ui(subtitle)}</span><ArrowRight className="shrink-0 text-zinc-300 transition group-hover:translate-x-1" size={15} /></span></span>
  </Link>;
}

export default function LandingGameCards() {
  useUiLanguage();
  return <nav className="mx-auto grid w-full max-w-[540px] grid-cols-2 gap-3" aria-label={ui("Choose a game")}>
    {games.map(game => <LandingGameCard key={game.route} {...game} />)}
  </nav>;
}
