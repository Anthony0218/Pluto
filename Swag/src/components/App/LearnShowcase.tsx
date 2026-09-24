import { BookOpen, Check, Circle, Lightbulb } from "lucide-react";

const lessons = [
  {
    number: "01",
    title: "The board",
    done: true,
  },
  {
    number: "02",
    title: "Piece movement",
    done: true,
  },
  {
    number: "03",
    title: "Control the center",
    active: true,
  },
  {
    number: "04",
    title: "Development",
  },
  {
    number: "05",
    title: "First challenge",
  },
];

export default function LearnShowcase() {
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
          overflow-hidden
          rounded-[28px]
          border border-white/[0.08]
          bg-[#080d1c]/80
          shadow-2xl shadow-black/30
          backdrop-blur-xl
        "
      >
        {/* HEADER */}
        <div
          className="
            flex items-center
            justify-between
            border-b border-white/[0.07]
            px-5 py-4
          "
        >
          <div className="flex items-center gap-3">
            <div
              className="
                flex h-9 w-9
                items-center justify-center
                rounded-xl
                bg-violet-500/10
                text-violet-300
              "
            >
              <BookOpen size={17} />
            </div>

            <div>
              <p className="text-sm font-semibold">Chess Basics</p>

              <p className="text-[10px] text-zinc-600">Beginner course</p>
            </div>
          </div>

          <span className="text-xs text-zinc-500">42%</span>
        </div>

        <div className="grid md:grid-cols-[0.7fr_1.3fr]">
          {/* LESSON LIST */}
          <div
            className="
              border-b border-white/[0.07]
              p-4
              md:border-b-0
              md:border-r
            "
          >
            <p
              className="
                mb-3 px-2
                text-[10px] font-bold
                uppercase tracking-[0.18em]
                text-zinc-600
              "
            >
              Lessons
            </p>

            <div className="space-y-1">
              {lessons.map((lesson) => (
                <div
                  key={lesson.number}
                  className={`
                    flex items-center gap-3
                    rounded-xl
                    px-3 py-3
                    ${
                      lesson.active
                        ? "bg-indigo-500/10 text-white"
                        : "text-zinc-500"
                    }
                  `}
                >
                  <span className="w-5 text-[10px]">{lesson.number}</span>

                  <span className="flex-1 text-xs font-medium">
                    {lesson.title}
                  </span>

                  {lesson.done ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : (
                    <Circle
                      size={12}
                      className={
                        lesson.active ? "text-indigo-300" : "text-zinc-700"
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* LESSON */}
          <div className="p-5 sm:p-6">
            <p
              className="
                text-[10px] font-bold
                uppercase tracking-[0.2em]
                text-indigo-300
              "
            >
              Lesson 03
            </p>

            <h3 className="mt-2 text-xl font-bold">Control the Center</h3>

            <p
              className="
                mt-2 text-sm
                leading-6 text-zinc-500
              "
            >
              Learn why central squares give your pieces more influence over the
              board.
            </p>

            {/* SIMPLE CHESSBOARD */}
            <div
              className="
                mx-auto mt-6
                grid
                aspect-square
                max-w-[280px]
                grid-cols-8
                overflow-hidden
                rounded-xl
                border border-white/10
              "
            >
              {Array.from({ length: 64 }).map((_, index) => {
                const row = Math.floor(index / 8);
                const col = index % 8;

                const light = (row + col) % 2 === 0;

                return (
                  <div
                    key={index}
                    className={`
                      flex items-center
                      justify-center
                      text-lg
                      ${light ? "bg-[#bbc4d4]" : "bg-[#57647b]"}
                    `}
                  >
                    {index === 27 && "♙"}
                    {index === 36 && "♟"}
                    {index === 57 && "♘"}
                  </div>
                );
              })}
            </div>

            <div
              className="
                mt-5
                flex items-start gap-3
                rounded-xl
                border border-indigo-400/10
                bg-indigo-500/[0.05]
                p-4
              "
            >
              <Lightbulb
                size={17}
                className="mt-0.5 shrink-0 text-indigo-300"
              />

              <div>
                <p className="text-xs font-semibold">Key idea</p>

                <p
                  className="
                    mt-1 text-xs
                    leading-5 text-zinc-500
                  "
                >
                  Central pieces usually have more available moves and influence
                  more squares.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESS */}
        <div className="border-t border-white/[0.07] px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Course progress</span>

            <span className="text-xs text-zinc-400">2 / 5</span>
          </div>

          <div
            className="
              mt-3 h-1.5
              overflow-hidden
              rounded-full
              bg-white/[0.06]
            "
          >
            <div
              className="
                h-full w-[42%]
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
  );
}
