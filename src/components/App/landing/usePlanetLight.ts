import { useEffect, type RefObject } from "react";
import { useLandingReducedMotion as useReducedMotion } from "./motionPreference";
import { VIEWPORT_SELECTOR } from "./viewport";

type Light = { x: number; y: number; pull: number; pullY: number };
// Matches the highlight baked into the planet CSS (upper left), so planets rest where they always looked.
const RESTING = { x: -0.6, y: -0.8 };
const PULL_RANGE = 280;
const MAX_PULL = 5;

/**
 * Lights every `.solar-art` inside `root` from the cursor and leans it a few pixels toward it.
 * It writes CSS variables the planet stylesheet reads, and skips touch, coarse pointers and reduced motion.
 */
export function usePlanetLight(root: RefObject<HTMLElement | null>) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const scope = root.current;
    if (!scope || reducedMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const viewport = document.querySelector<HTMLElement>(VIEWPORT_SELECTOR);
    const lights = new WeakMap<HTMLElement, Light>();
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    const tick = () => {
      frame = 0;
      let settling = false;
      const targets: { art: HTMLElement; rect: DOMRect }[] = [];
      for (const art of scope.querySelectorAll<HTMLElement>(".solar-art")) {
        const rect = art.getBoundingClientRect();
        if (rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight) targets.push({ art, rect });
      }
      for (const { art, rect } of targets) {
        const light = lights.get(art) ?? { ...RESTING, pull: 0, pullY: 0 };
        let want = { ...RESTING, pull: 0, pullY: 0 };
        if (pointer) {
          const dx = pointer.x - (rect.left + rect.width / 2);
          const dy = pointer.y - (rect.top + rect.height / 2);
          const distance = Math.hypot(dx, dy);
          if (distance > 1) {
            const closeness = Math.max(0, 1 - distance / PULL_RANGE);
            want = { x: dx / distance, y: dy / distance, pull: (dx / distance) * closeness * MAX_PULL, pullY: (dy / distance) * closeness * MAX_PULL };
          }
        }
        light.x += (want.x - light.x) * 0.16;
        light.y += (want.y - light.y) * 0.16;
        light.pull += (want.pull - light.pull) * 0.16;
        light.pullY += (want.pullY - light.pullY) * 0.16;
        lights.set(art, light);
        if (Math.abs(want.x - light.x) + Math.abs(want.y - light.y) + Math.abs(want.pull - light.pull) + Math.abs(want.pullY - light.pullY) > 0.004) settling = true;
        const style = art.style;
        style.setProperty("--lx", `${(50 + light.x * 37).toFixed(1)}%`);
        style.setProperty("--ly", `${(50 + light.y * 37).toFixed(1)}%`);
        style.setProperty("--gx", `${(50 + light.x * 22).toFixed(1)}%`);
        style.setProperty("--gy", `${(50 + light.y * 22).toFixed(1)}%`);
        style.setProperty("--sx", `${(light.x * 20).toFixed(1)}px`);
        style.setProperty("--sy", `${(light.y * 20).toFixed(1)}px`);
        style.setProperty("--px", `${light.pull.toFixed(2)}px`);
        style.setProperty("--py", `${light.pullY.toFixed(2)}px`);
      }
      if (settling) frame = requestAnimationFrame(tick);
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      wake();
    };
    const leave = () => { pointer = null; wake(); };

    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    viewport?.addEventListener("scroll", wake, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      viewport?.removeEventListener("scroll", wake);
      if (frame) cancelAnimationFrame(frame);
      for (const art of scope.querySelectorAll<HTMLElement>(".solar-art")) for (const name of ["--lx", "--ly", "--gx", "--gy", "--sx", "--sy", "--px", "--py"]) art.style.removeProperty(name);
    };
  }, [root, reducedMotion]);
}
