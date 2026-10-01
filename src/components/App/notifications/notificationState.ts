import { useCallback, useMemo, useSyncExternalStore } from "react";

/* Seen messages and Do Not Disturb are per-account, per-browser preferences.
   Every surface (toasts, friends sidebar, bell) reads the same keys so marking
   a message seen in one place clears it everywhere. */
const SEEN_EVENT = "pluto-message-seen-change";
const DND_EVENT = "pluto-do-not-disturb-change";
const seenKey = (userId?: string) => `pluto-read-message-ids-${userId ?? "guest"}`;
const dndKey = (userId?: string) => `pluto-do-not-disturb-${userId ?? "guest"}`;

function readStorage(key: string) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function parseIds(raw: string | null) {
  try {
    const saved: unknown = JSON.parse(raw || "[]");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

function subscribeTo(event: string) {
  return (onChange: () => void) => {
    window.addEventListener(event, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(event, onChange);
      window.removeEventListener("storage", onChange);
    };
  };
}
const subscribeSeen = subscribeTo(SEEN_EVENT);
const subscribeDnd = subscribeTo(DND_EVENT);

export function markNotificationsSeen(userId: string | undefined, ids: string[]) {
  if (!ids.length) return;
  const current = parseIds(readStorage(seenKey(userId)));
  const next = [...new Set([...current, ...ids])];
  if (next.length === current.length) return;
  try { localStorage.setItem(seenKey(userId), JSON.stringify(next.slice(-500))); }
  catch { /* Seen state still applies until the page reloads. */ }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

export function useSeenNotificationIds(userId?: string) {
  const key = seenKey(userId);
  const raw = useSyncExternalStore(subscribeSeen, () => readStorage(key));
  return useMemo(() => new Set(parseIds(raw)), [raw]);
}

export function useDoNotDisturb(userId?: string) {
  const key = dndKey(userId);
  const enabled = useSyncExternalStore(subscribeDnd, () => readStorage(key) === "1");
  const setEnabled = useCallback((next: boolean) => {
    try { localStorage.setItem(key, next ? "1" : "0"); }
    catch { /* Preference lasts for this visit only. */ }
    window.dispatchEvent(new Event(DND_EVENT));
  }, [key]);
  return [enabled, setEnabled] as const;
}
