import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { Volume2, VolumeX } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { getAudioSettings, setAudioSettings, subscribeAudioSettings, unlockChessAudio, type AudioSettings } from "@/games/chess/audio/chessAudio";

function useChessAudio() {
  const settings = useSyncExternalStore(subscribeAudioSettings, getAudioSettings);
  function update(patch: Partial<AudioSettings>) { unlockChessAudio(); setAudioSettings(patch); }
  return { settings, update };
}

const sliders: Array<[keyof Pick<AudioSettings, "masterVolume" | "effectsVolume">, string]> = [["masterVolume", "Master volume"], ["effectsVolume", "Sound effects volume"]];
const toggles: Array<[keyof Pick<AudioSettings, "muted" | "gameSounds" | "variantSounds">, string]> = [["muted", "Mute all audio"], ["gameSounds", "Game sounds"], ["variantSounds", "Variant sounds"]];

/** The audio controls themselves, shared by the header dropdown and the standalone settings page. */
function ChessAudioControls({ compact = false }: { compact?: boolean }) {
  useUiLanguage();
  const { settings, update } = useChessAudio();
  return <div className={compact ? "space-y-3" : "space-y-6"}>
    {sliders.map(([field, label]) => <label key={field} className={`block font-semibold ${compact ? "text-xs" : "text-sm"}`}><span className="flex justify-between"><span>{ui(label)}</span><span>{Math.round(settings[field] * 100)}%</span></span><input className={`w-full accent-indigo-400 ${compact ? "mt-1.5" : "mt-3"}`} type="range" min="0" max="1" step="0.05" value={settings[field]} onChange={event => update({ [field]: Number(event.target.value) })} /></label>)}
    {toggles.map(([field, label]) => <label key={field} className={`flex items-center justify-between gap-4 border-t border-white/10 font-semibold ${compact ? "min-h-8 pt-2 text-xs" : "min-h-11 pt-4 text-sm"}`}><span>{ui(label)}</span><input type="checkbox" className={compact ? "h-4 w-4 accent-indigo-400" : "h-5 w-5 accent-indigo-400"} checked={settings[field]} onChange={event => update({ [field]: event.target.checked })} /></label>)}
  </div>;
}

/** Sits in the header of every chess page, next to Appearance. */
export function ChessAudioMenu() {
  useUiLanguage();
  const { settings } = useChessAudio();
  const Icon = settings.muted ? VolumeX : Volume2;
  return <details className="chess-audio relative z-50 text-sm text-zinc-200 open:z-[60]"><summary className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-2 transition hover:border-amber-300/50 focus-visible:outline-2 focus-visible:outline-amber-300"><Icon size={16} aria-hidden="true" />{ui("Audio")}</summary>
    <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-amber-300/30 bg-[#151515] p-3 shadow-2xl">
      <ChessAudioControls compact />
    </div>
  </details>;
}

export default function ChessAudioSettings() {
  return <main className="mx-auto min-h-[var(--app-height)] max-w-3xl px-5 py-10 text-zinc-100">
    <Link to="/games/chess" className="text-sm text-indigo-300 hover:underline">← Chess</Link>
    <h1 className="mt-6 text-3xl font-bold">Chess audio settings</h1>
    <p className="mt-2 text-sm text-zinc-400">Your choices are saved in this browser.</p>
    <div className="mt-7 rounded-3xl border border-white/10 bg-zinc-900/70 p-6"><ChessAudioControls /></div>
  </main>;
}
