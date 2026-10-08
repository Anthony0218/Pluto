import { useState } from 'react';
import { baseRepresentations, numberBases, parseBaseInteger, placeValueTerms, toggleBit, type NumberBase } from '@/data/practicalMath';
import { ui, useUiLanguage } from '@/i18n/ui';
import './practicalTools.css';
import './calculator.css';
const baseNames: Record<NumberBase, string> = { 2: 'Binary', 8: 'Octal', 10: 'Decimal', 16: 'Hexadecimal' };
/** Two bytes, high byte first, each shown as two groups of four bits. */
const byteRows = [[15, 14, 13, 12, 11, 10, 9, 8], [7, 6, 5, 4, 3, 2, 1, 0]];

/**
 * A converter built like the calculators: one device. The display lists the number in all four bases (the row you type in
 * is the input base, the others follow), a place-value line explains it, and a 16-bit register below can be toggled.
 */
export default function NumberSystemConverter() {
  useUiLanguage();
  const [base, setBase] = useState<NumberBase>(10), [input, setInput] = useState('42');
  const value = parseBaseInteger(input, base);
  const representations = value === null ? null : baseRepresentations(value);
  const terms = value === null ? [] : placeValueTerms(value, base);
  const bitsAvailable = value !== null && value >= 0n && value <= 65535n;
  const select = (next: NumberBase) => { if (value !== null) setInput(value.toString(next).toUpperCase()); setBase(next); };
  const expansion = value === null ? '' : `${value < 0n ? '−(' : ''}${terms.length <= 16 ? terms.map(term => `${term.digit} × ${base}^${term.power}`).join(' + ') : ui('The place-value expansion is shown for numbers of up to 16 digits.')}${value < 0n ? ')' : ''}`;
  return <section className="calc-layout" aria-label={ui('Number-System Converter')}>
    <div className="calc-body ns-body" role="group" aria-label={ui('Number-System Converter')}>
      <div className="calc-display calc-display--fields ns-screen" aria-live="polite">
        {numberBases.map(item => {
          const name = `${ui(baseNames[item])} · ${item}`;
          return item === base
            ? <label key={item} className="calc-field is-active"><span>{name}</span>
              <input type="text" spellCheck={false} autoComplete="off" maxLength={259} value={input} aria-label={`${ui('Integer')}: ${ui(baseNames[item])}`} aria-invalid={value === null} onChange={event => setInput(event.target.value)} /></label>
            : <button type="button" key={item} className="calc-field ns-row" onClick={() => select(item)} aria-label={`${ui('Input base')}: ${ui(baseNames[item])} (${item})`}><span>{name}</span><output>{representations ? representations[item] : '—'}</output></button>;
        })}
      </div>
      {representations
        ? <p className="ns-expansion"><small>{ui('Place-value explanations')}</small><code className="pt-mono">{expansion}</code><code className="pt-mono">= {representations[10]}</code></p>
        : <p role="status" className="pt-error ns-expansion">{ui('Enter an integer containing only valid digits for the selected base.')}</p>}
      <div className="ns-bits" role="group" aria-label={ui('Clickable bits')}>
        <small>{ui('Clickable bits')}</small>
        {bitsAvailable ? byteRows.map((row, index) => <div className="ns-byte" key={index}>{row.map(bit => {
          const on = (value! & (1n << BigInt(bit))) !== 0n;
          return <button type="button" key={bit} className={`ns-bit${bit % 4 === 3 && bit % 8 !== 7 ? ' ns-bit--gap' : ''}`} aria-label={`${ui('Bit')} ${bit}: ${2 ** bit}`} aria-pressed={on} onClick={() => setInput(toggleBit(value!, bit).toString(base).toUpperCase())}><small>2^{bit}</small><strong>{on ? 1 : 0}</strong></button>;
        })}</div>) : <p className="calc-empty">{ui('The bit editor is available for values from 0 to 65,535. Conversion still works for larger or negative integers.')}</p>}
      </div>
    </div>
    <aside className="calc-side" aria-label={ui('Place-value explanations')}>
      <div className="pt-working">
        <h3>{ui('Place-value explanations')}</h3>
        {representations ? <><code className="pt-mono">{expansion}</code><code className="pt-mono">= {representations[10]}</code></> : <p className="calc-empty">{ui('Enter an integer containing only valid digits for the selected base.')}</p>}
        <p className="calc-empty">{ui('Toggle a bit to add or remove its power of two. This view uses 16 unsigned bits.')}</p>
      </div>
      <p className="lt-storage-note">{ui('Signed integers only, up to 256 digits. Optional 0b, 0o, or 0x prefixes must match the selected base. Negative values use a minus sign, not two’s complement.')}</p>
    </aside>
  </section>;
}
