import { getPreferences, subscribePreferences } from "./preferences.ts";
// Centralized Pluto Party audio. Custom files in public/sounds/party override the original synthesized
// tones and noise. Buses: master → music / sfx / ui.
// Browsers only allow audio after a user gesture: nothing is created or played before `unlock()` runs
// inside one, so there are no autoplay errors and no half-started music loops.
export type SoundId =
  | "click"
  | "dice"
  | "coinGain"
  | "coinLoss"
  | "pluto"
  | "property"
  | "damage"
  | "heal"
  | "ko"
  | "item"
  | "countdown"
  | "go"
  | "result"
  | "animal"
  | "avalanche"
  | "cable"
  | "radiation"
  | "duel"
  | "victory"
  | "hit"
  | "combo"
  | "delivery"
  | "splash"
  | "paddle"
  | "miss";
export type MusicMood = "off" | "calm" | "board" | "minigame";
type Bus = "music" | "sfx" | "ui";
interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  bus?: Bus;
}
const MOODS: Record<Exclude<MusicMood, "off">, { bpm: number; density: number; gain: number }> = {
  calm: { bpm: 84, density: 0.5, gain: 0.5 },
  board: { bpm: 100, density: 0.8, gain: 0.7 },
  minigame: { bpm: 132, density: 1, gain: 0.8 },
};
// Four-bar loop over C · A minor · F · G, arpeggiated from the chord tones.
const PROGRESSION = [
  [261.63, 329.63, 392.0, 523.25],
  [220.0, 261.63, 329.63, 440.0],
  [174.61, 220.0, 261.63, 349.23],
  [196.0, 246.94, 293.66, 392.0],
];
const ARPEGGIO = [0, 1, 2, 3, 2, 1, 2, 3];
class PartyAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<Bus, GainNode> | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<SoundId, number>();
  private voices = 0;
  private mood: MusicMood = "off";
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private rhythmStart: number | null = null;
  private rhythmBeat = -1;
  private custom = new Map<string, AudioBuffer>();
  private loadingCustom = false;
  constructor() {
    if (typeof window !== "undefined") subscribePreferences(() => this.applyPreferences());
  }
  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }
  // Call from a user gesture (pointerdown/keydown). Safe to call repeatedly.
  unlock() {
    if (typeof window === "undefined") return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const master = ctx.createGain();
        master.connect(ctx.destination);
        const bus = () => {
          const g = ctx.createGain();
          g.connect(master);
          return g;
        };
        this.ctx = ctx;
        this.master = master;
        this.buses = { music: bus(), sfx: bus(), ui: bus() };
        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = buffer;
        this.applyPreferences();
        void this.loadCustomSounds();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
      if (this.mood !== "off") this.startMusic();
    } catch {
      // Audio is optional; the game works silently if the browser refuses.
      this.ctx = null;
    }
  }
  // Pauses everything while the tab is hidden (saves battery on phones); resumes afterwards.
  setHidden(hidden: boolean) {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend().catch(() => {});
    else void this.ctx.resume().catch(() => {});
  }
  applyPreferences() {
    if (!this.ctx || !this.master || !this.buses) return;
    const p = getPreferences(),
      t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(p.muted ? 0 : p.masterVolume, t, 0.02);
    this.buses.music.gain.setTargetAtTime(p.musicVolume * 0.5, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(p.sfxVolume, t, 0.02);
    this.buses.ui.gain.setTargetAtTime(p.uiVolume, t, 0.02);
  }
  private tone(freq: number, at: number, duration: number, options: ToneOptions = {}) {
    const ctx = this.ctx!,
      osc = ctx.createOscillator(),
      env = ctx.createGain(),
      peak = options.gain ?? 0.2;
    osc.type = options.type ?? "triangle";
    osc.frequency.setValueAtTime(freq, at);
    if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(options.slideTo, at + duration);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(peak, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(env).connect(this.buses![options.bus ?? "sfx"]);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }
  private burst(at: number, duration: number, frequency: number, gain = 0.25, sweepTo?: number) {
    const ctx = this.ctx!,
      src = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      env = ctx.createGain();
    src.buffer = this.noise;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, at);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + duration);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.connect(filter).connect(env).connect(this.buses!.sfx);
    src.start(at);
    src.stop(at + duration + 0.02);
  }
  private async loadCustomSounds() {
    if (this.loadingCustom || !this.ctx) return;
    this.loadingCustom = true;
    try {
      const manifest = await fetch("/sounds/party/manifest.json").then((r) => r.json()) as Record<string, unknown>;
      await Promise.allSettled(Object.entries(manifest).filter(([, file]) => typeof file === "string" && /^[\w./-]+\.(mp3|wav|ogg|m4a)$/i.test(file) && !file.includes("..")).map(async ([id, file]) => {
        const response = await fetch("/sounds/party/" + file); if (!response.ok) return;
        const buffer = await this.ctx!.decodeAudioData(await response.arrayBuffer()); this.custom.set(id, buffer);
      }));
    } catch { /* Empty or missing custom audio keeps the synthesised fallback. */ }
  }
  cue(tile: number) {
    if (!this.unlocked || getPreferences().muted) return;
    this.tone([261.63,293.66,329.63,349.23,392,440,493.88,523.25,587.33][tile % 9], this.ctx!.currentTime + .01, .24, { gain: .13 });
  }
  setRhythm(localStartedAt: number | null) {
    if (this.rhythmStart === localStartedAt) return;
    this.rhythmStart = localStartedAt;
    this.rhythmBeat = -1;
    this.nextNoteTime = (this.ctx?.currentTime ?? 0) + .1;
  }
  play(id: SoundId) {
    if (!this.unlocked || getPreferences().muted) return;
    const ctx = this.ctx!,
      now = ctx.currentTime;
    // The same sound at most every 70 ms, and a small voice budget, so bursts of events stay pleasant.
    if (now - (this.lastPlayed.get(id) ?? -1) < 0.07 || this.voices > 12) return;
    this.lastPlayed.set(id, now);
    this.voices++;
    setTimeout(() => this.voices--, 600);
    const t = now + 0.01;
    const custom = this.custom.get(id);
    if (custom) { const source = ctx.createBufferSource(); source.buffer = custom; source.connect(this.buses![id === "click" ? "ui" : "sfx"]); source.start(t); return; }
    switch (id) {
      case "click":
        this.tone(900, t, 0.04, { type: "square", gain: 0.06, bus: "ui" });
        break;
      case "dice":
        for (const [i, dt] of [0, 0.05, 0.11, 0.18, 0.26, 0.35].entries())
          this.burst(t + dt, 0.04, 1800 + i * 150, 0.18);
        this.tone(660, t + 0.42, 0.12, { type: "square", gain: 0.08 });
        break;
      case "coinGain":
        this.tone(988, t, 0.07, { type: "square", gain: 0.08 });
        this.tone(1319, t + 0.07, 0.16, { type: "square", gain: 0.08 });
        break;
      case "coinLoss":
        this.tone(523, t, 0.22, { slideTo: 330, gain: 0.14 });
        break;
      case "pluto":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.tone(f, t + i * 0.09, 0.3, { gain: 0.14 }),
        );
        this.tone(2093, t + 0.36, 0.5, { type: "sine", gain: 0.05 });
        break;
      case "property":
        this.tone(392, t, 0.1, { type: "square", gain: 0.08 });
        this.tone(523.25, t + 0.1, 0.2, { type: "square", gain: 0.08 });
        break;
      case "damage":
        this.burst(t, 0.18, 700, 0.3, 200);
        this.tone(190, t, 0.22, { type: "sawtooth", slideTo: 90, gain: 0.1 });
        break;
      case "heal":
        this.tone(523.25, t, 0.35, { type: "sine", slideTo: 784, gain: 0.14 });
        break;
      case "ko":
        this.tone(440, t, 0.7, { type: "sawtooth", slideTo: 90, gain: 0.12 });
        this.burst(t + 0.05, 0.4, 500, 0.2, 120);
        break;
      case "item":
        this.tone(660, t, 0.08, { gain: 0.12 });
        this.tone(880, t + 0.08, 0.14, { gain: 0.12 });
        break;
      case "countdown":
        this.tone(660, t, 0.14, { type: "sine", gain: 0.18 });
        break;
      case "go":
        this.tone(988, t, 0.32, { type: "square", gain: 0.1 });
        break;
      case "result":
        [784, 988, 1175].forEach((f, i) => this.tone(f, t + i * 0.1, 0.25, { gain: 0.12 }));
        break;
      case "animal":
        this.burst(t, 0.35, 380, 0.25, 180);
        this.tone(110, t, 0.35, { type: "sawtooth", slideTo: 70, gain: 0.1 });
        break;
      case "avalanche":
        this.burst(t, 1.3, 900, 0.35, 90);
        break;
      case "cable":
        this.tone(784, t, 0.35, { type: "sine", gain: 0.12 });
        this.tone(988, t + 0.18, 0.45, { type: "sine", gain: 0.1 });
        break;
      case "radiation":
        for (const dt of [0, 0.06, 0.1, 0.19, 0.24]) this.burst(t + dt, 0.02, 3000, 0.25);
        break;
      case "duel":
        this.tone(392, t, 0.16, { type: "sawtooth", gain: 0.08 });
        this.tone(587.33, t + 0.16, 0.3, { type: "sawtooth", gain: 0.08 });
        break;
      case "victory":
        [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, t + i * 0.13, 0.2, { type: "square", gain: 0.08 }));
        this.tone(1046.5, t + 0.4, 0.8, { type: "square", gain: 0.09 });
        break;
      case "miss":
        this.tone(330, t, 0.2, { slideTo: 220, gain: 0.1 });
        break;
      case "hit":
        this.tone(880, t, .09, { gain: .09 });
        break;
      case "combo":
        [988, 1319, 1568].forEach((f, i) => this.tone(f, t + i * .04, .12, { gain: .08 }));
        break;
      case "delivery":
        this.tone(659, t, .12, { gain: .1 });
        this.tone(988, t + .1, .22, { gain: .1 });
        break;
      case "splash":
        this.burst(t, .3, 1300, .13, 300);
        break;
      case "paddle":
        this.tone(330, t, .07, { type: "square", gain: .06, slideTo: 440 });
        break;
    }
  }
  setMusic(mood: MusicMood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (mood === "off") this.stopMusic();
    else if (this.unlocked) this.startMusic();
  }
  private startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    // Look-ahead scheduler: a coarse timer queues the next few notes on the precise audio clock.
    this.musicTimer = setInterval(() => this.scheduleMusic(), 120);
  }
  private stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || this.mood === "off" || ctx.state !== "running") return;
    if (this.rhythmStart !== null) {
      // The same 600ms grid as the authoritative chart; the first note hits at start + 3000ms.
      const first = this.rhythmStart + 3000, current = Date.now();
      const nextBeat = Math.max(0, this.rhythmBeat + 1, Math.ceil((current - first) / 600));
      for (let beat = nextBeat; first + beat * 600 < current + 300; beat++) {
        const at = ctx.currentTime + Math.max(.005, (first + beat * 600 - current) / 1000);
        const chord = PROGRESSION[Math.floor(beat / 4) % 4];
        this.tone(chord[beat % 4], at, .22, { gain: .09, bus: "music" });
        this.tone(beat % 4 === 0 ? 110 : 220, at, .08, { type: "sine", gain: .15, bus: "music" });
        this.rhythmBeat = beat;
      }
      return;
    }
    const mood = MOODS[this.mood],
      eighth = 60 / mood.bpm / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.35) {
      const bar = Math.floor(this.step / 8) % PROGRESSION.length,
        beat = this.step % 8,
        chord = PROGRESSION[bar],
        at = this.nextNoteTime;
      if (beat % 4 === 0)
        this.tone(chord[0] / 2, at, eighth * 3.5, { type: "sine", gain: 0.16 * mood.gain, bus: "music" });
      // Deterministic sparseness per mood (no randomness, so the loop sounds the same every time).
      if (((this.step * 7) % 10) / 10 < mood.density)
        this.tone(chord[ARPEGGIO[beat]] * 2, at, eighth * 1.6, { type: "triangle", gain: 0.05 * mood.gain, bus: "music" });
      this.nextNoteTime += eighth;
      this.step++;
    }
  }
}
export const partyAudio = new PartyAudio();
