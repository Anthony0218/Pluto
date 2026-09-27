import { ui, useUiLanguage } from "@/i18n/ui";
type PromotionBarProps = {
  onPromote: (piece: "q" | "r" | "b" | "n") => void;
};

const promotionPieces = [
  {
    type: "q",
    symbol: "♕",
    label: "Queen",
  },
  {
    type: "r",
    symbol: "♖",
    label: "Rook",
  },
  {
    type: "b",
    symbol: "♗",
    label: "Bishop",
  },
  {
    type: "n",
    symbol: "♘",
    label: "Knight",
  },
] as const;

export default function PromotionBar({ onPromote }: PromotionBarProps) {
  useUiLanguage();
  return (
    <div
      className="
        absolute
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        rounded-xl
        bg-black/45
        p-4
        backdrop-blur-[4px]
      "
    >
      <div
        className="
          w-full
          max-w-md
          rounded-3xl
          border
          border-white/10
          bg-zinc-900/95
          p-6
          shadow-2xl
          shadow-black/60
        "
      >
        <div className="text-center">
          <div
            className="
              mx-auto
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-2xl
              border
              border-amber-400/20
              bg-amber-400/10
              text-2xl
            "
          >
            ♙
          </div>

          <p
            className="
              mt-4
              text-[10px]
              font-black
              uppercase
              tracking-[0.25em]
              text-amber-300
            "
          >{ui("Pawn Promotion")}</p>

          <h3
            className="
              mt-1
              text-xl
              font-black
              text-white
            "
          >{ui("Choose your piece")}</h3>

          <p className="mt-1 text-sm text-zinc-500">{ui("Select the piece your pawn should become.")}</p>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-3">
          {promotionPieces.map((piece) => (
            <button
              key={piece.type}
              type="button"
              onClick={() => onPromote(piece.type)}
              className="
                group
                flex
                flex-col
                items-center
                justify-center
                rounded-2xl
                border
                border-white/10
                bg-white/[0.04]
                px-2
                py-4
                transition

                hover:-translate-y-1
                hover:border-amber-400/30
                hover:bg-amber-400/10
                hover:shadow-lg
                hover:shadow-amber-950/40

                active:translate-y-0
                active:scale-95
              "
            >
              <span
                className="
                  text-5xl
                  leading-none
                  text-[#fff3d5]
                  drop-shadow-lg
                  transition
                  group-hover:scale-110
                "
              >
                {piece.symbol}
              </span>

              <span
                className="
                  mt-3
                  text-[10px]
                  font-black
                  uppercase
                  tracking-wider
                  text-zinc-500
                  transition
                  group-hover:text-amber-200
                "
              >
                {ui(piece.label)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
