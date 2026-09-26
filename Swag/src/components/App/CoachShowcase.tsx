import { ui, useUiLanguage } from "@/i18n/ui";
import { Link } from "react-router-dom";
import { BrainCircuit, Check, ChevronRight, Lightbulb } from "lucide-react";

export default function CoachShowcase() {
  useUiLanguage();
  return (
    <div className="relative">
      <div
        className="
          pointer-events-none
          absolute inset-20
          bg-sky-500/[0.12]
          blur-[110px]
        "
      />

      <div
        className="
          relative
          overflow-hidden
          rounded-[28px]
          border border-white/[0.08]
          bg-[#080d1c]/85
          shadow-2xl shadow-black/30
          backdrop-blur-xl
        "
      >
        {/* TOP */}
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
                bg-sky-500/10
                text-sky-300
              "
            >
              <BrainCircuit size={18} />
            </div>

            <div>
              <p className="text-sm font-semibold">{ui("Chess Coach")}</p>

              <p className="text-[10px] text-zinc-600">{ui("Powered by Stockfish")}</p>
            </div>
          </div>

          <div
            className="
              rounded-full
              border border-emerald-400/15
              bg-emerald-400/[0.06]
              px-3 py-1
              text-[10px]
              text-emerald-300
            "
          >{ui("Example position")}</div>
        </div>

        <div
          className="
            grid
            lg:grid-cols-[1fr_0.8fr]
          "
        >
          {/* BOARD */}
          <div
            className="
              border-b border-white/[0.07]
              p-5
              lg:border-b-0
              lg:border-r
            "
          >
            <div className="flex gap-3">
              {/* EVALUATION BAR */}
              <div
                className="
                  relative
                  w-5
                  overflow-hidden
                  rounded-md
                  bg-zinc-800
                "
              >
                <div
                  className="
                    absolute bottom-0
                    h-[62%] w-full
                    bg-zinc-100
                  "
                />
              </div>

              {/* BOARD */}
              <div
                className="
                  grid
                  aspect-square
                  flex-1
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
                        relative
                        flex items-center
                        justify-center
                        text-xl
                        ${light ? "bg-[#c0c7d4]" : "bg-[#526078]"}
                      `}
                    >
                      {index === 52 && "♘"}
                      {index === 27 && "♟"}
                      {index === 60 && "♔"}

                      {index === 45 && (
                        <div
                          className="
                            absolute
                            h-3 w-3
                            rounded-full
                            bg-indigo-500/60
                          "
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="
                mt-4
                flex items-center
                justify-between
              "
            >
              <div>
                <p
                  className="
                    text-[10px]
                    uppercase tracking-[0.18em]
                    text-zinc-600
                  "
                >{ui("Evaluation")}</p>

                <p className="mt-1 text-lg font-bold text-white">+0.8</p>
              </div>

              <div className="text-right">
                <p className="text-xs text-zinc-600">{ui("Best move")}</p>

                <p className="mt-1 font-mono text-lg font-semibold">{ui("Nf3")}</p>
              </div>
            </div>
          </div>

          {/* COACH EXPLANATION */}
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div
                className="
                  flex h-9 w-9
                  shrink-0
                  items-center justify-center
                  rounded-xl
                  bg-indigo-500/10
                  text-indigo-300
                "
              >
                <Lightbulb size={17} />
              </div>

              <div>
                <p className="text-xs text-zinc-500">{ui("Coach says")}</p>

                <h3 className="mt-1 font-semibold">{ui("Develop your knight.")}</h3>
              </div>
            </div>

            <p
              className="
                mt-5
                text-sm leading-6
                text-zinc-500
              "
            >{ui("Nf3 improves your position while developing a piece toward the center and preparing to castle.")}</p>

            <div className="mt-6 space-y-3">
              <Reason text={ui("Develops a minor piece")} />
              <Reason text={ui("Controls central squares")} />
              <Reason text={ui("Prepares kingside castling")} />
            </div>

            <Link
              to="/games/chess/classic/ai"
              className="
                group
                mt-7
                flex w-full
                items-center justify-between
                rounded-xl
                border border-white/[0.07]
                bg-white/[0.025]
                px-4 py-3
                text-left
                transition
                hover:bg-white/[0.05]
              "
            >
              <span className="text-xs font-medium">{ui("Practice with Stockfish")}</span>

              <ChevronRight
                size={15}
                className="
                  text-zinc-600
                  transition
                  group-hover:translate-x-0.5
                "
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Reason({ text }: { text: string }) {
  useUiLanguage();
  return (
    <div className="flex items-center gap-3">
      <div
        className="
          flex h-5 w-5
          items-center justify-center
          rounded-full
          bg-emerald-400/10
          text-emerald-300
        "
      >
        <Check size={11} />
      </div>

      <span className="text-xs text-zinc-400">{ui(text)}</span>
    </div>
  );
}
