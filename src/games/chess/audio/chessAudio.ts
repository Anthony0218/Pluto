export type ChessSoundEvent =
  | "gameStart"
  | "move"
  | "capture"
  | "check"
  | "checkmate"
  | "castle"
  | "boardRotate"
  | "rouletteEvent"
  | "roulettePromotionSuccess"
  | "roulettePromotionFailure"
  | "rouletteKing"
  | "bombFuse"
  | "bombExplosion"
  | "collapse"
  | "mutation"
  | "marketSpawn"
  | "bountyComplete"
  | "missionComplete"
  | "illegal"
  | "draw";

export type MusicCategory = "off" | "classical" | "jazz" | "ambient";
export type AudioSettings = {
  masterVolume: number;
  effectsVolume: number;
  musicVolume: number;
  gameSounds: boolean;
  variantSounds: boolean;
  backgroundMusic: boolean;
  muted: boolean;
  musicCategory: MusicCategory;
};
export type MusicTrack = {
  title: string;
  artist: string;
  source: string;
  license: string;
  path: string;
  category: Exclude<MusicCategory, "off">;
};
// Add tracks only after both the composition and recording licenses are verified.
export const musicTracks: MusicTrack[] = [];
export const soundAssets: Record<
  ChessSoundEvent,
  { path: string; available: boolean }
> = {
  gameStart: { path: "/sounds/chess/GameStart.mp3", available: false },
  move: { path: "/sounds/chess/Move.mp3", available: true },
  capture: { path: "/sounds/chess/Capture.mp3", available: true },
  check: { path: "/sounds/chess/Check.mp3", available: true },
  checkmate: { path: "/sounds/chess/Checkmate.mp3", available: true },
  castle: { path: "/sounds/chess/Castle.mp3", available: true },
  boardRotate: {
    path: "/sounds/chess/variants/BoardRotate.mp3",
    available: false,
  },
  rouletteEvent: {
    path: "/sounds/chess/variants/RouletteEvent.mp3",
    available: false,
  },
  roulettePromotionSuccess: {
    path: "/sounds/chess/variants/RoulettePromotionSuccess.mp3",
    available: true,
  },
  roulettePromotionFailure: {
    path: "/sounds/chess/variants/RoulettePromotionFailure.mp3",
    available: true,
  },
  rouletteKing: {
    path: "/sounds/chess/variants/RouletteKing.mp3",
    available: true,
  },
  bombFuse: { path: "/sounds/chess/variants/BombFuse.mp3", available: false },
  bombExplosion: {
    path: "/sounds/chess/variants/BombExplosion.mp3",
    available: true,
  },
  collapse: { path: "/sounds/chess/variants/Collapse.mp3", available: false },
  mutation: { path: "/sounds/chess/variants/Mutation.mp3", available: false },
  marketSpawn: {
    path: "/sounds/chess/variants/MarketSpawn.mp3",
    available: false,
  },
  bountyComplete: {
    path: "/sounds/chess/variants/BountyComplete.mp3",
    available: false,
  },
  missionComplete: {
    path: "/sounds/chess/variants/MissionComplete.mp3",
    available: false,
  },
  illegal: { path: "/sounds/chess/Illegal.mp3", available: false },
  draw: { path: "/sounds/chess/Draw.mp3", available: false },
};

const key = "chess-audio-settings-v1";
const defaults: AudioSettings = {
  masterVolume: 0.8,
  effectsVolume: 0.8,
  musicVolume: 0.4,
  gameSounds: true,
  variantSounds: true,
  backgroundMusic: false,
  muted: false,
  musicCategory: "off",
};
let settings: AudioSettings = readSettings();
const listeners = new Set<() => void>();
const samples = new Map<string, HTMLAudioElement>();
const loops = new Map<ChessSoundEvent, HTMLAudioElement>();
let music: HTMLAudioElement | null = null;
let musicPath = "";
let unlocked = false;
let pending: ChessSoundEvent | null = null;
let pendingTimer: number | null = null;
let lastCheckmateAt = 0;
const priority: Partial<Record<ChessSoundEvent, number>> = {
  move: 1,
  capture: 2,
  castle: 3,
  check: 4,
  checkmate: 5,
};

