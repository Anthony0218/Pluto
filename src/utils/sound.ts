import { playChessSound, soundAssets, type ChessSoundEvent } from "@/games/chess/audio/chessAudio";

export function playSound(sound: ChessSoundEvent | string) {
  if (sound in soundAssets) playChessSound(sound as ChessSoundEvent);
}

export function playPieceSelectSound(piece: string) { void piece; /* No selection clip is currently supplied. */ }
export function playPieceMoveSound(piece: string) { void piece; playChessSound("move"); }
export function playPieceCaptureSound(piece: string) { void piece; playChessSound("capture"); }
export function playRandomSound(sounds: string[]) { if (sounds.length) playSound(sounds[Math.floor(Math.random() * sounds.length)]); }
