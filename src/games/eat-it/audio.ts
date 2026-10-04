import { getAudioSettings } from '../chess/audio/chessAudio';
import type { GameEvent, MapId } from './types';
/** Procedural arcade effects use the site's existing volume and mute preferences. */
export class EatAudio {
  private context: AudioContext | null = null;
  private lastAmbient = 0;
  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => {});
  }
  private tone(frequency: number, end: number, duration: number, volume: number, delay = 0, type: OscillatorType = 'sine') {
    const c = this.context; if (!c || c.state !== 'running') return;
    const osc = c.createOscillator(), gain = c.createGain(), start = c.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(frequency, start); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    gain.gain.setValueAtTime(0.001, start); gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain); gain.connect(c.destination); osc.start(start); osc.stop(start + duration + 0.03);
  }
  play(event: GameEvent['type']) {
    const settings = getAudioSettings(); if (settings.muted || !settings.gameSounds) return;
    const volume = settings.masterVolume * settings.effectsVolume * 0.13;
    if (event === 'shock' || event === 'shockHit') { this.tone(1100, 120, .22, volume, 0, 'sawtooth'); this.tone(1600, 260, .12, volume*.5, .08); }
    if (event === 'food') { this.tone(260, 490, 0.07, volume); this.tone(190, 95, 0.1, volume * 0.5, 0.07); }
    if (event === 'eat') { this.tone(180, 50, 0.22, volume, 0, 'triangle'); this.tone(300, 100, 0.15, volume * 0.7, 0.23); }
    if (event === 'power' || event === 'questPickup' || event === 'questComplete' || event === 'npcFeed') { this.tone(430, 720, 0.16, volume); this.tone(650, 1040, 0.2, volume, 0.12); }
    if (event === 'fireball') { this.tone(160, 620, .22, volume, 0, 'sawtooth'); this.tone(320, 980, .18, volume * .7, .08); }
    if (event === 'blackHoleEaten') { this.tone(60, 900, .6, volume, 0, 'sawtooth'); this.tone(900, 120, .5, volume * .8, .35, 'triangle'); }
    if (event === 'choke') { this.tone(170, 80, .12, volume, 0, 'triangle'); this.tone(150, 65, .12, volume, .2, 'triangle'); }
    if (event === 'npcEmerge' || event === 'npcAttack') this.tone(400, 95, .25, volume, 0, 'triangle');
    if (event === 'collision') this.tone(100, 55, 0.06, volume * 0.3);
    if (event === 'eliminated') this.tone(350, 65, 0.45, volume, 0, 'triangle');
    if (event === 'hellStart' || event === 'sweep') this.tone(75, 38, .7, volume, 0, 'sawtooth');
    if (event === 'groundWarning' || event === 'groundDestroyed') this.tone(140, 45, .15, volume * .5, 0, 'triangle');
    if (event === 'fall' || event === 'lava') this.tone(220, 30, .5, volume, 0, 'triangle');
    if (event === 'tie') { this.tone(330, 220, .6, volume); this.tone(440, 330, .6, volume, .2); }
    if (event === 'escape' || event === 'hellAssist' || event === 'respawn') this.tone(240, 800, .3, volume);
    if (event === 'win') [523, 659, 784, 1047].forEach((hz, i) => this.tone(hz, hz, 0.3, volume, i * 0.12));
  }
  ambient(map: MapId | 'hell', time: number) {
    const s = getAudioSettings(); if (s.muted || !s.backgroundMusic || s.musicCategory === 'off' || time - this.lastAmbient < 4) return;
    this.lastAmbient = time; const volume = s.masterVolume * s.musicVolume * 0.025;
    if (map === 'hell') { this.tone(42, 55, 2, volume, 0, 'triangle'); this.tone(67, 40, 2, volume * .4, .5); }
    else if (map === 'nature') { this.tone(1600, 2400, 0.12, volume); this.tone(1900, 1400, 0.16, volume, 0.22); }
    else { this.tone(261, 261, 1.5, volume); this.tone(392, 392, 1.5, volume * 0.5, 0.1); }
  }
  close() { void this.context?.close(); this.context = null; }
}
