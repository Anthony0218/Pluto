import { useMemo } from "react";
import { isLegalGoMove, type GoMove, type GoState } from "../../games/go/rules";
type Props = { state: GoState; onMove: (move: GoMove) => void; disabled?: boolean };
const hoshiFor = (size: number) => {
  const edge = size === 9 ? 2 : 3, center = Math.floor(size / 2);
  return size === 9 ? [[edge,edge],[edge,6],[center,center],[6,edge],[6,6]] : [[edge,edge],[edge,center],[edge,size-1-edge],[center,edge],[center,center],[center,size-1-edge],[size-1-edge,edge],[size-1-edge,center],[size-1-edge,size-1-edge]];
};
export default function GoBoard({ state, onMove, disabled }: Props) {
  const hoshi = useMemo(() => new Set(hoshiFor(state.boardSize).map(([r,c]) => r + ":" + c)), [state.boardSize]);
  return <div className="aspect-square w-[min(92vw,calc(100dvh-22rem),720px)] min-w-60 rounded-xl border-8 border-[#7a4a20] bg-[#d7a657] p-[3.2%] shadow-2xl lg:w-[min(65vw,calc(100dvh-10rem),720px)]" style={{ backgroundImage: "radial-gradient(circle at 50% 50%,rgba(255,255,255,.13),transparent 60%)", touchAction: "manipulation" }}>
    <div className="relative grid h-full w-full" style={{ gridTemplateColumns: "repeat(" + state.boardSize + ",1fr)", gridTemplateRows: "repeat(" + state.boardSize + ",1fr)" }}>
      {state.board.map((stone, index) => {
        const row = Math.floor(index / state.boardSize), col = index % state.boardSize;
        const legal = isLegalGoMove(state, { type: "place", row, col });
        const last = state.lastMove?.row === row && state.lastMove.col === col;
        return <button key={index} type="button" disabled={disabled || !legal} onClick={() => onMove({ type: "place", row, col })} aria-label={(stone ?? "empty") + " intersection " + (row + 1) + ", " + (col + 1)} className="group relative flex min-h-0 min-w-0 items-center justify-center rounded-full focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-white">
          <span className={"pointer-events-none absolute top-1/2 h-px bg-[#392612] " + (col === 0 ? "left-1/2 w-1/2" : col === state.boardSize - 1 ? "right-1/2 w-1/2" : "left-0 w-full")} />
          <span className={"pointer-events-none absolute left-1/2 w-px bg-[#392612] " + (row === 0 ? "top-1/2 h-1/2" : row === state.boardSize - 1 ? "bottom-1/2 h-1/2" : "top-0 h-full")} />
          {!stone && hoshi.has(row + ":" + col) && <span className="absolute h-[18%] w-[18%] rounded-full bg-[#392612]" />}
          {stone && <span className={"relative h-[82%] w-[82%] rounded-full shadow-[inset_-3px_-4px_7px_rgba(0,0,0,.35),0_2px_4px_rgba(0,0,0,.5)] " + (stone === "black" ? "bg-zinc-950" : "bg-zinc-50")}>{last && <span className={"absolute left-1/2 top-1/2 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full " + (stone === "black" ? "bg-white" : "bg-black")} />}</span>}
          {!stone && legal && !disabled && <span className={"h-[72%] w-[72%] rounded-full opacity-0 transition group-hover:opacity-30 " + (state.currentPlayer === "black" ? "bg-black" : "bg-white")} />}
        </button>;
      })}
    </div>
  </div>;
}
