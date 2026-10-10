import { gameUi } from "../../../i18n/gameUi.ts";
import { createPortal } from "react-dom";
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

  const promotionDialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pawn-promotion-title"
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-[5px] sm:p-6"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-amber-300/20 bg-zinc-950/95 p-4 shadow-2xl shadow-black/70 ring-1 ring-white/5 sm:p-6"
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
            id="pawn-promotion-title"
            className="
              mt-1
              text-lg
              font-black
              text-white
              sm:text-xl
            "
          >{ui("Choose your piece")}</h3>

          <p className="mt-1 text-sm text-zinc-500">{ui("Select the piece your pawn should become.")}</p>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1.5 sm:mt-6 sm:gap-3">
          {promotionPieces.map((piece) => (
            <button
              key={piece.type}
              type="button"
              aria-label={ui(piece.label)}
              onClick={(event) => {
                event.stopPropagation();
                onPromote(piece.type);
              }}
              className="
                group
                flex
                min-h-20
                min-w-0
                flex-col
                items-center
                justify-center
                rounded-2xl
                border
                border-white/10
                bg-white/[0.04]
                px-1
                py-3
                transition

                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-amber-300
                sm:min-h-28
                sm:px-2
                sm:py-4

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
                  text-4xl
                  leading-none
                  text-[#fff3d5]
                  drop-shadow-lg
                  transition
                  group-hover:scale-110
                  sm:text-5xl
                "
              >
                {gameUi(piece.symbol)}
              </span>

              <span
                className="
                  mt-2
                  max-w-full
                  truncate
                  text-[8px]
                  font-black
                  uppercase
                  tracking-wide
                  text-zinc-500
                  transition
                  group-hover:text-amber-200
                  sm:mt-3
                  sm:text-[10px]
                  sm:tracking-wider
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

  return typeof document === "undefined"
    ? promotionDialog
    : createPortal(promotionDialog, document.body);
}
