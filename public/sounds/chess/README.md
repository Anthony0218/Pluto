# Chess audio assets

The existing files are `Move.mp3`, `Check.mp3`, `Checkmate.mp3`, and `Castle.mp3` (case-sensitive). `Capture.mp3` is not present; captures currently use `Move.mp3` as a fallback.

The semantic events in `src/games/chess/audio/chessAudio.ts` expect these additional files if sound is desired:

- `GameStart.mp3`, `Capture.mp3`, `Illegal.mp3`, `Draw.mp3`
- `variants/BoardRotate.mp3`, `RouletteEvent.mp3`, `RoulettePromotionSuccess.mp3`, `RoulettePromotionFailure.mp3`, `RouletteKing.mp3`
- `variants/BombFuse.mp3`, `BombExplosion.mp3`, `Collapse.mp3`, `Mutation.mp3`, `MarketSpawn.mp3`, `BountyComplete.mp3`, `MissionComplete.mp3`

After adding a licensed file, change its `available` flag in `chessAudio.ts` to `true`. The application deliberately does not request missing files.

Background music has no bundled tracks. Add only recordings and compositions licensed for web use to `musicTracks` in `chessAudio.ts`, with title, artist, source, license, path, and category.
