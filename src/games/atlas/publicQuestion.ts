import type { AtlasQuestion } from "./types.ts";

// Deliberate allowlist. Adding a private generator field cannot silently put it on the wire.
export function toPublicQuestion(question: AtlasQuestion, id: string, resolved = false, tip = 0) {
  const base = { id, interaction: question.interaction, category: question.category, difficulty: question.difficulty, prompt: question.prompt, sourceMetadata: question.sourceMetadata };
  switch (question.interaction) {
    case "higher_lower": return { ...base, interaction: "higher_lower" as const, first: question.first, second: question.second && { label: question.second.label, kind: question.second.kind, detail: question.second.detail, ...(resolved ? { note:question.second.note } : {}) }, stat: { key:question.stat.key, label:question.stat.label, unit:question.stat.unit, year:question.stat.year, firstValue:question.stat.firstValue, ...(resolved ? { secondValue:question.stat.secondValue } : {}) } };
    case "single_choice": return { ...base, interaction:"single_choice" as const, choices: question.choices, promptFlagAsset:question.promptFlagAsset, promptShape:question.promptShape };
    case "multi_select": return { ...base, interaction:"multi_select" as const, choices: question.choices };
    case "guess_country": return { ...base, interaction:"guess_country" as const, choices: question.choices, clues: resolved ? question.clues : question.clues.slice(0,tip+1) };
    case "map_click": return { ...base, interaction:"map_click" as const, flagAsset:question.flagAsset };
    case "closest_click": return { ...base, interaction:"closest_click" as const, flagAsset:question.flagAsset, targetRadiusKm:question.targetRadiusKm, ...(resolved ? { targetGeometryId:question.targetGeometryId, targetCoordinates:question.targetCoordinates } : {}) };
  }
}
export type PublicQuestion = ReturnType<typeof toPublicQuestion>;
