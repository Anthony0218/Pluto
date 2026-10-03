import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_CATEGORIES } from '../src/games/atlas/categories.ts';
import { DEFAULT_SOLO_SETTINGS } from '../src/games/atlas/soloSettings.ts';
import { loadArenaStored, saveArenaStored } from '../src/games/atlas/arenaStorage.ts';

test('all question categories are selected for new settings and the previous default migrates once', () => {
  const previousWindow = globalThis.window;
  let stored = null;
  globalThis.window = { localStorage: { getItem: () => stored, setItem: (_key, value) => { stored = value; } } };
  try {
    const all = QUESTION_CATEGORIES.map(({ id }) => id);
    assert.deepEqual(DEFAULT_SOLO_SETTINGS.categories, all);
    assert.deepEqual(loadArenaStored().settings.categories, all);
    stored = JSON.stringify({ difficulty:'expert', best:{'map-battle:expert':123}, settings:{...DEFAULT_SOLO_SETTINGS,categories:['countries','locations','capitals','flags']} });
    const migrated = loadArenaStored();
    assert.deepEqual(migrated.settings.categories, all);
    assert.equal(migrated.best['map-battle:expert'], 123);
    assert.equal(migrated.difficulty, 'expert');
    saveArenaStored({...migrated,settings:{...migrated.settings,categories:['countries','locations','capitals','flags']}});
    assert.deepEqual(loadArenaStored().settings.categories, ['countries','locations','capitals','flags'], 'explicitly saved selections survive the migration');
    stored = JSON.stringify({difficulty:'intermediate',settings:{...DEFAULT_SOLO_SETTINGS,categories:['languages','borders']}});
    assert.deepEqual(loadArenaStored().settings.categories, ['languages','borders'], 'existing custom selections are preserved');
  } finally { globalThis.window = previousWindow; }
});
