import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { collectLearningKeys } from "../scripts/i18n/learning-keys.mjs";

const read = name => JSON.parse(fs.readFileSync(new URL(`../src/i18n/${name}Translations.json`, import.meta.url), "utf8"));
const rows = [...read("learnContent"), ...read("milestoneTools"), ...read("advancedMath"), ...read("deeperMath"), ...read("musicFootball"), ...read("footballReference"), ...read("lifeTools"), ...read("finalTools"), ...read("notesTool")];
const tables = ["existing", "ui", "dashboard", "esPt", "eatIt", "chessCustom", "janmann", "social", "information", "learningTools"].map(read);
const languages = ["de", "bar", "ko", "ru", "es", "pt"];
const normalize = value => value.replace(/\s+/g, " ").trim();

test("learning translation rows have all six languages and unique source keys", () => {
  assert.equal(new Set(rows.map(row => normalize(row[0]))).size, rows.length);
  for (const row of rows) {
    assert.equal(row.length, 7, row[0]);
    for (const value of row) assert.ok(typeof value === "string" && value.trim(), row[0]);
  }
});

test("all active Learn prose is translated in every supported language", () => {
  const keys = collectLearningKeys();
  assert.ok(keys.length > 550, "includes lesson prose, exercises, outlines, diagrams, and controls");
  for (const [index, language] of languages.entries()) {
    const lookup = Object.assign({}, ...tables.map(table => Object.fromEntries(Object.entries(table[language] ?? {}).map(([key, value]) => [normalize(key), value]))), Object.fromEntries(rows.map(row => [normalize(row[0]), row[index + 1]])));
    assert.deepEqual(keys.filter(key => !lookup[key]?.trim()), [], language);
    // Bavarian must have its own entries; this deliberately does not use the German fallback.
  }
});
