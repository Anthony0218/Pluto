import { useState } from 'react';
import { baseRepresentations, numberBases, parseBaseInteger, placeValueTerms, toggleBit, type NumberBase } from '@/data/practicalMath';
import { ui, useUiLanguage } from '@/i18n/ui';
import './practicalTools.css';
const baseNames: Record<NumberBase, string> = { 2: 'Binary', 8: 'Octal', 10: 'Decimal', 16: 'Hexadecimal' };
export default function NumberSystemConverter() {
  useUiLanguage();
  const [base, setBase] = useState<NumberBase>(10), [input, setInput] = useState('42');
  const value = parseBaseInteger(input, base);
  const representations = value === null ? null : baseRepresentations(value);
  const terms = value === null ? [] : placeValueTerms(value, base);
  return <section className="pt-workbench" aria-label={ui('Number-System Converter')}>
    <div className="pt-inputs"><label>{ui('Input base')}<select value={base} onChange={event => { const next = Number(event.target.value) as NumberBase; if (value !== null) setInput(value.toString(next).toUpperCase()); setBase(next); }}>{numberBases.map(item => <option value={item} key={item}>{ui(baseNames[item])} ({item})</option>)}</select></label><label>{ui('Integer')}<input type="text" spellCheck={false} autoComplete="off" maxLength={259} value={input} aria-invalid={value === null} onChange={event => setInput(event.target.value)} /></label></div>
    <p className="lt-storage-note">{ui('Signed integers only, up to 256 digits. Optional 0b, 0o, or 0x prefixes must match the selected base. Negative values use a minus sign, not two’s complement.')}</p>
    {representations ? <><div className="pt-base-results" aria-live="polite">{numberBases.map(item => <div className="pt-result" key={item}><h3>{ui(baseNames[item])} · {item}</h3><output>{representations[item]}</output></div>)}</div>
      <section className="pt-working"><h3>{ui('Place-value explanations')}</h3><p className="pt-mono">{value! < 0n ? '−(' : ''}{terms.length <= 16 ? terms.map(term => `${term.digit} × ${base}^${term.power}`).join(' + ') : ui('The place-value expansion is shown for numbers of up to 16 digits.')}{value! < 0n ? ')' : ''}</p><p className="pt-mono">= {representations[10]}</p></section>
      <section className="pt-working"><h3>{ui('Clickable bits')}</h3>{value! >= 0n && value! <= 65535n ? <><p>{ui('Toggle a bit to add or remove its power of two. This view uses 16 unsigned bits.')}</p><div className="pt-bits">{Array.from({ length: 16 }, (_, index) => 15 - index).map(bit => <button type="button" key={bit} aria-label={`${ui('Bit')} ${bit}: ${2 ** bit}`} aria-pressed={(value! & (1n << BigInt(bit))) !== 0n} onClick={() => setInput(toggleBit(value!, bit).toString(base).toUpperCase())}><small>2^{bit}</small><strong>{(value! & (1n << BigInt(bit))) === 0n ? 0 : 1}</strong></button>)}</div></> : <p>{ui('The bit editor is available for values from 0 to 65,535. Conversion still works for larger or negative integers.')}</p>}</section>
    </> : <p role="status" className="pt-error">{ui('Enter an integer containing only valid digits for the selected base.')}</p>}
  </section>;
}
