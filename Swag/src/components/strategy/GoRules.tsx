import { useState } from "react";
import { Link } from "react-router-dom";

const topics = [
  {
    id: "turns",
    label: "Turns",
    title: "Place stones on intersections",
    body: "Black plays first. Players alternate placing one stone on an empty intersection. Stones never move after placement.",
    tip: "You may pass when no useful move remains. Two consecutive passes end the game.",
  },
  {
    id: "capture",
    label: "Captures",
    title: "Remove groups with no liberties",
    body: "Connected stones share liberties. When the final adjacent empty intersection is filled by the opponent, the entire group is captured.",
    tip: "Select the steps below to see White lose its final liberty.",
  },
  {
    id: "ko",
    label: "Ko",
    title: "Positions may not repeat",
    body: "Pluto uses positional superko: a move is illegal if it recreates any earlier board position. Suicide is also forbidden unless the move captures first.",
    tip: "Superko prevents endless capture loops while preserving ordinary tactical ko fights.",
  },
  {
    id: "score",
    label: "Scoring",
    title: "Stones plus surrounded territory",
    body: "Chinese area scoring counts your stones and empty intersections surrounded only by your color. White receives 6.5 komi.",
    tip: "Capture disputed dead stones before both players pass; the final score is then deterministic.",
  },
] as const;

const point = (row: number, col: number) => row * 5 + col;

export default function GoRules() {
  const [topic, setTopic] = useState<(typeof topics)[number]["id"]>("turns");
  const [step, setStep] = useState(0);
  const selected = topics.find((item) => item.id === topic)!;
  const black = new Set([point(1, 2), point(2, 1), point(2, 3), ...(step ? [point(3, 2)] : [])]);
  const white = new Set([point(2, 2)]);

  return (
    <main className="relative left-1/2 h-[calc(100dvh-4rem)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] px-4 py-4 text-zinc-100 sm:px-7 sm:py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(245,158,11,.11),transparent_30%),linear-gradient(to_bottom,#0b0e11,#050607)]" />
      <div className="relative mx-auto flex h-full max-w-6xl flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4">
          <Link to="/games/go" className="text-sm text-zinc-500 transition hover:text-white">← Go</Link>
          <p className="text-[10px] font-black uppercase tracking-[.28em] text-amber-400">Chinese area rules</p>
        </header>

        <div className="grid min-h-0 flex-1 items-center gap-4 py-3 md:grid-cols-[minmax(260px,.78fr)_minmax(360px,1.22fr)] md:gap-8">
          <section className="min-h-0">
            <p className="text-[10px] font-black uppercase tracking-[.28em] text-zinc-600">How to play</p>
            <h1 className="mt-2 font-serif text-4xl text-white sm:text-5xl">Go rules</h1>
            <div className="mt-4 grid grid-cols-4 gap-1.5" role="tablist" aria-label="Go rule topics">
              {topics.map((item) => (
                <button key={item.id} type="button" role="tab" aria-selected={topic === item.id} onClick={() => setTopic(item.id)} className={"min-h-10 rounded-xl border px-2 text-xs font-bold transition " + (topic === item.id ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-white/10 bg-white/5 text-zinc-500 hover:text-white")}>{item.label}</button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
              <h2 className="font-serif text-2xl text-white sm:text-3xl">{selected.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{selected.body}</p>
              <p className="mt-3 border-l-2 border-amber-400/60 pl-3 text-xs leading-5 text-zinc-500">{selected.tip}</p>
            </div>
          </section>

          <section className="flex min-h-0 items-center justify-center gap-4" aria-label="Interactive capture example">
            <div className="w-[min(48vw,42dvh,390px)] min-w-48 rounded-xl border-8 border-[#75451d] bg-[#d7a657] p-[8%] shadow-2xl">
              <div className="grid aspect-square grid-cols-5 grid-rows-5">
                {Array.from({ length: 25 }, (_, index) => {
                  const row = Math.floor(index / 5), col = index % 5;
                  const captured = step === 2 && white.has(index);
                  return <div key={index} className="relative flex items-center justify-center">
                    <span className={"absolute top-1/2 h-px bg-[#392612] " + (col === 0 ? "left-1/2 w-1/2" : col === 4 ? "right-1/2 w-1/2" : "left-0 w-full")} />
                    <span className={"absolute left-1/2 w-px bg-[#392612] " + (row === 0 ? "top-1/2 h-1/2" : row === 4 ? "bottom-1/2 h-1/2" : "top-0 h-full")} />
                    {black.has(index) && <span className="relative h-[72%] w-[72%] rounded-full bg-zinc-950 shadow-md" />}
                    {white.has(index) && !captured && <span className="relative h-[72%] w-[72%] rounded-full bg-zinc-50 shadow-md" />}
                    {captured && <span className="relative h-[28%] w-[28%] rounded-full border-2 border-red-700/70" />}
                  </div>;
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((value) => <button key={value} type="button" onClick={() => setStep(value)} aria-label={"Capture example step " + (value + 1)} className={"flex h-11 w-11 items-center justify-center rounded-full border text-sm font-black " + (step === value ? "border-amber-300 bg-amber-300 text-black" : "border-white/15 bg-white/5 text-zinc-400")}>{value + 1}</button>)}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
