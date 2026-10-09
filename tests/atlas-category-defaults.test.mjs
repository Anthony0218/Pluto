import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BATTLE_CATEGORIES } from '../src/games/atlas/categories.ts';
import { DEFAULT_SOLO_SETTINGS } from '../src/games/atlas/soloSettings.ts';
import { loadArenaStored, saveArenaStored } from '../src/games/atlas/arenaStorage.ts';

test('Map Battle offers only location categories, and saved fact categories and the map region are not restored', () => {
  const previousWindow = globalThis.window;
  let stored = null;
  globalThis.window = { localStorage: { getItem: () => stored, setItem: (_key, value) => { stored = value; } } };
  try {
    const all = MAP_BATTLE_CATEGORIES.map(({ id }) => id);
    assert.deepEqual(all, ['countries', 'locations', 'capitals', 'flags']);
    assert.equal(DEFAULT_SOLO_SETTINGS.scope, 'World');
    assert.deepEqual(DEFAULT_SOLO_SETTINGS.categories, all);
    assert.deepEqual(loadArenaStored().settings.categories, all);
    stored = JSON.stringify({ difficulty:'expert', best:{'map-battle:expert':123}, settings:{...DEFAULT_SOLO_SETTINGS,categories:['countries','locations','capitals','flags']} });
    const migrated = loadArenaStored();
    assert.deepEqual(migrated.settings.categories, all);
    assert.equal(migrated.best['map-battle:expert'], 123);
    assert.equal(migrated.difficulty, 'expert');
    saveArenaStored({...migrated,settings:{...migrated.settings,categories:['countries','locations','capitals','flags']}});
    assert.deepEqual(loadArenaStored().settings.categories, ['countries','locations','capitals','flags'], 'explicitly saved selections survive the migration');
    stored = JSON.stringify({difficulty:'intermediate',settings:{...DEFAULT_SOLO_SETTINGS,categories:['languages','borders','capitals']}});
    assert.deepEqual(loadArenaStored().settings.categories, ['capitals'], 'fact categories are dropped from saved selections');
    stored = JSON.stringify({difficulty:'intermediate',settings:{...DEFAULT_SOLO_SETTINGS,categories:['languages','borders']}});
    assert.deepEqual(loadArenaStored().settings.categories, all, 'a selection left empty falls back to the defaults');
    stored = JSON.stringify({difficulty:'intermediate',settings:{...DEFAULT_SOLO_SETTINGS,scope:'Europe'}});
    assert.equal(loadArenaStored().settings.scope, 'World', 'every new game starts on the whole world');
  } finally { globalThis.window = previousWindow; }
});
