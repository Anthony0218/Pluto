import test from 'node:test';
import assert from 'node:assert/strict';
import { decimalInput, calculatePercentage, percentageModes, numberBases, parseBaseInteger, baseRepresentations, toggleBit, placeValueTerms } from '../src/data/practicalMath.ts';
import { convertUnit, units } from '../src/data/unitConversions.ts';
import { recipeQuantity, scaleRecipe, createRecipeStore, parseSavedRecipes } from '../src/data/recipes.ts';
import { percentageActivities, percentageLessons } from '../src/data/everydayPercentages.ts';
import { gradeMathAnswer } from '../src/data/mathFoundations.ts';
import { createLearningToolsStore } from '../src/data/learningToolsProgress.ts';
import { toolApps } from '../src/data/toolCatalog.ts';
const near = (actual, expected) => assert.ok(typeof actual === 'number' && Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10, `${actual} ≈ ${expected}`);
const storage = () => { const entries = new Map(); return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }; };

test('percentage modes agree with independently calculated examples', () => {
  const cases = [['amount', 80, 25, 0, 20], ['share', 30, 120, 0, 25], ['discount', 80, 25, 0, 60], ['successive', 100, 20, 10, 72], ['vat-add', 100, 20, 0, 120], ['vat-remove', 120, 20, 0, 100], ['change', 80, 100, 0, 25], ['reverse-increase', 120, 20, 0, 100], ['reverse-decrease', 80, 20, 0, 100], ['points', 40, 50, 0, 10], ['compound', 1000, 5, 2, 1102.5], ['tip', 60, 10, 3, 22], ['scale', 4, 6, 0, 1.5]];
  assert.equal(cases.length, percentageModes.length);
  for (const [mode, a, b, c, expected] of cases) near(calculatePercentage(mode, a, b, c).result, expected);
  near(calculatePercentage('successive', 100, 20, 10).extra.value, 28);
  near(calculatePercentage('successive', 0, 20, 10).extra.value, 28);
  near(calculatePercentage('points', 40, 50).extra.value, 25);
  near(calculatePercentage('vat-remove', 120, 20).extra.value, 20);
});

test('inverse percentages recover their starting values across rates', () => {
  for (const original of [0, 1, 19.99, 123456]) for (const rate of [0, .5, 25, 99]) {
    const discounted = calculatePercentage('discount', original, rate).result;
    near(calculatePercentage('reverse-decrease', discounted, rate).result, original);
    const gross = calculatePercentage('vat-add', original, rate).result;
    near(calculatePercentage('vat-remove', gross, rate).result, original);
  }
  near(calculatePercentage('change', 100, 80).result, -20);
  near(calculatePercentage('compound', 500, 0, 3).result, 500);
  near(calculatePercentage('compound', 500, -100, 0).result, 500);
  near(calculatePercentage('compound', 500, -100, 2).result, 0);
});

test('percentage input rejects invalid bases, rates, periods and nonnumeric input', () => {
  for (const value of ['', 'Infinity', 'NaN', '2+2', '1/2', '1,000.5', '5%', '1e6']) assert.equal(decimalInput(value), null, value);
  assert.equal(decimalInput('1,25'), 1.25); assert.equal(decimalInput('−20.5'), -20.5);
  for (const args of [['share', 1, 0], ['change', 0, 10], ['discount', 100, 101], ['reverse-decrease', 0, 100], ['compound', 100, 5, 1.5], ['compound', 100, 5, 101], ['compound', 100, -101, 2], ['tip', 10, 5, 0], ['tip', 10, 5, 2.5], ['scale', 0, 2], ['points', 101, 50], ['amount', NaN, 2]]) assert.equal(typeof calculatePercentage(...args), 'string', JSON.stringify(args));
});

