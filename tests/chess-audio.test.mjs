import assert from 'node:assert/strict';
import test from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
globalThis.window = { setTimeout };
const played = [];
const instances = [];
class FakeAudio {
  constructor(path) { this.path = path; this.paused = false; instances.push(this); }
  cloneNode() { return new FakeAudio(this.path); }
  play() { played.push(this.path); return Promise.resolve(); }
  pause() { this.paused = true; }
}
globalThis.Audio = FakeAudio;
const audio = await import('../src/games/chess/audio/chessAudio.ts');

test('move outcomes play the highest priority supplied clip once', async () => {
  audio.playChessSound('move');
  audio.playChessSound('capture');
  audio.playChessSound('check');
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.deepEqual(played, ['/sounds/chess/Check.mp3']);
});

test('settings persist and mute suppresses effects', async () => {
  audio.setAudioSettings({ muted: true, masterVolume: 0.5 });
  audio.playChessSound('check');
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(played.length, 1);
  assert.equal(JSON.parse(storage.get('chess-audio-settings-v1')).masterVolume, 0.5);
  audio.setAudioSettings({ muted: false, masterVolume: 0.8 });
});

test('fuse starts once and stops before an explosion', () => {
  audio.soundAssets.bombFuse.available = true;
  audio.playChessSound('bombFuse');
  audio.playChessSound('bombFuse');
  assert.equal(played.filter(path => path.endsWith('BombFuse.mp3')).length, 1);
  const fuse = instances.find(instance => instance.path?.endsWith('BombFuse.mp3'));
  assert.equal(fuse?.loop, true);
  audio.playChessSound('bombExplosion');
  assert.equal(fuse?.paused, true);
  audio.soundAssets.bombFuse.available = false;
});
