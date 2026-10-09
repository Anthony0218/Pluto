import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as randomSeries from '../src/games/atlas/randomSeries.ts';
import { ARENA_MODES } from '../src/games/atlas/modeCatalog.ts';
import { areaReferenceCountry, areaValuesFromText } from '../src/games/atlas/areaReferences.ts';
import { buildTrialCountries } from '../src/games/atlas/trials/countryStats.ts';
import { createGuesserRun, guesserClues } from '../src/games/atlas/trials/countryGuesser.ts';
const require = createRequire(import.meta.url);
const countries = JSON.parse(readFileSync(new URL('../data/geography/countries.json', import.meta.url), 'utf8'));
const extras = JSON.parse(readFileSync(new URL('../data/geography/extras.json', import.meta.url), 'utf8'));
const pool = buildTrialCountries(countries, extras);

test('region and area are revealed together and references never repeat any answer option', () => {
  for (const country of pool) {
    const clues = guesserClues(country, () => .999);
    const region = clues.find(clue => clue.kind === "region");
    if (region) assert.ok(areaValuesFromText(region.text).length > 0, country.name);
    assert.equal(clues.filter(clue => clue.kind !== "region").flatMap(clue => areaValuesFromText(clue.text)).length, 0);
  }
  const slovakia = countries.find(country => country.iso3 === 'SVK');
  assert.equal(areaReferenceCountry(slovakia.areaKm2.value, countries).id, slovakia.id);
  assert.notEqual(areaReferenceCountry(slovakia.areaKm2.value, countries, [slovakia.id]).id, slovakia.id);
  for (let index = 0; index < 100; index++) {
    const round = createGuesserRun(pool, `area-reference-${index}`).round;
    for (const value of round.clues.flatMap(clue => areaValuesFromText(clue.text))) {
      const reference = areaReferenceCountry(value, countries, round.optionIds);
      assert.ok(reference);
      assert.ok(!round.optionIds.includes(reference.id));
    }
  }
  assert.equal(areaReferenceCountry(50000, [slovakia], [slovakia.id]), null);
});

