import { ui, useUiLanguage } from "@/i18n/ui";
import { ArrowRight, BookOpen, Check, Gamepad2, TrendingUp, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import QuickNavigation from "./QuickNavigation";

export default function LandingHero() {
  useUiLanguage();
  const { user } = useAuth();
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
          min-h-[520px]
          max-w-[1500px]
          items-center
          gap-16

          px-5
          py-20

          sm:px-8

          lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]
          lg:px-10
          lg:py-20

          xl:min-h-[560px]
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

        <section className="relative overflow-hidden rounded-[28px] border border-indigo-300/20 bg-[#10172a]/95 p-6 shadow-2xl shadow-black/30 sm:p-8" aria-label={ui("Your account")}>
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="relative flex min-h-[390px] flex-col">
            <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-400/10 text-indigo-200"><UserRound size={24} /></span>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">{ui("Your space to play")}</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight text-white sm:text-4xl">{ui(user ? "Welcome back." : "Make every game count.")}</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">{ui(user ? "Your games, friends and progress are ready on your dashboard." : "Create a free account to keep your favorites, follow your progress and play with friends.")}</p>
            {user ? <QuickNavigation key={user.id} userId={user.id} /> : <ul className="mt-6 space-y-3 text-sm text-zinc-200">
              <li className="flex items-center gap-3"><Check size={17} className="shrink-0 text-emerald-300" />{ui("Save your favorite games and progress")}</li>
              <li className="flex items-center gap-3"><Check size={17} className="shrink-0 text-emerald-300" />{ui("Follow daily challenges")}</li>
              <li className="flex items-center gap-3"><Check size={17} className="shrink-0 text-emerald-300" />{ui("Connect and play with friends")}</li>
            </ul>}
            <div className="mt-auto grid gap-3 pt-8 sm:grid-cols-2">
              {user ? <Link to="/dashboard" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 sm:col-span-2">{ui("Go to dashboard")}<ArrowRight size={16} /></Link> : <>
                <Link to="/login" className="flex min-h-12 items-center justify-center rounded-xl border border-indigo-300/30 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">{ui("Log in")}</Link>
                <Link to="/login?mode=register" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400">{ui("Register")}<ArrowRight size={16} /></Link>
              </>}
            </div>
          </div>
        </section>

      </div>
    </section>
  );
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
