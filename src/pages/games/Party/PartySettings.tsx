import { useEffect, useId, useRef, useState } from "react";
import { usePreferences } from "./usePreferences.ts";
import { X } from "lucide-react";
import {
  DEFAULT_PREFERENCES,
  setPreferences,
  type MotionPreference,
} from "../../../games/party/client/preferences.ts";
import { partyAudio } from "../../../games/party/client/audio.ts";

const VOLUMES: { key: "masterVolume" | "musicVolume" | "sfxVolume" | "uiVolume"; label: string }[] = [
  { key: "masterVolume", label: "Master volume" },
  { key: "musicVolume", label: "Music volume" },
  { key: "sfxVolume", label: "Sound effects" },
  { key: "uiVolume", label: "Interface sounds" },
];
// Settings sheet: audio, motion, hints and fullscreen. Preferences are stored on this device only.
export default function PartySettings({ onClose }: { onClose: () => void }) {
  const prefs = usePreferences();
  const titleId = useId();
  const first = useRef<HTMLButtonElement>(null);
  const [fullscreen, setFullscreen] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled === true;
  useEffect(() => {
    // Focus moves into the dialog once and returns to whatever had it when the dialog closes.
    const previous = document.activeElement as HTMLElement | null;
    first.current?.focus();
    return () => previous?.focus?.();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const change = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener("keydown", key);
    document.addEventListener("fullscreenchange", change);
    return () => {
      window.removeEventListener("keydown", key);
      document.removeEventListener("fullscreenchange", change);
    };
  }, [onClose]);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return (
    <div className="pp-modal-backdrop" onClick={onClose}>
      <section
        className="pp-card pp-settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 id={titleId}>Settings</h2>
          <button ref={first} className="pp-icon-button" onClick={onClose} aria-label="Close settings">
            <X size={20} />
          </button>
        </header>
        <fieldset>
          <legend>Audio</legend>
          <label className="pp-switch">
            <input
              type="checkbox"
              checked={prefs.muted}
              onChange={(e) => setPreferences({ muted: e.target.checked })}
            />
            <span>Mute all sound</span>
          </label>
          {VOLUMES.map(({ key, label }) => (
            <label key={key} className="pp-slider">
              <span>
                {label} <b>{Math.round(prefs[key] * 100)}%</b>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(prefs[key] * 100)}
                disabled={prefs.muted}
                onChange={(e) => setPreferences({ [key]: Number(e.target.value) / 100 })}
                onPointerUp={() => partyAudio.play(key === "uiVolume" ? "click" : "coinGain")}
              />
            </label>
          ))}
          <small>Sound starts after your first tap or key press (browser rule).</small>
        </fieldset>
        <fieldset>
          <legend>Display</legend>
          <label className="pp-select">
            <span>Motion</span>
            <select
              value={prefs.motion}
              onChange={(e) => setPreferences({ motion: e.target.value as MotionPreference })}
            >
              <option value="system">Follow device setting</option>
              <option value="reduce">Reduced motion</option>
              <option value="full">Full motion</option>
            </select>
          </label>
          <label className="pp-switch">
            <input
              type="checkbox"
              checked={prefs.controlHints}
              onChange={(e) => setPreferences({ controlHints: e.target.checked })}
            />
            <span>Show control hints</span>
          </label>
          {canFullscreen && (
            <button type="button" onClick={toggleFullscreen}>
              {fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            </button>
          )}
        </fieldset>
        <footer>
          <button type="button" onClick={() => setPreferences(DEFAULT_PREFERENCES)}>
            Reset to defaults
          </button>
          <button type="button" className="pp-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
