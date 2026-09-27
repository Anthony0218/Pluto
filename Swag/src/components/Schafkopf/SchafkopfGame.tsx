import { useEffect, useState } from "react";
import { applyAction, chooseAiAction, collectSecondsFor, createGame, LEGEN_DECISION_MILLISECONDS, resolveLegenTimeout, viewFor, type Action, type AiDifficulty, type GameRules, type GameState } from "../../games/schafkopf/schafkopf";
import { DEFAULT_ANNOUNCEMENT_SETTINGS, SIMPLE_ANNOUNCEMENT_SETTINGS, formatDeclarationAnnouncement } from "../../games/schafkopf/announcements";
import SchafkopfTable from "./SchafkopfTable";
import { savedSchafkopfRules } from "./schafkopfRulesPreference";

function savedAiNames() {
  const fallback = ["Du", "KI Sepp", "KI Resi", "KI Franz"];
  try {
    const names = JSON.parse(localStorage.getItem("schafkopf-ai-names") ?? "null");
    return Array.isArray(names) && names.length === 4 && names.every(name => typeof name === "string" && name.trim()) ? names as string[] : fallback;
  } catch { return fallback; }
}

function savedAiDifficulty(): AiDifficulty {
  try {
    const value = localStorage.getItem("schafkopf-ai-difficulty");
    return value === "beginner" || value === "amateur" || value === "advanced" || value === "pro" || value === "legend" ? value : "amateur";
  } catch { return "amateur"; }
}

export default function SchafkopfGame({ mode = "hotseat" }: { mode?: "hotseat" | "ai" }) {
  const [game, setGame] = useState<GameState>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`schafkopf-game-${mode}`) ?? "null") as GameState | null;
      if (saved && Array.isArray(saved.hands) && saved.hands.length === 4 && Array.isArray(saved.totals) && saved.totals.length === 4 && Number.isInteger(saved.round)) {
        if (saved.phase === "legen" && !Number.isFinite(saved.legenDeadline)) saved.legenDeadline = Date.now() + LEGEN_DECISION_MILLISECONDS;
        return saved;
      }
    } catch { /* Start a new table if the saved game is invalid. */ }
    return createGame(mode === "ai" ? savedAiNames() : undefined, 3, undefined, undefined, 1, savedSchafkopfRules());
  });
  const [revealed, setRevealed] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>(savedAiDifficulty);
  const [customCollectSeconds, setCustomCollectSeconds] = useState<number | null>(() => {
    try { const value = Number(localStorage.getItem("schafkopf-collect-seconds")); return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null; }
    catch { return null; }
  });
  const collectSeconds = customCollectSeconds ?? collectSecondsFor(aiDifficulty);
  const seat = mode === "ai" ? 0 : game.turn;
  const hidden = mode === "hotseat" && revealed !== game.revision;

  useEffect(() => {
    try { localStorage.setItem(`schafkopf-game-${mode}`, JSON.stringify(game)); } catch { /* Current table continues in memory. */ }
  }, [game, mode]);

  useEffect(() => {
    if (game.phase !== "legen" || !game.legenDeadline) return;
    const timeout = window.setTimeout(() => setGame(current => current.phase === "legen" ? resolveLegenTimeout(current) : current), Math.max(0, game.legenDeadline - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [game.phase, game.legenDeadline]);

  useEffect(() => {
    if (mode !== "ai" || game.phase === "finished" || game.phase === "redeal") return;
    const botSeat = game.phase === "legen" ? game.legenDecisions.findIndex((decision, index) => index !== 0 && decision === null) : game.turn;
    if (botSeat <= 0) return;
    const timer = window.setTimeout(() => {
      try {
        const action = chooseAiAction(viewFor(game, botSeat), aiDifficulty);
        setGame(applyAction(game, botSeat, action.type === "declare" ? { ...action, phrase: formatDeclarationAnnouncement(action.contract, aiDifficulty === "beginner" || aiDifficulty === "amateur" ? SIMPLE_ANNOUNCEMENT_SETTINGS : DEFAULT_ANNOUNCEMENT_SETTINGS) } : action));
      }
      catch (cause) { setError(cause instanceof Error ? cause.message : "KI konnte nicht ziehen."); }
    }, game.phase === "trick" ? collectSeconds * 1000 : 850);
    return () => window.clearTimeout(timer);
  }, [game, mode, aiDifficulty, collectSeconds]);

  const changeAiDifficulty = (difficulty: AiDifficulty) => {
    setAiDifficulty(difficulty);
    try { localStorage.setItem("schafkopf-ai-difficulty", difficulty); } catch { /* Keep this session's choice. */ }
  };

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
  const renameAi = (index: number, name: string) => {
    const clean = name.trim().slice(0, 24);
    if (!clean) return;
    setGame(current => {
      const names = [...current.names];
      const previous = names[index];
      names[index] = clean;
      try { localStorage.setItem("schafkopf-ai-names", JSON.stringify(names)); } catch { /* Keep this session's names. */ }
      return { ...current, names, announcements: current.announcements.map(text => text.startsWith(`${previous}: `) ? `${clean}: ${text.slice(previous.length + 2)}` : text) };
    });
  };
  return <SchafkopfTable view={viewFor(game, seat)} onAction={act} error={error} hidden={hidden} onReveal={() => setRevealed(game.revision)} onRulesChange={(rules: GameRules) => setGame(current => ({ ...current, rules }))} onRename={mode === "ai" ? renameAi : undefined} aiDifficulty={mode === "ai" ? aiDifficulty : undefined} onAiDifficultyChange={mode === "ai" ? changeAiDifficulty : undefined} collectSecondsValue={collectSeconds} onCollectSecondsChange={setCustomCollectSeconds} subtitle={mode === "ai" ? "Du gegen drei KI-Spieler" : "Hotseat · Vier Spieler"} />;
}
