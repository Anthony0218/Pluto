import { ui, useUiLanguage } from "@/i18n/ui";
import { BookOpen, Gamepad2, TrendingUp } from "lucide-react";

import VisitPlutoPreview from "./VisitPlutoPreview";

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
          min-h-[760px]
          max-w-[1500px]
          items-center
          gap-16

          px-5
          py-20

          sm:px-8

          lg:grid-cols-[0.82fr_1.18fr]
          lg:px-10
          lg:py-28

          xl:min-h-[820px]
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
        <VisitPlutoPreview />
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
