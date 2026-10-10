import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useCardTheme } from "@/context/CardThemeContext";
import {
  WATTEN_CARD_CLIP,
  type WattenCard as WattenCardType,
} from "@/utils/watten";
import { getWattenCardImage } from "@/utils/WattenCardImages";
import { playHoverSound } from "./WattenGame";
import { ui } from "@/i18n/ui";

type WattenCardProps = {
  card: WattenCardType;

  selected?: boolean;

  disabled?: boolean;
  invalid?: boolean;
  requiredChoice?: boolean;

  hint?: string;

  helpStatus?: "winning" | "losing";

  onClick?: () => void;
};

export default function WattenCard({
  card,
  selected = false,
  disabled = false,
  invalid = false,
  requiredChoice = false,
  hint,
  helpStatus,
  onClick,
}: WattenCardProps) {
  useGameLanguage();
  const { cardTheme } = useCardTheme();

  const imageSrc = getWattenCardImage(card, cardTheme);

  return (
    <button
      type="button"
      onMouseEnter={playHoverSound}
      disabled={disabled || invalid}
      onClick={onClick}
      title={
        invalid
          ? ui("Trump or Critical: play a trump or critical card.")
          : undefined
      }
      className={`
        group relative
        h-32 w-[84px]
        shrink-0
        transition-all duration-150

        ${
          invalid
            ? "wt-card-locked"
            : helpStatus === "winning"
              ? `
                cursor-pointer
                ring-4 ring-green-500
                shadow-[0_0_18px_rgba(34,197,94,0.55)]
                hover:z-20
                hover:-translate-y-3
                hover:scale-105
              `
              : helpStatus === "losing"
                ? `
                  cursor-pointer
                  ring-2 ring-red-500
                  shadow-[0_0_14px_rgba(239,68,68,0.35)]
                  hover:z-20
                  hover:-translate-y-3
                  hover:scale-105
                `
                : requiredChoice
                  ? `
                    cursor-pointer
                    ring-2 ring-emerald-400
                    shadow-[0_0_12px_rgba(52,211,153,0.3)]
                    hover:z-20
                    hover:-translate-y-3
                    hover:scale-105
                  `
                  : selected
                    ? `
                      -translate-y-3
                      ring-2 ring-indigo-400
                      shadow-lg
                    `
                    : `
                      cursor-pointer
                      hover:z-20
                      hover:-translate-y-3
                      hover:scale-105
                      hover:shadow-xl
                    `
        }

        ${disabled && !invalid ? "cursor-not-allowed opacity-60" : ""}
      `}
    >
      {/* Card image */}
      <div className="relative h-full w-full">
        <img
          src={imageSrc}
          alt={gameUi(`${card.suit} ${card.rank}`)}
          draggable={false}
          style={{
            clipPath: WATTEN_CARD_CLIP,
          }}
          className="
      h-full
      w-full
      select-none
      object-fill
      rounded-[6px]
      drop-shadow-md
    "
        />
      </div>

      {/* Locked: this card may not be played now (Trumpf oder Kritisch), as in Schafkopf */}
      {invalid && <span className="wt-card-lock" aria-hidden="true">🔒 {ui("Locked")}</span>}

      {/* Beginner/help mode tooltip */}
      {hint && !invalid && (
        <div
          className="
            pointer-events-none
            absolute
            bottom-full
            left-1/2
            z-[100]
            mb-3
            hidden
            w-52
            -translate-x-1/2
            rounded-lg
            border
            border-amber-300/40
            bg-zinc-950
            px-3
            py-2
            text-center
            text-xs
            font-semibold
            leading-5
            text-amber-200
            shadow-xl

            group-hover:block
          "
        >
          {gameUi(hint)}

          {/* Tooltip arrow */}
          <div
            className="
              absolute
              left-1/2
              top-full
              -translate-x-1/2
              border-4
              border-transparent
              border-t-zinc-950
            "
          />
        </div>
      )}
    </button>
  );
}
