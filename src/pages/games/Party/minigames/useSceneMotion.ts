import { useEffect, useState } from "react";
import { prefersReducedMotion, subscribePreferences } from "../../../../games/party/client/preferences.ts";

export function useSceneMotion() {
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!prefersReducedMotion());
    update(); query.addEventListener("change", update);
    const unsubscribe = subscribePreferences(update);
    return () => { query.removeEventListener("change", update); unsubscribe(); };
  }, []);
  return motion;
}
