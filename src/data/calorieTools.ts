import { validDate } from './lifeTools.ts';
export const mealNames = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type Nutrients = { protein?: number; carbs?: number; fat?: number; fiber?: number };
export type FoodPortion = { name: string; quantity: number; energy: number; unit: 'g' | 'serving'; nutrients?: Nutrients };
export type FoodEntry = FoodPortion & { id: string; date: string; meal: typeof mealNames[number] };
export type SavedMeal = { id: string; name: string; foods: FoodPortion[] };
export type NutritionFood = FoodPortion & { id: string };
export type NutritionRecipe = { id: string; name: string; foods: FoodPortion[]; servings: number };
export type NutritionSettings = { calorieGoal: number | null };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 100;
const id = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(v);
// Two decimal places keep manual portions and label values predictable.
export function portionNumber(value: string): number | null { if (!/^\d{1,6}(?:[.,]\d{1,2})?$/.test(value.trim())) return null; const n = Number(value.trim().replace(',', '.')); return Number.isFinite(n) ? n : null; }
const bounded = (v: unknown, max: number, positive = false): v is number => typeof v === 'number' && Number.isFinite(v) && v >= (positive ? 0.01 : 0) && v <= max && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const validNutrients = (v: unknown) => v === undefined || object(v) && ['protein', 'carbs', 'fat', 'fiber'].every(key => v[key] === undefined || bounded(v[key], 10000));
export const validFood = (v: unknown): v is FoodPortion => object(v) && text(v.name) && bounded(v.quantity, 100000, true) && bounded(v.energy, 10000) && ['g', 'serving'].includes(v.unit as string) && validNutrients(v.nutrients);
export const validFoodEntry = (v: unknown): v is FoodEntry => object(v) && id(v.id) && validDate(v.date) && mealNames.includes(v.meal as typeof mealNames[number]) && validFood(v);
export const validSavedMeal = (v: unknown): v is SavedMeal => object(v) && id(v.id) && text(v.name) && Array.isArray(v.foods) && v.foods.length > 0 && v.foods.length <= 50 && v.foods.every(validFood);
export const validNutritionFood = (v: unknown): v is NutritionFood => object(v) && id(v.id) && validFood(v);
export const validNutritionRecipe = (v: unknown): v is NutritionRecipe => object(v) && id(v.id) && text(v.name) && bounded(v.servings, 100, true) && Array.isArray(v.foods) && v.foods.length > 0 && v.foods.length <= 50 && v.foods.every(validFood);
export const validNutritionSettings = (v: unknown): v is NutritionSettings => object(v) && (v.calorieGoal === null || bounded(v.calorieGoal, 10000, true));
export const foodCalories = (food: FoodPortion) => Math.round(food.quantity * food.energy / (food.unit === 'g' ? 100 : 1) * 10) / 10;
export const totalCalories = (foods: FoodPortion[]) => Math.round(foods.reduce((sum, f) => sum + Math.round(foodCalories(f) * 10), 0)) / 10;
export function calorieHistory(entries: FoodEntry[]) { const dates = [...new Set(entries.map(e => e.date))].sort().reverse(); return dates.map(date => ({ date, calories: totalCalories(entries.filter(e => e.date === date)), count: entries.filter(e => e.date === date).length })); }
