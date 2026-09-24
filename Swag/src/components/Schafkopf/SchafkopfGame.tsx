import { useEffect, useState } from "react";
import { applyAction, chooseAiAction, createGame, viewFor, type Action } from "../../games/schafkopf/schafkopf";
import SchafkopfTable from "./SchafkopfTable";

export default function SchafkopfGame({ mode = "hotseat" }: { mode?: "hotseat" | "ai" }) {
  const [game, setGame] = useState(() => createGame(mode === "ai" ? ["Du", "KI Sepp", "KI Resi", "KI Franz"] : undefined));
  const [revealed, setRevealed] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const seat = mode === "ai" ? 0 : game.turn;
  const hidden = mode === "hotseat" && revealed !== game.revision;

  useEffect(() => {
    if (mode !== "ai" || game.turn === 0 || game.phase === "finished" || game.phase === "redeal") return;
    const timer = window.setTimeout(() => {
      try { setGame(applyAction(game, game.turn, chooseAiAction(viewFor(game, game.turn)))); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "KI konnte nicht ziehen."); }
    }, game.phase === "trick" ? 1400 : 850);
    return () => window.clearTimeout(timer);
  }, [game, mode]);

  function act(action: Action) {
    try {
      const updated = applyAction(game, seat, action);
      // Keep the same player's hand open when winning a negotiation or starting a trick.
      if (updated.turn === seat && action.type !== "next") setRevealed(updated.revision);
      else setRevealed(-1);
      setGame(updated);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Aktion fehlgeschlagen."); }
  }
  return <SchafkopfTable view={viewFor(game, seat)} onAction={act} error={error} hidden={hidden} onReveal={() => setRevealed(game.revision)} subtitle={mode === "ai" ? "Du gegen drei KI-Spieler" : "Hotseat · Vier Spieler"} />;
}
