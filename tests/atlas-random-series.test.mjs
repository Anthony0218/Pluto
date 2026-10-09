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
    assert.ok(order.includes('c'));
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
      assert.ok(order.includes('stat_battle'));
      assert.equal(room.mode, order[0]);
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
function localSeriesHarness(first, length = 3, solo = false, requested, enabled = true) {
  let states = [], refs = [], slot = 0, refSlot = 0;
  const modes = requested ?? ['map-battle', 'closest-wins', 'stat-battle', 'history-battle', 'region-builder'].slice(0, length);
  let params = new URLSearchParams({ ...(enabled ? { random: '1' } : {}), bestOf: String(length), modes: modes.join(',') });
  let location = { pathname: `/games/atlas-arena/${solo ? 'solo' : 'hotseat'}/${first}`, search: `?${params}`, state: null };
  const navigations = [];
  const exports = loadTs('../src/pages/games/AtlasArena/useRandomSeries.ts', {
    react: {
      useState(initial) { const index = slot++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
      useRef(initial) { const index = refSlot++; return refs[index] ?? (refs[index] = {current: initial}); },
    },
    'react-router-dom': {
      useSearchParams: () => [params], useLocation: () => location,
      useNavigate: () => (to, options) => { navigations.push({ to, options }); location = { ...to, state: structuredClone(options.state) }; params = new URLSearchParams(location.search); },
    },
    '../../../games/atlas/modeCatalog': { ONLINE_ARENA_MODES: ARENA_MODES, modeById: id => ARENA_MODES.find(mode => mode.id === id) },
    '../../../games/atlas/randomSeries': { chooseRandomModes, gameWinner, seriesComplete, seriesLength },
  });
  const render = () => { slot = 0; refSlot = 0; return exports.useRandomSeries(location.pathname.split('/').at(-1), solo); };
  render.navigations = navigations;
  render.location = () => location;
  render.reload = () => { states = []; refs = []; return render(); };
  return render;
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
  assert.ok(repaired.order.includes('map-battle'));
  assert.equal(new Set(repaired.order).size, 3);
});

