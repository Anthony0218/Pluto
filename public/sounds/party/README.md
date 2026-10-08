# Pluto Party custom sounds

Put your MP3, WAV, OGG or M4A files in this folder. Map sound IDs to filenames in `manifest.json`, for example:

```json
{
  "dice": "my-dice.wav",
  "heal": "cleanse.mp3",
  "coinGain": "coins.ogg",
  "victory": "winner.mp3"
}
```

Supported IDs: click, dice, coinGain, coinLoss, pluto, property, damage, heal, ko, item, countdown, go, result, animal, avalanche, cable, radiation, duel, victory, miss, hit, combo, delivery, splash, paddle.

Paths may include subfolders within this folder. Reload the page after changing the manifest. Sounds load on the first user interaction, respect the game’s volume/mute settings, and use the synthesised fallback if a file is unavailable. Music and Echo Wall tones are synthesised. Pluto Pulse music uses the chart’s 100 BPM beat grid.
