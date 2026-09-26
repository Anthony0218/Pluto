import { ui, useUiLanguage } from "@/i18n/ui";
import { ArrowRight, ChevronLeft, ChevronRight, Gamepad2 } from "lucide-react";

import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import { games } from "../../data/games";

export default function DashboardPlayCarousel() {
  useUiLanguage();
  const navigate = useNavigate();

  const [currentGame, setCurrentGame] = useState(0);

  const [paused, setPaused] = useState(false);

  const game = games[currentGame];

  useEffect(() => {
    if (
      paused ||
      games.length <= 1 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentGame((current) => (current + 1) % games.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [paused]);

  function previous() {
    setCurrentGame((current) => (current - 1 + games.length) % games.length);
  }

  function next() {
    setCurrentGame((current) => (current + 1) % games.length);
  }

  if (!game) {
    return null;
  }

  return (
    <section
      aria-label={ui("Available games")}
      aria-roledescription="carousel"
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="
        group
        relative
        min-h-[360px]
        overflow-hidden
        rounded-[26px]

        border
        border-indigo-400/30

        bg-[#090e20]

        shadow-2xl
        shadow-black/30
      "
    >
      {/* =====================================
          SLIDES
      ===================================== */}

      <div
        className="
          flex
          h-full
          transition-transform
          duration-700
          ease-[cubic-bezier(0.22,1,0.36,1)]
        "
        style={{
          transform: `translateX(-${currentGame * 100}%)`,
        }}
      >
        {games.map((item, index) => (
          <div
            key={item.route}
            inert={index !== currentGame}
            aria-hidden={index !== currentGame}
            className="
              relative
              min-h-[360px]
              min-w-full
              overflow-hidden
            "
          >
            {/* IMAGE */}
            <img
              src={item.image}
              alt={item.title}
              className="
                absolute
                inset-0
                h-full
                w-full
                object-cover
              "
            />

            {/* DARK OVERLAY */}
            <div
              className="
                absolute
                inset-0

                bg-gradient-to-r

                from-[#070b19]
                via-[#070b19]/90
                to-[#070b19]/20
              "
            />

            <div
              className="
                absolute
                inset-0

                bg-gradient-to-t
                from-[#050816]/80
                via-transparent
                to-transparent
              "
            />

            {/* CONTENT */}
            <div
              className="
                relative
                z-10

                flex
                min-h-[360px]
                max-w-2xl
                flex-col
                justify-center

                p-7

                sm:p-9

                lg:p-10
              "
            >
              <div
                className="
                  mb-4
                  flex
                  items-center
                  gap-2
                "
              >
                <Gamepad2 size={15} className="text-indigo-300" />

                <span
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.2em]
                    text-indigo-300
                  "
                >{ui("Play")}</span>
              </div>

              <p
                className="
                  text-sm
                  font-medium
                  text-zinc-400
                "
              >
                {ui(item.subtitle)}
              </p>

              <h2
                className="
                  mt-2

                  text-4xl
                  font-bold
                  tracking-tight
                  text-white

                  sm:text-5xl
                "
              >
                {ui(item.title)}
              </h2>

              <p
                className="
                  mt-4
                  max-w-lg
                  text-sm
                  leading-6
                  text-zinc-300

                  sm:text-base
                "
              >
                {ui(item.description)}
              </p>

              {/* FEATURES */}
              <div
                className="
                  mt-5
                  flex
                  flex-wrap
                  gap-2
                "
              >
                {item.features.slice(0, 3).map((feature) => (
                  <span
                    key={feature}
                    className="
                        rounded-lg
                        border
                        border-white/10
                        bg-black/25
                        px-3
                        py-1.5
                        text-xs
                        text-zinc-300
                        backdrop-blur
                      "
                  >
                    {feature}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={() => navigate(item.route)}
                className="
                  group/button

                  mt-7

                  inline-flex
                  w-fit
                  items-center
                  gap-2

                  rounded-xl

                  bg-indigo-500

                  px-5
                  py-3

                  text-sm
                  font-semibold
                  text-white

                  shadow-lg
                  shadow-indigo-500/20

                  transition

                  hover:bg-indigo-400

                  active:scale-[0.98]
                "
              >{ui("Play")}{ui(item.title)}
                <ArrowRight
                  size={16}
                  className="
                    transition-transform
                    group-hover/button:translate-x-1
                  "
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* =====================================
          PREVIOUS
      ===================================== */}

      <button
        type="button"
        onClick={previous}
        aria-label={ui("Previous game")}
        className="
          absolute
          left-4
          top-1/2
          z-20

          flex
          h-10
          w-10

          -translate-y-1/2

          items-center
          justify-center

          rounded-full

          border
          border-white/10

          bg-black/30

          text-zinc-300

          backdrop-blur-md

          transition

          hover:bg-black/60
          hover:text-white
        "
      >
        <ChevronLeft size={20} />
      </button>

      {/* =====================================
          NEXT
      ===================================== */}

      <button
        type="button"
        onClick={next}
        aria-label={ui("Next game")}
        className="
          absolute
          right-4
          top-1/2
          z-20

          flex
          h-10
          w-10

          -translate-y-1/2

          items-center
          justify-center

          rounded-full

          border
          border-white/10

          bg-black/30

          text-zinc-300

          backdrop-blur-md

          transition

          hover:bg-black/60
          hover:text-white
        "
      >
        <ChevronRight size={20} />
      </button>

      {/* =====================================
          INDICATORS
      ===================================== */}

      <div
        className="
          absolute
          bottom-5
          left-1/2
          z-20

          flex

          -translate-x-1/2

          gap-2
        "
      >
        {games.map((item, index) => (
          <button
            key={item.route}
            type="button"
            onClick={() => setCurrentGame(index)}
            aria-label={`Show ${item.title}`}
            className={`
              h-1.5
              rounded-full

              transition-all
              duration-300

              ${
                index === currentGame
                  ? "w-8 bg-indigo-400"
                  : `
                    w-2
                    bg-white/30
                    hover:bg-white/60
                  `
              }
            `}
          />
        ))}
      </div>
    </section>
  );
}
