import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
export default function HorrorChessRules() {
  useUiLanguage();
  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <ChessPageHeader className="mb-6 rounded-3xl border border-rose-400/15 bg-zinc-900/75 p-6 shadow-xl shadow-black/20">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-300">{ui("Chess Variant IV")}</p>

          <h1 className="mt-2 text-3xl font-black text-white">{ui("Horror Chess Rulebook")}</h1>

          <p className="mt-2 text-sm text-zinc-500">{ui("Infection, curses, fire and freezing.")}</p>

          <a
            href="/games/chess/variants/horror/hotseat"
            className="mt-5 inline-flex rounded-full border border-rose-400/15 bg-rose-400/[0.07] px-4 py-2 text-xs font-black text-rose-200 transition hover:bg-rose-400/[0.13]"
          >{ui("← Back to Horror Chess")}</a>
        </ChessPageHeader>

        <section className="mb-6 rounded-2xl border border-white/5 bg-zinc-900/55 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">{ui("Board legend")}</span>

            <HorrorLegendItem
              icon="☣"
              label={ui("Infected piece")}
              className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
            />

            <HorrorLegendItem
              icon="☠"
              label={ui("Cursed piece")}
              className="border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200"
            />

            <HorrorLegendItem
              icon="🔥"
              label={ui("Burning square")}
              className="border-orange-400/20 bg-orange-400/10 text-orange-200"
            />

            <HorrorLegendItem
              icon="❄"
              label={ui("Frozen piece")}
              className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
            />

            <HorrorLegendItem
              icon="×"
              label={ui("Doomed piece")}
              className="border-red-300/30 bg-red-400/10 text-red-200"
            />
          </div>
        </section>

        <RuleCard icon="♔" title={ui("Normal chess still decides the winner")}>{ui("Checkmate still wins. Normal draw rules also remain active. Horror effects change which pieces can move and may remove non-King pieces from the board.")}</RuleCard>

        <RuleCard icon="☣" title={ui("1. Infection")}>{ui("One White Pawn and one Black Pawn begin infected. An infected piece that moves spreads infection to one adjacent occupied non-King piece when possible. Capturing an infected piece infects the capturer. An infected piece that makes a capture also becomes cursed.")}</RuleCard>

        <RuleCard icon="☠" title={ui("2. Cursed pieces")}>{ui("One non-King piece per side begins cursed. The curse follows that piece when it moves. If a non-King piece captures a cursed piece, the capturer becomes doomed and disappears after the opponent completes their next move. Kings are not allowed to capture onto a cursed square.")}</RuleCard>

        <RuleCard icon="✹" title={ui("3. Burning squares")}>{ui("Every 8 plies — four complete moves — two currently empty squares become burning zones. They remain active for four plies. A non-King piece that lands on or passes through a burning square disappears immediately after completing the move. This happens before check/checkmate is evaluated, so a burned checking piece does not leave the King in check. Kings may neither enter nor cross burning squares, and those squares count as unavailable King escapes for checkmate.")}</RuleCard>

        <RuleCard icon="❄" title={ui("4. Knight Freeze")}>{ui("When the Knight that just moved directly attacks the enemy King, one random enemy non-King piece becomes frozen for that side's next turn. A frozen piece cannot move. A frozen rook also cannot be used as part of castling.")}</RuleCard>

        <RuleCard icon="⚠" title={ui("5. Doomed pieces")}>{ui("A dashed red frame means the piece is doomed by a curse, fire, or both. It remains on the board during the opponent's move and disappears immediately afterward if it is still alive on that square.")}</RuleCard>

        <RuleCard icon="↶" title={ui("6. Undo and history")}>{ui("Undo restores the exact board and Horror state. Infection, curses, burning squares, freezes and doomed pieces all rewind together. Historical move previews show the Horror state from that exact ply.")}</RuleCard>
      </div>
    </div>
  );
}

function RuleCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  useUiLanguage();
  return (
    <section className="mb-4 rounded-3xl border border-rose-400/10 bg-zinc-900/70 p-5 shadow-lg shadow-black/10">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-400/10 text-xl">
          {icon}
        </span>

        <div>
          <h2 className="font-black text-white">{ui(title)}</h2>

          <p className="mt-2 text-sm leading-7 text-zinc-400">{children}</p>
        </div>
      </div>
    </section>
  );
}

function HorrorLegendItem({
  icon,
  label,
  className,
}: {
  icon: string;
  label: string;
  className: string;
}) {
  useUiLanguage();
  return (
    <div className="flex items-center gap-2">
      <span
        className={`
          flex
          h-7
          w-7
          items-center
          justify-center
          rounded-lg
          border
          text-base
          font-black
          ${className}
        `}
      >
        {icon}
      </span>

      <span className="text-[10px] font-bold text-zinc-400">{ui(label)}</span>
    </div>
  );
}
