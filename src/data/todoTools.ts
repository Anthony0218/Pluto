import { validDate, type ExpenseGroup } from './lifeTools.ts';
import { validNutritionRecipe, type NutritionRecipe } from './calorieTools.ts';

export type TodoContent = { title: string; notes: string; priority: 'normal' | 'high'; dueDate: string; done: boolean; deleted: boolean };
export type TodoRevision = TodoContent & { at: number };
export type Todo = TodoContent & { id: string; createdAt: number; updatedAt: number; history: TodoRevision[] };
export type ShoppingItem = { id: string; name: string; quantity: number; unit: 'g' | 'serving' | 'piece' | 'kg' | 'l' | 'ml'; done: boolean; recipes: string[] };
export type ExpenseLink = { groupId: string; expenseId: string };
export type ShoppingList = { id: string; name: string; items: ShoppingItem[]; expenseLinks: ExpenseLink[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(v);
const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string' && (empty || !!v.trim()) && v.length <= max;
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 4102444800000;
const content = (v: unknown): boolean => object(v) && text(v.title, 100) && text(v.notes, 2000, true) && ['normal', 'high'].includes(v.priority as string) && (v.dueDate === '' || validDate(v.dueDate)) && typeof v.done === 'boolean' && typeof v.deleted === 'boolean';
export const validTodo = (v: unknown): v is Todo => object(v) && id(v.id) && content(v) && time(v.createdAt) && time(v.updatedAt) && v.updatedAt >= v.createdAt && Array.isArray(v.history) && v.history.length <= 200 && v.history.every((r, index, rows) => content(r) && object(r) && time(r.at) && r.at >= (v.createdAt as number) && r.at <= (v.updatedAt as number) && (index === 0 || r.at >= rows[index - 1].at));
export const validShoppingItem = (v: unknown): v is ShoppingItem => object(v) && id(v.id) && text(v.name, 100) && typeof v.quantity === 'number' && Number.isFinite(v.quantity) && v.quantity > 0 && v.quantity <= 100000 && Math.abs(v.quantity * 100 - Math.round(v.quantity * 100)) < 1e-6 && ['g', 'serving', 'piece', 'kg', 'l', 'ml'].includes(v.unit as string) && typeof v.done === 'boolean' && Array.isArray(v.recipes) && v.recipes.length <= 100 && v.recipes.every(n => text(n, 100)) && new Set(v.recipes).size === v.recipes.length;
export const validShoppingList = (v: unknown): v is ShoppingList => object(v) && id(v.id) && text(v.name, 100) && Array.isArray(v.items) && v.items.length <= 500 && v.items.every(validShoppingItem) && new Set(v.items.map(i => i.id)).size === v.items.length && Array.isArray(v.expenseLinks) && v.expenseLinks.length <= 200 && v.expenseLinks.every(l => object(l) && id(l.groupId) && id(l.expenseId)) && new Set(v.expenseLinks.map(l => `${l.groupId}/${l.expenseId}`)).size === v.expenseLinks.length;

export function reviseTodo(todo: Todo, changes: Partial<TodoContent>, now = Date.now()): Todo {
  const { title, notes, priority, dueDate, done, deleted } = todo;
  if (Object.entries(changes).every(([key, value]) => todo[key as keyof TodoContent] === value)) return todo;
  return { ...todo, ...changes, updatedAt: Math.max(now, todo.updatedAt), history: [...todo.history, { title, notes, priority, dueDate, done, deleted, at: todo.updatedAt }] };
}

/** Combine only matching names AND units, preserving checked purchases as separate rows. */
export function addRecipeToList(list: ShoppingList, recipe: NutritionRecipe, servings: number, makeId: () => string = () => crypto.randomUUID()): ShoppingList | null {
  if (!validNutritionRecipe(recipe) || !Number.isFinite(servings) || servings <= 0 || servings > 100) return null;
  const items = list.items.map(item => ({ ...item, recipes: [...item.recipes] }));
  for (const food of recipe.foods) {
    const quantity = Math.max(.01, Math.round(food.quantity * servings / recipe.servings * 100) / 100);
    const existing = items.find(item => !item.done && item.name.trim().toLocaleLowerCase() === food.name.trim().toLocaleLowerCase() && item.unit === food.unit);
    if (existing) { existing.quantity = Math.round((existing.quantity + quantity) * 100) / 100; if (!existing.recipes.includes(recipe.name)) existing.recipes.push(recipe.name); }
    else items.push({ id: makeId(), name: food.name, quantity, unit: food.unit, done: false, recipes: [recipe.name] });
  }
  const result = { ...list, items };
  return validShoppingList(result) ? result : null;
}
export function linkExpense(list: ShoppingList, link: ExpenseLink): ShoppingList {
  return list.expenseLinks.some(item => item.groupId === link.groupId && item.expenseId === link.expenseId) ? list : { ...list, expenseLinks: [...list.expenseLinks, link] };
}
export function linkedExpenseTotals(list: ShoppingList, groups: ExpenseGroup[]) {
  const totals: Record<string, number> = {};
  for (const link of list.expenseLinks) {
    const group = groups.find(g => g.id === link.groupId), expense = group?.expenses.find(e => e.id === link.expenseId);
    if (group && expense) totals[group.currency] = (totals[group.currency] ?? 0) + expense.amount;
  }
  return totals;
}
