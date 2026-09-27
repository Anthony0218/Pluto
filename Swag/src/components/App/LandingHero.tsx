import { ui, useUiLanguage } from "@/i18n/ui";
import { ArrowRight, BookOpen, Gamepad2, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const heroGames = [
  { title: "Chess", subtitle: "Classic modes", route: "/games/chess/classic", icon: "♟", image: "/images/chess-game-icon.png", accent: "sky" },
  { title: "Watten", subtitle: "Choose a table", route: "/games/watten", icon: "♦", image: "/images/watten-game-icon.png", accent: "rose" },
  { title: "Schafkopfen", subtitle: "Bavarian cards", route: "/games/schafkopf", icon: "♣", image: "/images/watten-game-icon.png", accent: "emerald" },
  { title: "Chess Variants", subtitle: "New rules, new tactics", route: "/games/chess/variants", icon: "♞", image: "/images/chess-variant.png", accent: "amber", variant: true },
] as const;

export default function LandingHero() {
  useUiLanguage();
  return (
    <section
      className="
        relative
        overflow-hidden
        border-b border-white/[0.08]
      "
    >
      {/* BACKGROUND EFFECTS */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="
            absolute
            -left-32
            top-20
            h-[420px]
            w-[420px]
            rounded-full
            bg-indigo-500/[0.10]
            blur-[130px]
          "
        />

        <div
          className="
            absolute
            right-[-100px]
            top-[-40px]
            h-[500px]
            w-[500px]
            rounded-full
            bg-violet-500/[0.08]
            blur-[150px]
          "
        />

        <div
          className="
            absolute inset-0
            bg-[radial-gradient(circle,_rgba(255,255,255,0.5)_1px,_transparent_1px)]
            bg-[size:52px_52px]
            opacity-[0.08]
          "
        />
      </div>

      <div
        className="
          relative
          mx-auto
          grid
          min-h-[680px]
          max-w-[1500px]
          items-center
          gap-16

          px-5
          py-20

          sm:px-8

          lg:grid-cols-[0.82fr_1.18fr]
          lg:px-10
          lg:py-28

          xl:min-h-[720px]
          xl:gap-24
        "
      >
        {/* LEFT SIDE */}
        <div>
          <p
            className="
              mb-5
              text-xs
              font-bold
              uppercase
              tracking-[0.32em]
              text-indigo-300
            "
          >{ui("Games + Learning")}</p>

          <h1
            className="
              max-w-3xl
              text-5xl
              font-black
              leading-[0.95]
              tracking-[-0.055em]
              text-white

              sm:text-6xl
              lg:text-7xl
              xl:text-[86px]
            "
          >{ui("Play.")}<br />{ui("Learn.")}<br />
            <span
              className="
                bg-gradient-to-r
                from-sky-300
                via-indigo-300
                to-violet-400
                bg-clip-text
                text-transparent
              "
            >{ui("Improve.")}</span>
          </h1>

          <p
            className="
              mt-7
              max-w-xl
              text-base
              leading-7
              text-zinc-400

              sm:text-lg
              sm:leading-8
            "
          >{ui("Play games, learn new skills and use powerful tools to understand how you can get better.")}</p>

          <div className="mt-8 w-full max-w-xl">
            <Link to="/dashboard" className="inline-flex min-h-16 w-full items-center justify-center gap-6 rounded-2xl border border-indigo-300/40 bg-gradient-to-r from-indigo-500 to-violet-600 px-8 py-5 text-lg font-bold tracking-widest text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">{ui("HOME")}<ArrowRight size={21} /></Link>
          </div>

          {/* PLAY / LEARN / IMPROVE */}
          <div
            className="
              mt-10
              grid
              max-w-2xl
              gap-6

              sm:grid-cols-3
            "
          >
            <HeroFeature
              icon={<Gamepad2 size={19} />}
              title={ui("Play")}
              description={ui("Games and variants")}
            />

            <HeroFeature
              icon={<BookOpen size={19} />}
              title={ui("Learn")}
              description={ui("Interactive lessons")}
            />

            <HeroFeature
              icon={<TrendingUp size={19} />}
              title={ui("Improve")}
              description={ui("Track your progress")}
            />
          </div>
        </div>

        {/* RIGHT SIDE */}
        <nav className="grid w-full max-w-[480px] grid-cols-2 gap-3 justify-self-center sm:gap-4" aria-label={ui("Choose a game")}>
          {heroGames.map((game) => <LandingGameCard key={game.route} {...game} />)}
        </nav>
      </div>
    </section>
  );
}

function LandingGameCard({ title, subtitle, route, icon, image, accent, variant }: (typeof heroGames)[number] & { variant?: boolean }) {
  const accents = {
    sky: "border-sky-300/20 from-sky-400/[0.13] group-hover:border-sky-300/55 group-hover:shadow-sky-500/15",
    rose: "border-rose-300/20 from-rose-400/[0.13] group-hover:border-rose-300/55 group-hover:shadow-rose-500/15",
    emerald: "border-emerald-300/20 from-emerald-400/[0.13] group-hover:border-emerald-300/55 group-hover:shadow-emerald-500/15",
    amber: "border-amber-300/35 from-amber-400/[0.16] group-hover:border-amber-200/70 group-hover:shadow-amber-500/20",
  } as const;

  return <Link to={route} className={`group relative flex aspect-[1.35/1] min-h-36 flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br ${accents[accent]} to-slate-950/80 p-3.5 shadow-xl shadow-black/20 transition duration-300 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300 motion-reduce:transform-none sm:p-4`}>
    <img src={image} alt="" className={`pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50 transition duration-500 group-hover:scale-105 group-hover:opacity-65 ${variant ? "object-[center_55%]" : "object-center"}`} />
    <span className={`pointer-events-none absolute inset-0 ${variant ? "bg-[linear-gradient(135deg,rgba(31,15,3,.58),rgba(8,10,20,.24)_48%,rgba(4,7,15,.9))]" : "bg-[linear-gradient(135deg,rgba(4,11,26,.84),rgba(4,11,26,.25)_55%,rgba(4,7,15,.88))]"}`} />
    <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/25 font-serif text-3xl text-white shadow-inner sm:h-11 sm:w-11">{icon}</span>
    <span className="relative">
      <strong className="block font-serif text-lg text-white sm:text-xl">{ui(title)}</strong>
      <span className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-300"><span>{ui(subtitle)}</span><ArrowRight className="shrink-0 text-zinc-300 transition group-hover:translate-x-1" size={15} /></span>
    </span>
  </Link>;
}

function HeroFeature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  useUiLanguage();
  return (
    <div className="flex items-start gap-3">
      <div
        className="
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-xl

          border
          border-indigo-300/[0.12]

          bg-indigo-400/[0.08]

          text-indigo-300
        "
      >
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold text-white">{ui(title)}</p>

        <p className="mt-1 text-xs text-zinc-500">{ui(description)}</p>
      </div>
    </div>
  );
}
