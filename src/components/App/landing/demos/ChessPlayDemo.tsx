import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Chess, type Square } from "chess.js";
import { Bot, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Undo2, User } from "lucide-react";
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

const START_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const GLYPHS: Record<"w" | "b", Record<string, string>> = { w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕" }, b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" } };

/** Pieces each side has lost, derived from the position, ordered by value for the captured-pieces strip. */
function captures(fen: string) {
  const onBoard: Record<string, number> = {};
  for (const char of fen.split(" ")[0]) if (/[pnbrq]/i.test(char)) onBoard[char] = (onBoard[char] ?? 0) + 1;
  const lost = (side: "w" | "b") => Object.keys(START_COUNTS).flatMap(kind => {
    const key = side === "w" ? kind.toUpperCase() : kind;
    return Array<string>(Math.max(0, START_COUNTS[kind] - (onBoard[key] ?? 0))).fill(kind);
  }).sort((a, b) => VALUES[a] - VALUES[b]);
  return { white: lost("b"), black: lost("w") };
}
const material = (pieces: string[]) => pieces.reduce((sum, kind) => sum + VALUES[kind], 0);

type Played = { fen: string; lastMove: [Square, Square] | null };
type Own = Played & { undo: Played[] };

/** A light opponent for the demo: mates if it can, takes what is safe to take, otherwise plays something sensible. */
function replyFor(fen: string) {
  const game = new Chess(fen);
  let best: { from: Square; to: Square; promotion?: string } | null = null;
  let bestScore = -Infinity;
  for (const move of game.moves({ verbose: true })) {
    game.move(move);
    let score = Math.random();
    if (game.isCheckmate()) score += 1000;
    else {
      if (move.captured) score += VALUES[move.captured] * 10;
      if (game.inCheck()) score += 2;
      if (move.promotion) score += 8;
      // Do not hang the piece that just moved.
      if (game.moves({ verbose: true }).some(reply => reply.to === move.to && reply.captured)) score -= VALUES[move.piece] * 10 - (move.captured ? VALUES[move.captured] * 10 : 0);
    }
    game.undo();
    if (score > bestScore) { bestScore = score; best = { from: move.from, to: move.to, promotion: move.promotion }; }
  }
  return best;
}

