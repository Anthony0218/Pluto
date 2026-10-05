import { parseMathAnswer } from './mathFoundations.ts';
export type Ingredient = { id: string; name: string; quantity: string; unit: string };
export type Recipe = { id: string; name: string; servings: string; ingredients: Ingredient[] };
export function recipeQuantity(input: string): number | null {
  const rational = parseMathAnswer(input);
  if (!rational) return null;
  const number = Number(rational.numerator) / Number(rational.denominator);
  return Number.isFinite(number) && number >= 0 && number <= 1e6 ? number : null;
}
export function scaleRecipe(recipe: Pick<Recipe, 'servings' | 'ingredients'>, target: string) {
  const from = recipeQuantity(recipe.servings), to = recipeQuantity(target);
  if (!from || !to || from > 1000 || to > 1000 || recipe.ingredients.length === 0) return null;
  const quantities = recipe.ingredients.map(ingredient => recipeQuantity(ingredient.quantity));
  if (quantities.some(value => value === null) || recipe.ingredients.some(item => !item.name.trim())) return null;
  const scaled = quantities.map(value => value! * to / from);
  return scaled.some(value => !Number.isFinite(value) || value > 1e12) ? null : { factor: to / from, quantities: scaled };
}
export function validateRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Recipe;
  return typeof recipe.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(recipe.id) && typeof recipe.name === 'string' && recipe.name.trim().length > 0 && recipe.name.length <= 100 && typeof recipe.servings === 'string' && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && recipe.ingredients.length <= 100 && new Set(recipe.ingredients.map(item => item?.id)).size === recipe.ingredients.length && recipe.ingredients.every(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 100 && typeof item.unit === 'string' && item.unit.length <= 30 && typeof item.quantity === 'string') && scaleRecipe(recipe, recipe.servings) !== null;
}
export function parseSavedRecipes(raw: string | null): Recipe[] {
  try { const value: unknown = JSON.parse(raw ?? 'null'); if (!Array.isArray(value)) return []; const ids = new Set<string>(); return value.filter(validateRecipe).filter(recipe => { if (ids.has(recipe.id)) return false; ids.add(recipe.id); return true; }).slice(0, 50); } catch { return []; }
}
export function createRecipeStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
  const entries = new Map<string, { raw: string | null; recipes: Recipe[] }>();
  const volatile = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  const key = (account: string) => `pluto-recipes-v1:${account}`;
  const notify = (account: string) => listeners.get(account)?.forEach(fn => fn());
  function read(account: string) {
    const previous = entries.get(account); if (volatile.has(account)) return previous!.recipes;
    let raw: string | null = null;
    try { raw = storage?.getItem(key(account)) ?? null; } catch { if (previous) return previous.recipes; }
    if (previous?.raw === raw) return previous.recipes;
    const recipes = parseSavedRecipes(raw); entries.set(account, { raw, recipes }); return recipes;
  }
  function write(account: string, recipes: Recipe[]) {
    const raw = JSON.stringify(recipes); entries.set(account, { raw, recipes });
    try { if (!storage) throw Error('Storage unavailable'); storage.setItem(key(account), raw); volatile.delete(account); } catch { volatile.add(account); }
    notify(account);
  }
  return {
    read,
    save(account: string, recipe: Recipe) { if (!validateRecipe(recipe)) return false; const existing = read(account); if (existing.length >= 50 && !existing.some(item => item.id === recipe.id)) return false; write(account, [recipe, ...existing.filter(item => item.id !== recipe.id)]); return true; },
    remove(account: string, id: string) { write(account, read(account).filter(item => item.id !== id)); },
    subscribe(account: string, fn: () => void) { const group = listeners.get(account) ?? new Set(); group.add(fn); listeners.set(account, group); return () => { group.delete(fn); if (!group.size) listeners.delete(account); }; },
    sync(storageKey: string | null) { for (const account of entries.keys()) if (storageKey === null || storageKey === key(account)) { volatile.delete(account); read(account); notify(account); } },
    isVolatile: (account: string) => volatile.has(account),
  };
}
