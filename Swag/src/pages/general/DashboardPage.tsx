import {
  ArrowRight,
  BarChart3,
  Flame,
  Search,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import { gameList } from "../../data/games";

import DashboardPlayCarousel from "../../components/App/DashboardPlayCarousel";

export default function DashboardPage() {
  const navigate = useNavigate();

  const { user } = useAuth();

  const displayName = user?.email?.split("@")[0] ?? "Player";

  const greeting = getGreeting();

  return (
    <main
      className="
        min-h-screen
        bg-transparent
        text-zinc-100
      "
    >
      <div
        className="
          mx-auto
          max-w-[1550px]

          px-5
          py-7

          sm:px-7

          xl:px-9
        "
      >
        {/* =====================================
            GRID
        ===================================== */}

        <div
          className="
            grid
            gap-6

            xl:grid-cols-[minmax(0,1fr)_350px]
          "
        >
          {/* ===================================
              MAIN COLUMN
          =================================== */}

          <div className="min-w-0">
            {/* SEARCH */}
            <div
              className="
                relative
                mb-9
                max-w-xl
              "
            >
              <Search
                size={18}
                className="
                  absolute
                  left-4
                  top-1/2
                  -translate-y-1/2
                  text-zinc-600
                "
              />

              <input
                type="search"
                placeholder="Search games, lessons, friends..."
                className="
                  h-11
                  w-full

                  rounded-xl

                  border
                  border-white/[0.08]

                  bg-[#0b1020]/75

                  pl-11
                  pr-4

                  text-sm
                  text-white

                  outline-none

                  placeholder:text-zinc-600

                  transition

                  focus:border-indigo-400/30
                "
              />
            </div>

            {/* GREETING */}
            <section className="mb-6">
              <h1
                className="
                  text-3xl
                  font-bold
                  tracking-tight

                  sm:text-4xl
                "
              >
                {greeting}, {displayName} 👋
              </h1>

              <p
                className="
                  mt-2
                  text-zinc-500
                "
              >
                A little progress each day leads to big results.
              </p>

              {/* STATS */}
              <div
                className="
                  mt-5
                  flex
                  flex-wrap
                  gap-3
                "
              >
                <StatChip
                  icon={<Flame size={17} className="text-orange-400" />}
                  value="7"
                  text="day streak"
                />

                <StatChip
                  icon={<Sparkles size={17} className="text-indigo-300" />}
                  value="1,240"
                  text="total XP"
                />

                <StatChip
                  icon={<BarChart3 size={17} className="text-violet-300" />}
                  value="Level 12"
                  text=""
                />

                <StatChip
                  icon={<Users size={17} className="text-emerald-400" />}
                  value="24"
                  text="friends online"
                />
              </div>
            </section>

            {/* PLAY CAROUSEL */}
            <DashboardPlayCarousel />

            {/* ===================================
                YOUR GAMES
            =================================== */}

            <section className="mt-6">
              <SectionHeader
                title="Your Games"
                action="View all games"
                onClick={() => navigate("/games")}
              />

              <div
                className="
                  grid
                  gap-4

                  md:grid-cols-3
                "
              >
                {gameList.slice(0, 2).map((game) => (
                  <button
                    key={game.route}
                    type="button"
                    onClick={() => navigate(game.route)}
                    className="
                        group
                        relative

                        min-h-[180px]

                        overflow-hidden

                        rounded-2xl

                        border
                        border-white/[0.08]

                        bg-[#0b1020]

                        text-left

                        transition

                        hover:-translate-y-1
                        hover:border-indigo-400/20
                      "
                  >
                    <img
                      src={game.image}
                      alt={game.name}
                      className="
                          absolute
                          inset-0

                          h-full
                          w-full

                          object-cover

                          transition
                          duration-500

                          group-hover:scale-105
                        "
                    />

                    <div
                      className="
                          absolute
                          inset-0

                          bg-gradient-to-t

                          from-black/95
                          via-black/40
                          to-transparent
                        "
                    />

                    <div
                      className="
                          relative

                          flex
                          h-full
                          min-h-[180px]
                          flex-col
                          justify-end

                          p-5
                        "
                    >
                      <h3
                        className="
                            text-xl
                            font-semibold
                          "
                      >
                        {game.name}
                      </h3>

                      <p
                        className="
                            mt-1
                            text-sm
                            text-zinc-400
                          "
                      >
                        {game.description}
                      </p>
                    </div>
                  </button>
                ))}

                {/* MORE GAMES */}
                <button
                  type="button"
                  onClick={() => navigate("/games")}
                  className="
                    group

                    flex
                    min-h-[180px]
                    flex-col
                    justify-center

                    overflow-hidden

                    rounded-2xl

                    border
                    border-indigo-400/20

                    bg-gradient-to-br
                    from-indigo-500/[0.13]
                    via-[#0c1124]
                    to-violet-500/[0.08]

                    p-6

                    text-left

                    transition

                    hover:-translate-y-1
                    hover:border-indigo-400/40
                  "
                >
                  <div
                    className="
                      flex
                      h-11
                      w-11
                      items-center
                      justify-center

                      rounded-xl

                      bg-indigo-500/15

                      text-indigo-300
                    "
                  >
                    <Trophy size={20} />
                  </div>

                  <h3
                    className="
                      mt-5
                      text-lg
                      font-semibold
                    "
                  >
                    More Games
                  </h3>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-zinc-500
                    "
                  >
                    Explore all games and discover new ones.
                  </p>

                  <ArrowRight
                    size={18}
                    className="
                      mt-4
                      text-indigo-300

                      transition-transform

                      group-hover:translate-x-1
                    "
                  />
                </button>
              </div>
            </section>

            {/* ===================================
                CONTINUE LEARNING
            =================================== */}

            <section className="mt-6">
              <SectionHeader
                title="Continue Learning"
                action="View all lessons"
                onClick={() => navigate("/learn")}
              />

              <div
                className="
                  flex
                  flex-col
                  gap-5

                  rounded-2xl

                  border
                  border-white/[0.08]

                  bg-[#0b1020]/80

                  p-5

                  sm:flex-row
                  sm:items-center
                "
              >
                <div
                  className="
                    flex
                    h-28
                    w-full
                    shrink-0
                    items-center
                    justify-center

                    rounded-xl

                    bg-gradient-to-br
                    from-amber-200/20
                    to-indigo-500/10

                    text-4xl

                    sm:w-36
                  "
                >
                  ♟
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="
                      text-xs
                      text-zinc-600
                    "
                  >
                    Chess Basics
                  </p>

                  <h3
                    className="
                      mt-1
                      font-semibold
                    "
                  >
                    Control the Center
                  </h3>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-zinc-500
                    "
                  >
                    Learn why the center is crucial and how to dominate it.
                  </p>

                  <div
                    className="
                      mt-4
                      flex
                      items-center
                      gap-3
                    "
                  >
                    <div
                      className="
                        h-1.5
                        flex-1
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
                          bg-indigo-500
                        "
                      />
                    </div>

                    <span
                      className="
                        text-xs
                        text-zinc-500
                      "
                    >
                      3 / 5
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/learn")}
                  className="
                    inline-flex
                    shrink-0
                    items-center
                    justify-center
                    gap-2

                    rounded-xl

                    bg-indigo-500

                    px-5
                    py-3

                    text-sm
                    font-semibold

                    transition

                    hover:bg-indigo-400
                  "
                >
                  Continue Lesson
                  <ArrowRight size={15} />
                </button>
              </div>
            </section>
          </div>

          {/* ===================================
              RIGHT RAIL
          =================================== */}

          <aside
            className="
              space-y-4

              xl:sticky
              xl:top-24
              xl:self-start
            "
          >
            <ProgressCard />

            <DailyChallenge />

            <FriendsOnline />
          </aside>
        </div>
      </div>
    </main>
  );
}

/* ============================================
   HELPERS
============================================ */

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function StatChip({
  icon,
  value,
  text,
}: {
  icon: React.ReactNode;
  value: string;
  text: string;
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-2.5

        rounded-xl

        border
        border-white/[0.08]

        bg-[#0b1020]/70

        px-4
        py-2.5
      "
    >
      {icon}

      <span
        className="
          text-sm
          font-semibold
          text-white
        "
      >
        {value}
      </span>

      {text && (
        <span
          className="
            text-xs
            text-zinc-500
          "
        >
          {text}
        </span>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  action,
  onClick,
}: {
  title: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div
      className="
        mb-3

        flex
        items-center
        justify-between
      "
    >
      <h2
        className="
          text-lg
          font-semibold
        "
      >
        {title}
      </h2>

      <button
        type="button"
        onClick={onClick}
        className="
          flex
          items-center
          gap-1.5

          text-xs
          font-medium
          text-indigo-300

          transition

          hover:text-indigo-200
        "
      >
        {action}

        <ArrowRight size={13} />
      </button>
    </div>
  );
}

function ProgressCard() {
  return (
    <section
      className="
        rounded-2xl

        border
        border-white/[0.08]

        bg-[#080d1c]/85

        p-5
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
        "
      >
        <h2 className="font-semibold">Your Progress</h2>

        <button
          className="
            text-xs
            text-indigo-300
          "
        >
          See details →
        </button>
      </div>

      <div
        className="
          mt-5
          flex
          items-center
          gap-5
        "
      >
        <div
          className="
            relative
            flex
            h-20
            w-20
            shrink-0
            items-center
            justify-center
            rounded-full
          "
          style={{
            background: "conic-gradient(#8b5cf6 0 42%, #1f2937 42% 100%)",
          }}
        >
          <div
            className="
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-full
              bg-[#080d1c]
            "
          >
            <span
              className="
                text-lg
                font-bold
              "
            >
              42%
            </span>
          </div>
        </div>

        <div>
          <p className="font-semibold">Keep going!</p>

          <p
            className="
              mt-1
              text-sm
              text-zinc-500
            "
          >
            You're making great progress.
          </p>
        </div>
      </div>

      <div
        className="
          mt-5
          grid
          grid-cols-3
          gap-2
        "
      >
        <SmallStat icon="🔥" value="7" label="Streak" />

        <SmallStat icon="XP" value="1,240" label="Total XP" />

        <SmallStat icon="▥" value="12" label="Level" />
      </div>
    </section>
  );
}

function SmallStat({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  return (
    <div
      className="
        rounded-xl

        border
        border-white/[0.07]

        bg-white/[0.025]

        p-3

        text-center
      "
    >
      <div className="text-sm">{icon}</div>

      <p
        className="
          mt-2
          text-sm
          font-bold
        "
      >
        {value}
      </p>

      <p
        className="
          mt-1
          text-[10px]
          text-zinc-600
        "
      >
        {label}
      </p>
    </div>
  );
}

function DailyChallenge() {
  return (
    <section
      className="
        rounded-2xl

        border
        border-white/[0.08]

        bg-[#080d1c]/85

        p-5
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
        "
      >
        <h2 className="font-semibold">Daily Challenge</h2>

        <span
          className="
            text-xs
            text-zinc-600
          "
        >
          12h left
        </span>
      </div>

      <div
        className="
          mt-4

          flex
          items-center
          gap-4

          rounded-xl

          border
          border-white/[0.07]

          bg-white/[0.025]

          p-4
        "
      >
        <div
          className="
            flex
            h-12
            w-12
            shrink-0
            items-center
            justify-center

            rounded-xl

            bg-indigo-500/20

            text-indigo-300
          "
        >
          <Target size={22} />
        </div>

        <div className="flex-1">
          <p
            className="
              text-sm
              font-semibold
            "
          >
            Win 2 games
          </p>

          <p
            className="
              mt-1
              text-xs
              text-zinc-600
            "
          >
            Any game mode
          </p>

          <div
            className="
              mt-3
              flex
              items-center
              gap-3
            "
          >
            <div
              className="
                h-1.5
                flex-1
                rounded-full
                bg-white/[0.06]
              "
            >
              <div
                className="
                  h-full
                  w-1/2
                  rounded-full
                  bg-indigo-500
                "
              />
            </div>

            <span
              className="
                text-[10px]
                text-zinc-500
              "
            >
              1/2
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function FriendsOnline() {
  const friends = [
    ["Sophie", "Playing Chess"],
    ["Lukas", "In a Watten game"],
    ["Emma", "Learning"],
    ["Noah", "Online"],
  ];

  return (
    <section
      className="
        rounded-2xl

        border
        border-white/[0.08]

        bg-[#080d1c]/85

        p-5
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
        "
      >
        <h2 className="font-semibold">Friends Online</h2>

        <span
          className="
            text-xs
            text-indigo-300
          "
        >
          View all →
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {friends.map(([name, activity]) => (
          <div
            key={name}
            className="
                flex
                items-center
                gap-3
                py-2
              "
          >
            <div
              className="
                  relative
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-white/[0.06]
                  text-xs
                  font-semibold
                "
            >
              {name[0]}

              <span
                className="
                    absolute
                    bottom-0
                    right-0

                    h-2.5
                    w-2.5

                    rounded-full

                    border-2
                    border-[#080d1c]

                    bg-emerald-400
                  "
              />
            </div>

            <div className="min-w-0 flex-1">
              <p
                className="
                    truncate
                    text-sm
                    font-medium
                  "
              >
                {name}
              </p>

              <p
                className="
                    truncate
                    text-xs
                    text-zinc-600
                  "
              >
                {activity}
              </p>
            </div>

            <button
              className="
                  rounded-lg

                  border
                  border-indigo-400/20

                  px-3
                  py-1.5

                  text-xs
                  text-indigo-300

                  transition

                  hover:bg-indigo-500/10
                "
            >
              Play
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
