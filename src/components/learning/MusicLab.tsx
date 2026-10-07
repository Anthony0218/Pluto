import { useEffect, useRef, useState } from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
import { bottomLineStep, clefNames, drumNames, drumVoice, frequency, midiName, musicInstruments, rhythmDuration, rhythmPatterns, rhythmTimeline, staffY, resolveWrittenNote, writtenNote, type Clef, type RhythmEvent } from '@/data/musicReading';
import { ui } from '@/i18n/ui';

const clefSymbols = { treble: '𝄞', bass: '𝄢', alto: '𝄡', tenor: '𝄡' };
function Staff({ clef, steps, accidental = 0, keySignature = 0, events, active = -1, percussion = false }: { clef: Clef; steps: number[]; accidental?: number; keySignature?: number; events?: RhythmEvent[]; active?: number; percussion?: boolean }) {
  return <div className="sl-score-scroll" tabIndex={0} aria-label={ui('Musical staff')}><svg className={`sl-staff ${steps.length > 3 ? 'sl-staff-passage' : ''}`} viewBox={`0 0 ${steps.length > 3 ? 660 : 360} 185`} role="img" aria-label={ui(percussion ? 'Drum notation' : 'Musical staff')}>
    <rect width="660" height="185" rx="12" fill="#f5f0e7" />
    {[0, 1, 2, 3, 4].map(line => <line key={line} x1="25" x2={steps.length > 3 ? 635 : 335} y1={110 - line * 14} y2={110 - line * 14} stroke="#374151" />)}
    {percussion ? <text x="32" y="98" fontSize="42" fill="#1f2937">Ⅱ</text> : <text x="28" y={clef === 'treble' ? 108 : clef === 'bass' ? 87 : clef === 'alto' ? 100 : 86} fontSize="64" fill="#1f2937" fontFamily="serif">{clefSymbols[clef]}</text>}
    {keySignature !== 0 && <text x="85" y={keySignature > 0 ? staffY(38, 'treble') + 5 : staffY(34, 'treble') + 5} fill="#1f2937" fontSize="25">{keySignature > 0 ? '♯' : '♭'}</text>}
    {steps.map((step, index) => {
      const x = 135 + index * Math.min(85, 440 / Math.max(steps.length - 1, 1));
      const percussionVoice = (step - bottomLineStep[clef]) / 4;
      const y = percussion ? [110, 82, 54][percussionVoice] : staffY(step, clef);
      const event = events?.[index];
      const rest = event?.step === null;
      const ledger: number[] = [];
      if (!percussion && !rest) { for (let ly = 124; ly <= y; ly += 14) ledger.push(ly); for (let ly = 40; ly >= y; ly -= 14) ledger.push(ly); }
      return <g key={index} fill={active === index ? '#854d0e' : '#172033'}>
        {active === index && <rect x={x - 24} y="16" width="49" height="130" rx="8" fill="#facc1540" />}
        {ledger.map(ly => <line key={ly} x1={x - 17} x2={x + 17} y1={ly} y2={ly} stroke="#172033" />)}
        {rest ? <text x={x - 10} y="97" fontSize="38">𝄽</text> : <>
          {accidental !== 0 && <text x={x - 31} y={y + 6} fontSize="25">{accidental === 1 ? '♯' : accidental === -1 ? '♭' : '♮'}</text>}
          {percussion && percussionVoice === 2 ? <text x={x - 9} y={y + 7} fontSize="26">×</text> : <ellipse cx={x} cy={y} rx="10" ry="7" transform={`rotate(-15 ${x} ${y})`} fill={event?.beats === 2 && !event.dotted ? '#f5f0e7' : undefined} stroke="#172033" strokeWidth="2" />}
          <line x1={x + 9} x2={x + 9} y1={y} y2={y - 35} stroke="#172033" strokeWidth="2" />
          {event && event.beats < 1 && <path d={`M ${x + 9} ${y - 35} q 19 10 6 23`} fill="none" stroke="#172033" strokeWidth="3" />}
          {event?.dotted && <circle cx={x + 21} cy={y - 3} r="3" />}
          {event?.tie && <path d={`M ${x - 76} ${y + 14} Q ${x - 35} ${y + 36} ${x - 4} ${y + 14}`} fill="none" stroke="#172033" strokeWidth="2" />}
        </>}
        <text x={x} y="168" textAnchor="middle" fontSize="14">{event ? `${Number(event.beats.toFixed(3))}` : resolveWrittenNote(step, accidental, keySignature).name}</text>
      </g>;
    })}
  </svg></div>;
}
export default function MusicLab({ topic, rhythm }: { topic: string; rhythm: boolean }) {
  const [instrumentId, setInstrumentId] = useState('piano');
  const instrument = musicInstruments.find(item => item.id === instrumentId)!;
  const [step, setStep] = useState(28);
  const [accidental, setAccidental] = useState(0);
  const [signature, setSignature] = useState(0);
  const [celloTenor, setCelloTenor] = useState(false);
  const [patternId, setPatternId] = useState(topic === 'meter' ? 'compound' : topic === 'dots-ties' ? 'ties' : 'rests');
  const [bpm, setBpm] = useState(80);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const activeToken = useRef(0);
  const clef = instrumentId === 'cello' && celloTenor ? 'tenor' : instrument.clef;
  const pattern = rhythmPatterns.find(item => item.id === patternId)!;
  const timeline = rhythmTimeline(pattern.events);
  const note = resolveWrittenNote(step, accidental, signature);
  const soundMidi = note.midi + instrument.transpose;
  const percussion = instrumentId === 'drums';
  const stop = () => { activeToken.current++; if (raf.current !== null) cancelAnimationFrame(raf.current); raf.current = null; if (audio.current) void audio.current.close().catch(() => {}); audio.current = null; setPlaying(false); };
  useEffect(() => () => { activeToken.current++; if (raf.current !== null) cancelAnimationFrame(raf.current); if (audio.current) void audio.current.close().catch(() => {}); }, []);
  const play = async () => {
    stop(); setAudioError(false); setTaps([]); setBeat(0);
    const token = activeToken.current;
    try {
      const context = new AudioContext(); audio.current = context; await context.resume();
      if (token !== activeToken.current) { void context.close().catch(() => {}); return; }
      if (context.state !== 'running') throw new Error('audio');
      const start = context.currentTime + 0.08;
      const schedule = (midi: number, when: number, length: number) => { const osc = context.createOscillator(); const gain = context.createGain(); osc.type = percussion ? 'triangle' : 'sine'; osc.frequency.value = frequency(midi); gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(0.13, when + 0.015); gain.gain.setValueAtTime(0.13, when + Math.max(0.02, length - 0.04)); gain.gain.linearRampToValueAtTime(0, when + length); osc.connect(gain); gain.connect(context.destination); osc.start(when); osc.stop(when + length + 0.01); };
      const total = rhythm ? rhythmDuration(pattern.events, bpm) : 0.75;
      if (rhythm) timeline.forEach((event, index) => { if (event.step === null || event.tie) return; const duration = event.beats + (timeline[index + 1]?.tie ? timeline[index + 1].beats : 0); schedule(percussion ? [36, 60, 90][drumVoice(event.step)] : writtenNote(event.step).midi + instrument.transpose, start + event.start * 60 / bpm, duration * 60 / bpm * 0.96); });
      else schedule(percussion ? 60 : soundMidi, start, total);
      setPlaying(true);
      const tick = () => { if (token !== activeToken.current) return; const elapsed = Math.max(0, context.currentTime - start); setBeat(elapsed * bpm / 60); if (elapsed < total) raf.current = requestAnimationFrame(tick); else stop(); }; raf.current = requestAnimationFrame(tick);
    } catch { if (token === activeToken.current) { stop(); setAudioError(true); } }
  };
  const change = (action: () => void) => { stop(); setBeat(0); setTaps([]); action(); };
  const displaySteps = rhythm ? pattern.events.map(event => percussion ? bottomLineStep[clef] + drumVoice(event.step ?? 28) * 4 : event.step ?? 28) : percussion ? [30, 34, 38] : [step];
  const active = playing && rhythm ? timeline.findIndex(e => beat >= e.start && beat < e.end) : -1;
  const writtenMidi = rhythm ? pattern.events.find(e => e.step !== null)?.step ?? 28 : step;
  return <section className="sl-lab"><div className="sl-lab-heading"><span className="lt-eyebrow">{ui(rhythm ? 'Rhythm studio' : 'Notation studio')}</span><h3>{ui(rhythm ? 'Read, count, and listen' : 'Written pitch and sounding pitch')}</h3></div>
    <div className="sl-controls"><label>{ui('Instrument')}<select value={instrumentId} onChange={e => change(() => { setInstrumentId(e.target.value); const selected = musicInstruments.find(i => i.id === e.target.value)!; setStep(selected.clef === 'bass' ? 21 : selected.clef === 'alto' ? 28 : 28); setAccidental(0); setSignature(0); })}>{musicInstruments.map(item => <option key={item.id} value={item.id}>{ui(item.name)}</option>)}</select></label>
      {!rhythm && !percussion && <><label>{ui('Written note')}<input type="range" min={instrument.clef === 'bass' ? 14 : 24} max={instrument.clef === 'bass' ? 32 : 42} value={step} onChange={e => change(() => setStep(Number(e.target.value)))} /></label><label>{ui('Local accidental')}<select value={accidental} onChange={e => change(() => setAccidental(Number(e.target.value)))}><option value="0">{ui('Use key signature')}</option><option value="1">♯ {ui('Sharp')}</option><option value="-1">♭ {ui('Flat')}</option><option value="2">♮ {ui('Natural')}</option></select></label>{clef === 'treble' && <label>{ui('Key signature')}<select value={signature} onChange={e => change(() => { setSignature(Number(e.target.value)); setAccidental(0); })}><option value="0">C / Am</option><option value="1">G / Em · F♯</option><option value="-1">F / Dm · B♭</option></select></label>}</>}
      {instrumentId === 'cello' && <label>{ui('Clef')}<select value={celloTenor ? 'tenor' : 'bass'} onChange={e => change(() => setCelloTenor(e.target.value === 'tenor'))}><option value="bass">{ui('Bass clef')}</option><option value="tenor">{ui('Tenor clef')}</option></select></label>}
      {rhythm && <><label>{ui('Pattern')}<select value={patternId} onChange={e => change(() => setPatternId(e.target.value))}>{rhythmPatterns.map(item => <option key={item.id} value={item.id}>{ui(item.name)} · {item.meter}</option>)}</select></label><label>{ui('Tempo')} · {bpm} BPM<input type="range" min="40" max="180" value={bpm} onChange={e => change(() => setBpm(Number(e.target.value)))} /></label></>}
    </div>
    <p>{ui(instrument.description)}</p>
    <Staff clef={clef} steps={displaySteps} accidental={rhythm ? 0 : accidental} keySignature={rhythm ? 0 : signature} events={rhythm ? pattern.events : undefined} active={active} percussion={percussion} />
    {instrumentId === 'piano' && <><p>{ui('Bass-staff reference: C3. This lower staff is a reference, not an additional playback part.')}</p><Staff clef="bass" steps={[21]} /></>}
    {rhythm ? <><p>{pattern.meter} · {ui(pattern.unit)} · {Number(timeline.at(-1)!.end.toFixed(2))} · {rhythmDuration(pattern.events, bpm).toFixed(2)} s</p><div className="sl-beat-grid">{timeline.map((event, i) => <span key={i} className={active === i ? 'active' : ''}>{event.step === null ? ui('Rest') : percussion ? ui(drumNames[drumVoice(event.step)]) : writtenNote(event.step).name} · {Number(event.beats.toFixed(3))}{event.tie && ` · ${ui('Tie')}`}</span>)}</div><progress aria-label={ui('Playback position')} max={timeline.at(-1)!.end} value={Math.min(beat, timeline.at(-1)!.end)} /></> : <div className="sl-readout"><span>{ui('Written note')}: <strong>{percussion ? ui('Kick / snare / hi-hat') : note.name}</strong></span>{!percussion && <span>{ui('Sounding pitch')}: <strong>{midiName(soundMidi)}</strong> · {frequency(soundMidi).toFixed(1)} Hz</span>}<span>{ui(percussion ? 'Drum notation' : clefNames[clef])}</span></div>}
    {rhythm && !percussion && <p className="sl-source">{ui('First sounding note')}: {midiName(writtenNote(writtenMidi).midi + instrument.transpose)} · {ui('Durations under the notes use the selected beat unit.')}</p>}
    {instrumentId === 'guitar' && !rhythm && <div className="sl-tab"><strong>TAB · E4 → E3</strong><pre>{'e |---0---|\nB |-------|\nG |-------|\nD |-------|\nA |-------|\nE |-------|'}</pre><p>{ui('Example: the top line is the highest string; 0 means open string. This is a separate example, not a fingering for the selected note.')}</p></div>}
    {percussion && <p>{ui('Kick low · snare middle · hi-hat high with x head. Playback uses synthetic pitch cues, not realistic drum sounds.')}</p>}
    <div className="sl-actions"><button type="button" className="lt-button primary" onClick={playing ? stop : () => { void play(); }}>{playing ? <Square size={16} aria-hidden /> : <Play size={16} aria-hidden />}{ui(playing ? 'Stop' : 'Play sound')}</button>{rhythm && <button type="button" className="lt-button" disabled={!playing} onClick={() => setTaps(prev => [...prev.slice(-15), beat])}>{ui('Tap along')}</button>}<span><Volume2 size={16} aria-hidden />{ui('Audio starts only when you press play.')}</span></div>
    {taps.length > 0 && <p>{ui('Your taps in beat units')}: {taps.map(t => t.toFixed(2)).join(' · ')}</p>}{audioError && <p role="alert">{ui('Audio is unavailable. You can still read and explore the notation.')}</p>}
    <p className="sl-source">{ui('International A–G note names; middle C = C4. Equal temperament, A4 = 440 Hz. Synthesized audio is illustrative.')}</p>
  </section>;
}
