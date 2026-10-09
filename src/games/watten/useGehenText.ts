import { useAppLanguage } from "@/i18n/languageStore";
import { translateWatten } from "./i18n/wattenLanguage";

/** The Gehen wording in the player's language; `{name}`-style placeholders are filled from `vars`. */
export function useGehenText() {
  const { language } = useAppLanguage();
  return (key: string, vars: Record<string, string | number> = {}) =>
    translateWatten(language, key).replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

/** English is the translation key. */
export const GEHEN_RULE = "One vote to stay is enough. To give up (gehen), both players of the team must vote gehen.";
