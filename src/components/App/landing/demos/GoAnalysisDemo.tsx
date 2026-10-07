import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { applyGoMove } from "@/games/go/rules";
import GoBoard from "@/components/strategy/GoBoard";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCopy } from "../copy";
import DemoFrame from "./DemoFrame";
import { qualityOf, sampleCandidates, sampleGame, sampleStates, sampleWinrate } from "./goDemoData";

const qualityColors = { "AI Move": "#34d399", Good: "#7dd3fc", Inaccuracy: "#fcd34d", Mistake: "#fb923c", Blunder: "#f87171" } as const;
const W = 260;
const H = 84;

/** Step through a sample game and see the win rate swing, with three candidate moves per position. Sample data, not a live engine. */
export default function GoAnalysisDemo() {
  useUiLanguage();
  const text = useCopy();
  const states = useMemo(() => sampleStates(), []);
  const [ply, setPly] = useState(10);
  const [chosen, setChosen] = useState<number | null>(null);
  const playedState = states[ply];
  const beforeState = states[Math.max(0, ply - 1)];
  const winrate = sampleWinrate[ply];
  const candidates = useMemo(() => sampleCandidates(beforeState, sampleWinrate[Math.max(0, ply - 1)]), [beforeState, ply]);
  const state = chosen === null ? playedState : applyGoMove(beforeState, candidates[chosen].move);
  const mover = ply % 2 === 1 ? 1 : -1; // who played the move that led here: Black on odd plies
  const change = ply ? (sampleWinrate[ply] - sampleWinrate[ply - 1]) * mover : 0;
  const quality = qualityOf(change);
  const point = (index: number) => `${(index / (sampleWinrate.length - 1)) * W},${H - (sampleWinrate[index] / 100) * H}`;
  const line = sampleWinrate.map((_, index) => point(index)).join(" ");
  const go = (next: number) => { setPly(Math.max(0, Math.min(sampleGame.length, next))); setChosen(null); };

  return <DemoFrame tone="go" title={ui("Go Analysis")} href="/games/go/analysis" action={text("analyzeGo")}>
    <div className="go-demo">
      <GoBoard state={state} onMove={() => undefined} disabled />
      <div className="go-demo-side">
        <p className="demo-eyebrow">{text("sampleAnalysis")}</p>
        <figure className="go-chart" aria-label={`${text("winrate")}: ${winrate}%`}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true">
            <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#ffffff22" strokeDasharray="3 4" />
            <polyline points={`0,${H} ${line} ${W},${H}`} fill="#a5b4fc22" stroke="none" />
            <polyline points={line} fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinejoin="round" />
            <circle cx={point(ply).split(",")[0]} cy={point(ply).split(",")[1]} r="4.5" fill="#fff" stroke="#6366f1" strokeWidth="2" />
          </svg>
          <figcaption>{text("winrate")} · {ui("Black")} <strong>{winrate}%</strong></figcaption>
        </figure>
        {ply > 0 && <p className="demo-quality" style={{ "--quality": qualityColors[quality] } as React.CSSProperties}><span />{ui(quality)}<small>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</small></p>}
        {ply > 0 && <button type="button" className="go-move-row" aria-pressed={chosen === null} onClick={() => setChosen(null)}><span>{ui("Current Move")} · {sampleGame[ply - 1]}</span><small>{ui(chosen === null ? "On the board" : "Click to show")}</small></button>}
        <ul className="go-candidates" aria-label={text("candidates")}>
          {candidates.map((candidate, index) => <li key={candidate.label}><button type="button" aria-pressed={chosen === index} onClick={() => setChosen(index)}><b>{index + 1}</b>{candidate.label}<span>{candidate.winrate}%</span></button></li>)}
        </ul>
        <div className="demo-controls">
          <button type="button" aria-label={ui("Start of game")} onClick={() => go(0)}><RotateCcw size={15} /></button>
          <button type="button" aria-label={ui("Previous move")} disabled={ply === 0} onClick={() => go(ply - 1)}><ChevronLeft size={16} /></button>
          <span className="demo-count">{ply}/{sampleGame.length}</span>
          <button type="button" aria-label={ui("Next move")} disabled={ply === sampleGame.length} onClick={() => go(ply + 1)}><ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  </DemoFrame>;
}
