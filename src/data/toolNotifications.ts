import type { PlannerTask } from './lifeTools.ts';
export type AnnualReminder = { month: number; day: number; zone: string };
export type ReminderChange = { id: string; title: string; at: number; enabled: boolean; issuedAt?: number; annual?: AnnualReminder };
export function reminderChanges(previous: PlannerTask[], next: PlannerTask[]): ReminderChange[] {
  const old = new Map(previous.map(t => [t.id, t]));
  const changes = next.filter(t => { const p = old.get(t.id); return !p || p.title !== t.title || p.at !== t.at || p.done !== t.done || p.reminder !== t.reminder || p.reminded !== t.reminded; }).map(t => ({ id: t.id, title: t.title, at: t.at, enabled: t.reminder && !t.done && !t.reminded }));
  const ids = new Set(next.map(t => t.id));
  previous.filter(t => !ids.has(t.id)).forEach(t => changes.push({ id: t.id, title: t.title, at: t.at, enabled: false }));
  return changes;
}
export function pushSupported() { return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
export function vapidBytes(key: string): Uint8Array<ArrayBuffer> { const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
export type DeliveryCheck = { id: string; device_id: string; status: 'pending' | 'sending' | 'accepted' | 'shown' | 'clicked' | 'failed'; attempts: number; created_at: string; updated_at: string };
