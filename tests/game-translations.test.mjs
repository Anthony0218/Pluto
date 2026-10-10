import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { gameUi, translateGameUi } from '../src/i18n/gameUi.ts';
import { isGameTerm } from '../src/i18n/gameTerms.ts';
import { collectGameKeys, normalizeGameKey } from '../scripts/i18n/game-keys.mjs';

const rows = JSON.parse(fs.readFileSync(new URL('../src/i18n/gameTranslations.json', import.meta.url)));
const pending = JSON.parse(fs.readFileSync(new URL('../src/i18n/gameTranslationPending.json', import.meta.url)));
const languages = ['en', 'de', 'bar', 'ko', 'ru', 'es', 'pt'];
const slots = text => [...new Set(text.match(/\{(?:\d+|[A-Za-z][\w.]*)\}/g) ?? [])].sort();

test('game translations have unique source keys and seven non-empty language columns', () => {
  assert.ok(rows.length > 9000);
  assert.equal(new Set(rows.map(row => normalizeGameKey(row[0]))).size, rows.length);
  for (const row of rows) {
    assert.equal(row.length, 8, row[0]);
    for (const text of row) assert.ok(typeof text === 'string' && text.trim(), row[0]);
    for (const text of row.slice(1)) assert.deepEqual(slots(text), slots(row[0]), row[0]);
  }
});

test('unfinished translations are explicitly recorded rather than counted as translated', () => {
  for (const [key, missing] of Object.entries(pending)) {
    const row = rows.find(row => row[0] === key);
    assert.ok(row, key);
    for (const language of missing) {
      assert.ok(languages.includes(language), language);
      assert.equal(row[languages.indexOf(language) + 1], key, `${language}: ${key}`);
    }
  }
});

test('all collected game prose has a dictionary entry or an existing app translation', () => {
  const dictionaries = fs.readdirSync(new URL('../src/i18n/', import.meta.url))
    .filter(name => name.endsWith('Translations.json') && name !== 'gameTranslations.json')
    .map(name => JSON.parse(fs.readFileSync(new URL(`../src/i18n/${name}`, import.meta.url))));
  const keys = new Set(rows.map(row => normalizeGameKey(row[0])));
  const existing = Object.assign({}, ...dictionaries.map(table => Array.isArray(table) ? Object.fromEntries(table.map(row => [normalizeGameKey(row[0]), true])) : Object.fromEntries(Object.values(table).flatMap(table => Object.keys(table).map(key => [normalizeGameKey(key), true])))));
  assert.deepEqual(collectGameKeys().filter(key => !keys.has(key) && !existing[key]), []);
});

test('regional card names, declarations and notation survive every language', () => {
  for (const language of languages) for (const text of ['Blaue', 'Pumpe', 'Blaue / mit der Blauen', 'Schellige / Bums / Pumpe', 'Wenz', 'Farbwenz', 'Kontra / Re / Sub / Hirsch', 'Eichel-Ober', 'Herz-Ass', 'I spui auf die Blaue.', 'Nf3', 'O-O']) {
    assert.equal(isGameTerm(text), true, text);
    assert.equal(translateGameUi(language, text), text, `${language}: ${text}`);
  }
});

test('message parameters retain player names, dollar signs, scores and room codes', () => {
  for (const language of languages) {
    const translated = translateGameUi(language, 'Pass to White $&');
    assert.ok(translated.includes('White $&'), language);
    const copied = translateGameUi(language, 'Bitte kopiere den Code manuell: AB12CD');
    assert.ok(copied.includes('AB12CD'), language);
    assert.equal(translateGameUi(language, 'Nf3'), 'Nf3');
    assert.equal(translateGameUi(language, '120 / 61'), '120 / 61');
    assert.equal(translateGameUi(language, 'constructor'), 'constructor');
  }
});

test('localization preserves React elements and simulation data without mutating them', () => {
  const element = React.createElement('span', null, 'White');
  const state = { player: { name: 'White' }, score: 61, roomCode: 'AB12CD' };
  assert.equal(gameUi(element), element);
  assert.equal(gameUi(state), state);
  assert.deepEqual(state, { player: { name: 'White' }, score: 61, roomCode: 'AB12CD' });
  assert.equal(translateGameUi('en', '  Vier Spieler.\nAcht Stiche. Ein gutes Blatt.  '), '  Four players. Eight tricks. A good hand.  ');
});

test('Atlas country names are localized without translating language-quiz clues', () => {
  for (const [language, expected] of [['de', 'Deutschland'], ['ko', '독일'], ['ru', 'Германия'], ['es', 'Alemania'], ['pt', 'Alemanha']]) assert.equal(translateGameUi(language, 'Germany'), expected);
  const quiz = fs.readFileSync(new URL('../src/components/atlas/trials/LanguageGuesserGame.tsx', import.meta.url), 'utf8');
  assert.match(quiz, /<blockquote lang="und">\{round\.sentence\}<\/blockquote>/);
});
