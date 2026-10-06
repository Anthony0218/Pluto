import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import GoBoard from "@/components/strategy/GoBoard";
import { applyGoMove, createInitialGoState, type GoMove, type GoState } from "@/games/go/rules";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCopy } from "../copy";
import DemoFrame from "./DemoFrame";
import { chooseDemoMove } from "./goDemoData";

/** A real 9×9 board with the real rules: you play Black, a simple bot answers as White. */
export default function GoPlayDemo() {
  useUiLanguage();
  const text = useCopy();
  const [state, setState] = useState<GoState>(() => createInitialGoState(9));
  const timer = useRef<number>(0);
  const thinking = state.status === "playing" && state.currentPlayer === "white";

  useEffect(() => {
    if (!thinking) return;
    timer.current = window.setTimeout(() => setState(current => current.status === "playing" && current.currentPlayer === "white" ? applyGoMove(current, chooseDemoMove(current)) : current), 650);
    return () => window.clearTimeout(timer.current);
  }, [thinking, state]);

  const play = (move: GoMove) => setState(current => current.currentPlayer === "black" && current.status === "playing" ? applyGoMove(current, move) : current);
  const status = state.status === "finished" ? state.result ?? ui("Game over") : thinking ? text("goThinking") : text("goYourMove");
  return <DemoFrame tone="go" title={ui("Go")} href="/games/go" action={text("playGo")}>
    <div className="go-demo">
      <GoBoard state={state} onMove={play} disabled={thinking || state.status === "finished"} />
      <div className="go-demo-side">
        <p className="demo-eyebrow">{ui("9×9")}</p>
        <p className="demo-status" aria-live="polite">{status}</p>
        <dl className="demo-stats"><div><dt>{ui("Black")}</dt><dd>{state.captures.black}</dd></div><div><dt>{ui("White")}</dt><dd>{state.captures.white}</dd></div></dl>
        <p className="demo-hint">{text("goHint")}</p>
        <div className="demo-controls demo-controls--wide">
          <button type="button" disabled={thinking || state.status === "finished"} onClick={() => play({ type: "pass" })}>{ui("Pass")}</button>
          <button type="button" onClick={() => setState(createInitialGoState(9))}><RotateCcw size={15} aria-hidden="true" />{ui("New game")}</button>
        </div>
      </div>
    </div>
  </DemoFrame>;
}
