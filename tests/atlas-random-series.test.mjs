import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chooseRandomModes, gameWinner, seriesComplete, seriesLength, seriesWins } from '../src/games/atlas/randomSeries.ts';
import { atlasEndpoint } from './helpers/atlas-endpoint.mjs';

test('random series draw without replacement and end at the correct win target', () => {
  assert.equal(seriesLength(null), 3);
  assert.equal(seriesLength('5'), 5);
  const modes = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (const length of [1, 3, 5]) {
    const order = chooseRandomModes(modes, length, 'c', () => .9);
    assert.equal(order[0], 'c');
    assert.equal(new Set(order).size, length);
    const wins = Array.from({ length: Math.floor(length / 2) + 1 }, (_, i) => ({ mode: order[i], winnerId: 'alice', scores: { alice: 3, bob: 1 } }));
    assert.equal(seriesComplete(length, wins.slice(0, -1)), false);
    assert.equal(seriesComplete(length, wins), true);
    assert.deepEqual(seriesWins(wins, ['alice', 'bob']), { alice: wins.length, bob: 0 });
  }
  assert.equal(gameWinner({ alice: 0, bob: 0 }), null);
  assert.equal(gameWinner({ alice: -1, bob: -3 }), 'alice');
  const draw = { mode: 'a', winnerId: null, scores: { alice: 1, bob: 1 } };
  assert.equal(seriesComplete(3, [draw, draw]), false);
  assert.equal(seriesComplete(3, [draw, draw, draw]), true);
});

test('casual online series persist per-game results, stop early, rematch, and never settle ranks', async () => {
  const version = JSON.parse(await readFile(new URL('../data/geography/version.json', import.meta.url), 'utf8')).atlasDataVersion;
  const endpoint = await atlasEndpoint();
  try {
    const invoke = async (user, body, expected = 200) => {
      const response = await endpoint.call(user, { ...body, datasetVersion: version });
      assert.equal(response.status, expected, JSON.stringify(response.body));
      return response.body;
    };
    for (const length of [1, 3, 5]) {
      let room = await invoke('alice', { op: 'create', mode: 'stat_battle', randomBestOf: length, maxPlayers: 4 });
      const row = endpoint.matches.at(-1), code = room.code, order = [...room.series.order];
      assert.equal(room.maxPlayers, 2);
      assert.equal(order[0], 'stat_battle');
      assert.equal(new Set(order).size, length);
      assert.ok(room.settings.categories.length);
      assert.ok(room.settings.stats.length);
      assert.equal(room.settings.scope, 'Europe');
      await invoke('bob', { op: 'join', code });
      await invoke('third', { op: 'join', code }, 400);
      const target = Math.floor(length / 2) + 1;
      for (let game = 0; game < target; game++) {
        await invoke('alice', { op: 'ready', code });
        room = await invoke('bob', { op: 'ready', code });
        assert.equal(room.status, 'countdown');
        endpoint.advance(3001);
        room = await invoke('alice', { op: 'get', code });
        assert.equal(room.status, 'round_active');
        assert.equal(room.mode, order[game]);
        // End a server-graded game; verify the real handler advances its persisted state.
        row.status = 'finished'; row.scores = { alice: 500, bob: 200 };
        room = await invoke('alice', { op: 'get', code });
        assert.equal(room.series.results.length, game + 1);
        assert.deepEqual(room.series.results[game], { mode: order[game], winnerId: 'alice', scores: { alice: 500, bob: 200 } });
        assert.equal(room.series.wins.alice, game + 1);
        assert.equal(room.status, game + 1 === target ? 'finished' : 'intermission');
        const restored = await invoke('bob', { op: 'get', code });
        assert.deepEqual(restored.series, room.series);
      }
      assert.deepEqual(room.scores, { alice: target, bob: 0 });
      assert.equal(endpoint.results.length, 0);
      room = await invoke('alice', { op: 'rematch', code });
      assert.equal(room.series.results.length, 0);
      assert.equal(room.series.order.length, length);
      assert.equal(new Set(room.series.order).size, length);
      assert.equal(room.mode, room.series.order[0]);
      assert.deepEqual(room.scores, { alice: 0, bob: 0 });
    }
    // Split wins require game three. Draws consume a game and can draw the series.
    for (const scores of [[{ alice: 5, bob: 1 }, { alice: 1, bob: 5 }, { alice: 3, bob: 1 }], Array(3).fill({ alice: 1, bob: 1 })]) {
      let room = await invoke('alice', { op: 'create', mode: 'map_battle', randomBestOf: 3 });
      const row = endpoint.matches.at(-1), code = room.code;
      await invoke('bob', { op: 'join', code });
      for (const [index, score] of scores.entries()) {
        row.status = 'finished'; row.scores = score;
        room = await invoke('alice', { op: 'get', code });
        assert.equal(room.status, index === 2 ? 'finished' : 'intermission');
      }
      assert.equal(room.series.results.length, 3);
      assert.deepEqual(room.scores, scores[0].alice === scores[0].bob ? { alice: 0, bob: 0 } : { alice: 2, bob: 1 });
    }
    for (const invalid of [2, 4, 100, '3', null]) await invoke('alice', { op: 'create', mode: 'map_battle', randomBestOf: invalid }, 400);
  } finally { endpoint.close(); }
});

