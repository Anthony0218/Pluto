import {
  ArrowRight,
  BookOpen,
  Flame,
  Gamepad2,
  Sparkles,
  Trophy,
} from "lucide-react";

import { Link } from "react-router-dom";

export default function VisitPlutoPreview() {
  return (
    <div className="relative">
      {/* BACKGROUND GLOW */}
      <div
        className="
          pointer-events-none
          absolute
          inset-12
          bg-indigo-500/[0.18]
          blur-[100px]
        "
      />

      <div
        className="
          relative
          overflow-hidden
          rounded-[28px]

          border
          border-white/[0.09]

          bg-[#080d1d]/90

          shadow-2xl
          shadow-black/50

          backdrop-blur-xl
        "
      >
        {/* MINI APP HEADER */}
        <div
          className="
            flex
            items-center
            justify-between

            border-b
            border-white/[0.07]

            px-5
            py-4
          "
        >
          <div className="flex items-center gap-3">
            <img
              src="/pluto-icon.png"
              alt="Pluto"
              className="
                h-9
                w-9
                rounded-xl
                object-cover
              "
            />

            <div>
              <p className="text-sm font-semibold text-white">Pluto</p>

              <p className="text-[10px] text-zinc-600">Your dashboard</p>
            </div>
          </div>

          <div
            className="
              rounded-full
              border border-indigo-400/20
              bg-indigo-400/[0.08]
              px-3
              py-1

              text-[10px]
              font-medium
              text-indigo-300
            "
          >
            Dashboard
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-5 sm:p-6">
          {/* STATS */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <MiniStat icon={<Flame size={15} />} value="7" label="day streak" />

            <MiniStat icon={<Sparkles size={15} />} value="1,240" label="XP" />

            <MiniStat icon={<Trophy size={15} />} value="12" label="level" />
          </div>

          {/* CONTINUE PLAYING */}
          <div
            className="
              mt-4
              overflow-hidden
              rounded-2xl

              border
              border-white/[0.07]

              bg-white/[0.025]
            "
          >
            <div
              className="
                flex
                items-center
                justify-between

                p-4
              "
            >
              <div className="flex items-center gap-3">
                <div
                  className="
                    flex
                    h-11
                    w-11
                    items-center
                    justify-center

                    rounded-xl

                    bg-indigo-400/[0.08]

                    text-indigo-300
                  "
                >
                  <Gamepad2 size={20} />
                </div>

                <div>
                  <p
                    className="
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-[0.17em]
                      text-zinc-600
                    "
                  >
                    Continue playing
                  </p>

                  <p className="mt-1 text-sm font-semibold">Chess</p>
                </div>
              </div>

              <span className="text-sm text-zinc-600">→</span>
            </div>
          </div>

          {/* LEARNING */}
          <div
            className="
              mt-3
              rounded-2xl

              border
              border-white/[0.07]

              bg-white/[0.025]

              p-4
            "
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center

                  rounded-xl

                  bg-violet-400/[0.08]

                  text-violet-300
                "
              >
                <BookOpen size={19} />
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <p
                      className="
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-[0.17em]
                        text-zinc-600
                      "
                    >
                      Continue learning
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      Control the Center
                    </p>
                  </div>

                  <span className="text-xs text-zinc-500">60%</span>
                </div>

                {/* PROGRESS */}
                <div
                  className="
                    mt-3
                    h-1.5
                    overflow-hidden
                    rounded-full
                    bg-white/[0.06]
                  "
                >
                  <div
                    className="
                      h-full
                      w-[60%]
                      rounded-full

                      bg-gradient-to-r
                      from-indigo-500
                      to-violet-400
                    "
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SMALL ACTIVITY */}
          <div
            className="
              mt-3
              grid
              gap-3
              sm:grid-cols-2
            "
          >
            <div
              className="
                rounded-2xl
                border border-white/[0.07]
                bg-white/[0.02]
                p-4
              "
            >
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                Daily challenge
              </p>

              <p className="mt-2 text-sm font-medium">Find the best move</p>
            </div>

            <div
              className="
                rounded-2xl
                border border-white/[0.07]
                bg-white/[0.02]
                p-4
              "
            >
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                Friends
              </p>

              <p className="mt-2 text-sm font-medium">4 online now</p>
            </div>
          </div>
        </div>

        {/* VISIT PLUTO */}
        <div
          className="
            flex
            items-center
            justify-between
            gap-4

            border-t
            border-white/[0.07]

            bg-white/[0.015]

            px-5
            py-4

            sm:px-6
          "
        >
          <div>
            <p className="text-sm font-semibold">Visit Pluto</p>

            <p className="mt-0.5 text-xs text-zinc-500">
              Your games, learning and progress.
            </p>
          </div>

          <Link
            to="/dashboard"
            className="
              group

              inline-flex
              shrink-0
              items-center
              gap-2

              rounded-xl

              bg-indigo-500

              px-4
              py-2.5

              text-xs
              font-semibold
              text-white

              transition

              hover:bg-indigo-400
            "
          >
            Open Pluto
            <ArrowRight
              size={14}
              className="
                transition-transform
                group-hover:translate-x-0.5
              "
            />
          </Link>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div
      className="
        rounded-xl

        border
        border-white/[0.06]

        bg-white/[0.025]

        p-3
      "
    >
      <div className="text-indigo-300">{icon}</div>

      <p className="mt-3 text-sm font-bold text-white sm:text-base">{value}</p>

      <p className="mt-0.5 text-[10px] text-zinc-600">{label}</p>
    </div>
  );
}