/** A game that plays itself on a loop; step or pause it any time. */
export default function ChessPlayDemo() {
  useUiLanguage();
  const text = useCopy();
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);
  const [own, setOwn] = useState<Own | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [thinking, setThinking] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const reply = useRef<number | null>(null);
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

  useEffect(() => () => { if (reply.current !== null) window.clearTimeout(reply.current); }, []);

  useEffect(() => {
    if (!playing || held || !visible || own) return;
    const timer = window.setTimeout(() => setPly(current => (current >= line.length ? 0 : current + 1)), ply >= line.length ? 2600 : 1150);
    return () => window.clearTimeout(timer);
  }, [ply, playing, held, visible, own]);

  const current: Played = own ?? positions[ply];
  const game = new Chess(current.fen);
  // The visitor always plays White. Joining while Black is to move lets the scripted reply happen first.
  const takeOver = (): Own => own ?? { ...positions[ply % 2 === 0 ? ply : Math.min(ply + 1, line.length)], undo: [] };
  const over = game.isGameOver();
  const turn = over ? (game.isCheckmate() ? "Checkmate" : "Draw") : own ? (thinking ? "Thinking…" : "Your move") : game.turn() === "w" ? "White to move" : "Black to move";
  const moveCount = own ? Number(current.fen.split(" ")[5]) * 2 - (game.turn() === "w" ? 2 : 1) : ply;
  const legalSquares = own && selected && !thinking ? game.moves({ square: selected, verbose: true }).map(move => move.to) : [];

  function attempt(from: Square, to: Square) {
    if (thinking) return false;
    const state = takeOver();
    const board = new Chess(state.fen);
    if (board.get(from)?.color !== "w") return false;
    try { board.move({ from, to, promotion: "q" }); } catch { return false; }
    setPlaying(false);
    setSelected(null);
    setOwn({ fen: board.fen(), lastMove: [from, to], undo: [...state.undo, { fen: state.fen, lastMove: state.lastMove }] });
    const answer = board.isGameOver() ? null : replyFor(board.fen());
    if (answer) {
      setThinking(true);
      reply.current = window.setTimeout(() => {
        board.move(answer);
        setOwn(latest => latest && { ...latest, fen: board.fen(), lastMove: [answer.from, answer.to] });
        setThinking(false);
      }, 550);
    }
    return true;
  }
  function choose(square: Square) {
    if (thinking) return;
    if (selected && selected !== square && attempt(selected, square)) return;
    const base = new Chess(takeOver().fen);
    if (base.get(square)?.color === "w") { setOwn(takeOver()); setSelected(square); setPlaying(false); } else setSelected(null);
  }
  function takeBack() {
    if (reply.current !== null) window.clearTimeout(reply.current);
    setThinking(false);
    setSelected(null);
    setOwn(latest => {
      if (!latest) return latest;
      const previous = latest.undo[latest.undo.length - 1];
      return previous ? { ...previous, undo: latest.undo.slice(0, -1) } : latest;
    });
  }
  function backToDemo() {
    if (reply.current !== null) window.clearTimeout(reply.current);
    setThinking(false);
    setSelected(null);
    setOwn(null);
    setPly(0);
    setPlaying(true);
  }
  const taken = captures(current.fen);
  const blackLead = material(taken.black) - material(taken.white);
  return <DemoFrame tone="chess" title={ui("Chess")} href="/games/chess/classic/ai" action={text("playChess")}>
    <div ref={frame} className="chess-demo" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocusCapture={() => setHeld(true)} onBlurCapture={() => setHeld(false)}>
      <div className="chess-demo-board"><ChessPreviewBoard fen={current.fen} lastMove={current.lastMove} selected={selected} legalSquares={legalSquares} onSquareClick={choose} onMoveAttempt={attempt} label={ui("Chess")} /></div>
      <div className="chess-demo-side">
        <div className="chess-demo-status"><span className="demo-eyebrow">{ui(own ? "Match status" : "Click a piece to play")}</span><strong>{ui(turn)}</strong><small>{moveCount} {ui("moves")}</small></div>
        <PlayerCard name="Stockfish" side={ui("Black")} icon={<Bot size={16} aria-hidden="true" />} taken={taken.black} lead={blackLead} active={!over && game.turn() === "b"} color="b" />
        <PlayerCard name={ui("You")} side={ui("White")} icon={<User size={16} aria-hidden="true" />} taken={taken.white} lead={-blackLead} active={!over && game.turn() === "w"} color="w" />
        {own
          ? <div className="demo-controls">
            <button type="button" aria-label={ui("Undo")} disabled={!own.undo.length} onClick={takeBack}><Undo2 size={16} /></button>
            <button type="button" onClick={backToDemo}><RotateCcw size={15} />{ui("Back to demo")}</button>
          </div>
          : <div className="demo-controls">
            <button type="button" aria-label={ui("Previous move")} disabled={ply === 0} onClick={() => { setPlaying(false); setPly(ply - 1); }}><ChevronLeft size={16} /></button>
            <button type="button" aria-label={ui(playing ? "Pause" : "Play")} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
            <button type="button" aria-label={ui("Next move")} disabled={ply === line.length} onClick={() => { setPlaying(false); setPly(ply + 1); }}><ChevronRight size={16} /></button>
          </div>}
        <div className="demo-chips">{modes.map(mode => <Link key={mode.route} to={mode.route}>{ui(mode.label)}</Link>)}</div>
      </div>
    </div>
  </DemoFrame>;
}

/** One player strip, like the real game screen: avatar, name and colour, what they have captured, and whose turn it is. */
function PlayerCard({ name, side, icon, taken, lead, active, color }: { name: string; side: string; icon: ReactNode; taken: string[]; lead: number; active: boolean; color: "w" | "b" }) {
  return <div className="chess-demo-player" data-active={active || undefined}>
    <span className="chess-demo-avatar">{icon}</span>
    <span className="chess-demo-who"><strong>{name}</strong><small>{side}</small></span>
    <span className="chess-demo-taken" aria-label={ui("Captured pieces")}>{taken.map((kind, index) => <i key={index}>{GLYPHS[color === "w" ? "b" : "w"][kind]}</i>)}{lead > 0 && <b>+{lead}</b>}</span>
    <span className="chess-demo-dot" aria-hidden="true" />
  </div>;
}
