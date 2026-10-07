import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useScroll, type UseScrollOptions } from "motion/react";

export const VIEWPORT_SELECTOR = ".app-viewport";

let scrollUsers = 0;

/**
 * The app scrolls inside `.app-viewport`, not the window, so scroll-linked motion must watch that element.
 * Motion only tracks a positioned container, so this marks it `data-journey` (see landingJourney.css) for as
 * long as any landing component uses it.
 */
export function useViewportScroll(options: Omit<UseScrollOptions, "container"> = {}) {
  const container = useRef<HTMLElement | null>(null);
  // Declared before useScroll so the container is resolved and positioned before Motion subscribes to it.
  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>(VIEWPORT_SELECTOR);
    container.current = element;
    if (!element) return;
    scrollUsers += 1;
    element.dataset.journey = "";
    return () => {
      scrollUsers -= 1;
      if (!scrollUsers) delete element.dataset.journey;
    };
  }, []);
  return useScroll({ container, ...options });
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    onChange => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(query).matches,
    () => false,
  );
}