test('number conversion is exact beyond JavaScript safe integer precision', () => {
  const value = parseBaseInteger('9007199254740993', 10);
  assert.equal(value, 9007199254740993n); assert.equal(baseRepresentations(value)[16], '20000000000001');
  for (const candidate of [0n, 42n, -42n, value, (1n << 200n) + 123n]) for (const base of numberBases) assert.equal(parseBaseInteger(baseRepresentations(candidate)[base], base), candidate);
  assert.equal(parseBaseInteger('0xFF', 16), 255n); assert.equal(parseBaseInteger('-0b101', 2), -5n); assert.equal(parseBaseInteger('0o77', 8), 63n);
  assert.equal(parseBaseInteger('0BAD', 16), 2989n); assert.equal(parseBaseInteger('0B', 16), 11n);
  assert.notEqual(parseBaseInteger('-0x' + 'F'.repeat(256), 16), null);
  for (const [input, base] of [['102', 2], ['8', 8], ['12a', 10], ['FG', 16], ['0xFF', 10], ['0b10', 10], ['1.5', 10], ['', 10], ['+', 10], ['1 0', 2], ['1'.repeat(257), 2]]) assert.equal(parseBaseInteger(input, base), null, input);
});

test('place values and interactive bits preserve the number', () => {
  for (const value of [0n, 1n, 42n, 65535n]) for (const bit of [0, 3, 15]) { const changed = toggleBit(value, bit); assert.equal(toggleBit(changed, bit), value); assert.equal(changed - value, (value & (1n << BigInt(bit))) ? -(1n << BigInt(bit)) : 1n << BigInt(bit)); }
  for (const base of numberBases) assert.equal(placeValueTerms(9007199254740993n, base).reduce((sum, term) => sum + term.value, 0n), 9007199254740993n);
  for (const value of [-1n, 65536n]) assert.throws(() => toggleBit(value, 0), RangeError);
});

test('unit conversions distinguish powers, offsets and binary prefixes', () => {
  for (const [value, from, to, expected] of [[1, 'in', 'cm', 2.54], [1, 'lb', 'kg', .45359237], [1, 'USgal', 'L', 3.785411784], [36, 'kmh', 'ms', 10], [0, 'C', 'F', 32], [100, 'C', 'F', 212], [0, 'K', 'C', -273.15], [1, 'km2', 'm2', 1000000], [1, 'm3', 'L', 1000], [1, 'kB', 'B', 1000], [1, 'KiB', 'B', 1024], [8, 'bit', 'B', 1], [1e12, 'km', 'm', 1e15]]) near(convertUnit(value, from, to), expected);
  for (const from of units) for (const to of units.filter(item => item.group === from.group)) {
    const initial = from.group === 'Temperature' ? 300 : 123.45;
    near(convertUnit(convertUnit(initial, from.id, to.id), to.id, from.id), initial);
  }
  for (const [value, from, to] of [[1, 'm', 'kg'], [-1, 'kg', 'g'], [-273.151, 'C', 'K'], [-1, 'K', 'C'], [Infinity, 'm', 'ft'], [1, 'fake', 'm']]) assert.equal(convertUnit(value, from, to), null);
});
const recipe = { id: 'recipe-a', name: 'Example', servings: '4', ingredients: [{ id: 'flour', name: 'Flour', quantity: '200', unit: 'g' }, { id: 'milk', name: 'Milk', quantity: '1/2', unit: 'L' }] };

test('recipe scaling accepts fractions and preserves original quantities and units', () => {
  assert.equal(recipeQuantity('1/2'), .5); assert.equal(recipeQuantity('0,5'), .5); assert.equal(recipeQuantity('1/0'), null); assert.equal(recipeQuantity('-1'), null);
  assert.deepEqual(scaleRecipe(recipe, '6'), { factor: 1.5, quantities: [300, .75] });
  assert.deepEqual(scaleRecipe(recipe, '2'), { factor: .5, quantities: [100, .25] });
  assert.equal(recipe.ingredients[0].quantity, '200'); assert.equal(recipe.ingredients[1].unit, 'L');
  for (const target of ['0', '-1', '1001', '1/0', 'abc']) assert.equal(scaleRecipe(recipe, target), null);
  assert.equal(scaleRecipe({ ...recipe, servings: '0' }, '6'), null);
  assert.equal(scaleRecipe({ ...recipe, ingredients: [{ ...recipe.ingredients[0], name: '' }] }, '6'), null);
});