function readSettings(): AudioSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value && typeof value === "object"
      ? { ...defaults, ...value }
      : defaults;
  } catch {
    return defaults;
  }
}
export function getAudioSettings() {
  return settings;
}
export function subscribeAudioSettings(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setAudioSettings(patch: Partial<AudioSettings>) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    /* Session settings still work. */
  }
  for (const listener of listeners) listener();
  for (const loop of loops.values())
    loop.volume = settings.muted
      ? 0
      : settings.masterVolume * settings.effectsVolume;
  syncMusic();
  if (!settings.variantSounds) stopSound("bombFuse");
}
export function unlockChessAudio() {
  unlocked = true;
  for (const asset of Object.values(soundAssets))
    if (asset.available && !samples.has(asset.path)) {
      const sample = new Audio(asset.path);
      sample.preload = "auto";
      samples.set(asset.path, sample);
    }
  syncMusic();
}
function isVariant(event: ChessSoundEvent) {
  return ![
    "gameStart",
    "move",
    "capture",
    "check",
    "checkmate",
    "castle",
    "illegal",
    "draw",
  ].includes(event);
}
function allowed(event: ChessSoundEvent) {
  return (
    !settings.muted &&
    (isVariant(event) ? settings.variantSounds : settings.gameSounds) &&
    settings.masterVolume > 0 &&
    settings.effectsVolume > 0
  );
}
function playNow(event: ChessSoundEvent) {
  if (!allowed(event)) return;
  if (event === "checkmate") {
    const now = Date.now();
    if (now - lastCheckmateAt < 1000) return;
    lastCheckmateAt = now;
  }
  const asset = soundAssets[event];
  const path = asset.available
    ? asset.path
    : event === "capture"
      ? soundAssets.move.path
      : null;
  if (!path) return;
  const audio =
    (samples.get(path)?.cloneNode(true) as HTMLAudioElement | undefined) ??
    new Audio(path);
  audio.volume = settings.masterVolume * settings.effectsVolume;
  void audio.play().catch(() => {});
}
export function playChessSound(event: ChessSoundEvent) {
  if (event === "bombFuse") {
    startSoundLoop(event);
    return;
  }
  if (event === "bombExplosion") stopSound("bombFuse");
  if (event in priority) {
    if (!pending || (priority[event] ?? 0) >= (priority[pending] ?? 0))
      pending = event;
    if (pendingTimer === null)
      pendingTimer = window.setTimeout(() => {
        const chosen = pending;
        pending = null;
        pendingTimer = null;
        if (chosen) playNow(chosen);
      }, 35);
    return;
  }
  playNow(event);
}
export function playChessMoveOutcome(
  move: {
    captured?: string;
    isKingsideCastle?: () => boolean;
    isQueensideCastle?: () => boolean;
  },
  position: { isCheckmate: () => boolean; isCheck: () => boolean },
) {
  if (position.isCheckmate()) playChessSound("checkmate");
  else if (position.isCheck()) playChessSound("check");
  else if (move.isKingsideCastle?.() || move.isQueensideCastle?.())
    playChessSound("castle");
  else playChessSound(move.captured ? "capture" : "move");
}
export function startSoundLoop(event: ChessSoundEvent) {
  if (loops.has(event) || !allowed(event) || !soundAssets[event].available)
    return;
  const audio = new Audio(soundAssets[event].path);
  audio.loop = true;
  audio.volume = settings.masterVolume * settings.effectsVolume;
  loops.set(event, audio);
  void audio.play().catch(() => {
    loops.delete(event);
  });
}
export function stopSound(event: ChessSoundEvent) {
  const audio = loops.get(event);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    loops.delete(event);
  }
}
function syncMusic() {
  const track =
    unlocked && settings.backgroundMusic
      ? musicTracks.find((item) => item.category === settings.musicCategory)
      : undefined;
  if (!track) {
    music?.pause();
    music = null;
    musicPath = "";
    return;
  }
  if (musicPath !== track.path) {
    music?.pause();
    music = new Audio(track.path);
    music.loop = true;
    musicPath = track.path;
  }
  if (music) {
    music.volume = settings.muted
      ? 0
      : settings.masterVolume * settings.musicVolume;
    void music.play().catch(() => {});
  }
}
