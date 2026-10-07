// Calendar and money calculations are pure so browser suspension, DST, and rounding
// can be exercised independently of React.
export const currencies = ['EUR', 'USD', 'GBP', 'CHF'] as const;
export type Currency = typeof currencies[number];
export function moneyCents(input: string): number | null {
  if (!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(input.trim())) return null;
  const [whole, fraction = ''] = input.trim().replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents <= 2000000000 ? cents : null;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const validTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export function validZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || zone.length > 100) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(0); return true; } catch { return false; }
}
const zoneFormatters = new Map<string, Intl.DateTimeFormat>();
export function zonedParts(at: number, zone: string) {
  let formatter = zoneFormatters.get(zone);
  if (!formatter) { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); if (zoneFormatters.size >= 64) zoneFormatters.clear(); zoneFormatters.set(zone, formatter); }
  const parts = Object.fromEntries(formatter.formatToParts(at).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
export function wallTimeCandidates(date: string, time: string, zone: string): number[] {
  if (!validDate(date) || !validTime(time) || !validZone(zone)) return [];
  const wall = Date.parse(`${date}T${time}:00Z`), offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = wall + hours * 3600000, local = zonedParts(probe, zone);
    offsets.add(Date.parse(`${local.date}T${local.time}:00Z`) - probe);
  }
  return [...offsets].map(offset => wall - offset).filter(at => { const p = zonedParts(at, zone); return p.date === date && p.time === time; }).sort((a, b) => a - b);
}
export type ZoneAvailability = { id: string; zone: string; from: string; to: string };
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function isAvailable(at: number, duration: number, location: ZoneAvailability) {
  const from = minutes(location.from), to = minutes(location.to);
  if (from === to) return false;
  for (let minute = 0; minute < duration; minute++) {
    const local = minutes(zonedParts(at + minute * 60000, location.zone).time);
    if (!(from < to ? local >= from && local < to : local >= from || local < to)) return false;
  }
  return true;
}
export function overlappingSlots(at: number, duration: number, locations: ZoneAvailability[]) {
  if (!Number.isFinite(at) || !Number.isInteger(duration) || duration < 1 || duration > 240 || !locations.length || locations.some(l => !validZone(l.zone) || !validTime(l.from) || !validTime(l.to))) return [];
  return Array.from({ length: 48 }, (_, i) => at + i * 30 * 60000).filter(slot => locations.every(location => isAvailable(slot, duration, location)));
}
export type PlannerTask = { id: string; title: string; date: string; time: string; zone: string; at: number; duration: number; done: boolean; reminder: boolean; reminded: boolean };
export function taskConflicts(tasks: PlannerTask[]) {
  const conflicts = new Set<string>();
  for (let i = 0; i < tasks.length; i++) for (let j = i + 1; j < tasks.length; j++) {
    const a = tasks[i], b = tasks[j];
    if (!a.done && !b.done && a.at < b.at + b.duration * 60000 && b.at < a.at + a.duration * 60000) { conflicts.add(a.id); conflicts.add(b.id); }
  }
  return conflicts;
}
export const dueTasks = (tasks: PlannerTask[], now: number) => tasks.filter(task => task.reminder && !task.done && !task.reminded && task.at <= now);
export type RoutineExercise = { id: string; name: string; sets: number; reps: number; duration: number; rest: number };
export type Routine = { id: string; name: string; work: number; rest: number; rounds: number; exercises?: RoutineExercise[] };
export function workoutPhase(routine: Routine, elapsed: number) {
  const total = routine.work * routine.rounds + routine.rest * (routine.rounds - 1);
  const seconds = Math.max(0, Math.floor(elapsed));
  if (seconds >= total) return { phase: 'Finished' as const, round: routine.rounds, remaining: 0, total };
  const cycle = routine.work + routine.rest, round = Math.floor(seconds / cycle) + 1, offset = seconds % cycle;
  return { phase: offset < routine.work ? 'Work' as const : 'Rest' as const, round, remaining: offset < routine.work ? routine.work - offset : cycle - offset, total };
}
// Largest remainder allocation guarantees that every cent is assigned once.
export function splitCents(total: number, weights: number[]): number[] | null {
  if (!Number.isSafeInteger(total) || total < 0 || total > 2e9 || weights.length < 1 || weights.length > 30 || weights.some(w => !Number.isSafeInteger(w) || w < 0 || w > 2000000000)) return null;
  const sum = weights.reduce((a, b) => a + b, 0); if (!sum) return null;
  const shares = weights.map(weight => Number(BigInt(total) * BigInt(weight) / BigInt(sum)));
  const order = weights.map((weight, index) => ({ index, remainder: Number(BigInt(total) * BigInt(weight) % BigInt(sum)) })).sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const left = total - shares.reduce((a, b) => a + b, 0);
  for (let i = 0; i < left; i++) shares[order[i].index]++;
  return shares;
}
export type Member = { id: string; name: string; userId?: string };
export type GroupExpense = { id: string; title: string; date: string; paidBy: string; amount: number; shares: Record<string, number>; subtotal?: number; tip?: number; splitMethod?: 'equal' | 'custom'; tipMethod?: 'equal' | 'person'; tipPayer?: string; billShares?: Record<string, number>; tipShares?: Record<string, number> };
export type Repayment = { id: string; date: string; from: string; to: string; amount: number };
export type ExpenseGroup = { id: string; name: string; currency: Currency; members: Member[]; expenses: GroupExpense[]; repayments: Repayment[]; ownerId?: string; revision?: number };
export function groupBalances(group: ExpenseGroup) {
  const balances: Record<string, number> = Object.fromEntries(group.members.map(m => [m.id, 0]));
  for (const expense of group.expenses) { balances[expense.paidBy] += expense.amount; for (const [id, amount] of Object.entries(expense.shares)) balances[id] -= amount; }
  for (const payment of group.repayments) { balances[payment.from] += payment.amount; balances[payment.to] -= payment.amount; }
  return balances;
}
export function settlementPlan(group: ExpenseGroup) {
  const balances = groupBalances(group), debtors = group.members.map(m => ({ id: m.id, amount: -balances[m.id] })).filter(m => m.amount > 0), creditors = group.members.map(m => ({ id: m.id, amount: balances[m.id] })).filter(m => m.amount > 0), payments: { from: string; to: string; amount: number }[] = [];
  let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length) { const amount = Math.min(debtors[d].amount, creditors[c].amount); payments.push({ from: debtors[d].id, to: creditors[c].id, amount }); debtors[d].amount -= amount; creditors[c].amount -= amount; if (!debtors[d].amount) d++; if (!creditors[c].amount) c++; }
  return payments;
}
export function anniversary(date: string, month: string) {
  const day = Number(date.slice(8)), [year, m] = month.split('-').map(Number), last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
export type BudgetEntry = { id: string; title: string; category: string; date: string; amount: number; currency: Currency; kind: 'income' | 'expense'; recurring: boolean };
export type BudgetLimit = { id: string; month: string; currency: Currency; amount: number };
export type Subscription = { id: string; name: string; amount: number; currency: Currency; date: string; cycle: 'monthly' | 'yearly'; active: boolean };
export function nextRenewal(subscription: Subscription, today: string): string {
  const anchor = subscription.date;
  if (today <= anchor) return anchor;
  if (subscription.cycle === 'monthly') { const current = anniversary(anchor, today.slice(0, 7)); if (current >= today) return current; const date = new Date(`${today.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); return anniversary(anchor, date.toISOString().slice(0, 7)); }
  let year = Number(today.slice(0, 4)); let result = anniversary(anchor, `${year}-${anchor.slice(5, 7)}`);
  if (result < today) { year++; result = anniversary(anchor, `${year}-${anchor.slice(5, 7)}`); }
  return result;
}
export function budgetMonth(entries: BudgetEntry[], month: string, currency: Currency) {
  const rows = entries.filter(entry => entry.currency === currency && (entry.recurring ? entry.date.slice(0, 7) <= month : entry.date.slice(0, 7) === month)).map(entry => ({ ...entry, date: entry.recurring ? anniversary(entry.date, month) : entry.date }));
  const income = rows.filter(e => e.kind === 'income').reduce((sum, e) => sum + e.amount, 0), expense = rows.filter(e => e.kind === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const categories = new Map<string, number>(); rows.filter(e => e.kind === 'expense').forEach(e => { categories.set(e.category, (categories.get(e.category) ?? 0) + e.amount); });
  return { rows, income, expense, remaining: income - expense, categories: Object.fromEntries(categories) };
}
export function subscriptionCosts(subscriptions: Subscription[], currency: Currency) {
  const annual = subscriptions.filter(s => s.active && s.currency === currency).reduce((sum, s) => sum + s.amount * (s.cycle === 'monthly' ? 12 : 1), 0);
  return { annual, monthly: annual / 12 };
}
export function csv(rows: (string | number)[][]) {
  // Neutralize spreadsheet formulas in user-authored text before quoting.
  return '\ufeff' + rows.map(row => row.map(value => { const text = typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : String(value); return `"${text.replaceAll('"', '""')}"`; }).join(',')).join('\r\n');
}

// Direct bill amounts and tip allocation are independent. Every cent is conserved.
export function expenseSplit(subtotal: number, tip: number, participants: string[], method: 'equal' | 'custom', custom: Record<string, number>, tipMethod: 'equal' | 'person', tipPayer: string) {
  if (!participants.length || participants.length > 30 || new Set(participants).size !== participants.length || !Number.isSafeInteger(subtotal) || subtotal < 0 || !Number.isSafeInteger(tip) || tip < 0 || subtotal + tip <= 0 || subtotal + tip > 2e9) return null;
  const bill = method === 'equal' ? splitCents(subtotal, participants.map(() => 1)) : participants.map(id => custom[id]);
  if (!bill || bill.some(n => !Number.isSafeInteger(n) || n < 0) || bill.reduce((a, b) => a + b, 0) !== subtotal || tipMethod === 'person' && !participants.includes(tipPayer)) return null;
  const tips = tipMethod === 'equal' ? splitCents(tip, participants.map(() => 1))! : participants.map(id => id === tipPayer ? tip : 0);
  return { billShares: Object.fromEntries(participants.map((id, i) => [id, bill[i]])), tipShares: Object.fromEntries(participants.map((id, i) => [id, tips[i]])), shares: Object.fromEntries(participants.map((id, i) => [id, bill[i] + tips[i]])) };
}
export function routineSequence(routine: Routine) {
  const exercises = routine.exercises?.length ? routine.exercises : [{ id: 'interval', name: routine.name, sets: routine.rounds, reps: 0, duration: routine.work, rest: routine.rest }];
  return exercises.flatMap(exercise => Array.from({ length: exercise.sets }, (_, i) => ({ exercise, set: i + 1 })));
}
export function routineProgress(routine: Routine, elapsed: number) {
  const sequence = routineSequence(routine);
  const total = sequence.reduce((sum, step, i) => sum + step.exercise.duration + (i < sequence.length - 1 ? step.exercise.rest : 0), 0);
  let remaining = Math.max(0, Math.floor(elapsed));
  for (let i = 0; i < sequence.length; i++) {
    const step = sequence[i], work = step.exercise.duration, rest = i < sequence.length - 1 ? step.exercise.rest : 0;
    if (remaining < work) return { ...step, phase: 'Work', remaining: work - remaining, total };
    remaining -= work;
    if (remaining < rest) return { ...step, phase: 'Rest', remaining: rest - remaining, total };
    remaining -= rest;
  }
  return { ...sequence[sequence.length - 1], phase: 'Finished', remaining: 0, total };
}
// Derived subscription rows reuse their IDs and never copy records into storage.
export function subscriptionBudgetEntries(subscriptions: Subscription[], month: string): BudgetEntry[] {
  return subscriptions.filter(s => s.active && s.date.slice(0, 7) <= month && (s.cycle === 'monthly' || s.date.slice(5, 7) === month.slice(5, 7))).map(s => ({ id: `subscription-${s.id}`, title: s.name, category: 'Subscriptions', date: anniversary(s.date, month), amount: s.amount, currency: s.currency, kind: 'expense', recurring: false }));
}
