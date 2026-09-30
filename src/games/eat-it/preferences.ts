import { matchSettings } from './progression.ts';
import type { MatchSettings } from './types.ts';
export const SETTINGS_KEY = 'eat-it-settings';
export function loadPreferences(): MatchSettings {
  try { const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'); return matchSettings({ ...(value && typeof value === 'object' ? value : {}), mode: 'solo' }); }
  catch { return matchSettings({ mode: 'solo' }); }
}
export function savePreferences(settings: MatchSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(matchSettings(settings))); } catch { /* Keep the current match usable without storage. */ }
}
