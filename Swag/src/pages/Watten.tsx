import { Link } from "react-router-dom";
import { Gamepad2, Users, ArrowRight } from "lucide-react";

export default function Watten() {
  const heroImage = "/images/watten-game-icon.png";

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <header className="mb-8 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">
            Watten
          </p>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Wie möchtest du spielen?
          </h1>
        </header>

        {/* HERO IMAGE */}
        <Link
          to="/watten/rules"
          className="
    group relative mx-auto mb-8 block
    aspect-square w-56
    overflow-hidden rounded-3xl
    border border-slate-700
    bg-slate-800
    shadow-2xl shadow-black/30
    transition-all duration-300

    hover:scale-[1.03]
    hover:border-sky-500/60
    hover:ring-2
    hover:ring-sky-500/30

    sm:w-64
  "
        >
          <img
            src={heroImage}
            alt="Watten Spielregeln"
            className="
      h-full w-full object-cover
      transition-transform duration-500
      group-hover:scale-110
    "
          />

          {/* Dark overlay */}
          <div
            className="
      absolute inset-0
      bg-black/35
      transition-colors duration-300
      group-hover:bg-black/50
    "
          />

          {/* Text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="
        rounded-xl
        border border-white/20
        bg-black/35
        px-5 py-2.5
        text-xl font-bold
        tracking-wide text-white
        shadow-lg
        backdrop-blur-sm
        transition-all duration-300

        group-hover:scale-105
        group-hover:bg-black/50
      "
            >
              Spielregeln
            </span>
          </div>
        </Link>

        {/* MODE CARDS */}
        <section className="grid gap-5 md:grid-cols-2">
          {/* HOTSEAT */}
          <Link
            to="/watten/hotseat"
            className="
              group
              relative overflow-hidden
              rounded-2xl
              border border-slate-700
              bg-slate-800/90
              p-6
              shadow-lg shadow-black/15

              transition-all duration-300

              hover:-translate-y-1
              hover:border-sky-500/60
              hover:bg-slate-800
              hover:shadow-2xl
              hover:shadow-sky-950/30
              hover:ring-1
              hover:ring-sky-500/30
            "
          >
            {/* subtle glow */}
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-500/0 blur-3xl transition-colors duration-500 group-hover:bg-sky-500/10" />

            <div className="relative">
              <div className="mb-8 flex items-start justify-between">
                <div
                  className="
                    flex h-14 w-14 items-center justify-center
                    rounded-2xl
                    bg-sky-500/15
                    text-sky-300
                    ring-1 ring-sky-500/20
                    transition-transform duration-300
                    group-hover:scale-110
                  "
                >
                  <Gamepad2 size={27} />
                </div>

                <span className="rounded-full bg-slate-900/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Lokal
                </span>
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Hotseat
              </h2>

              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                Spielt gemeinsam an einem Gerät. Nach jedem Zug wird das Gerät
                einfach an den nächsten Spieler weitergegeben.
              </p>

              <div className="mt-8 flex items-center justify-between border-t border-slate-700 pt-5">
                <span className="text-xs text-slate-500">
                  Ein Gerät · Mehrere Spieler
                </span>

                <div
                  className="
                    flex items-center gap-2
                    text-sm font-semibold text-sky-300
                    transition-transform duration-300
                    group-hover:translate-x-1
                  "
                >
                  Spielen
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>

          {/* MULTIPLAYER */}
          <Link
            to="/watten/multiplayer"
            className="
              group
              relative overflow-hidden
              rounded-2xl
              border border-slate-700
              bg-slate-800/90
              p-6
              shadow-lg shadow-black/15

              transition-all duration-300

              hover:-translate-y-1
              hover:border-emerald-500/60
              hover:bg-slate-800
              hover:shadow-2xl
              hover:shadow-emerald-950/30
              hover:ring-1
              hover:ring-emerald-500/30
            "
          >
            {/* subtle glow */}
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/0 blur-3xl transition-colors duration-500 group-hover:bg-emerald-500/10" />

            <div className="relative">
              <div className="mb-8 flex items-start justify-between">
                <div
                  className="
                    flex h-14 w-14 items-center justify-center
                    rounded-2xl
                    bg-emerald-500/15
                    text-emerald-300
                    ring-1 ring-emerald-500/20
                    transition-transform duration-300
                    group-hover:scale-110
                  "
                >
                  <Users size={27} />
                </div>

                <span className="rounded-full bg-slate-900/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Online
                </span>
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Multiplayer
              </h2>

              <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                Erstelle eine private Partie und lade deine Freunde mit einem
                Spielcode ein.
              </p>

              <div className="mt-8 flex items-center justify-between border-t border-slate-700 pt-5">
                <span className="text-xs text-slate-500">
                  Mehrere Geräte · Online
                </span>

                <div
                  className="
                    flex items-center gap-2
                    text-sm font-semibold text-emerald-300
                    transition-transform duration-300
                    group-hover:translate-x-1
                  "
                >
                  Spielen
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