test('final scorecard names each game winner and marks the unused third game', () => {
  const { AtlasRandomSeriesResults } = loadTs('../src/components/atlas/AtlasRandomSeriesResults.tsx', {
    'react-router-dom': { Link: props => React.createElement('a', { href: props.to }, props.children) },
    './AtlasFitContent': { AtlasFitContent: ({children}) => children },
    './AtlasResultHero': loadTs('../src/components/atlas/AtlasResultHero.tsx', {}),
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

test('every mode can open a random series and the drawn mode always starts it', () => {
  const pool = ARENA_MODES.map(mode => mode.id), first = new Set(), positions = new Set();
  for (let index = 0; index < 500; index++) {
    first.add(chooseRandomModes(pool, 3, undefined, seededRandom(`all-random-${index}`))[0]);
    const order = chooseRandomModes(pool, 5, 'map-fill', seededRandom(`included-${index}`));
    positions.add(order.indexOf('map-fill'));
    assert.equal(new Set(order).size, 5);
  }
  assert.deepEqual([...first].sort(), [...pool].sort());
  assert.deepEqual([...positions].sort(), [0]);
});

import { seededRandom } from '../src/games/atlas/random.ts';

test('next game navigates to the correct mode and retains scores across review and reload', () => {
  for (const solo of [true, false]) for (const length of [1, 3, 5]) {
    const order = ['guess-country', 'map-fill', 'language-guesser', 'stat-battle', 'higher-lower'].slice(0, length);
    const render = localSeriesHarness(order[0], length, solo, order);
    let series = render();
    for (let game = 0; game < length; game++) {
      assert.equal(series.mode.id, order[game]);
      const staleFinish = series.finish;
      staleFinish(solo ? {you: (game + 1) * 100} : {'0': 100, '1': 100});
      staleFinish(solo ? {you: 999} : {'0': 999, '1': 0});
      series = render.reload();
      assert.equal(series.results.length, game + 1, 'one result, even with a double click');
      assert.equal(series.reviewing, true);
      assert.deepEqual(series.order, order);
      const calls = render.navigations.length;
      series.next();
      if (game === length - 1) {
        assert.equal(render.navigations.length, calls, 'a completed series cannot start an extra game');
        assert.equal(series.complete, true);
      } else {
        const destination = render.navigations.at(-1);
        assert.equal(destination.to.pathname, `/games/atlas-arena/${solo ? 'solo' : 'hotseat'}/${order[game + 1]}`);
        assert.equal(new URLSearchParams(destination.to.search).get('random'), '1');
        assert.equal(destination.options.replace, true);
        staleFinish({you: 999});
        series = render.reload();
        assert.equal(series.reviewing, false);
        assert.equal(series.mode.id, order[game + 1]);
        assert.equal(series.results.length, game + 1);
        assert.deepEqual(series.results[0].scores, solo ? {you: 100} : {'0': 100, '1': 100});
      }
    }
  }
});

test('a direct mode stays one game even if bestOf is present; a series rematch starts a fresh shuffled run', () => {
  const direct = localSeriesHarness('map-fill', 5, true, undefined, false);
  const single = direct();
  assert.equal(single.enabled, false);
  assert.equal(single.mode.id, 'map-fill');
  single.finish({you: 999}); single.next(); single.reset();
  assert.equal(direct().results.length, 0);
  assert.equal(direct.navigations.length, 0);

  const render = localSeriesHarness('map-fill', 3, true, ['map-fill', 'language-guesser', 'stat-battle']);
  render().finish({you: 100});
  let series = render();
  series.reset(); series = render.reload();
  assert.equal(series.results.length, 0);
  assert.equal(series.reviewing, false);
  assert.equal(series.order.length, 3);
  assert.equal(render.location().pathname.split('/').at(-1), series.order[0]);

  render.location().state.atlasRandomSeries.results = [{mode: series.order[0], scores: {you: 'bad'}, winnerId: null}];
  assert.equal(render.reload().results.length, 0, 'invalid local history cannot contaminate the new game');
});

test('casual series never time out and require two distinct Continue signals after each game', async () => {
  const version = JSON.parse(await readFile(new URL('../data/geography/version.json', import.meta.url), 'utf8')).atlasDataVersion;
  const endpoint = await atlasEndpoint();
  try {
    const invoke = async (user, body) => { const response = await endpoint.call(user, { ...body, datasetVersion: version }); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body; };
    for (const length of [3, 5]) {
      let room = await invoke('alice', { op: 'create', mode: 'map_battle', randomBestOf: length });
      const code = room.code, row = endpoint.matches.at(-1);
      await invoke('bob', { op: 'join', code });
      row.status = 'finished'; row.scores = { alice: 500, bob: 200 };
      room = await invoke('alice', { op: 'get', code });
      assert.equal(room.status, 'intermission'); assert.equal(room.intermissionEndsAt, null); assert.equal(row.resolve_at, null);
      // Even a legacy deadline on a casual room cannot bypass Continue.
      row.resolve_at = new Date(endpoint.now() + 45_000).toISOString();
      endpoint.advance(300_000);
      room = await invoke('bob', { op: 'get', code }); assert.equal(room.status, 'intermission');
      room = await invoke('alice', { op: 'ready', code, requestId: 'continue-alice' });
      assert.equal(room.status, 'intermission'); assert.equal(room.players.filter(p => p.ready).length, 1);
      room = await invoke('alice', { op: 'ready', code, requestId: 'continue-alice' });
      assert.equal(room.status, 'intermission'); assert.equal(room.players.filter(p => p.ready).length, 1);
      endpoint.advance(60_000);
      room = await invoke('bob', { op: 'get', code }); assert.equal(room.status, 'intermission'); assert.equal(room.players[0].ready, true);
      room = await invoke('bob', { op: 'ready', code }); assert.equal(room.status, 'countdown'); assert.equal(row.resolve_at, null);
      endpoint.advance(3000); room = await invoke('bob', { op: 'get', code }); assert.equal(room.status, 'round_active'); assert.equal(room.series.results.length, 1);
    }
  } finally { endpoint.close(); }
});

test('ranked waits indefinitely for both ready signals, then starts the next mode for both players', async () => {
  const version = JSON.parse(await readFile(new URL('../data/geography/version.json', import.meta.url), 'utf8')).atlasDataVersion;
  const endpoint = await atlasEndpoint();
  try {
    const invoke = async (user, body) => { const response = await endpoint.call(user, { ...body, datasetVersion: version }); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body; };
    for (const nextMode of ['map_battle', 'stat_battle', 'extreme_geography']) {
      let room = await invoke('alice', { op: 'create', mode: 'map_battle' }); const code = room.code, row = endpoint.matches.at(-1);
      await invoke('bob', { op: 'join', code });
      row.match_kind = 'ranked'; row.state = { ranked: { bans: { alice: [], bob: [] }, order: ['map_battle', nextMode, 'language_guesser'], gameIndex: 0, wins: {}, results: [] } };
      row.status = 'finished'; row.scores = { alice: 5, bob: 2 };
      room = await invoke('alice', { op: 'get', code }); assert.equal(room.status, 'intermission'); assert.equal(room.intermissionEndsAt, null);
      row.resolve_at = new Date(endpoint.now() + 45_000).toISOString();
      endpoint.advance(300_000);
      room = await invoke('bob', { op: 'get', code }); assert.equal(room.status, 'intermission');
      room = await invoke('alice', { op: 'ready', code, requestId: 'ready-alice' });
      assert.equal(room.status, 'intermission'); assert.equal(room.players.filter(p => p.ready).length, 1);
      room = await invoke('alice', { op: 'ready', code, requestId: 'ready-alice' });
      assert.equal(room.players.filter(p => p.ready).length, 1);
      endpoint.advance(60_000); room = await invoke('bob', { op: 'get', code }); assert.equal(room.status, 'intermission');
      room = await invoke('bob', { op: 'ready', code });
      assert.equal(room.status, 'round_active'); assert.equal(room.mode, nextMode); assert.equal(room.series.results.length, 1);
      const alice = await invoke('alice', { op: 'get', code }); assert.equal(alice.mode, nextMode); assert.equal(alice.status, room.status); assert.equal(alice.question?.id, room.question?.id);
      if (nextMode === 'extreme_geography') assert.ok(room.run);
      if (nextMode === 'stat_battle') assert.ok(room.battle);
      row.status = 'finished'; row.scores = { alice: 4, bob: 1 };
      room = await invoke('alice', { op: 'get', code }); assert.equal(room.status, 'finished'); assert.equal(room.series.wins.alice, 2);
    }
  } finally { endpoint.close(); }
});

test('local series Continue waits for both players and ignores a repeated click', () => {
  let continued = [], nextCalls = 0;
  const ref = { current: [] };
  const { AtlasRandomSeriesResults } = loadTs('../src/components/atlas/AtlasRandomSeriesResults.tsx', {
    react: { useState: () => [continued, next => { continued = next; }], useRef: () => ref },
    'react-router-dom': { Link: props => React.createElement('a', { href: props.to }, props.children) },
    './AtlasFitContent': { AtlasFitContent: ({children}) => children },
    './AtlasResultHero': loadTs('../src/components/atlas/AtlasResultHero.tsx', {}),
    '../../games/atlas/modeCatalog': { modeById: id => ARENA_MODES.find(mode => mode.id === id) },
    '../../games/atlas/randomSeries': { gameWinner, seriesWins, seriesLabel },
  });
  const props = { order: ['map-battle', 'closest-wins', 'stat-battle'], players: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }], results: [{ mode: 'map-battle', winnerId: 'a', scores: { a: 500, b: 200 } }], complete: false, onNext: () => nextCalls++, onAgain() {} };
  const buttons = node => { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(buttons); return [...(node.type === 'button' ? [node] : []), ...buttons(node.props?.children)]; };
  let tree = AtlasRandomSeriesResults(props);
  const [alice, bob] = buttons(tree); alice.props.onClick(); alice.props.onClick(); assert.equal(nextCalls, 0); assert.deepEqual(continued, ['a']);
  tree = AtlasRandomSeriesResults(props); assert.equal(buttons(tree)[0].props.disabled, true); assert.match(renderToStaticMarkup(tree), /1\/2 are ready/);
  bob.props.onClick(); bob.props.onClick(); assert.equal(nextCalls, 1);
  const final = AtlasRandomSeriesResults({ ...props, complete: true }); const html = renderToStaticMarkup(final);
  assert.match(html, /Replay/); assert.match(html, /Back to menu/); assert.doesNotMatch(html, /Continue/); assert.match(html, /atlas-result-particles/);
});

test('ranked and casual result breaks require both ready signals and show the ready count', () => {
  const { AtlasSeriesIntermission } = loadTs('../src/components/atlas/AtlasSeriesIntermission.tsx', {});
  const props = { players: [{ id: 'a', name: 'Alice', ready: false }, { id: 'b', name: 'Bob', ready: true }], userId: 'a', ranked: true, endsAt: new Date(45_000).toISOString(), now: 10_000, gameNumber: 2, modeTitle: 'Stat Battle', busy: false, onReady() {} };
  const html = renderToStaticMarkup(React.createElement(AtlasSeriesIntermission, props));
  assert.doesNotMatch(html, /35s/); assert.match(html, /both players press I&#x27;m ready/); assert.match(html, /1\/2 are ready/);
  const casual = renderToStaticMarkup(React.createElement(AtlasSeriesIntermission, { ...props, ranked: false }));
  assert.doesNotMatch(casual, /35s/); assert.match(casual, /both players press I&#x27;m ready/); assert.match(casual, />I&#x27;m ready</);
  const ready = renderToStaticMarkup(React.createElement(AtlasSeriesIntermission, { ...props, userId: 'b' }));
  assert.match(ready, /disabled=""/); assert.match(ready, /Waiting for opponent/);
});

test('trial completion reports the actual final score once without an extra results click', () => {
  const effects = [];
  const received = [];
  const { GameOverPanel } = loadTs('../src/components/atlas/trials/TrialsUI.tsx', {
    react: { useEffect: fn => effects.push(fn), useRef: initial => ({ current: initial }) },
    '../AtlasFitContent': { AtlasFitContent: ({children}) => children },
    './trialSession': { useTrialSession: () => ({ onComplete: score => received.push(score) }) },
    '../AtlasResultHero': loadTs('../src/components/atlas/AtlasResultHero.tsx', {}),
  });
  GameOverPanel({ title: 'Run complete', score: 1450, best: 1000, stats: [], onRestart() {}, onExit() {} });
  effects[0](); effects[0]();
  assert.deepEqual(received, [1450]);
});

test('chosen-mode rooms finish after one game and Replay keeps the chosen mode', async () => {
  const version = JSON.parse(await readFile(new URL('../data/geography/version.json', import.meta.url), 'utf8')).atlasDataVersion;
  const endpoint = await atlasEndpoint();
  try {
    const invoke = async (user, body) => { const response = await endpoint.call(user, { ...body, datasetVersion: version }); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body; };
    for (const mode of ['map_battle', 'stat_battle', 'extreme_geography']) {
      let room = await invoke('alice', { op: 'create', mode }); const code = room.code, row = endpoint.matches.at(-1);
      await invoke('bob', { op: 'join', code }); row.status = 'finished'; row.scores = { alice: 7, bob: 3 };
      room = await invoke('alice', { op: 'get', code }); assert.equal(room.status, 'finished'); assert.equal(room.series, undefined); assert.equal(room.intermissionEndsAt, null);
      endpoint.advance(60_000); room = await invoke('bob', { op: 'get', code }); assert.equal(room.status, 'finished');
      room = await invoke('alice', { op: 'rematch', code }); assert.equal(room.status, 'ready'); assert.equal(room.mode, mode); assert.equal(room.series, undefined); assert.deepEqual(room.scores, { alice: 0, bob: 0 });
    }
  } finally { endpoint.close(); }
});
