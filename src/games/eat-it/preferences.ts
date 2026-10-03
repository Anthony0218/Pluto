import { matchSettings } from './progression.ts';
import type { MatchSettings } from './types.ts';
export const SETTINGS_KEY = 'eat-it-settings-v2';
const LEGACY_KEY = 'eat-it-settings';
/** Menu defaults: 10 minutes, Animals ON, Hell Sudden Death OFF, Lives OFF, Bots ON.
 * Picking 2 minutes in the menu switches Hell ON (any other duration switches it OFF). */
export const DEFAULT_PREFERENCES = { matchDuration: 600, animalsEnabled: true, hellEnabled: false, livesEnabled: false, botsEnabled: true } as const;
export function loadPreferences(): MatchSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    // The rule toggles got new defaults, so older saved preferences only keep the bot difficulty.
    const legacy = stored === null ? JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '{}') : null;
    const value = legacy ? { botDifficulty: legacy?.botDifficulty } : JSON.parse(stored ?? '{}');
    // Every visit starts from the 10-minute default; Hell follows the duration rather than a saved toggle.
    return matchSettings({ ...DEFAULT_PREFERENCES, ...(value && typeof value === 'object' ? value : {}), mode: 'solo', matchDuration: DEFAULT_PREFERENCES.matchDuration, hellEnabled: DEFAULT_PREFERENCES.hellEnabled });
  }
  catch { return matchSettings({ ...DEFAULT_PREFERENCES, mode: 'solo' }); }
}
export function savePreferences(settings: MatchSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(matchSettings(settings))); } catch { /* Keep the current match usable without storage. */ }
}
