import { useSyncExternalStore } from "react";

export type AppLanguage = "en" | "de" | "bar" | "ko" | "ru" | "es" | "pt";
const listeners = new Set<() => void>();
const valid = (value: string | null): value is AppLanguage => !!value && ["en", "de", "bar", "ko", "ru", "es", "pt"].includes(value);
let language: AppLanguage = "en";
try {
  const saved = localStorage.getItem("pluto-language") ?? localStorage.getItem("chess-language") ?? localStorage.getItem("watten-language");
  if (valid(saved)) language = saved;
} catch { /* Language remains usable when storage is unavailable. */ }

export function getAppLanguage() { return language; }
export function setAppLanguage(next: AppLanguage) {
  language = next;
  document.documentElement.lang = next;
  try {
    for (const key of ["pluto-language", "chess-language", "watten-language"]) localStorage.setItem(key, next);
  } catch { /* Keep the in-memory preference. */ }
  listeners.forEach((notify) => notify());
}
if (typeof window !== "undefined") {
  document.documentElement.lang = language;
  window.addEventListener("storage", (event) => {
    if (event.key === "pluto-language" && valid(event.newValue)) {
      language = event.newValue;
      document.documentElement.lang = language;
      listeners.forEach((notify) => notify());
    }
  });
}
function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
}
export function useAppLanguage() {
  const language = useSyncExternalStore(subscribe, getAppLanguage, () => "en" as const);
  return { language, setLanguage: setAppLanguage };
}
