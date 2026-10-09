const KEY = "pluto:chunk-reload";

/** A lazy chunk that can no longer be fetched: a new version was deployed while this tab stayed open. */
export const isChunkLoadError = (error: unknown) =>
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(error instanceof Error ? error.message : String(error));

/** False right after a reload (or without session storage), so a real outage cannot loop. */
export function canReloadForNewVersion(): boolean {
  try { return Date.now() - Number(sessionStorage.getItem(KEY)) >= 30_000; } catch { return false; }
}

/** Reloads to pick up the new version, at most once per 30 seconds. */
export function reloadForNewVersion(): boolean {
  if (!canReloadForNewVersion()) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { return false; }
  window.location.reload();
  return true;
}
