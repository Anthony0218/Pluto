import test from 'node:test';
import assert from 'node:assert/strict';
import { reviseTodo, validTodo, validShoppingList, addRecipeToList, linkExpense, linkedExpenseTotals } from '../src/data/todoTools.ts';
import { createLifeToolsStore, emptyLifeTools, parseLifeTools } from '../src/data/lifeToolsStorage.ts';
import { toolApps } from '../src/data/toolCatalog.ts';

const todo = { id: 'todo-a', title: 'Original task', notes: 'Details', dueDate: '', priority: 'normal', done: false, deleted: false, createdAt: 100, updatedAt: 100, history: [] };
const list = { id: 'list-a', name: 'Weekend shopping', items: [], expenseLinks: [] };
const recipe = { id: 'recipe-a', name: 'Bowl', servings: 2, foods: [{ name: 'Rice', quantity: 150, unit: 'g', energy: 350 }, { name: 'Tomato', quantity: 1, unit: 'serving', energy: 30 }] };
const memory = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; };

test('tasks, completed tasks, deleted tasks and revision history survive reload and isolate accounts', () => {
  const port = memory(), store = createLifeToolsStore(port);
  assert.equal(store.save('alice', 'todos', todo), true);
  const edited = reviseTodo(todo, { title: 'Updated task', notes: 'Changed notes' }, 200);
  const completed = reviseTodo(edited, { done: true }, 300);
  const deleted = reviseTodo(completed, { deleted: true }, 400);
  assert.equal(store.save('alice', 'todos', deleted), true);
  const reloaded = createLifeToolsStore(port).read('alice').todos[0];
  assert.equal(reloaded.done, true); assert.equal(reloaded.deleted, true);
  assert.deepEqual(reloaded.history.map(r => [r.title, r.done, r.deleted]), [['Original task', false, false], ['Updated task', false, false], ['Updated task', true, false]]);
  const restored = reviseTodo(reloaded, { title: reloaded.history[0].title, deleted: false }, 500);
  assert.equal(store.save('alice', 'todos', restored), true);
  assert.equal(restored.history.at(-1).deleted, true);
  assert.deepEqual(store.read('bob').todos, []); assert.deepEqual(store.read('guest').todos, []);
  assert.equal(reviseTodo(todo, { title: todo.title }), todo, 'unchanged fields do not consume revision capacity');
});
test('snapshot migration preserves existing life apps and rejects only malformed new rows', () => {
  const old = emptyLifeTools(); delete old.todos; delete old.shoppingLists;
  const migrated = parseLifeTools(JSON.stringify(old)); assert.deepEqual(migrated.todos, []); assert.deepEqual(migrated.shoppingLists, []);
  const data = { ...old, todos: [todo, { ...todo, id: 'bad', dueDate: '2026-02-30' }], shoppingLists: [list, { ...list, id: 'bad', items: [null] }] };
  assert.deepEqual(parseLifeTools(JSON.stringify(data)).todos, [todo]); assert.deepEqual(parseLifeTools(JSON.stringify(data)).shoppingLists, [list]);
});
test('history is never silently discarded: reject overflow and invalid writes atomically', () => {
  const store = createLifeToolsStore(memory());
  const full = { ...todo, history: Array.from({ length: 200 }, () => ({ ...todo, at: 100 })) };
  assert.equal(store.save('a', 'todos', full), true);
  assert.equal(store.save('a', 'todos', reviseTodo(full, { title: 'Overflow' }, 200)), false);
  assert.deepEqual(store.read('a').todos, [full]);
  assert.equal(validTodo({ ...todo, history: [{ ...todo, at: 300 }] }), false);
  assert.equal(validTodo({ ...todo, notes: 'x'.repeat(2001) }), false);
});
test('recipe ingredients scale by servings, merge matching units and preserve checked purchases', () => {
  let id = 0;
  const first = addRecipeToList(list, recipe, 4, () => `item-${++id}`);
  assert.equal(first.items[0].quantity, 300); assert.equal(first.items[1].quantity, 2);
  assert.deepEqual(list.items, [], 'import never mutates source list');
  const second = addRecipeToList(first, recipe, 2, () => `item-${++id}`);
  assert.equal(second.items[0].quantity, 450); assert.deepEqual(second.items[0].recipes, ['Bowl']);
  const checked = { ...second, items: second.items.map(i => ({ ...i, done: true })) };
  const third = addRecipeToList(checked, recipe, 2, () => `item-${++id}`);
  assert.equal(third.items.length, 4); assert.equal(third.items[0].quantity, 450); assert.equal(third.items[2].done, false);
  const different = { ...recipe, foods: [{ ...recipe.foods[0], unit: 'serving' }] };
  assert.equal(addRecipeToList(first, different, 2, () => `item-${++id}`).items.length, 3);
  for (const portions of [0, -1, 101, NaN]) assert.equal(addRecipeToList(list, recipe, portions), null);
  const overflow = { ...recipe, foods: [{ ...recipe.foods[0], quantity: 100000 }] };
  assert.equal(addRecipeToList(list, overflow, 4), null);
});
test('shopping lists retain names, edits, purchases and bill references without crossing lists', () => {
  const port = memory(), store = createLifeToolsStore(port);
  let n = 0; const imported = addRecipeToList(list, recipe, 2, () => `item-${++n}`);
  assert.equal(store.save('a', 'shoppingLists', imported), true);
  assert.equal(store.save('a', 'shoppingLists', { ...list, id: 'list-b', name: 'Party' }), true);
  const connected = linkExpense({ ...imported, name: 'Renamed', items: imported.items.map(i => ({ ...i, done: true })) }, { groupId: 'group-a', expenseId: 'bill-a' });
  assert.equal(linkExpense(connected, connected.expenseLinks[0]), connected);
  assert.equal(store.save('a', 'shoppingLists', connected), true);
  const restored = createLifeToolsStore(port).read('a');
  assert.equal(restored.shoppingLists.find(l => l.id === list.id).items[0].done, true);
  assert.equal(restored.shoppingLists.find(l => l.id === 'list-b').items.length, 0);
  assert.equal(validShoppingList({ ...connected, expenseLinks: [...connected.expenseLinks, ...connected.expenseLinks] }), false);
});
test('connected totals follow ledger edits, separate currencies and tolerate inaccessible bills', () => {
  const connected = { ...list, expenseLinks: [{ groupId: 'g-eur', expenseId: 'bill-a' }, { groupId: 'g-usd', expenseId: 'bill-b' }, { groupId: 'missing', expenseId: 'gone' }] };
  const groups = [{ id: 'g-eur', currency: 'EUR', expenses: [{ id: 'bill-a', amount: 1234 }] }, { id: 'g-usd', currency: 'USD', expenses: [{ id: 'bill-b', amount: 500 }] }];
  assert.deepEqual(linkedExpenseTotals(connected, groups), { EUR: 1234, USD: 500 });
  groups[0].expenses[0].amount = 2345;
  assert.deepEqual(linkedExpenseTotals(connected, groups), { EUR: 2345, USD: 500 });
  groups[0].expenses = []; assert.deepEqual(linkedExpenseTotals(connected, groups), { USD: 500 });
});
test('ToDo List is fully available in the tool catalog', () => {
  assert.equal(toolApps.find(t => t.id === 'todo-list').status, 'available');
});
