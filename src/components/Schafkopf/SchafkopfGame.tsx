import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useEffect, useState } from "react";
import { applyAction, chooseAiAction, collectSecondsFor, createGame, migrateGameState, resolveLegenTimeout, viewFor, type Action, type AiDifficulty, type GameRules, type GameState } from "../../games/schafkopf/schafkopf";
import { DEFAULT_ANNOUNCEMENT_SETTINGS, SIMPLE_ANNOUNCEMENT_SETTINGS, formatDeclarationAnnouncement } from "../../games/schafkopf/announcements";
import SchafkopfTable from "./SchafkopfTable";
import { savedSchafkopfRules } from "./schafkopfRulesPreference";

function savedAiNames(mode: "hotseat" | "ai") {
  const fallback = mode === "ai" ? ["Du", "KI Sepp", "KI Resi", "KI Franz"] : ["Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"];
  try {
    const names = JSON.parse(localStorage.getItem(`schafkopf-${mode}-names`) ?? "null");
    return Array.isArray(names) && names.length === 4 && names.every(name => typeof name === "string" && name.trim()) ? names as string[] : fallback;
  } catch { return fallback; }
}

function savedAiDifficulty(): AiDifficulty {
  try {
    const value = localStorage.getItem("schafkopf-ai-difficulty");
    return value === "beginner" || value === "amateur" || value === "advanced" || value === "pro" || value === "legend" ? value : "beginner";
  } catch { return "beginner"; }
}

export default function SchafkopfGame({ mode = "hotseat" }: { mode?: "hotseat" | "ai" }) {
  useGameLanguage();
  const [game, setGame] = useState<GameState>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`schafkopf-game-${mode}`) ?? "null") as GameState | null;
      if (saved && Array.isArray(saved.hands) && saved.hands.length === 4 && Array.isArray(saved.totals) && saved.totals.length === 4 && Number.isInteger(saved.round)) {
        // The single-player table is deliberately untimed. Old saved games
        // may still carry the former Legen deadline, so remove it on load too.
        if (mode === "ai") {
          saved.legenDeadline = null;
          saved.rules = { ...saved.rules, legen: true };
        }
        return migrateGameState(saved);
      }
    } catch { /* Start a new table if the saved game is invalid. */ }
    const freshGame = createGame(savedAiNames(mode), 3, undefined, undefined, 1, { ...savedSchafkopfRules(), ...(mode === "ai" ? { legen: true } : {}) });
    if (mode === "ai") freshGame.legenDeadline = null;
    return freshGame;
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
    if (mode === "ai" || game.phase !== "legen" || !game.legenDeadline) return;
    const timeout = window.setTimeout(() => setGame(current => current.phase === "legen" ? resolveLegenTimeout(current) : current), Math.max(0, game.legenDeadline - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [game.phase, game.legenDeadline, mode]);

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
      const currentGame = mode === "ai" && game.phase === "legen" ? { ...game, legenDeadline: null } : game;
      let updated = applyAction(currentGame, seat, action);
      if (mode === "ai" && updated.phase === "legen") updated = { ...updated, legenDeadline: null };
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
      try { localStorage.setItem(`schafkopf-${mode}-names`, JSON.stringify(names)); } catch { /* Keep this session's names. */ }
      return { ...current, names, announcements: current.announcements.map(text => text.startsWith(`${previous}: `) ? `${clean}: ${text.slice(previous.length + 2)}` : text) };
    });
  };
  return <SchafkopfTable view={viewFor(game, seat)} onAction={act} error={error} hidden={hidden} onReveal={() => setRevealed(game.revision)} onRulesChange={(rules: GameRules) => setGame(current => ({ ...current, rules: mode === "ai" ? { ...rules, legen: true } : rules }))} onRename={renameAi} aiDifficulty={mode === "ai" ? aiDifficulty : undefined} onAiDifficultyChange={mode === "ai" ? changeAiDifficulty : undefined} collectSecondsValue={collectSeconds} onCollectSecondsChange={setCustomCollectSeconds} alwaysLegen={mode === "ai"} untimedLegen={mode === "ai"} subtitle={gameUi(mode === "ai" ? "Du gegen drei KI-Spieler" : "Hotseat · Vier Spieler")} />;
}
