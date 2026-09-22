import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Tab = "Übersicht" | "Online spielen" | "Spiele" | "Fortschritt";

type Game = {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  route: string;
  tag: string;
  features: string[];
  finished: boolean;
};

export const games: Game[] = [
  {
    title: "Schach",
    subtitle: "Klassische Strategie",
    description:
      "Spiele Schach, tritt gegen Stockfish an, analysiere Stellungen und werte deine Partien aus.",
    image: "/images/chess-home.png",
    route: "/games/chess",
    tag: "Strategie",
    features: ["Einzelspieler", "Stockfish", "Analyse"],
    finished: true,
  },
  {
    title: "Watten",
    subtitle: "Traditionelles Kartenspiel",
    description:
      "Spiele Watten mit taktischen Hinweisen, Punktewertung und einer einsteigerfreundlichen Hilfe.",
    image: "/images/watten-home.png",
    route: "/games/watten",
    tag: "Kartenspiel",
    features: ["3 Spieler", "Hilfemodus", "Punktewertung"],
    finished: true,
  },
  {
    title: "Medieval Kingdoms",
    subtitle: "Rundenbasierte Strategie",
    description:
      "Führe dein mittelalterliches Königreich, plane deine Züge und kämpfe in rundenbasierten Schlachten um die Vorherrschaft.",
    image: "/images/medieval-kingdoms.png",
    route: "/games/medieval-kingdoms",
    tag: "Strategie",
    features: ["Rundenbasiert", "Taktik", "Mittelalter"],
    finished: false,
  },
  {
    title: "Schach 3D",
    subtitle: "Schach in einer neuen Dimension",
    description:
      "Erlebe klassisches Schach auf einem animierten 3D-Brett – lokal im Hotseat oder gegen Stockfish mit mehreren Schwierigkeitsstufen.",
    image: "/images/chess3d.png",
    route: "/games/chess/3dchess",
    tag: "Strategie · 3D",
    features: ["3D-Brett", "Hotseat", "Stockfish AI"],
    finished: true,
  },
];
export const gameList = [
  {
    name: "Schach",
    description:
      "Klassisches Schach gegen Freunde, lokal oder gegen Stockfish.",
    route: "/games/chess",
    category: "Strategie",
    image: "/images/chess-game-icon.png",
    finished: true,
  },

  {
    name: "Watten",
    description: "Das traditionelle bayerische Kartenspiel.",
    route: "/games/watten",
    category: "Kartenspiel",
    image: "/images/watten-game-icon.png",
    finished: true,
  },

  {
    name: "Medieval Kingdoms",
    description: "A turn based strategy game in medieval style.",
    route: "/games/medieval-kingdoms",
    category: "Strategie",
    image: "/images/medieval-kingdoms-icon.png",
    finished: false,
  },

  {
    name: "Schach 3D",
    description:
      "Klassisches Schach als interaktives 3D-Erlebnis – lokal im Hotseat oder gegen Stockfish.",
    route: "/games/chess/3dchess",
    category: "Strategie · 3D",
    image: "/images/chess3d-icon.png",
    finished: true,
  },
];
export default function HomePage() {
  const navigate = useNavigate();
  const tabs: Tab[] = ["Übersicht", "Online spielen", "Spiele", "Fortschritt"];
  const [activeTab, setActiveTab] = useState<Tab>("Übersicht");
  const [currentGame, setCurrentGame] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || activeTab !== "Übersicht") {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentGame((current) => (current + 1) % games.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [isPaused, activeTab]);

  function previousGame() {
    setCurrentGame((current) => (current - 1 + games.length) % games.length);
  }

  function nextGame() {
    setCurrentGame((current) => (current + 1) % games.length);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-[1450px] px-5 py-6 sm:px-8 lg:px-10">
        {/* HEADER */}
        <header className="mb-8 ml-10 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("Übersicht")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-xl font-bold text-white shadow-lg shadow-sky-500/20">
              ♞
            </div>

            <div className="text-left">
              <h1 className="text-lg font-semibold tracking-tight text-white">
                SWAG
              </h1>

              <p className="text-[11px] text-zinc-500">Play. Learn. Improve.</p>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/games")}
              className="hidden rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 sm:block"
            >
              Meine Spiele
            </button>

            <button
              onClick={() => navigate("/profile")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
            >
              A
            </button>
          </div>
        </header>

        {/* TABS */}
        <nav className="mb-7 flex gap-7 overflow-x-auto border-b border-zinc-800">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                relative whitespace-nowrap pb-4 text-sm font-medium
                transition-colors
                ${
                  activeTab === tab
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }
              `}
            >
              {tab}

              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-sky-400" />
              )}
            </button>
          ))}
        </nav>

        {/* GAMES */}
        {activeTab === "Übersicht" && (
          <div className="space-y-6">
            {/* FEATURED SLIDER */}
            <section
              className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/20"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Sliding track */}
              <div
                className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transform: `translateX(-${currentGame * 100}%)`,
                }}
              >
                {games.map((game) => (
                  <div
                    key={game.title}
                    className="grid min-w-full lg:grid-cols-[1.1fr_0.9fr]"
                  >
                    {/* IMAGE */}
                    <div className="relative min-h-[330px] overflow-hidden sm:min-h-[420px]">
                      <img
                        src={game.image}
                        alt={game.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[8000ms] hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-zinc-900" />

                      <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                          {game.tag}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black backdrop-blur-md ${
                            game.finished
                              ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-200"
                              : "border-amber-400/25 bg-amber-400/15 text-amber-200"
                          }`}
                        >
                          {game.finished ? "Fertig" : "In Entwicklung"}
                        </span>
                      </div>
                    </div>

                    {/* CONTENT */}
                    <div className="flex min-h-[330px] flex-col justify-center p-7 sm:p-10 lg:min-h-[420px] lg:p-12">
                      <p className="mb-2 text-sm font-medium text-sky-400">
                        {game.subtitle}
                      </p>

                      <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                        {game.title}
                      </h2>

                      <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400 sm:text-base sm:leading-7">
                        {game.description}
                      </p>

                      {/* Feature chips */}
                      <div className="mt-5 flex flex-wrap gap-2">
                        {game.features.map((feature) => (
                          <span
                            key={feature}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => navigate(game.route)}
                        className="mt-7 flex w-fit items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 active:scale-[0.98]"
                      >
                        {game.title} spielen.
                        <span className="transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* PREVIOUS */}
              <button
                type="button"
                onClick={previousGame}
                className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 text-2xl text-white backdrop-blur-md transition hover:bg-black/60"
              >
                ‹
              </button>

              {/* NEXT */}
              <button
                type="button"
                onClick={nextGame}
                className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/30 text-2xl text-white backdrop-blur-md transition hover:bg-black/60"
              >
                ›
              </button>

              {/* INDICATORS */}
              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
                {games.map((game, index) => (
                  <button
                    key={game.title}
                    onClick={() => setCurrentGame(index)}
                    className={`
                      h-1.5 rounded-full transition-all duration-300
                      ${
                        index === currentGame
                          ? "w-8 bg-sky-400"
                          : "w-2.5 bg-white/30 hover:bg-white/60"
                      }
                    `}
                  />
                ))}
              </div>
            </section>

            {/* DASHBOARD */}
            <section className="grid gap-4 lg:grid-cols-12">
              {/* CONTINUE */}
              <button
                onClick={() => navigate("/games/chess")}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-800 lg:col-span-5"
              >
                <div className="mb-7 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    weiterspielen
                  </span>

                  <span className="text-zinc-600 transition group-hover:translate-x-1 group-hover:text-sky-400">
                    →
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800 text-3xl transition group-hover:bg-zinc-700">
                    ♞
                  </div>

                  <div>
                    <h3 className="font-semibold text-white">Schach</h3>

                    <p className="mt-1 text-sm text-zinc-500">
                      Letzte Partie fortsetzen
                    </p>
                  </div>
                </div>
              </button>

              {/* QUICK PLAY */}
              <button
                onClick={() => setActiveTab("Online spielen")}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-zinc-800 lg:col-span-3"
              >
                <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-xl text-sky-400">
                  ⚡
                </div>

                <h3 className="font-semibold text-white"> Schnellspiel</h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Online-Gegner finden
                </p>
              </button>

              {/* DAILY */}
              <button className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:bg-zinc-800 lg:col-span-4">
                <div className="mb-7 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-xl text-amber-400">
                    ◈
                  </div>

                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    Täglich
                  </span>
                </div>

                <h3 className="font-semibold text-white">
                  Tägliche Herausforderung
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  Finde den besten Zug
                </p>
              </button>
            </section>

            {/* EXPLORE */}
            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Entdecken
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Verbessere dein Spiel und verfolge deinen Fortschritt.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  onClick={() => navigate("/games/chess/rules")}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800"
                >
                  <span className="text-2xl">♘</span>

                  <h3 className="mt-5 font-semibold text-white">
                    Schach lernen
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Regeln, Taktiken und typische Motive.
                  </p>
                </button>

                <button
                  onClick={() => navigate("/games/watten/rules")}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800"
                >
                  <span className="text-2xl">🂡</span>

                  <h3 className="mt-5 font-semibold text-white">
                    Watten lernen
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Schlag, Trumpf, Kritisch und Taktik verstehen.
                  </p>
                </button>

                <button
                  onClick={() => navigate("/profile")}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-700 hover:bg-zinc-800"
                >
                  <span className="text-2xl">↗</span>

                  <h3 className="mt-5 font-semibold text-white">
                    Dein Fortschritt
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Siege, Partien und deine Entwicklung.
                  </p>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* PLAY ONLINE */}
        {activeTab === "Online spielen" && (
          <section>
            <div className="mb-6">
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Online spielen
              </h2>

              <p className="mt-2 text-zinc-500">
                Fordere andere Spieler heraus.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => navigate("games/watten/multiplayer")}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left transition hover:-translate-y-1 hover:border-sky-500/40"
              >
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-2xl">
                  🂡
                </div>

                <h3 className="text-xl font-semibold text-white">
                  Watten Multiplayer
                </h3>

                <p className="mt-2 text-sm text-zinc-500">
                  Erstelle eine Partie oder tritt einer bestehenden Watten-Runde
                  bei.
                </p>

                <p className="mt-6 text-sm font-medium text-sky-400">
                  Jetzt spielen →
                </p>
              </button>

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => navigate("/games/chess/classic/multiplayer")}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left transition hover:-translate-y-1 hover:border-sky-500/40"
                >
                  <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-2xl">
                    ♞
                  </div>

                  <h3 className="text-xl font-semibold text-zinc-400">
                    Schach Multiplayer
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500">
                    Erstelle eine Partie oder tritt einer bestehenden
                    Schachpartie bei.
                  </p>

                  <p className="mt-6 text-sm font-medium text-sky-400">
                    Jetzt spielen →
                  </p>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SPIELE */}
        {activeTab === "Spiele" && (
          <section>
            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Spiele
              </h2>

              <p className="mt-2 text-zinc-500">
                Wähle ein Spiel und starte direkt eine neue Partie.
              </p>
            </div>

            {/* Game grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {gameList.map((game) => (
                <button
                  key={game.name}
                  type="button"
                  onClick={() => navigate(game.route)}
                  className="
        group
        relative
        aspect-square
        overflow-hidden
        rounded-2xl
        border border-zinc-800
        bg-zinc-900
        text-left

        transition-all duration-300 ease-out

        hover:z-10
        hover:scale-[1.04]
        hover:border-zinc-500
        hover:shadow-2xl
        hover:shadow-black/40
        hover:ring-2
        hover:ring-sky-500/60

        active:scale-[1.01]
      "
                >
                  {/* Background image */}
                  <img
                    src={game.image}
                    alt={game.name}
                    className="
          absolute inset-0
          h-full w-full
          object-cover
          transition-transform duration-500
          group-hover:scale-110
        "
                  />

                  {/* Dark overlay */}
                  <div
                    className="
          absolute inset-0
          bg-gradient-to-t
          from-black/95
          via-black/45
          to-black/10
          transition-all duration-300
          group-hover:via-black/35
        "
                  />

                  {/* subtle hover glow */}
                  <div
                    className="
          absolute inset-0
          bg-sky-500/0
          transition-colors duration-300
          group-hover:bg-sky-500/5
        "
                  />

                  {/* Content */}
                  <div className="relative flex h-full flex-col p-5">
                    {/* Category */}
                    <div className="flex flex-wrap justify-end gap-2">
                      <span
                        className="
              rounded-full
              border border-white/15
              bg-black/30
              px-2.5 py-1
              text-[10px] font-semibold
              uppercase tracking-wider
              text-zinc-200
              backdrop-blur-md
            "
                      >
                        {game.category}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                          game.finished
                            ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-200"
                            : "border-amber-400/25 bg-amber-400/15 text-amber-200"
                        }`}
                      >
                        {game.finished ? "Fertig" : "In Entwicklung"}
                      </span>
                    </div>

                    {/* Bottom content */}
                    <div className="mt-auto">
                      <h3
                        className="
              text-2xl font-semibold
              tracking-tight text-white
              drop-shadow-lg
              transition-transform duration-300
              group-hover:translate-x-1
            "
                      >
                        {game.name}
                      </h3>

                      <p className="mt-2 max-w-[90%] text-sm leading-5 text-zinc-300">
                        {game.description}
                      </p>

                      <div
                        className="
              mt-4 flex items-center gap-2
              text-sm font-semibold text-sky-300
              transition-all duration-300
              group-hover:translate-x-1
              group-hover:text-sky-200
            "
                      >
                        Spielen
                        <span>→</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        {/* PROGRESS */}
        {activeTab === "Fortschritt" && (
          <section>
            <div className="mb-6">
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Progress
              </h2>

              <p className="mt-2 text-zinc-500">
                Your performance across all games.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Gespielte Partien", "47"],
                ["Siege", "28"],
                ["Siegquote", "60 %"],
                ["Aktuelle Serie", "4"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {label}
                  </p>

                  <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