function harness(query = '', reducedMotion = false) {
  const states = [], refs = [], cleanups = [], timers = new Map(), delays = [], navigations = [];
  let stateSlot = 0, refSlot = 0, timerId = 0;
  const react = {
    useState(initial) { const index = stateSlot++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef(initial) { const index = refSlot++; return refs[index] ?? (refs[index] = {current: initial}); },
    useEffect(effect) { if (!cleanups.length) cleanups.push(effect()); },
  };
  const modules = {
    react,
    '../../../components/atlas/AtlasMastery': {AtlasMastery:()=>null},
    'react-router-dom': {Link: 'a', useNavigate: () => url => navigations.push(url), useSearchParams: () => [new URLSearchParams(query)]},
    '../../../games/atlas/randomSeries': randomSeries,
    '../../../games/atlas/arenaStorage': {bestKey: id => id},
    '../../../games/atlas/modeCatalog': {ARENA_MODES},
    '../../../games/atlas/soloSettings': {DIFFICULTY_LABELS: {}},
    '../../../games/atlas/useAtlasData': {useAtlasData: () => ({data: null})},
    './useArenaStore': {MODE_ICONS: Object.fromEntries(ARENA_MODES.map(mode => [mode.id, 'svg'])), useArenaStore: () => ({stored: {difficulty: 'beginner', best: {},settings:{scope:'Europe'}}, update() {}})},
    './AtlasRankedTab': {AtlasRankedTab: () => null},
    './atlas-arena.css': {}, '../../../components/atlas/trials/atlas-trials.css': {},
  };
  const source = ts.transpileModule(readFileSync(new URL('../src/pages/games/AtlasArena/AtlasArenaPage.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023},
  }).outputText;
  const exports = {};
  new Function('require', 'exports', 'setTimeout', 'clearTimeout', 'window', source + '\nexports.RandomModeChoice = RandomModeChoice;')(
    name => name.endsWith('/i18n/gameUi.ts') ? { gameUi: value => value, useGameLanguage: () => ({ language: 'en' }) } : modules[name] ?? require(name), exports,
    (callback, delay) => { const id = ++timerId; timers.set(id, callback); delays.push(delay); return id; },
    id => timers.delete(id), {matchMedia: () => ({matches: reducedMotion})},
  );
  return {
    render(Component = exports.default, props = {}) { stateSlot = 0; refSlot = 0; return Component(props); },
    step() { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
    timers, delays, navigations, RandomModeChoice: exports.RandomModeChoice,
  };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree.type === 'function' && tree.type.name === 'PlayChoiceActions') return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props?.children)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
const buttons = tree => nodes(tree).filter(node => node.type === 'button');
const chooseCard = tree => find(tree, node => node.props?.className === 'atlas-play-choice is-choose');
const randomElement = tree => find(tree, node => node.type?.name === 'RandomModeChoice');
const actionButtons = tree => buttons(tree).filter(node => typeof node.props.children?.[1]?.props?.children === 'string');

test('Casual, Ranked, Modes tab order and choosing, clearing, background reset and launching', () => {
  const h = harness();
  let tree = h.render();
  const nav = find(tree, node => node.type === 'nav');
  assert.deepEqual(buttons(nav).map(node => node.props.children), ['Casual', 'Ranked', 'Modes', 'Mastery']);
  const mode = ARENA_MODES[4];
  const select = () => { buttons(chooseCard(h.render())).find(node => node.props['aria-label'] === mode.title).props.onClick(); tree = h.render(); };
  select();
  assert.equal(find(chooseCard(tree), node => node.type === 'h3').props.children, mode.title);
  for (const [index, url] of [`/games/atlas-arena/solo/${mode.id}`, `/games/atlas-arena/multiplayer?mode=${mode.online}`, `/games/atlas-arena/hotseat/${mode.id}`].entries()) {
    actionButtons(chooseCard(tree))[index].props.onClick();
    assert.equal(h.navigations.at(-1), url);
  }
  chooseCard(tree).props.onClick({target: {closest: () => ({})}});
  assert.equal(find(chooseCard(h.render()), node => node.type === 'h3').props.children, mode.title, 'nested buttons preserve the selected mode');
  chooseCard(tree).props.onClick({target: {closest: () => null}});
  assert.ok(buttons(chooseCard(h.render())).some(node => node.props.children === 'Choose'));
  select();
  buttons(chooseCard(tree)).find(node => node.props['aria-label'] === 'Clear mode selection').props.onClick();
  tree = h.render();
  buttons(chooseCard(tree)).find(node => node.props.children === 'Choose').props.onClick();
  assert.ok(find(h.render(), node => node.props?.['aria-label'] === 'Atlas Arena modes'));
  assert.ok(chooseCard(harness('tab=play').render()), 'old Play links still open Casual');
});

test('only ? reveals roulette, its highlight slows down, and every launch uses the winner', () => {
  const parent = harness();
  const element = randomElement(parent.render());
  const h = harness();
  const render = () => h.render(h.RandomModeChoice, element.props);
  const oldRandom = Math.random;
  try {
    Math.random = () => .37;
    let tree = render();
    assert.equal(find(tree, node => node.props?.['aria-label'] === 'Random mode roulette'), undefined);
    assert.equal(tree.props.onClick, undefined, 'the card background does not spin');
    const expected = ARENA_MODES[Math.floor(.37 * ARENA_MODES.length)];
    for (const [index, url] of [`/games/atlas-arena/solo/${expected.id}`, `/games/atlas-arena/multiplayer?mode=${expected.online}`, `/games/atlas-arena/hotseat/${expected.id}`].entries()) {
      actionButtons(tree)[index].props.onClick();
      const launched = new URL(parent.navigations.at(-1), 'http://atlas.test');
      const expectedUrl = new URL(url, 'http://atlas.test');
      const order = launched.searchParams.get('modes').split(',');
      assert.equal(launched.pathname, index === 1 ? expectedUrl.pathname : `/games/atlas-arena/${index === 0 ? 'solo' : 'hotseat'}/${order[0]}`);
      assert.equal(launched.searchParams.get('mode'), expectedUrl.searchParams.get('mode'));
      assert.equal(launched.searchParams.get('random'), '1');
      assert.equal(launched.searchParams.get('bestOf'), '3');
      assert.equal(new Set(launched.searchParams.get('modes').split(',')).size, 3);
      assert.ok(launched.searchParams.get('modes').split(',').includes(expected.id));
      assert.ok(launched.searchParams.get('series'));
    }
    assert.equal(find(render(), node => node.props?.['aria-label'] === 'Random mode roulette'), undefined);
    buttons(tree).find(node => node.props['aria-label'] === 'Spin for a random mode').props.onClick();
    tree = render();
    const roulette = find(tree, node => node.props?.['aria-label'] === 'Random mode roulette');
    assert.equal(nodes(roulette).filter(node => node.props?.["aria-disabled"] === "true").length, ARENA_MODES.length);
    assert.ok(actionButtons(tree).every(node => node.props.disabled));
    while (h.timers.size) {
      tree = render();
      assert.equal(nodes(tree).filter(node => node.props?.className === 'is-highlighted').length, 1);
      h.step();
    }
    tree = render();
    assert.ok(h.delays.length >= ARENA_MODES.length * 2);
    assert.ok(h.delays.at(-1) > h.delays[0] * 5);
    assert.ok(h.delays.every((delay, index) => index === 0 || delay > h.delays[index - 1]));
    assert.equal(find(tree, node => node.props?.className === 'is-highlighted').props['aria-label'], expected.title);
    assert.ok(actionButtons(tree).every(node => !node.props.disabled));
    Math.random = () => .99;
    for (let index = 0; index < 3; index++) actionButtons(tree)[index].props.onClick();
    assert.deepEqual(parent.navigations.slice(-3).map(url => new URL(url, 'http://atlas.test').pathname), [`/games/atlas-arena/solo/${expected.id}`, '/games/atlas-arena/multiplayer', `/games/atlas-arena/hotseat/${expected.id}`]);
    assert.ok(parent.navigations.slice(-3).every(url => new URL(url, 'http://atlas.test').searchParams.get('modes').split(',')[0] === expected.id));
  } finally { Math.random = oldRandom; }
});

test('roulette cancels its timer on unmount and respects reduced motion', () => {
  for (const reduced of [false, true]) {
    const element = randomElement(harness().render());
    const h = harness('', reduced);
    let tree = h.render(h.RandomModeChoice, element.props);
    buttons(tree).find(node => node.props['aria-label'] === 'Spin for a random mode').props.onClick();
    tree = h.render(h.RandomModeChoice, element.props);
    assert.equal(h.timers.size, reduced ? 0 : 1);
    if (reduced) assert.ok(actionButtons(tree).every(node => !node.props.disabled));
    h.unmount();
    assert.equal(h.timers.size, 0);
  }
});

test('random picker X cancels an active spin, restores ?, and permits another spin', () => {
  const element = randomElement(harness().render()), h = harness();
  const render = () => h.render(h.RandomModeChoice, element.props);
  const spin = () => buttons(render()).find(node => node.props['aria-label'] === 'Spin for a random mode').props.onClick();
  const reset = () => buttons(render()).find(node => node.props['aria-label'] === 'Reset random mode').props.onClick();
  spin();
  assert.equal(h.timers.size, 1);
  reset();
  assert.equal(h.timers.size, 0);
  assert.ok(buttons(render()).some(node => node.props['aria-label'] === 'Spin for a random mode'));
  assert.ok(actionButtons(render()).every(node => !node.props.disabled));
  spin();
  while (h.timers.size) h.step();
  assert.equal(nodes(render()).filter(node => node.props?.['aria-disabled'] === 'true').length, ARENA_MODES.length);
  reset();
  assert.equal(find(render(), node => node.props?.['aria-label'] === 'Random mode roulette'), undefined);
  spin();
  assert.equal(h.timers.size, 1);
  h.unmount();
});


test('random match formats default to BO3 and launch one, three or five distinct modes', () => {
  const parent = harness(), element = randomElement(parent.render()), h = harness();
  const render = () => h.render(h.RandomModeChoice, element.props);
  const formats = () => buttons(render()).filter(node => node.props.role === 'radio');
  assert.deepEqual(formats().map(node => node.props.children), ['One game', 'Best of 3', 'Best of 5']);
  assert.deepEqual(formats().map(node => node.props['aria-checked']), [false, true, false]);
  for (const [index, length] of [1, 3, 5].entries()) {
    formats()[index].props.onClick();
    actionButtons(render())[2].props.onClick();
    const params = new URL(parent.navigations.at(-1), 'http://atlas.test').searchParams;
    assert.equal(params.get('bestOf'), String(length));
    const modes = params.get('modes').split(',');
    assert.equal(modes.length, length);
    assert.equal(new Set(modes).size, length);
  }
});
