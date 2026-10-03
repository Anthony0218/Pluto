import { useEffect, useMemo, useRef, useState } from "react";
import { getGoGroup, isLegalGoMove, type GoMove, type GoState } from "../../games/go/rules";
import { capturedGoPoints, GO_COLUMNS, goAtariPoints, goCoordinate, previewGoMove } from "../../games/go/analysis";
import "./go.css";

type Props = { state: GoState; onMove: (move: GoMove) => void; disabled?: boolean; help?: boolean; marked?: number; hint?: GoMove | null; suggestions?: GoMove[]; selectedSuggestion?: number; onAttempt?: (move: GoMove) => void };
export default function GoBoard({ state, onMove, disabled, help = false, marked, hint, suggestions = [], selectedSuggestion, onAttempt }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [ghosts, setGhosts] = useState<{ index: number; stone: string }[]>([]);
  const previous = useRef(state);
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (before.boardSize !== state.boardSize || state.moveHistory.length !== before.moveHistory.length + 1) { setGhosts([]); return; }
    setGhosts(capturedGoPoints(before, state).map(index => ({ index, stone: before.board[index]! })));
    const timer = window.setTimeout(() => setGhosts([]), 750);
    return () => window.clearTimeout(timer);
  }, [state]);
  const atari = useMemo(() => help ? goAtariPoints(state) : new Set<number>(), [state, help]);
  const active = hover ?? marked ?? null;
  const move: GoMove | null = active === null ? null : { type: "place", row: Math.floor(active / state.boardSize), col: active % state.boardSize };
  const preview = help && active !== null && !state.board[active] && move ? previewGoMove(state, move) : null;
  const group = help && active !== null && state.board[active] ? getGoGroup(state.board, state.boardSize, active) : null;
  const liberties = group?.liberties ?? preview?.liberties ?? new Set<number>();
  const edge = state.boardSize === 9 ? 2 : 3, center = Math.floor(state.boardSize / 2);
  return <div className="go-board-wrap">
    <div className="go-board" role="group" aria-label="Go board" data-board-size={state.boardSize}>
      <div className="go-coordinates go-coordinates-columns" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${state.boardSize}, 1fr)` }}>{Array.from({ length: state.boardSize }, (_, index) => <span key={index}>{GO_COLUMNS[index]}</span>)}</div>
      <div className="go-coordinates go-coordinates-rows" aria-hidden="true" style={{ gridTemplateRows: `repeat(${state.boardSize}, 1fr)` }}>{Array.from({ length: state.boardSize }, (_, index) => <span key={index}>{state.boardSize - index}</span>)}</div>
      <div className="go-grid" style={{ gridTemplateColumns: `repeat(${state.boardSize}, 1fr)` }}>
        {state.board.map((stone, index) => {
          const row = Math.floor(index / state.boardSize), col = index % state.boardSize;
          const placement: GoMove = { type: "place", row, col };
          const legal = isLegalGoMove(state, placement);
          const last = state.lastMove?.row === row && state.lastMove.col === col;
          const ghost = ghosts.find(item => item.index === index);
          const star = [edge, center, state.boardSize - edge - 1].includes(row) && [edge, center, state.boardSize - edge - 1].includes(col) && (state.boardSize !== 9 || row === col || row + col === state.boardSize - 1);
          const suggested = hint?.type === "place" && hint.row === row && hint.col === col;
          const suggestionRank = suggestions.findIndex(candidate => candidate.type === "place" && candidate.row === row && candidate.col === col);
          return <button key={index} type="button" className="go-point" aria-label={`${goCoordinate(placement, state.boardSize)}: ${stone ?? "empty"}${atari.has(index) ? ", in atari" : ""}${suggestionRank >= 0 ? `, best move ${suggestionRank + 1}${selectedSuggestion === suggestionRank ? ", selected" : ""}` : ""}`} aria-disabled={disabled || !legal}
            onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(index)} onBlur={() => setHover(null)}
            onClick={() => { setHover(index); if (onAttempt) onAttempt(placement); else if (!disabled && legal) onMove(placement); }}>
            <span className="go-line go-line-h" style={{ left: col === 0 ? "50%" : 0, right: col === state.boardSize - 1 ? "50%" : 0 }} />
            <span className="go-line go-line-v" style={{ top: row === 0 ? "50%" : 0, bottom: row === state.boardSize - 1 ? "50%" : 0 }} />
            {star && <span className="go-star" />}
            {stone && <span className={`go-stone go-stone--${stone}${atari.has(index) ? " go-atari" : ""}${preview?.captured.includes(index) ? " go-capture-preview" : ""}`} key={stone}>{last && <i className="go-last" />}</span>}
            {!stone && ghost && <span className={`go-stone go-stone--${ghost.stone} go-captured`} />}
            {!stone && liberties.has(index) && <span className="go-liberty" />}
            {!stone && !liberties.has(index) && legal && !disabled && <span className={`go-hover go-stone go-stone--${state.currentPlayer}`} />}
            {suggested && <span className="go-hint" />}
            {suggestionRank >= 0 && <span className={`go-suggestion${selectedSuggestion === suggestionRank ? " go-suggestion--selected" : ""}`} aria-hidden="true">{suggestionRank + 1}</span>}
            {marked === index && !stone && <span className="go-target" />}
          </button>;
        })}
      </div>
    </div>
    {help && <p className="go-board-note" role="status">{group ? `${group.stones.size} stone${group.stones.size === 1 ? "" : "s"} · ${group.liberties.size} liberties${group.liberties.size === 1 ? " · Atari" : ""}` : preview ? `${preview.captured.length} captured · ${preview.liberties.size} liberties${preview.selfAtari ? " · Warning: self-atari" : ""}` : active !== null && move && !isLegalGoMove(state, move) && !state.board[active] ? "Illegal move: suicide or a repeated position." : "Teal: liberties · Red: atari · Gold: suggested move"}</p>}
  </div>;
}
