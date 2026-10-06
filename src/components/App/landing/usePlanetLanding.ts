import { useCallback, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { animate } from "motion/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { pageBrand } from "../pageBrand";
import { VIEWPORT_SELECTOR } from "./viewport";

let landing = false;

/**
 * Click handler for planet links: the planet swells until its colour floods the screen, the route changes, the
 * destination's own colour (from pageBrand) fades in underneath, and the colour then closes like an iris back to the
 * planet that was clicked, revealing the new page. Falls back to the plain link for modified clicks and reduced motion.
 */
export function usePlanetLanding() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  return useCallback((event: MouseEvent<HTMLAnchorElement>, route: string) => {
    if (reducedMotion || landing || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const art = event.currentTarget.querySelector<HTMLElement>(".solar-art");
    if (!art) return;
    const rect = art.getBoundingClientRect();
    if (!rect.width) return;
    event.preventDefault();
    landing = true;

    const colors = getComputedStyle(art);
    const tone = (name: string, fallback: string) => colors.getPropertyValue(name).trim() || fallback;
    const size = rect.width;
    const centerX = rect.left + size / 2;
    const centerY = rect.top + size / 2;
    const reach = Math.hypot(Math.max(centerX, window.innerWidth - centerX), Math.max(centerY, window.innerHeight - centerY));
    const veil = document.createElement("div");
    veil.setAttribute("aria-hidden", "true");
    Object.assign(veil.style, {
      position: "fixed", zIndex: "9999", borderRadius: "50%", pointerEvents: "auto", willChange: "transform, opacity",
      left: `${centerX - size / 2}px`, top: `${centerY - size / 2}px`, width: `${size}px`, height: `${size}px`,
      background: `radial-gradient(circle at 38% 30%, ${tone("--light", "#dceeff")}, ${tone("--base", "#5f8fc7")} 43%, ${tone("--dark", "#1d3473")} 78%, #080c22 100%)`,
      boxShadow: `0 0 40px ${tone("--glow", "#5d9fff")}`,
    });
    document.body.append(veil);

    // The destination's colour, when it has one, fades in over the planet colour before the reveal.
    const surface = pageBrand(route)?.surface;
    const tint = document.createElement("div");
    Object.assign(tint.style, { position: "absolute", inset: "0", borderRadius: "50%", opacity: "0", background: surface ?? "transparent" });
    veil.append(tint);
    const flooded = (reach * 2.4) / size;

    void (async () => {
      try {
        await animate(veil, { scale: [1, flooded] }, { duration: 0.42, ease: [0.6, 0, 0.2, 1] });
      } finally {
        navigate(route);
      }
      try {
        // Let the destination mount, then ease it in while the veil closes.
        document.querySelector(VIEWPORT_SELECTOR)?.animate([{ opacity: 0.5, transform: "scale(1.015)" }, { opacity: 1, transform: "none" }], { duration: 650, delay: 180, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "backwards" });
        if (surface) await animate(tint, { opacity: 1 }, { duration: 0.22 });
        else await new Promise(resolve => setTimeout(resolve, 180));
        await animate(veil, { scale: 0 }, { duration: 0.6, ease: [0.7, 0, 0.3, 1] });
      } finally {
        veil.remove();
        landing = false;
      }
    })();
  }, [navigate, reducedMotion]);
}
