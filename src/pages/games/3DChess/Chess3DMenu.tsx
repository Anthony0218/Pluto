import { ArrowRight, Bot, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { CHESS_3D_DIFFICULTIES, type Chess3DDifficulty } from "@/games/chess/3d/chess3dDifficulty";
import { ui, useUiLanguage } from "@/i18n/ui";

export default function Chess3DMenu() {
  useUiLanguage();
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Chess3DDifficulty>("medium");
  const selected = CHESS_3D_DIFFICULTIES.find(entry => entry.id === difficulty)!;

  return (
    <main className="chess-menu-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_76%,rgba(14,165,233,.13),transparent_29%),radial-gradient(circle_at_84%_20%,rgba(139,92,246,.12),transparent_27%),linear-gradient(to_bottom,#090d16,#07090b_58%,#030509)]" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 text-[330px] leading-none text-sky-100/[0.025]">♞</div>
      <div className="pointer-events-none absolute right-[-42px] top-[16%] text-[265px] leading-none text-violet-100/[0.025]">♜</div>

      <div className="relative flex min-h-[var(--app-height)] w-full flex-col">
        <ChessPageHeader className="chess-menu-header" title="3D Chess" />
        <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(340px,.82fr)_minmax(520px,1.18fr)]">
          <header className="relative flex min-h-[360px] flex-col justify-center px-7 py-12 sm:px-10 lg:min-h-0 lg:px-14 xl:px-20">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />
            <div className="max-w-[560px]">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-sky-200"><Sparkles size={13} aria-hidden="true" />{ui("3D Chess")}</div>
              <h1 className="font-serif text-[50px] leading-[.96] tracking-[-0.035em] text-white sm:text-[66px] xl:text-[78px]">{ui("Choose your")}<br /><span className="text-sky-200">{ui("game mode")}</span></h1>
              <p className="mt-6 max-w-[490px] font-serif text-[18px] leading-8 text-zinc-400 sm:text-[20px]">{ui("Play cinematic 3D chess locally or challenge Stockfish with the same five difficulty levels used across the rest of the chess modes.")}</p>
            </div>
            <div className="mt-10 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-600"><span className="h-px w-14 bg-sky-300/50" />{ui("Local play · Computer opponent")}</div>
          </header>

          <div className="relative flex min-h-[560px] items-center border-t border-white/[0.06] px-5 py-8 sm:px-8 lg:min-h-0 lg:border-t-0 lg:px-10 xl:px-14">
            <div className="mx-auto grid w-full max-w-[900px] gap-4 xl:gap-5">
              <button type="button" onClick={() => navigate("/games/chess/3dchess/hotseat")} className="group relative overflow-hidden rounded-[22px] border border-sky-300/35 bg-sky-400/[0.04] text-left shadow-[0_16px_40px_rgba(0,0,0,.22)] transition duration-300 hover:-translate-y-0.5 hover:border-sky-200/70 hover:shadow-[0_18px_55px_rgba(14,165,233,.12)]">
                <img src="/images/chess3d.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 transition duration-500 group-hover:scale-105 group-hover:opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#090d16] via-[#090d16]/90 to-[#090d16]/35" />
                <div className="relative flex items-center gap-4 p-5 sm:gap-6 sm:p-6 xl:p-7">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-300/[0.09] text-sky-100 shadow-inner sm:h-[74px] sm:w-[74px]"><Users size={30} aria-hidden="true" /></div>
                  <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[0.26em] text-sky-200/80">{ui("Face to face")}</p><h2 className="mt-1.5 font-serif text-[28px] leading-tight text-white sm:text-[33px]">{ui("Hotseat")}</h2><p className="mt-2 max-w-[590px] text-sm leading-6 text-zinc-300 sm:text-[15px]">{ui("Share one device and play on the full animated 3D board.")}</p><p className="mt-3 text-[8px] font-black uppercase tracking-[0.24em] text-sky-100/45">{ui("3D Pieces · Capture FX · Undo")}</p></div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sky-300/40 text-sky-200 transition duration-300 group-hover:translate-x-1 sm:h-12 sm:w-12"><ArrowRight size={20} aria-hidden="true" /></span>
                </div>
              </button>

              <section className="overflow-hidden rounded-[22px] border border-violet-300/30 bg-violet-400/[0.04] shadow-[0_16px_40px_rgba(0,0,0,.22)]">
                <div className="flex items-start gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-6 xl:px-7"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-300/[0.09] text-violet-100 shadow-inner"><Bot size={30} aria-hidden="true" /></div><div><p className="text-[9px] font-black uppercase tracking-[0.26em] text-violet-200/80">{ui("Challenge the engine")}</p><h2 className="mt-1.5 font-serif text-[28px] leading-tight text-white sm:text-[33px]">{ui("Vs Stockfish")}</h2><p className="mt-2 text-sm leading-6 text-zinc-400">{ui("You play White. Choose how strong and consistent Stockfish should be.")}</p></div></div>
                <div className="p-5 sm:p-6 xl:p-7"><div className="grid gap-2 sm:grid-cols-2">{CHESS_3D_DIFFICULTIES.map(entry => {
                  const active = entry.id === difficulty;
                  return <button key={entry.id} type="button" onClick={() => setDifficulty(entry.id)} aria-pressed={active} className={`rounded-xl border px-4 py-3 text-left transition ${active ? "border-violet-300/60 bg-violet-300/[0.14] shadow-lg shadow-violet-950/20" : "border-white/10 bg-black/20 hover:border-violet-300/30 hover:bg-white/[0.05]"}`}><div className="flex items-center justify-between gap-3"><span className="font-bold text-white">{ui(entry.label)}</span>{active && <span className="h-2.5 w-2.5 rounded-full bg-violet-200 shadow-[0_0_12px_rgba(196,181,253,.8)]" />}</div><p className="mt-1 text-xs leading-5 text-zinc-400">{ui(entry.description)}</p></button>;
                })}</div><button type="button" onClick={() => navigate(`/games/chess/3dchess/ai?difficulty=${difficulty}`)} className="mt-5 flex w-full items-center justify-between rounded-xl bg-violet-300 px-5 py-4 text-sm font-black text-violet-950 shadow-lg shadow-violet-950/30 transition hover:bg-violet-200"><span>{ui("Play vs ")}{ui(selected.label)}{ui(" Stockfish")}</span><ArrowRight size={20} aria-hidden="true" /></button></div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
