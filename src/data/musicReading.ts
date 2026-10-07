export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';
export type MusicInstrument = { id: string; name: string; clef: Clef; transpose: number; description: string };
export const musicInstruments: MusicInstrument[] = [
  { id: 'piano', name: 'Piano', clef: 'treble', transpose: 0, description: 'Grand staff: treble above bass; both sound as written.' },
  { id: 'violin', name: 'Violin', clef: 'treble', transpose: 0, description: 'Treble clef; sounds as written.' },
  { id: 'flute', name: 'Flute', clef: 'treble', transpose: 0, description: 'Treble clef; sounds as written.' },
  { id: 'viola', name: 'Viola', clef: 'alto', transpose: 0, description: 'Alto clef: middle line C4; sounds as written.' },
  { id: 'cello', name: 'Cello', clef: 'bass', transpose: 0, description: 'Usually bass clef; higher parts can use tenor or treble.' },
  { id: 'guitar', name: 'Guitar', clef: 'treble', transpose: -12, description: 'Treble clef; sounds one octave below the written pitch. TAB lines represent strings.' },
  { id: 'bass', name: 'Electric bass', clef: 'bass', transpose: -12, description: 'Bass clef; sounds one octave below the written pitch.' },
  { id: 'clarinet', name: 'B-flat clarinet', clef: 'treble', transpose: -2, description: 'Treble clef; sounds two semitones below the written pitch.' },
  { id: 'sax', name: 'E-flat alto saxophone', clef: 'treble', transpose: -9, description: 'Treble clef; sounds nine semitones below the written pitch.' },
  { id: 'drums', name: 'Drum kit', clef: 'treble', transpose: 0, description: 'Unpitched notation: follow the score legend. This demo uses kick, snare, and hi-hat.' },
];
export const clefNames: Record<Clef, string> = { treble: 'Treble clef', bass: 'Bass clef', alto: 'Alto clef', tenor: 'Tenor clef' };
export const drumNames = ['Kick', 'Snare', 'Hi-hat'];
/** Keep tied events on the same drum voice, independent of their event index. */
export function drumVoice(step: number) { return step === 28 ? 0 : step === 29 ? 1 : 2; }
const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const semitones = [0, 2, 4, 5, 7, 9, 11];
export function writtenNote(step: number, accidental = 0) {
  if (!Number.isInteger(step) || step < 14 || step > 48 || ![-1, 0, 1].includes(accidental)) throw new RangeError('note');
  const degree = step % 7;
  const octave = Math.floor(step / 7);
  return { letter: letters[degree], octave, midi: (octave + 1) * 12 + semitones[degree] + accidental, name: `${letters[degree]}${accidental === 1 ? '♯' : accidental === -1 ? '♭' : ''}${octave}` };
}
/** Local natural (2) overrides the signature, while 0 uses it. */
export function resolveWrittenNote(step: number, local: number, signature: number) {
  if (![0, 1, -1, 2].includes(local) || ![0, 1, -1].includes(signature)) throw new RangeError('accidental');
  const alteration = local === 2 ? 0 : local || (signature === 1 && step % 7 === 3 ? 1 : signature === -1 && step % 7 === 6 ? -1 : 0);
  return writtenNote(step, alteration);
}
export const bottomLineStep: Record<Clef, number> = { treble: 30, bass: 18, alto: 24, tenor: 22 };
export function staffY(step: number, clef: Clef, bottom = 110) { return bottom - (step - bottomLineStep[clef]) * 7; }
export function midiName(midi: number) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new RangeError('midi');
  return `${['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`;
}
export function frequency(midi: number) { return 440 * 2 ** ((midi - 69) / 12); }
export type RhythmEvent = { beats: number; step: number | null; tie?: boolean; dotted?: boolean };
export type RhythmPattern = { id: string; name: string; meter: string; unit: string; events: RhythmEvent[] };
export const rhythmPatterns: RhythmPattern[] = [
  { id: 'quarters', name: 'Four steady quarters', meter: '4/4', unit: 'Quarter-note beats', events: [28, 29, 30, 32].map(step => ({ beats: 1, step })) },
  { id: 'rests', name: 'Eighth notes and a rest', meter: '4/4', unit: 'Quarter-note beats', events: [{ beats: 1, step: 28 }, { beats: 0.5, step: 29 }, { beats: 0.5, step: 30 }, { beats: 1, step: null }, { beats: 1, step: 32 }] },
  { id: 'dotted', name: 'Dotted quarter and eighth', meter: '4/4', unit: 'Quarter-note beats', events: [{ beats: 1.5, step: 28, dotted: true }, { beats: 0.5, step: 29 }, { beats: 2, step: 30 }] },
  { id: 'ties', name: 'Quarter tied to an eighth', meter: '4/4', unit: 'Quarter-note beats', events: [{ beats: 1, step: 28 }, { beats: 0.5, step: 28, tie: true }, { beats: 0.5, step: 29 }, { beats: 1, step: null }, { beats: 1, step: 32 }] },
  { id: 'waltz', name: 'Three quarter beats', meter: '3/4', unit: 'Quarter-note beats', events: [{ beats: 1, step: 28 }, { beats: 1, step: 30 }, { beats: 1, step: 32 }] },
  { id: 'compound', name: 'Two dotted-quarter groups', meter: '6/8', unit: 'Dotted-quarter beats', events: [28, 29, 30, 32, 30, 29].map(step => ({ beats: 1 / 3, step })) },
];
export function rhythmTimeline(events: RhythmEvent[]) {
  let beat = 0;
  return events.map(event => { const start = beat; beat += event.beats; return { ...event, start, end: beat }; });
}
export function rhythmDuration(events: RhythmEvent[], bpm: number) {
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 180 || events.some(e => !Number.isFinite(e.beats) || e.beats <= 0)) throw new RangeError('rhythm');
  return events.reduce((sum, event) => sum + event.beats, 0) * 60 / bpm;
}
