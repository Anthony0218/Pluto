import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { getAudioSettings, musicTracks, setAudioSettings, subscribeAudioSettings, unlockChessAudio, type AudioSettings, type MusicCategory } from "@/games/chess/audio/chessAudio";

export default function ChessAudioSettings() {
  const settings = useSyncExternalStore(subscribeAudioSettings, getAudioSettings);
  function update(patch: Partial<AudioSettings>) { unlockChessAudio(); setAudioSettings(patch); }
  const sliders: Array<[keyof Pick<AudioSettings, "masterVolume" | "effectsVolume" | "musicVolume">, string]> = [["masterVolume", "Master volume"], ["effectsVolume", "Sound effects volume"], ["musicVolume", "Music volume"]];
  const toggles: Array<[keyof Pick<AudioSettings, "muted" | "gameSounds" | "variantSounds" | "backgroundMusic">, string]> = [["muted", "Mute all audio"], ["gameSounds", "Game sounds"], ["variantSounds", "Variant sounds"], ["backgroundMusic", "Background music"]];
  return <main className="mx-auto min-h-[var(--app-height)] max-w-3xl px-5 py-10 text-zinc-100">
    <Link to="/games/chess" className="text-sm text-indigo-300 hover:underline">← Chess</Link>
    <h1 className="mt-6 text-3xl font-bold">Chess audio settings</h1>
    <p className="mt-2 text-sm text-zinc-400">Your choices are saved in this browser.</p>
    <div className="mt-7 space-y-6 rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      {sliders.map(([field, label]) => <label key={field} className="block text-sm font-semibold"><span className="flex justify-between"><span>{label}</span><span>{Math.round(settings[field] * 100)}%</span></span><input className="mt-3 w-full accent-indigo-400" type="range" min="0" max="1" step="0.05" value={settings[field]} onChange={event => update({ [field]: Number(event.target.value) })} /></label>)}
      {toggles.map(([field, label]) => <label key={field} className="flex min-h-11 items-center justify-between gap-4 border-t border-white/10 pt-4 text-sm font-semibold"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-indigo-400" checked={settings[field]} onChange={event => update({ [field]: event.target.checked })} /></label>)}
      <label className="block border-t border-white/10 pt-4 text-sm font-semibold">Music category<select className="mt-2 block w-full rounded-lg border border-white/20 bg-zinc-950 p-3" value={settings.musicCategory} onChange={event => update({ musicCategory: event.target.value as MusicCategory })}>
        <option value="off">Off</option><option value="classical">Classical</option><option value="jazz">Jazz</option><option value="ambient">Ambient / Space</option>
      </select></label>
      {settings.backgroundMusic && settings.musicCategory !== "off" && musicTracks.length === 0 && <p className="text-xs text-zinc-400">No licensed music tracks have been added yet. Music will remain silent until tracks are available.</p>}
    </div>
  </main>;
}
