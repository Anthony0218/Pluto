import finalTools from './finalToolsTranslations.json' with { type: "json" };
import lifeTools from './lifeToolsTranslations.json' with { type: "json" };
import footballReference from './footballReferenceTranslations.json' with { type: "json" };
import musicFootball from './musicFootballTranslations.json' with { type: "json" };
import existing from "./existingTranslations.json" with { type: "json" };
import extra from "./uiTranslations.json" with { type: "json" };
import dashboard from "./dashboardTranslations.json" with { type: "json" };
import esPt from "./esPtTranslations.json" with { type: "json" };
import eatIt from "./eatItTranslations.json" with { type: "json" };
import chessCustom from "./chessCustomTranslations.json" with { type: "json" };
import janmann from "./janmannTranslations.json" with { type: "json" };
import social from "./socialTranslations.json" with { type: "json" };
import information from "./informationTranslations.json" with { type: "json" };
import learningTools from "./learningToolsTranslations.json" with { type: "json" };
import learnContent from "./learnContentTranslations.json" with { type: "json" };
import advancedMath from "./advancedMathTranslations.json" with { type: "json" };
import deeperMath from "./deeperMathTranslations.json" with { type: "json" };
import milestoneTools from "./milestoneToolsTranslations.json" with { type: "json" };
import notesTool from "./notesToolTranslations.json" with { type: "json" };
import { getAppLanguage, useAppLanguage, type AppLanguage } from "./languageStore.ts";

export const useUiLanguage = useAppLanguage;
type Table = Record<string, Record<string, string>>;
const aliases: Record<string, string> = { Schach: "Chess", "Schach 3D": "3D Chess", "All Variants": "All variants", "Room Code": "Room code", "ROOM CODE": "Room code", "Create room": "Create Room", "Join room": "Join Room", "Back to Lobby": "Back to lobby", "Back to live board": "Back to Live Board", "Your Progress": "Your progress", "Chat →": "Chat", "Log in →": "Log in" };
const normalized = (key: string) => key.replace(/\s+/g, " ").trim();
const lookup: Table = {};
const gameRows: string[][] = gameTranslations;
const gameEnglish = Object.fromEntries(gameRows.map(row => [normalized(row[0]), row[1]]));
const learningLanguages = ["de", "bar", "ko", "ru", "es", "pt"];
for (const [index, language] of learningLanguages.entries()) {
  lookup[language] = Object.assign(Object.create(null), Object.fromEntries(Object.entries((existing as Table)[language] ?? {}).map(([key, value]) => [normalized(key), value])));
  // The Notes tool's words go in first: any wording the app already had for the same text wins.
  Object.assign(lookup[language], Object.fromEntries(notesTool.map(row => [normalized(row[0]), row[index + 1]])), lookup[language]);
  Object.assign(lookup[language], (extra as Table)[language]);
  Object.assign(lookup[language], (dashboard as Table)[language]);
  Object.assign(lookup[language], (esPt as Table)[language]);
  Object.assign(lookup[language], (eatIt as Table)[language]);
  Object.assign(lookup[language], (chessCustom as Table)[language]);
  Object.assign(lookup[language], (janmann as Table)[language]);
  Object.assign(lookup[language], (social as Table)[language]);
  Object.assign(lookup[language], (information as Table)[language]);
  Object.assign(lookup[language], (learningTools as Table)[language]);
  Object.assign(lookup[language], Object.fromEntries(learnContent.map(row => [normalized(row[0]), row[index + 1]])));
  Object.assign(lookup[language], Object.fromEntries(advancedMath.map(row => [normalized(row[0]), row[index + 1]])));
  Object.assign(lookup[language], Object.fromEntries(deeperMath.map(row => [normalized(row[0]), row[index + 1]])));
  Object.assign(lookup[language], Object.fromEntries(footballReference.map(row => [normalized(row[0]), row[index + 1]])));
  Object.assign(lookup[language], Object.fromEntries(musicFootball.map(row => [normalized(row[0]), row[index + 1]])));
  Object.assign(lookup[language], Object.fromEntries(lifeTools.map(row => [normalized(row[0]), row[index + 1]])));
  Object.assign(lookup[language], Object.fromEntries(finalTools.map(row => [normalized(row[0]), row[index + 1]])));
  Object.assign(lookup[language], Object.fromEntries(milestoneTools.map(row => [normalized(row[0]), row[index + 1]])));
  // Existing app wording wins; games supply any previously missing text.
  for (const row of gameRows) lookup[language][normalized(row[0])] ??= row[index + 2];
}

export function translateUi(language: AppLanguage, input: string): string {
  const clean = normalized(input);
  const alias = Object.hasOwn(aliases, clean) ? aliases[clean] : undefined;
  const key = alias ?? clean;
  if (language === "en") return alias ?? (Object.hasOwn(gameEnglish, key) ? gameEnglish[key] : input);
  const table = lookup[language];
  const direct = table[key] ?? (language === "bar" ? lookup.de[key] : undefined);
  if (direct) return input.replace(clean, () => direct);
  // Common room/status messages share templates across every variant.
  const templates: [RegExp, string][] = [
    [/^Create (.+) [Rr]oom$/, "Create {name} room"],
    [/^Join (.+) [Rr]oom$/, "Join {name} room"],
    [/^Loading (.+?)(?:\.{3}|…)$/, "Loading {name}…"],
    [/^(.+) · Multiplayer$/, "{name} · Multiplayer"],
    [/^Sign in to open this (.+) room\.$/, "Sign in to open this room."],
    [/^(.+) room unavailable\.$/, "Room unavailable"],
    [/^(.+) to move$/, "{name} to move"],
    [/^(.+) wins$/, "{name} wins"],
  ];
  for (const [pattern, template] of templates) {
    const match = key.match(pattern);
    if (match) {
      const translated = table[template] ?? (language === "bar" ? lookup.de[template] : undefined);
      if (translated) return translated.replace("{name}", translateUi(language, match[1]));
    }
  }
  // Preserve icons, counters and punctuation around a translated label.
  const decorated = key.match(/^([^\p{L}]*)([\p{L}].*?)([\s:…→.!✓·]*)$/u);
  if (decorated && (decorated[1] || decorated[3])) {
    const label = table[decorated[2]] ?? (language === "bar" ? lookup.de[decorated[2]] : undefined);
    if (label) return `${decorated[1]}${label}${decorated[3]}`;
  }
  return input;
}
/** Accepts React text or nodes without altering names, board notation or elements. */
export function ui<T>(value: T): T {
  return (typeof value === "string" ? translateUi(getAppLanguage(), value) : value) as T;
}
import gameTranslations from "./gameTranslations.json" with { type: "json" };
