import { validZone, wallTimeCandidates, zonedParts } from './lifeTools.ts';
import type { ReminderChange } from './toolNotifications.ts';

export type BirthdayPerson = { id: string; name: string; month: number; day: number; birthYear?: number; zone: string; reminder: boolean; dismissedYear?: number };
export type BirthdayOccurrence = { date: string; at: number; year: number; age: number | null };
export function validBirthdayDay(month: unknown, day: unknown): boolean {
  return typeof month === 'number' && Number.isInteger(month) && month >= 1 && month <= 12 && typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= new Date(Date.UTC(2000, month, 0)).getUTCDate();
}
export function validBirthdayPerson(value: unknown): value is BirthdayPerson {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'string' && /^[a-zA-Z0-9-]{1,65}$/.test(p.id) && typeof p.name === 'string' && !!p.name.trim() && p.name.length <= 80 && validBirthdayDay(p.month, p.day) && validZone(p.zone) && typeof p.reminder === 'boolean'
    && (p.birthYear === undefined || typeof p.birthYear === 'number' && Number.isInteger(p.birthYear) && p.birthYear >= 1900 && p.birthYear <= new Date().getFullYear() && (p.month !== 2 || p.day !== 29 || new Date(Date.UTC(p.birthYear, 2, 0)).getUTCDate() === 29))
    && (p.dismissedYear === undefined || typeof p.dismissedYear === 'number' && Number.isInteger(p.dismissedYear) && p.dismissedYear >= 2000 && p.dismissedYear <= 2099);
}
/** February 29 is observed on February 28 in non-leap years. */
export function birthdayDate(person: Pick<BirthdayPerson, 'month' | 'day'>, year: number): string {
  const day = Math.min(person.day, new Date(Date.UTC(year, person.month, 0)).getUTCDate());
  return `${year}-${String(person.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function nextBirthday(person: BirthdayPerson, now: number): BirthdayOccurrence | null {
  const today = zonedParts(now, person.zone).date;
  let year = Number(today.slice(0, 4));
  if (birthdayDate(person, year) < today) year++;
  if (year > 2099) return null;
  const date = birthdayDate(person, year), at = wallTimeCandidates(date, '09:00', person.zone)[0];
  return at === undefined ? null : { date, at, year, age: person.birthYear === undefined ? null : year - person.birthYear };
}
export function dueBirthdays(people: BirthdayPerson[], now: number): BirthdayPerson[] {
  return people.filter(person => {
    if (!person.reminder) return false;
    const local = zonedParts(now, person.zone), year = Number(local.date.slice(0, 4));
    return birthdayDate(person, year) === local.date && local.time >= '09:00' && person.dismissedYear !== year;
  });
}
export function birthdayReminderChanges(previous: BirthdayPerson[], next: BirthdayPerson[], now = Date.now()): ReminderChange[] {
  const old = new Map(previous.map(p => [p.id, p]));
  const changed = next.filter(p => { const before = old.get(p.id); return !before || before.name !== p.name || before.month !== p.month || before.day !== p.day || before.zone !== p.zone || before.reminder !== p.reminder; });
  const ids = new Set(next.map(p => p.id));
  const changes = (person: BirthdayPerson, enabled: boolean): ReminderChange => ({ id: `birthday-${person.id}`, title: person.name, at: nextBirthday(person, now)?.at ?? now, enabled, annual: { month: person.month, day: person.day, zone: person.zone } });
  return [...changed.map(p => changes(p, p.reminder)), ...previous.filter(p => !ids.has(p.id)).map(p => changes(p, false))];
}
