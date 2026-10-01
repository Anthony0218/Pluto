import type { PendingPromotion } from "@/games/chess/custom/editor/usePieceSelection";
import type { GameVariant, Move, TeamId } from "@/games/chess/custom/engine/types";
import { ui } from "@/i18n/ui";
import PieceToken from "../PieceToken";

export default function PromotionPicker({ pending, variant, team, onChoose }: { pending: PendingPromotion; variant: GameVariant; team: TeamId; onChoose: (move: Move | null) => void }) {
  const teamDef = variant.teams.find((entry) => entry.id === team);
  return (
    <div role="dialog" aria-label={ui("Choose a promotion")} className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="rounded-2xl border border-amber-300/30 bg-[#101318] p-4 shadow-2xl">
        <p className="mb-3 text-center text-xs font-black uppercase tracking-[0.2em] text-amber-200">{ui("Promote to")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {pending.moves.map((move) => {
            const def = variant.pieces.find((piece) => piece.id === move.promotion);
            return (
              <button key={move.promotion} type="button" onClick={() => onChoose(move)} className="flex w-20 flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-200 transition hover:border-amber-300/50 hover:bg-amber-300/10">
                <span className="h-12 w-12"><PieceToken def={def} team={teamDef} /></span>
                {def?.name}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => onChoose(null)} className="mt-3 w-full text-center text-xs text-zinc-500 hover:text-white">
          {ui("Cancel")}
        </button>
      </div>
    </div>
  );
}