// Exercise the actual local-series hook and result screen with controlled React state.
function localSeriesHarness(first, length = 3, solo = false, requested) {
  const states = [];
  let slot = 0;
  const modes = requested ?? ['map-battle', 'closest-wins', 'stat-battle', 'territory-battle', 'region-builder'].slice(0, length);
  const params = new URLSearchParams({ random: '1', bestOf: String(length), modes: modes.join(',') });
  const exports = loadTs('../src/pages/games/AtlasArena/useRandomSeries.ts', {
    react: { useState(initial) { const index = slot++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; } },
    'react-router-dom': { useSearchParams: () => [params] },
    '../../../games/atlas/modeCatalog': { ARENA_MODES, modeById: id => ARENA_MODES.find(mode => mode.id === id) },
    '../../../games/atlas/randomSeries': { chooseRandomModes, gameWinner, seriesComplete, seriesLength },
  });
  return () => { slot = 0; return exports.useRandomSeries(first, solo); };
}

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ARENA_MODES } from '../src/games/atlas/modeCatalog.ts';
import { seriesLabel } from '../src/games/atlas/randomSeries.ts';
const require = createRequire(import.meta.url);
function loadTs(path, modules) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', source)(name => modules[name] ?? require(name), exports);
  return exports;
}

test('hotseat retains the mode order and stops after two wins; solo visits all three modes', () => {
  for (const solo of [false, true]) {
    const render = localSeriesHarness('map-battle', 3, solo);
    let series = render();
    const order = [...series.order];
    assert.equal(series.mode.id, 'map-battle');
    for (let game = 0; game < (solo ? 3 : 2); game++) {
      assert.equal(series.mode.id, order[game]);
      series.finish(solo ? { you: 500 } : { '0': 300, '1': 100 });
      series = render();
      assert.equal(series.reviewing, true);
      assert.equal(series.results.length, game + 1);
      assert.deepEqual(series.order, order);
      assert.equal(series.complete, game + 1 === (solo ? 3 : 2));
      if (!series.complete) { series.next(); series = render(); assert.equal(series.reviewing, false); }
    }
    assert.equal(series.results[0].winnerId, solo ? null : '0');
    series.reset(); series = render();
    assert.equal(series.reviewing, false);
    assert.equal(series.results.length, 0);
    assert.equal(series.order.length, 3);
    assert.equal(new Set(series.order).size, 3);
  }
  const repaired = localSeriesHarness('map-battle', 3, false, ['unknown', 'map-battle', 'map-battle'])();
  assert.equal(repaired.order[0], 'map-battle');
  assert.equal(new Set(repaired.order).size, 3);
});

test('final scorecard names each game winner and marks the unused third game', () => {
  const { AtlasRandomSeriesResults } = loadTs('../src/components/atlas/AtlasRandomSeriesResults.tsx', {
    'react-router-dom': { Link: props => React.createElement('a', { href: props.to }, props.children) },
    '../../games/atlas/modeCatalog': { modeById: id => ARENA_MODES.find(mode => mode.id === id) },
    '../../games/atlas/randomSeries': { gameWinner, seriesWins, seriesLabel },
  });
  const props = { order: ['map-battle', 'closest-wins', 'stat-battle'], players: [{ id: '0', name: 'Alice' }, { id: '1', name: 'Bob' }], results: [{ mode: 'map-battle', winnerId: '0', scores: { '0': 500, '1': 200 } }, { mode: 'closest-wins', winnerId: '0', scores: { '0': 900, '1': 100 } }], complete: true, onNext() {}, onAgain() {} };
  const html = renderToStaticMarkup(React.createElement(AtlasRandomSeriesResults, props));
  assert.match(html, /Alice wins the series/);
  assert.match(html, /2 – 0/);
  assert.equal((html.match(/Alice won/g) ?? []).length, 2);
  assert.match(html, /Alice: 500 · Bob: 200/);
  assert.match(html, /Not needed/);
  assert.doesNotMatch(html, /Next game/);
});