test('saved recipes survive reload, update in place, and remain separate per account', () => {
  const port = storage(), a = createRecipeStore(port), b = createRecipeStore(port);
  assert.equal(a.save('alice', recipe), true); assert.equal(createRecipeStore(port).read('alice')[0].ingredients[1].quantity, '1/2');
  assert.deepEqual(a.read('bob'), []); assert.deepEqual(a.read('guest'), []);
  a.save('alice', { ...recipe, name: 'Renamed' }); assert.equal(a.read('alice').length, 1);
  let changes = 0; b.read('alice'); b.subscribe('alice', () => changes++); b.sync('pluto-recipes-v1:alice'); assert.equal(b.read('alice')[0].name, 'Renamed'); assert.equal(changes, 1);
  a.remove('alice', 'recipe-a'); b.sync('pluto-recipes-v1:alice'); assert.deepEqual(b.read('alice'), []);
  assert.deepEqual(parseSavedRecipes('broken'), []); assert.deepEqual(parseSavedRecipes(JSON.stringify([null, { ...recipe, servings: '-1' }, recipe, recipe])), [recipe]);
});

test('unavailable storage and recipe limits give predictable behavior', () => {
  const store = createRecipeStore(null); store.save('guest', recipe); assert.equal(store.isVolatile('guest'), true); assert.equal(store.read('guest'), store.read('guest')); assert.deepEqual(store.read('guest'), [recipe]);
  const persistent = createRecipeStore(storage()); for (let i = 0; i < 50; i++) assert.equal(persistent.save('alice', { ...recipe, id: `recipe-${i}` }), true);
  assert.equal(persistent.save('alice', { ...recipe, id: 'recipe-51' }), false); assert.equal(persistent.save('alice', { ...recipe, id: 'recipe-0' }), true);
  assert.equal(persistent.save('alice', { ...recipe, name: '' }), false);
});

test('all nine percentage scenarios have audited practice answers and saved progress', () => {
  const expected = [[90, 42, 25], [72, 25, 28], [220, 200, 16], [25, 80, -20], [2100, 10, 20], [46, 22, 1], [300, 150, 50], [25, 10, 25], [1102.5, 42, 500]];
  assert.equal(percentageLessons.length, 9);
  for (const [index, activity] of percentageActivities.entries()) {
    assert.equal(activity.practice.length, 3); assert.equal(new Set(activity.practice.map(item => item.id)).size, 3);
    activity.practice.forEach((item, question) => assert.equal(gradeMathAnswer(item.answer, String(expected[index][question])), 'correct', `${activity.id}/${item.id}`));
    assert.ok(activity.check && activity.example.verification);
  }
  const port = storage(), store = createLearningToolsStore(port);
  store.recordSolvedExercise('alice', percentageActivities[0].id, 'p1'); store.recordSolvedExercise('alice', percentageActivities[0].id, 'fake');
  assert.deepEqual(createLearningToolsStore(port).read('alice').solvedExercises[percentageActivities[0].id], ['p1']); assert.deepEqual(store.read('bob').solvedExercises, {});
  assert.deepEqual(toolApps.filter(item => item.status === 'available').map(item => item.id), ['percentage-calculator', 'number-system-converter', 'unit-converter', 'recipe-scaler', 'workout-timer', 'bill-splitter', 'time-zone-planner', 'function-plotter', 'budget-tracker', 'subscription-tracker', 'calorie-tracker', 'weather-explorer', 'day-planner']);
});
