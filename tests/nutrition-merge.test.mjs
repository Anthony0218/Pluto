import test from 'node:test';
import assert from 'node:assert/strict';
import { scaledRecipeFoods, totalCalories } from '../src/data/calorieTools.ts';
import { createLifeToolsStore } from '../src/data/lifeToolsStorage.ts';

const foods = [{ name: 'Rice', quantity: 200, energy: 350, unit: 'g', nutrients: { protein: 7 } }];
test('legacy saved meals retain adjustable portions without changing their saved quantities', () => {
  const meal = { id: 'old-meal', name: 'Lunch', foods };
  const data = new Map([['pluto-life-tools-v1:alice', JSON.stringify({ version: 1, savedMeals: [meal] })]]);
  const store = createLifeToolsStore({ getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) });
  const recipe = { ...meal, servings: 1 };
  assert.equal(totalCalories(scaledRecipeFoods(recipe, 1.5)), 1050);
  assert.deepEqual(meal.foods, foods);
  assert.deepEqual(store.read('alice').savedMeals, [meal]);
});
test('new multi-serving and fractional recipes log the selected portion count accurately', () => {
  const recipe = { id: 'new-recipe', name: 'Rice', servings: 4, foods };
  assert.equal(scaledRecipeFoods(recipe, 2)[0].quantity, 100);
  assert.equal(scaledRecipeFoods({ ...recipe, servings: .5 }, 1)[0].quantity, 400);
  assert.equal(scaledRecipeFoods(recipe, .5)[0].quantity, 25);
  for (const portions of [0, -1, NaN, Infinity, 100000]) assert.equal(scaledRecipeFoods(recipe, portions), null);
});
