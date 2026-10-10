import { gameUi } from "../../../i18n/gameUi.ts";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import { JANMANN } from "@/games/chess/janmann/config";
import JanmannGambitArtwork from "../JanmannGambitArtwork";
import UserLink from "@/components/social/UserLink";

export function RulesContent() {
  return <div className="space-y-5 text-sm leading-7 text-zinc-300">
    <p>{ui("An ordinary chessboard asks where a piece stands. Janmann’s Gambit asks how much space that position implies.")}</p>
    <p>{ui("Eight triangular sectors contain ten Dividends each: 80 playable surfaces with 3 m³ each. The Dividends are the board. Flat and sphere are two views of the same game.")}</p>
    <div><h3 className="font-serif text-lg text-amber-100">{ui("Move · control · extract")}</h3>
      <p>{ui("Make one legal move, then extract 1 m³ from any uncontested Dividend occupied by your side, or preserve the board and end your turn. Attacks and occupation establish control; attacks by both sides make a Dividend contested.")}</p>
      <p>{ui("The final extraction destroys the Dividend and sacrifices its occupant. A king cannot take the last unit. Extraction may never leave your king in check.")}</p>
    </div>
    <div><h3 className="font-serif text-lg text-amber-100">{ui("Movement across the sphere")}</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>{ui("King: one neighboring Dividend, never into check.")}</li>
        <li>{ui("Rook: follow an axis ring in either direction, including across sector seams.")}</li>
        <li>{ui("Bishop: follow a diagonal ring in either direction. Queen: combine rook and bishop rings.")}</li>
        <li>{ui("Knight: two steps along a rook ring, then one branching step off that ring. Jumps work in either direction.")}</li>
        <li>{ui("Pawn: one connection toward the opposing cap; capture on either of two forward diagonal connections. Promote to queen, rook, bishop or knight on the opposing cap. No double step, en passant or castling.")}</li>
      </ul>
      <p className="mt-2">{ui("No piece may land on a Void. Sliding pieces can trace through a Void; occupied Dividends block them. The highlighted destinations are legal moves, including king safety.")}</p>
    </div>
    <div><h3 className="font-serif text-lg text-amber-100">{ui("Two paths to victory")}</h3>
      <p>{ui("Checkmate wins immediately. Otherwise, end a turn with at least 50 m³ extracted and at least five secured sectors to win by Volumetric Dominance. A sector is secured when you control more non-Void Dividends than your opponent. Contested Dividends and ties count for neither side. No legal moves without check is stalemate.")}</p>
    </div>
    <div><h3 className="font-serif text-lg text-amber-100">{ui("The Janmann Principle")}</h3>
      <p>{ui("50 surface units = 50 m³ is an invented game law. The volume you gain is the surface you lose.")}</p>
      <p>{ui("Measure reveals Vouter − Vinner − Vangle in cubic metres. Vangle is the volume removed by a solid-angle selection. Measurement, camera movement and sphere assembly never consume a turn or change the game.")}</p>
    </div>
    <p className="border-l border-amber-200/30 pl-4 font-serif italic text-amber-100">{ui("“A square is merely a volume that has not yet considered its options.” — The Janmann Principle (fictional)")}</p>
    <p className="text-xs text-zinc-400">{ui("Fixed Community variant by Yannick. Local two-player hotseat. Not configurable.")}</p>
  </div>;
}

export default function JanmannRules() {
  useUiLanguage();
  return <main className="mx-auto max-w-5xl px-4 py-8 text-zinc-100">
    <Link to="/chess-custom/community" className="text-sm text-zinc-400">← {ui("Community")}</Link>
    <div className="mt-6 grid gap-8 md:grid-cols-[280px_1fr]">
      <div className="h-96 overflow-hidden rounded-2xl border border-amber-100/20"><JanmannGambitArtwork /></div>
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-200">{ui("Not configurable")} · {ui("Experimental")}</p>
        <h1 className="mt-2 font-serif text-4xl">{gameUi(JANMANN.name)}</h1>
        <p className="mt-1 text-sm text-zinc-400">{ui("by")} <UserLink username={JANMANN.author} className="font-semibold text-zinc-200">{gameUi(JANMANN.author)}</UserLink></p>
        <h2 className="mb-5 mt-5 font-serif text-2xl text-amber-100">{ui("Think differently...")}</h2>
        <RulesContent />
        <Link to="/chess-custom/janmanns-gambit" className="mt-6 inline-flex rounded-xl bg-amber-200 px-5 py-3 font-semibold text-zinc-950">{ui("Play")}</Link>
      </div>
    </div>
  </main>;
}
