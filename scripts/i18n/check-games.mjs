import fs from 'node:fs';
import { collectGameKeys, normalizeGameKey } from './game-keys.mjs';

const directory = new URL('../../src/i18n/', import.meta.url);
const rows = JSON.parse(fs.readFileSync(new URL('gameTranslations.json', directory)));
const pending = JSON.parse(fs.readFileSync(new URL('gameTranslationPending.json', directory)));
const languages = ['en', 'de', 'bar', 'ko', 'ru', 'es', 'pt'];
const keys = new Set(rows.map(row => normalizeGameKey(row[0])));
const existing = new Set(fs.readdirSync(directory)
  .filter(name => name.endsWith('Translations.json') && name !== 'gameTranslations.json')
  .flatMap(name => {
    const table = JSON.parse(fs.readFileSync(new URL(name, directory)));
    return Array.isArray(table) ? table.map(row => normalizeGameKey(row[0])) : Object.values(table).flatMap(table => Object.keys(table).map(normalizeGameKey));
  }));
const uncovered = collectGameKeys().filter(key => !keys.has(key) && !existing.has(key));
console.log(`${rows.length} game source texts; ${Object.keys(pending).length} still need at least one translation.`);
for (const language of languages) console.log(`${language}: ${Object.values(pending).filter(list => list.includes(language)).length} pending`);
if (uncovered.length) console.error('Source texts without an entry:', uncovered);
process.exitCode = uncovered.length || Object.keys(pending).length ? 1 : 0;
