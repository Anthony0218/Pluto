import { birthdayReminderChanges, validBirthdayDay, validBirthdayPerson, type BirthdayPerson } from './birthdayTools.ts';
import { reminderChanges, type ReminderChange } from './toolNotifications.ts';
import { validFoodEntry, validSavedMeal, validNutritionFood, validNutritionRecipe, validNutritionSettings, type FoodEntry, type SavedMeal, type NutritionFood, type NutritionRecipe, type NutritionSettings } from './calorieTools.ts';
import { expenseSplit, currencies, validDate, validTime, validZone, zonedParts, type PlannerTask, type Routine, type ExpenseGroup, type BudgetEntry, type BudgetLimit, type Subscription, type ZoneAvailability } from './lifeTools.ts';
export type LifeToolsState = { version: 1; birthdays: BirthdayPerson[]; background: { enabled: boolean; pending: ReminderChange[] }; foodEntries: FoodEntry[]; savedMeals: SavedMeal[]; nutritionFoods: NutritionFood[]; nutritionRecipes: NutritionRecipe[]; nutritionSettings: NutritionSettings; weatherPlaces: WeatherPlace[]; tasks: PlannerTask[]; routines: Routine[]; groups: ExpenseGroup[]; entries: BudgetEntry[]; limits: BudgetLimit[]; subscriptions: Subscription[]; zones: ZoneAvailability[]; breaks: { enabled: boolean; interval: number; nextAt: number } };
export const emptyLifeTools = (): LifeToolsState => ({ version: 1, birthdays: [], background: { enabled: false, pending: [] }, foodEntries: [], savedMeals: [], nutritionFoods: [], nutritionRecipes: [], nutritionSettings: { calorieGoal: null }, weatherPlaces: [], tasks: [], routines: [], groups: [], entries: [], limits: [], subscriptions: [], zones: [], breaks: { enabled: false, interval: 60, nextAt: 0 } });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
/** Weather Explorer was retired; its saved places stay in the stored state so existing data still loads and syncs. */
export type WeatherPlace = { id: string; name: string; latitude: number; longitude: number };
const validWeatherPlace = (v: unknown): v is WeatherPlace => record(v) && typeof v.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(v.id) && typeof v.name === 'string' && !!v.name.trim() && v.name.length <= 100
  && typeof v.latitude === 'number' && Number.isFinite(v.latitude) && Math.abs(v.latitude) <= 90 && typeof v.longitude === 'number' && Number.isFinite(v.longitude) && Math.abs(v.longitude) <= 180;
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
const text = (value: unknown, length = 100): value is string => typeof value === 'string' && !!value.trim() && value.length <= length;
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const cents = (value: unknown) => integer(value, 0, 2e9);
const currency = (value: unknown) => currencies.includes(value as typeof currencies[number]);
const timestamp = (value: unknown) => integer(value, 0, 4102444800000);
function list(value: unknown, validator: (value: unknown) => boolean, limit: number): boolean {
  return Array.isArray(value) && value.length <= limit && value.every(validator) && new Set(value.map(v => v.id)).size === value.length;
}
function validExpenseMetadata(e: Record<string, unknown>) {
  if (!['subtotal', 'tip', 'splitMethod', 'tipMethod', 'billShares', 'tipShares', 'tipPayer'].some(key => key in e)) return true;
  if (!cents(e.subtotal) || !cents(e.tip) || !['equal', 'custom'].includes(e.splitMethod as string) || !['equal', 'person'].includes(e.tipMethod as string) || !record(e.billShares) || !record(e.tipShares) || !record(e.shares)) return false;
  const participants = Object.keys(e.shares), bill = e.billShares, tips = e.tipShares, shares = e.shares;
  if (Object.keys(bill).length !== participants.length || Object.keys(tips).length !== participants.length || participants.some(id => !cents(bill[id]) || !cents(tips[id]) || (bill[id] as number) + (tips[id] as number) !== shares[id])) return false;
  const split = expenseSplit(e.subtotal as number, e.tip as number, participants, 'custom', bill as Record<string, number>, e.tipMethod as 'equal' | 'person', e.tipPayer as string);
  if (!split || (e.subtotal as number) + (e.tip as number) !== e.amount) return false;
  const billValues = Object.values(bill) as number[], tipValues = Object.values(tips) as number[];
  return tipValues.reduce((a,b) => a+b,0) === e.tip && (e.splitMethod !== 'equal' || Math.max(...billValues) - Math.min(...billValues) <= 1) && (e.tipMethod === 'person' ? participants.every(id => tips[id] === (id === e.tipPayer ? e.tip : 0)) : Math.max(...tipValues) - Math.min(...tipValues) <= 1);
}
export const validators = {
  birthdays: validBirthdayPerson,
  foodEntries: validFoodEntry, savedMeals: validSavedMeal, nutritionFoods: validNutritionFood, nutritionRecipes: validNutritionRecipe, weatherPlaces: validWeatherPlace,
  tasks: (v: unknown): v is PlannerTask => record(v) && id(v.id) && text(v.title) && validDate(v.date) && validTime(v.time) && validZone(v.zone) && timestamp(v.at) && (zonedParts(v.at as number, v.zone).date === v.date && zonedParts(v.at as number, v.zone).time === v.time) && integer(v.duration, 1, 1440) && typeof v.done === 'boolean' && typeof v.reminder === 'boolean' && typeof v.reminded === 'boolean',
  routines: (v: unknown): v is Routine => record(v) && id(v.id) && text(v.name) && integer(v.work, 1, 3600) && integer(v.rest, 0, 3600) && integer(v.rounds, 1, 100) && (v.exercises === undefined || (Array.isArray(v.exercises) && list(v.exercises, e => record(e) && id(e.id) && text(e.name) && integer(e.sets, 1, 100) && integer(e.reps, 0, 1000) && integer(e.duration, 1, 3600) && integer(e.rest, 0, 3600), 100) && v.exercises.length > 0)),
  zones: (v: unknown): v is ZoneAvailability => record(v) && id(v.id) && validZone(v.zone) && validTime(v.from) && validTime(v.to) && v.from !== v.to,
  entries: (v: unknown): v is BudgetEntry => record(v) && id(v.id) && text(v.title) && text(v.category, 50) && validDate(v.date) && cents(v.amount) && currency(v.currency) && ['income', 'expense'].includes(v.kind as string) && typeof v.recurring === 'boolean',
  limits: (v: unknown): v is BudgetLimit => record(v) && id(v.id) && typeof v.month === 'string' && validDate(`${v.month}-01`) && cents(v.amount) && currency(v.currency),
  subscriptions: (v: unknown): v is Subscription => record(v) && id(v.id) && text(v.name) && cents(v.amount) && currency(v.currency) && validDate(v.date) && ['monthly', 'yearly'].includes(v.cycle as string) && typeof v.active === 'boolean',
  groups: (v: unknown): v is ExpenseGroup => {
    if (!record(v) || !id(v.id) || !text(v.name) || !currency(v.currency) || !list(v.members, m => record(m) && id(m.id) && text(m.name), 30) || (v.members as unknown[]).length < 2) return false;
    const members = new Set((v.members as { id: string }[]).map(m => m.id));
    return list(v.expenses, e => record(e) && id(e.id) && text(e.title) && validDate(e.date) && members.has(e.paidBy as string) && cents(e.amount) && record(e.shares) && Object.keys(e.shares).length > 0 && Object.entries(e.shares).every(([member, amount]) => members.has(member) && cents(amount)) && Object.values(e.shares).reduce<number>((sum, n) => sum + (n as number), 0) === e.amount && validExpenseMetadata(e), 500)
      && list(v.repayments, p => record(p) && id(p.id) && validDate(p.date) && members.has(p.from as string) && members.has(p.to as string) && p.from !== p.to && integer(p.amount, 1, 2e9), 500);
  },
};
export const collectionLimits = { birthdays: 300, foodEntries: 5000, savedMeals: 100, nutritionFoods: 1000, nutritionRecipes: 300, weatherPlaces: 20, tasks: 500, routines: 50, groups: 30, entries: 2000, limits: 1200, subscriptions: 200, zones: 10 };
export type Collection = keyof typeof validators;
const validBreaks = (value: unknown): value is LifeToolsState['breaks'] => record(value) && typeof value.enabled === 'boolean' && integer(value.interval, 1, 240) && timestamp(value.nextAt);
let lastReminderChange = 0;
const validBackground = (v: unknown): v is LifeToolsState['background'] => record(v) && typeof v.enabled === 'boolean' && Array.isArray(v.pending) && v.pending.length <= 1000 && v.pending.every(r => record(r) && id(r.id) && text(r.title) && timestamp(r.at) && typeof r.enabled === 'boolean' && (r.issuedAt === undefined || timestamp(r.issuedAt)) && (r.annual === undefined || record(r.annual) && validBirthdayDay(r.annual.month, r.annual.day) && validZone(r.annual.zone)));
export function parseLifeTools(raw: string | null): LifeToolsState {
  const state = emptyLifeTools();
  try {
    if ((raw?.length ?? 0) > 5000000) return state;
    const data: unknown = JSON.parse(raw ?? 'null'); if (!record(data) || data.version !== 1) return state;
    for (const key of Object.keys(validators) as Collection[]) {
      const values = data[key]; if (!Array.isArray(values)) continue;
      const seen = new Set<string>();
      // One malformed row does not erase other valid collections or entries.
      const valid = values.filter(v => { try { if (!validators[key](v) || seen.has(v.id)) return false; seen.add(v.id); return true; } catch { return false; } }).slice(0, collectionLimits[key]);
      Object.assign(state, { [key]: valid });
    }
    if (validBreaks(data.breaks)) state.breaks = data.breaks;
    if (validBackground(data.background)) state.background = data.background;
    if (validNutritionSettings(data.nutritionSettings)) state.nutritionSettings = data.nutritionSettings;
  } catch { /* Corrupt snapshots start empty. */ }
  return state;
}
export function createLifeToolsStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
  const prefix = 'pluto-life-tools-v1:', cache = new Map<string, { raw: string | null; state: LifeToolsState }>(), volatile = new Set<string>(), listeners = new Map<string, Set<() => void>>();
  const notify = (account: string) => listeners.get(account)?.forEach(fn => fn());
  function read(account: string): LifeToolsState {
    const previous = cache.get(account); if (previous && volatile.has(account)) return previous.state;
    let raw: string | null;
    try { if (!storage) throw Error('Unavailable'); raw = storage.getItem(prefix + account); }
    catch { volatile.add(account); if (previous) return previous.state; raw = null; }
    if (previous && previous.raw === raw) return previous.state;
    const state = parseLifeTools(raw); cache.set(account, { raw, state }); return state;
  }
  function update(account: string, change: (state: LifeToolsState) => LifeToolsState) {
    const previous = read(account), next = change(structuredClone(previous));
    if (!validBackground(next.background)) return false;
    if (next.background.enabled) {
      const changes = [...reminderChanges(previous.background.enabled ? previous.tasks : [], next.tasks), ...birthdayReminderChanges(previous.background.enabled ? previous.birthdays : [], next.birthdays)];
      const queued = new Map(next.background.pending.map(r => [r.id, r]));
      if (changes.length) lastReminderChange = Math.max(Date.now(), lastReminderChange + 1, ...next.background.pending.map(r => (r.issuedAt ?? 0) + 1));
      changes.forEach(r => queued.set(r.id, { ...r, issuedAt: lastReminderChange }));
      next.background.pending = [...queued.values()];
      if (!validBackground(next.background)) return false;
    }
    if (next.version !== 1 || !validBreaks(next.breaks) || !validNutritionSettings(next.nutritionSettings) || (Object.keys(validators) as Collection[]).some(key => !list(next[key], validators[key], collectionLimits[key]))) return false;
    const raw = JSON.stringify(next); if (raw.length > 5000000) return false; cache.set(account, { raw, state: next });
    try { if (!storage) throw Error('Unavailable'); storage.setItem(prefix + account, raw); } catch { volatile.add(account); }
    notify(account); return true;
  }
  return {
    read, update,
    save<K extends Collection>(account: string, collection: K, value: LifeToolsState[K][number]) { return update(account, state => ({ ...state, [collection]: [...state[collection].filter(v => v.id !== value.id), value] })); },
    remove(account: string, collection: Collection, itemId: string) { return update(account, state => ({ ...state, [collection]: state[collection].filter(v => v.id !== itemId) })); },
    isVolatile: (account: string) => volatile.has(account),
    subscribe(account: string, fn: () => void) { const group = listeners.get(account) ?? new Set(); group.add(fn); listeners.set(account, group); return () => { group.delete(fn); if (!group.size) listeners.delete(account); }; },
    sync(key: string | null) { for (const account of cache.keys()) if ((key === null || key === prefix + account) && !volatile.has(account)) { read(account); notify(account); } },
  };
}
