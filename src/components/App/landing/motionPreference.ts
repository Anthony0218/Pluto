import { useSyncExternalStore } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const KEY = "pluto-landing-animations";
const EVENT = "pluto-landing-animations-change";

function read() {
  try { return window.localStorage.getItem(KEY) !== "off"; }
  catch { return true; }
}
// Without storage the choice still lasts until the page is closed.
let session: boolean | undefined;
const current = () => session ?? read();

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** Whether the landing page may animate: on by default, and the visitor can switch it off from the header. */
export function useLandingAnimations() {
  const on = useSyncExternalStore(subscribe, current, () => true);
  const set = (next: boolean) => {
    session = next;
    try { window.localStorage.setItem(KEY, next ? "on" : "off"); } catch { /* The session copy still applies. */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set] as const;
}

/** The landing page's version of `prefers-reduced-motion`: also true when the visitor turned its animations off. */
export function useLandingReducedMotion() {
  const system = useReducedMotion();
  const [animations] = useLandingAnimations();
  return system || !animations;
}
