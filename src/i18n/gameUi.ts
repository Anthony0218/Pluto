import translationRows from "./gameTranslations.json" with { type: "json" };
import templateValues from "./gameTemplateValues.json" with { type: "json" };
import { getAppLanguage, useAppLanguage, type AppLanguage } from "./languageStore.ts";
import { translateUi } from "./ui.ts";
import { isGameTerm } from "./gameTerms.ts";

export const useGameLanguage = useAppLanguage;
const languages: AppLanguage[] = ["en", "de", "bar", "ko", "ru", "es", "pt"];
const cache = Object.fromEntries(languages.map(language => [language, new Map<string, string>()])) as Record<AppLanguage, Map<string, string>>;
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const translations: string[][] = translationRows;
const tables = Object.fromEntries(languages.map((language, index) => [language,
  Object.fromEntries(translations.map(row => [normalize(row[0]), row[index + 1]])),
])) as Record<AppLanguage, Record<string, string>>;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Match complete messages, longest fixed text first. Captured names, scores and
// notation are inserted verbatim rather than passed through a word translator.
const placeholders = /\{(?:\d+|[A-Za-z][\w.]*)\}/g;
const templates = translations.filter(row => row[0].match(placeholders) && /[\p{L}]{2}/u.test(row[0].replace(placeholders, "")))
  .sort((a, b) => b[0].replace(placeholders, "").length - a[0].replace(placeholders, "").length)
  .map(row => {
    const slots: string[] = [];
    const parts = normalize(row[0]).split(/(\{(?:\d+|[A-Za-z][\w.]*)\})/g);
    const pattern = parts.map(part => {
      if (/^\{(?:\d+|[A-Za-z][\w.]*)\}$/.test(part)) { slots.push(part); return "(.*?)"; }
      return escape(part);
    }).join("");
    return { row, slots, pattern: new RegExp(`^${pattern}$`, "u"), prefix: parts[0] };
  });

export function translateGameUi(language: AppLanguage, input: string): string {
  const key = normalize(input);
  if (!/[\p{L}]/u.test(key) || isGameTerm(key)) return input;
  const surround = (text: string) => `${input.match(/^\s*/)?.[0] ?? ""}${text}${input.match(/\s*$/)?.[0] ?? ""}`;
  const direct = Object.hasOwn(tables[language], key) ? tables[language][key] : undefined;
  if (direct) return direct === key ? input : surround(direct);
  const saved = cache[language].get(key);
  if (saved !== undefined) return saved === key ? input : surround(saved);
  const remember = (text: string) => {
    if (cache[language].size >= 2000) cache[language].clear();
    cache[language].set(key, text);
    return text === key ? input : surround(text);
  };
  for (const { row, slots, pattern, prefix } of templates) {
    if (!key.startsWith(prefix)) continue;
    const match = pattern.exec(key);
    if (!match) continue;
    const localizedSlots: string[] = (templateValues as Record<string, string[]>)[row[0]] ?? [];
    const values = Object.fromEntries(slots.map((slot, index) => {
      const value = match[index + 1];
      return [slot, localizedSlots.includes(slot.slice(1, -1)) && value !== key ? translateGameUi(language, value) : value];
    }));
    const translated = row[languages.indexOf(language) + 1];
    return remember(translated.replace(placeholders, slot => values[slot] ?? slot));
  }
  return remember(translateUi(language, key));
}

/** Localize presentation strings only; React elements and game data stay intact. */
export function gameUi<T>(value: T): T {
  if (typeof value === "string") return translateGameUi(getAppLanguage(), value) as T;
  if (Array.isArray(value)) return value.map(item => gameUi(item)) as T;
  return value;
}
