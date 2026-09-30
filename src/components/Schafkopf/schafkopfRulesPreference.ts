import { DEFAULT_GAME_RULES, type GameRules } from "../../games/schafkopf/schafkopf";

export function savedSchafkopfRules(): GameRules {
  try {
    const saved = JSON.parse(localStorage.getItem("schafkopf-rulebook") ?? "{}") as Partial<GameRules>;
    return { ...DEFAULT_GAME_RULES, ...saved };
  } catch {
    return DEFAULT_GAME_RULES;
  }
}
