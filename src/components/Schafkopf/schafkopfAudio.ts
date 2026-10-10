import { useEffect, useRef, useState } from "react";

export type SoundSettings = { music: number; announcements: number; effects: number };
export type SoundSelection = { music: "piano" | "soft"; effects: "classic" | "soft" };
function savedSelection(): SoundSelection {
  try { const value = JSON.parse(localStorage.getItem("schafkopf-sound-selection") ?? "null"); return { music: value?.music === "soft" ? "soft" : "piano", effects: value?.effects === "soft" ? "soft" : "classic" }; } catch { return { music: "piano", effects: "classic" }; }
}
const defaults: SoundSettings = { music: 22, announcements: 0, effects: 75 };
// The speech code stays in place for the forthcoming Bavarian voice recordings.
const ANNOUNCEMENT_SPEECH_ENABLED = false;

function savedSounds(): SoundSettings {
  try {
    const value = JSON.parse(localStorage.getItem("schafkopf-sounds") ?? "null");
    return Object.fromEntries((Object.keys(defaults) as (keyof SoundSettings)[]).map(key => [key, Number.isFinite(value?.[key]) ? Math.max(0, Math.min(100, value[key])) : defaults[key]])) as SoundSettings;
  } catch { return defaults; }
}

function createNoise(ctx: AudioContext, duration: number, volume: number, frequency: number, now: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let sample = 0; sample < data.length; sample++) data[sample] = (Math.random() * 2 - 1) * (1 - sample / data.length);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = .7;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(now);
}

export function useSchafkopfAudio(round: number, announcements: string[], playedCardCount: number) {
  const [selection, setSelection] = useState(savedSelection);
  const selectionRef = useRef(selection);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  const selectSound = (key: keyof SoundSelection, value: SoundSelection[keyof SoundSelection]) => setSelection(current => {
    const next = { ...current, [key]: value } as SoundSelection;
    try { localStorage.setItem("schafkopf-sound-selection", JSON.stringify(next)); } catch { /* Session choice. */ }
    return next;
  });
  const effectVolume = () => settingsRef.current.effects / 100 * (selectionRef.current.effects === "soft" ? .45 : 1);
  const [settings, setSettings] = useState(savedSounds);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("schafkopf-sound-muted") === "true"; } catch { return false; }
  });
  const settingsRef = useRef(settings);
  const mutedRef = useRef(muted);
  const contextRef = useRef<AudioContext | null>(null);
  const heardRef = useRef({ round, count: announcements.length });
  const playedCardRef = useRef(playedCardCount);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const update = (key: keyof SoundSettings, value: number) => {
    setSettings(current => {
      const next = { ...current, [key]: value };
      try { localStorage.setItem("schafkopf-sounds", JSON.stringify(next)); } catch { /* Keep session setting. */ }
      return next;
    });
  };

  const toggleMute = () => setMuted(current => {
    const next = !current;
    try { localStorage.setItem("schafkopf-sound-muted", String(next)); } catch { /* Keep session setting. */ }
    return next;
  });

  const canPlayEffects = () => !mutedRef.current && settingsRef.current.effects > 0;
  useEffect(() => {
    const unlock = () => {
      contextRef.current ??= new AudioContext();
      void contextRef.current.resume();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); void contextRef.current?.close(); contextRef.current = null; window.speechSynthesis?.cancel(); };
  }, []);

  useEffect(() => {
    let step = 0;
    const progression = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 293.66], [196, 246.94, 329.63]];
    const play = () => {
      const ctx = contextRef.current;
      const volume = mutedRef.current ? 0 : settingsRef.current.music / 100;
      if (!ctx || ctx.state !== "running" || volume === 0) return;
      const chord = progression[Math.floor(step / 8) % progression.length];
      const frequency = step % 4 === 0 ? chord[0] / 2 : chord[[0, 1, 2, 1][step % 4]];
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = selectionRef.current.music === "soft" ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * (step % 4 === 0 ? .19 : .11), now + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, now + 1.45);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 1.5);
      step++;
    };
    const timer = window.setInterval(play, 390);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (playedCardRef.current !== playedCardCount) {
      if (playedCardCount > playedCardRef.current) {
        const ctx = contextRef.current;
        if (ctx && ctx.state === "running" && canPlayEffects()) {
          const now = ctx.currentTime;
          const volume = effectVolume();
          createNoise(ctx, .085, volume * .24, 1450, now);
          createNoise(ctx, .13, volume * .10, 430, now + .018);
        }
      }
      playedCardRef.current = playedCardCount;
    }
  }, [playedCardCount]);

  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx || ctx.state !== "running" || !canPlayEffects()) return;
    const volume = effectVolume();
    const now = ctx.currentTime;
    for (let index = 0; index < 9; index++) createNoise(ctx, .07, volume * .105, 950 + (index % 3) * 300, now + index * .042);
  }, [round]);

  useEffect(() => {
    const heard = heardRef.current;
    if (heard.round !== round || announcements.length < heard.count) { heard.round = round; heard.count = 0; }
    const fresh = announcements.slice(heard.count);
    heard.count = announcements.length;
    for (const line of fresh) {
      if (line.includes("Klopft!")) {
        const ctx = contextRef.current;
        if (ctx && canPlayEffects()) {
          const now = ctx.currentTime;
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(650, now);
          oscillator.frequency.exponentialRampToValueAtTime(190, now + .12);
          gain.gain.setValueAtTime(effectVolume() * .36, now);
          gain.gain.exponentialRampToValueAtTime(.0001, now + .19);
          oscillator.connect(gain).connect(ctx.destination);
          oscillator.start(now);
          oscillator.stop(now + .2);
          const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .075), ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let sample = 0; sample < data.length; sample++) data[sample] = (Math.random() * 2 - 1) * (1 - sample / data.length);
          const tap = ctx.createBufferSource();
          const wood = ctx.createBiquadFilter();
          const tapGain = ctx.createGain();
          tap.buffer = buffer;
          wood.type = "lowpass";
          wood.frequency.value = 900;
          tapGain.gain.setValueAtTime(effectVolume() * .25, now);
          tapGain.gain.exponentialRampToValueAtTime(.0001, now + .075);
          tap.connect(wood).connect(tapGain).connect(ctx.destination);
          tap.start(now);
        }
      }
      if (ANNOUNCEMENT_SPEECH_ENABLED && !mutedRef.current && settingsRef.current.announcements > 0 && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(line);
        utterance.lang = "de-DE";
        utterance.volume = settingsRef.current.announcements / 100;
        utterance.rate = .98;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [round, announcements]);

  return { settings, muted, update, toggleMute, selection, selectSound };
}
