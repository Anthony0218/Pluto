import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyCents, splitCents, validDate, wallTimeCandidates, zonedParts, taskConflicts, dueTasks, workoutPhase, isAvailable, overlappingSlots, groupBalances, settlementPlan, anniversary, nextRenewal, budgetMonth, subscriptionCosts, csv } from '../src/data/lifeTools.ts';
import { createLifeToolsStore, emptyLifeTools, parseLifeTools, validators } from '../src/data/lifeToolsStorage.ts';
import { toolApps } from '../src/data/toolCatalog.ts';
const memory = () => { const entries = new Map(); return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }; };
const task = { id: 'task-a', title: 'Appointment', date: '2026-10-06', time: '09:00', zone: 'Europe/Berlin', at: Date.parse('2026-10-06T07:00Z'), duration: 30, done: false, reminder: true, reminded: false };
const group = { id: 'group-a', name: 'Friends', currency: 'EUR', members: [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }, { id: 'cara', name: 'Cara' }], expenses: [{ id: 'dinner', title: 'Dinner', date: '2026-10-06', paidBy: 'alice', amount: 1000, shares: { alice: 334, bob: 333, cara: 333 } }], repayments: [] };

test('money parsing rejects precision loss, negative values, expressions and non-finite values', () => {
  assert.equal(moneyCents('19.99'), 1999); assert.equal(moneyCents('0,01'), 1); assert.equal(moneyCents('9999999.99'), 999999999); assert.equal(moneyCents('20000000'), 2000000000);
  for (const value of ['', '-1', '1.001', '1e2', 'Infinity', '1/2', '20000000.01', '1,000.00']) assert.equal(moneyCents(value), null, value);
});
test('weighted allocation conserves every cent including large custom values and tied remainders', () => {
  assert.deepEqual(splitCents(1000, [1, 1, 1]), [334, 333, 333]); assert.deepEqual(splitCents(101, [1, 2, 0]), [34, 67, 0]);
  assert.deepEqual(splitCents(999999999, [999999998, 1]), [999999998, 1]);
  for (let total = 0; total < 1000; total += 7) for (const weights of [[1, 1, 1], [0, 7, 2], [1000000000, 1999999999, 5]]) { const parts = splitCents(total, weights); assert.equal(parts.reduce((a, b) => a + b, 0), total); assert.ok(parts.every((p, i) => p >= 0 && (weights[i] !== 0 || p === 0))); }
  for (const weights of [[], [0, 0], [NaN], [-1], [1.5], [2000000001]]) assert.equal(splitCents(100, weights), null);
});
test('date validation and IANA conversions handle missing and repeated local times', () => {
  assert.equal(validDate('2024-02-29'), true); assert.equal(validDate('2026-02-29'), false); assert.equal(validDate('2026-04-31'), false);
  assert.deepEqual(wallTimeCandidates('2026-03-29', '02:30', 'Europe/Berlin'), []);
  assert.deepEqual(wallTimeCandidates('2026-10-25', '02:30', 'Europe/Berlin').map(at => new Date(at).toISOString()), ['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']);
  assert.deepEqual(wallTimeCandidates('2026-03-08', '02:30', 'America/New_York'), []);
  assert.equal(wallTimeCandidates('2026-11-01', '01:30', 'America/New_York').length, 2);
  assert.equal(new Date(wallTimeCandidates('2026-10-06', '09:00', 'Asia/Kathmandu')[0]).toISOString(), '2026-10-06T03:15:00.000Z');
  assert.deepEqual(zonedParts(Date.parse('2026-10-06T23:00Z'), 'Asia/Seoul'), { date: '2026-10-07', time: '08:00' });
  assert.deepEqual(wallTimeCandidates('2026-10-06', '12:00', 'invalid'), []);
});
test('availability checks whole meeting, daily rollover, overnight windows, and DST differences', () => {
  const locations = [{ id: 'berlin', zone: 'Europe/Berlin', from: '09:00', to: '17:00' }, { id: 'ny', zone: 'America/New_York', from: '09:00', to: '17:00' }];
  assert.deepEqual(overlappingSlots(Date.parse('2026-10-06T12:00Z'), 60, locations).map(at => new Date(at).toISOString()), ['2026-10-06T13:00:00.000Z', '2026-10-06T13:30:00.000Z', '2026-10-06T14:00:00.000Z']);
  assert.equal(isAvailable(Date.parse('2026-10-06T14:30Z'), 60, locations[0]), false);
  const overnight = { id: 'night', zone: 'UTC', from: '22:00', to: '02:00' };
  assert.equal(isAvailable(Date.parse('2026-10-06T23:30Z'), 120, overnight), true); assert.equal(isAvailable(Date.parse('2026-10-06T23:30Z'), 180, overnight), false);
  assert.ok(overlappingSlots(Date.parse('2026-10-27T12:00Z'), 60, locations).length > overlappingSlots(Date.parse('2026-10-06T12:00Z'), 60, locations).length);
  assert.deepEqual(overlappingSlots(0, 0, locations), []); assert.deepEqual(overlappingSlots(0, 30, []), []);
});
test('planner detects cross-date overlaps but allows touching boundaries and ignores completed tasks', () => {
  const touching = { ...task, id: 'touching', at: task.at + 30 * 60000 };
  assert.equal(taskConflicts([task, touching]).size, 0);
  assert.deepEqual([...taskConflicts([task, { ...touching, at: task.at + 29 * 60000 }])], ['task-a', 'touching']);
  assert.equal(taskConflicts([task, { ...task, id: 'done', done: true }]).size, 0);
  const late = { ...task, id: 'late', date: '2026-10-06', at: Date.parse('2026-10-06T23:50Z') };
  assert.equal(taskConflicts([late, { ...task, id: 'early', date: '2026-10-07', at: Date.parse('2026-10-07T00:00Z') }]).size, 2);
});
test('missed reminders remain due until dismissed or completed and are not due early', () => {
  assert.deepEqual(dueTasks([task], task.at - 1), []); assert.deepEqual(dueTasks([task], task.at + 86400000), [task]);
  for (const changes of [{ done: true }, { reminded: true }, { reminder: false }]) assert.deepEqual(dueTasks([{ ...task, ...changes }], task.at), []);
});
test('workout timing follows elapsed seconds, skips final rest, and handles zero rest and suspension', () => {
  const routine = { id: 'routine', name: 'Intervals', work: 30, rest: 15, rounds: 3 };
  assert.deepEqual(workoutPhase(routine, 0), { phase: 'Work', round: 1, remaining: 30, total: 120 });
  assert.equal(workoutPhase(routine, 29.9).remaining, 1); assert.equal(workoutPhase(routine, 30).phase, 'Rest'); assert.equal(workoutPhase(routine, 45).round, 2);
  assert.equal(workoutPhase(routine, 120).phase, 'Finished'); assert.equal(workoutPhase(routine, 99999).phase, 'Finished');
  assert.equal(workoutPhase({ ...routine, rest: 0 }, 30).round, 2); assert.equal(workoutPhase({ ...routine, rounds: 1 }, 30).phase, 'Finished');
});
test('group balances conserve money, recorded repayments reduce debt, and suggested settlement closes it', () => {
  assert.ok(validators.groups(group)); assert.deepEqual(groupBalances(group), { alice: 666, bob: -333, cara: -333 });
  const suggestions = settlementPlan(group); assert.deepEqual(suggestions, [{ from: 'bob', to: 'alice', amount: 333 }, { from: 'cara', to: 'alice', amount: 333 }]);
  const settled = { ...group, repayments: suggestions.map((p, i) => ({ ...p, id: `payment-${i}`, date: '2026-10-06' })) };
  assert.deepEqual(groupBalances(settled), { alice: 0, bob: 0, cara: 0 }); assert.deepEqual(settlementPlan(settled), []);
  assert.equal(Object.values(groupBalances({ ...group, repayments: [{ id: 'p', date: '2026-10-06', from: 'bob', to: 'alice', amount: 100 }] })).reduce((a, b) => a + b, 0), 0);
  for (const expense of [{ ...group.expenses[0], shares: { alice: 1000, stranger: 0 } }, { ...group.expenses[0], shares: { alice: 999 } }, { ...group.expenses[0], paidBy: 'missing' }]) assert.equal(validators.groups({ ...group, expenses: [expense] }), false);
});
test('renewals preserve anchor days through short months and leap years', () => {
  const s = { id: 'sub', name: 'Membership', amount: 1000, currency: 'EUR', date: '2024-01-31', cycle: 'monthly', active: true };
  assert.equal(anniversary(s.date, '2026-02'), '2026-02-28');
  assert.equal(nextRenewal(s, '2026-02-01'), '2026-02-28'); assert.equal(nextRenewal(s, '2026-02-28'), '2026-02-28'); assert.equal(nextRenewal(s, '2026-03-01'), '2026-03-31'); assert.equal(nextRenewal(s, '2026-12-31'), '2026-12-31'); assert.equal(nextRenewal(s, '2027-01-01'), '2027-01-31');
  const leap = { ...s, date: '2024-02-29', cycle: 'yearly' };
  assert.equal(nextRenewal(leap, '2025-02-01'), '2025-02-28'); assert.equal(nextRenewal(leap, '2025-03-01'), '2026-02-28'); assert.equal(nextRenewal(leap, '2028-01-01'), '2028-02-29');
  assert.equal(nextRenewal({ ...s, date: '2027-01-31' }, '2026-10-06'), '2027-01-31');
});
test('budget combines manual and planned entries without duplicating saved rows or currencies', () => {
  const entry = { id: 'rent', title: 'Rent', category: 'Housing', date: '2026-01-31', amount: 100000, currency: 'EUR', kind: 'expense', recurring: true };
  const entries = [entry, { ...entry, id: 'pay', title: 'Pay', amount: 200000, kind: 'income', recurring: false, date: '2026-02-02' }, { ...entry, id: 'usd', currency: 'USD' }, { ...entry, id: 'future', date: '2027-01-01' }];
  const february = budgetMonth(entries, '2026-02', 'EUR'); assert.equal(february.income, 200000); assert.equal(february.expense, 100000); assert.equal(february.remaining, 100000); assert.equal(february.rows[0].date, '2026-02-28'); assert.deepEqual(february.categories, { Housing: 100000 });
  assert.equal(budgetMonth(entries, '2025-12', 'EUR').rows.length, 0); assert.equal(budgetMonth(entries, '2026-03', 'EUR').income, 0); assert.equal(entries[0].date, '2026-01-31');
  const special = budgetMonth([{ ...entry, category: '__proto__' }, { ...entry, id: 'other', category: 'constructor' }], '2026-02', 'EUR'); assert.equal(special.categories.__proto__, 100000); assert.equal(special.categories.constructor, 100000);
});
test('subscription annualization separates currencies, inactive records and invoice amounts', () => {
  const s = { id: 'monthly', name: 'Music', amount: 999, currency: 'EUR', date: '2026-01-31', cycle: 'monthly', active: true };
  assert.deepEqual(subscriptionCosts([s, { ...s, id: 'yearly', cycle: 'yearly', amount: 10001 }, { ...s, id: 'inactive', active: false }, { ...s, id: 'usd', currency: 'USD' }], 'EUR'), { annual: 21989, monthly: 21989 / 12 });
});
test('tool snapshots survive reload, isolate guest/accounts, notify subscribers and sync tabs', () => {
  const port = memory(), a = createLifeToolsStore(port), b = createLifeToolsStore(port);
  assert.equal(a.save('alice', 'tasks', task), true); a.save('alice', 'groups', group); assert.equal(a.read('alice'), a.read('alice'));
  assert.equal(createLifeToolsStore(port).read('alice').groups[0].expenses[0].amount, 1000); assert.deepEqual(a.read('bob'), emptyLifeTools()); assert.deepEqual(a.read('guest'), emptyLifeTools());
  let updates = 0; b.read('alice'); b.subscribe('alice', () => updates++); a.save('alice', 'tasks', { ...task, title: 'Changed' }); b.sync('pluto-life-tools-v1:alice'); assert.equal(updates, 1); assert.equal(b.read('alice').tasks[0].title, 'Changed');
  assert.equal(b.update('alice', s => ({ ...s, breaks: { enabled: true, interval: 15, nextAt: task.at } })), true);
  port.entries.clear(); b.sync(null); assert.deepEqual(b.read('alice'), emptyLifeTools());
});
test('corrupt records are ignored independently and invalid writes leave existing data intact', () => {
  const data = { ...emptyLifeTools(), tasks: [null, { ...task, at: task.at + 60000 }, task, task], groups: [group, { ...group, id: 'bad', members: null }] };
  const parsed = parseLifeTools(JSON.stringify(data)); assert.deepEqual(parsed.tasks, [task]); assert.deepEqual(parsed.groups, [group]);
  assert.deepEqual(parseLifeTools('broken'), emptyLifeTools()); assert.deepEqual(parseLifeTools('{"version":2}'), emptyLifeTools());
  const store = createLifeToolsStore(memory()); store.save('a', 'tasks', task); assert.equal(store.save('a', 'tasks', { ...task, duration: 0 }), false); assert.equal(store.read('a').tasks[0].duration, 30);
  assert.equal(store.update('a', s => ({ ...s, breaks: { enabled: true, interval: 0, nextAt: 0 } })), false);
});
test('blocked/full storage preserves a session copy even when storage is cleared elsewhere', () => {
  for (const port of [null, { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } }, { getItem: () => null, setItem() { throw Error('full'); } }]) {
    const store = createLifeToolsStore(port); assert.equal(store.save('a', 'tasks', task), true); store.sync(null); assert.deepEqual(store.read('a').tasks, [task]); assert.equal(store.isVolatile('a'), true); assert.deepEqual(store.read('b').tasks, []);
  }
});
test('bounded collections reject overflow and allow editing existing records at the limit', () => {
  const store = createLifeToolsStore(memory()); const routine = { id: 'r', name: 'Run', work: 30, rest: 10, rounds: 3 };
  assert.equal(store.update('a', s => ({ ...s, routines: Array.from({ length: 50 }, (_, i) => ({ ...routine, id: `r-${i}` })) })), true);
  assert.equal(store.save('a', 'routines', { ...routine, id: 'r-extra' }), false); assert.equal(store.save('a', 'routines', { ...routine, id: 'r-0', name: 'Edited' }), true);
});
test('CSV quotes delimiters and neutralizes spreadsheet formula text', () => {
  const content = csv([['Name', 'Amount'], ['=HYPERLINK("x")', 100], [' line\n"two",three', 1], [' @SUM(1)', 2]]);
  assert.ok(content.includes('"\'=HYPERLINK(""x"")"')); assert.ok(content.includes('" line\n""two"",three"')); assert.ok(content.includes('"\' @SUM(1)"'));
});
test('the life apps are published; Subscription Tracker and Weather Explorer left the catalog', () => {
  for (const id of ['day-planner', 'time-zone-planner', 'workout-timer', 'bill-splitter', 'budget-tracker', 'calorie-tracker']) assert.equal(toolApps.find(t => t.id === id).status, 'available');
  for (const id of ['subscription-tracker', 'weather-explorer']) assert.equal(toolApps.find(t => t.id === id), undefined);
});
