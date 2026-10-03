import { LANGUAGE_PHRASES } from "../phrases.ts";
import { seededRandom, shuffled } from "../random.ts";
import type { AtlasDifficulty } from "../types.ts";

export const LANGUAGE_GUESSER = { rounds: 12, options: 6, correct: 200 } as const;
export type LanguageRound = { language: string; sentence: string; translation: string; options: string[] };

// Each displayed sentence has one answer. Alternate spellings and duplicate translations are omitted.
const OMIT = new Set(["Serbian (Latin)", "Norwegian Bokmål", "Swati"]);
const ENTRIES = Object.entries(LANGUAGE_PHRASES).filter(([language, sentence]) =>
  !OMIT.has(language) && Object.values(LANGUAGE_PHRASES).filter((other) => other === sentence).length === 1);
const script = (value: string) => /[\u0400-\u052f]/u.test(value) ? "cyrillic"
  : /[\u0600-\u06ff]/u.test(value) ? "arabic"
    : /[\u0900-\u097f]/u.test(value) ? "devanagari"
      : /[\u4e00-\u9fff]/u.test(value) ? "han"
        : /[\u0370-\u03ff]/u.test(value) ? "greek" : "latin";

export function languageRound(seed: string, index: number, difficulty: AtlasDifficulty): LanguageRound {
  const random = seededRandom(`${seed}:language:${index}`);
  const order = shuffled(ENTRIES, seededRandom(`${seed}:language:order`));
  const [language, sentence] = order[index % order.length];
  const others = ENTRIES.map(([name]) => name).filter((name) => name !== language);
  const sameScript = others.filter((name) => script(LANGUAGE_PHRASES[name]) === script(sentence));
  const nearCount = difficulty === "beginner" ? 1 : difficulty === "intermediate" ? 3 : 5;
  const near = shuffled(sameScript, random).slice(0, nearCount);
  const far = shuffled(others.filter((name) => !near.includes(name)), random).slice(0, LANGUAGE_GUESSER.options - 1 - near.length);
  return {
    language,
    sentence,
    // The clue deck uses compact everyday greetings. The meaning appears only after the choice is locked.
    translation: language === "English" ? sentence : "Good morning! How are you? Thank you very much.",
    options: shuffled([language, ...near, ...far], random),
  };
}
