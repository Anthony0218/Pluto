import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";

const IMMERSIVE = "watten-immersive";

/**
 * Plays Watten full screen. Where the browser allows it (desktop, Android, iPad)
 * the page really goes full screen; iPhones have no such API, so the app header
 * is hidden as well, which frees the same space.
 */
export default function WattenFullscreenButton({ className = "" }: { className?: string }) {
  useUiLanguage();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const leftFullscreen = () => { if (!document.fullscreenElement) { document.documentElement.classList.remove(IMMERSIVE); setActive(false); } };
    document.addEventListener("fullscreenchange", leftFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", leftFullscreen);
      document.documentElement.classList.remove(IMMERSIVE);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  async function toggle() {
    const root = document.documentElement;
    if (active) {
      root.classList.remove(IMMERSIVE);
      setActive(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      return;
    }
    root.classList.add(IMMERSIVE);
    setActive(true);
    try { await root.requestFullscreen?.(); } catch { /* The hidden header still gives the extra room. */ }
  }

  const label = ui(active ? "Exit full screen" : "Full screen");
  return <button type="button" onClick={() => void toggle()} aria-pressed={active} aria-label={label} title={label} className={`watten-fullscreen-button ${className}`}>
    {active ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
    <span>{label}</span>
  </button>;
}
