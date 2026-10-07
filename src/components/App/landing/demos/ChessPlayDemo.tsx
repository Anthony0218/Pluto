import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chess, type Square } from "chess.js";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import ChessPreviewBoard from "../../ChessPreviewBoard";
import { useCopy } from "../copy";
import { useInView } from "../useInView";
import DemoFrame from "./DemoFrame";

// The Italian Game, Møller Attack: a real opening, so every position is genuinely legal.
const line = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4", "cxd4", "Bb4+", "Nc3", "Nxe4", "O-O", "Bxc3", "bxc3", "d5"];
const modes = [
  { label: "Singleplayer", route: "/games/chess/classic/ai" },
  { label: "Multiplayer", route: "/games/chess/classic/multiplayer" },
  { label: "Hotseat", route: "/games/chess/classic/hotseat" },
];

/** A game that plays itself on a loop; step or pause it any time. */
export default function ChessPlayDemo() {
  useUiLanguage();
  const text = useCopy();
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const visible = useInView(frame);
  const positions = useMemo(() => {
    const game = new Chess();
    const result = [{ fen: game.fen(), lastMove: null as [Square, Square] | null }];
    for (const move of line) {
      const played = game.move(move);
      result.push({ fen: game.fen(), lastMove: [played.from, played.to] as [Square, Square] });
    }
    return result;
  }, []);

  useEffect(() => {
    if (!playing || held || !visible) return;
    const timer = window.setTimeout(() => setPly(current => (current >= line.length ? 0 : current + 1)), ply >= line.length ? 2600 : 1150);
    return () => window.clearTimeout(timer);
  }, [ply, playing, held, visible]);

  const current = positions[ply];
  const turn = ply % 2 === 0 ? "White to move" : "Black to move";
  return <DemoFrame tone="chess" title={ui("Chess")} href="/games/chess/classic/ai" action={text("playChess")}>
    <div ref={frame} className="chess-demo" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocusCapture={() => setHeld(true)} onBlurCapture={() => setHeld(false)}>
      <ChessPreviewBoard fen={current.fen} lastMove={current.lastMove} label={ui("Chess")} />
      <div className="chess-demo-side">
        <p className="demo-eyebrow">{ui(turn)}</p>
        <ol className="chess-demo-moves" aria-label={ui("Moves")}>
          {Array.from({ length: Math.ceil(line.length / 2) }, (_, pair) => <li key={pair}>
            <span>{pair + 1}.</span>
            {[0, 1].map(side => { const index = pair * 2 + side; return line[index] && <button key={side} type="button" aria-current={ply === index + 1 ? "step" : undefined} onClick={() => { setPlaying(false); setPly(index + 1); }}>{line[index]}</button>; })}
          </li>)}
        </ol>
        <div className="demo-controls">
          <button type="button" aria-label={ui("Previous move")} disabled={ply === 0} onClick={() => { setPlaying(false); setPly(ply - 1); }}><ChevronLeft size={16} /></button>
          <button type="button" aria-label={ui(playing ? "Pause" : "Play")} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <button type="button" aria-label={ui("Next move")} disabled={ply === line.length} onClick={() => { setPlaying(false); setPly(ply + 1); }}><ChevronRight size={16} /></button>
        </div>
        <div className="demo-chips">{modes.map(mode => <Link key={mode.route} to={mode.route}>{ui(mode.label)}</Link>)}</div>
      </div>
    </div>
  </DemoFrame>;
}
