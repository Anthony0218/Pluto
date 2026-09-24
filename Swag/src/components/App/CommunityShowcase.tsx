import { Flame, Swords, Trophy, Users } from "lucide-react";

const friends = [
  {
    name: "Anna",
    activity: "Playing Chess",
    initials: "AN",
  },
  {
    name: "Max",
    activity: "Learning",
    initials: "MX",
  },
  {
    name: "Sophie",
    activity: "Online",
    initials: "SO",
  },
];

export default function CommunityShowcase() {
  return (
    <div className="relative">
      <div
        className="
          pointer-events-none
          absolute inset-20
          bg-violet-500/[0.12]
          blur-[100px]
        "
      />

      <div
        className="
          relative
          grid gap-3
          sm:grid-cols-2
        "
      >
        {/* DAILY CHALLENGE */}
        <div
          className="
            rounded-[24px]
            border border-white/[0.08]
            bg-[#080d1c]/85
            p-5
            backdrop-blur-xl
          "
        >
          <div className="flex items-center justify-between">
            <div
              className="
                flex h-10 w-10
                items-center justify-center
                rounded-xl
                bg-amber-400/10
                text-amber-300
              "
            >
              <Flame size={18} />
            </div>

            <span
              className="
                rounded-full
                bg-amber-400/[0.08]
                px-3 py-1
                text-[10px]
                text-amber-300
              "
            >
              Daily
            </span>
          </div>

          <h3 className="mt-6 font-semibold">Daily Challenge</h3>

          <p className="mt-2 text-xs text-zinc-500">Win two games today.</p>

          <div className="mt-6">
            <div
              className="
                flex justify-between
                text-[10px] text-zinc-600
              "
            >
              <span>Progress</span>
              <span>1 / 2</span>
            </div>

            <div
              className="
                mt-2 h-1.5
                overflow-hidden
                rounded-full
                bg-white/[0.06]
              "
            >
              <div
                className="
                  h-full w-1/2
                  rounded-full
                  bg-amber-400
                "
              />
            </div>
          </div>
        </div>

        {/* TOURNAMENT */}
        <div
          className="
            rounded-[24px]
            border border-white/[0.08]
            bg-[#080d1c]/85
            p-5
            backdrop-blur-xl
          "
        >
          <div
            className="
              flex h-10 w-10
              items-center justify-center
              rounded-xl
              bg-indigo-500/10
              text-indigo-300
            "
          >
            <Trophy size={18} />
          </div>

          <h3 className="mt-6 font-semibold">Weekly Tournament</h3>

          <p className="mt-2 text-xs text-zinc-500">Blitz · 3+2</p>

          <div className="mt-6 flex items-center gap-2">
            <Users size={14} className="text-zinc-600" />

            <span className="text-xs text-zinc-400">128 players</span>
          </div>

          <button
            className="
              mt-5 w-full
              rounded-xl
              bg-indigo-500
              py-2.5
              text-xs font-semibold
              transition
              hover:bg-indigo-400
            "
          >
            Join tournament
          </button>
        </div>

        {/* FRIENDS */}
        <div
          className="
            rounded-[24px]
            border border-white/[0.08]
            bg-[#080d1c]/85
            p-5
            backdrop-blur-xl
            sm:col-span-2
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Friends online</p>

              <p className="mt-1 text-xs text-zinc-600">
                Play and learn together.
              </p>
            </div>

            <Swords size={18} className="text-indigo-300" />
          </div>

          <div className="mt-5 divide-y divide-white/[0.06]">
            {friends.map((friend) => (
              <div
                key={friend.name}
                className="
                  flex items-center
                  justify-between
                  py-3
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      relative
                      flex h-9 w-9
                      items-center justify-center
                      rounded-full
                      bg-white/[0.05]
                      text-[10px]
                      font-semibold
                    "
                  >
                    {friend.initials}

                    <span
                      className="
                        absolute
                        bottom-0 right-0
                        h-2.5 w-2.5
                        rounded-full
                        border-2
                        border-[#080d1c]
                        bg-emerald-400
                      "
                    />
                  </div>

                  <div>
                    <p className="text-xs font-medium">{friend.name}</p>

                    <p className="mt-0.5 text-[10px] text-zinc-600">
                      {friend.activity}
                    </p>
                  </div>
                </div>

                <button
                  className="
                    rounded-lg
                    border border-white/[0.08]
                    px-3 py-1.5
                    text-[10px]
                    text-zinc-400
                    transition
                    hover:bg-white/[0.05]
                    hover:text-white
                  "
                >
                  Play
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
