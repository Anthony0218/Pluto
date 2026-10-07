import { useState } from 'react';
import { convertUnit, units, unitGroups, type UnitGroup } from '@/data/unitConversions';
import { decimalInput } from '@/data/practicalMath';
import { ui } from '@/i18n/ui';
import useToolNumber from '@/hooks/useToolNumber';
import './practicalTools.css';
export default function UnitConverter() {
  const number = useToolNumber();
  const [group, setGroup] = useState<UnitGroup>('Length'), [from, setFrom] = useState('m'), [to, setTo] = useState('ft'), [input, setInput] = useState('1'), [precision, setPrecision] = useState(6);
  const choices = units.filter(item => item.group === group);
  const value = decimalInput(input), result = value === null ? null : convertUnit(value, from, to);
  const source = units.find(item => item.id === from)!, target = units.find(item => item.id === to)!;
  return <section className="pt-workbench" aria-label={ui('Unit Converter')}>
    <div className="pt-inputs"><label>{ui('Measurement')}<select value={group} onChange={event => { const next = event.target.value as UnitGroup; const options = units.filter(item => item.group === next); setGroup(next); setFrom(options[0].id); setTo(options[1].id); }}>{unitGroups.map(item => <option value={item} key={item}>{ui(item)}</option>)}</select></label><label>{ui('Value')}<input type="text" inputMode="decimal" value={input} maxLength={26} aria-invalid={result === null} onChange={event => setInput(event.target.value)} /></label><label>{ui('From unit')}<select value={from} onChange={event => setFrom(event.target.value)}>{choices.map(item => <option key={item.id} value={item.id}>{item.symbol}</option>)}</select></label><label>{ui('To unit')}<select value={to} onChange={event => setTo(event.target.value)}>{choices.map(item => <option key={item.id} value={item.id}>{item.symbol}</option>)}</select></label><label>{ui('Decimal places')}<select value={precision} onChange={event => setPrecision(Number(event.target.value))}>{[2, 4, 6, 8, 12].map(item => <option key={item}>{item}</option>)}</select></label></div>
    <button className="lt-button" type="button" onClick={() => { setFrom(to); setTo(from); }}>{ui('Swap units')}</button>
    <div className="pt-result" aria-live="polite">{result !== null ? <><p className="lt-eyebrow">{ui('Result')}</p><output className="pt-output">{number(result, precision)} {target.symbol}</output><p>{number(value!, precision)} {source.symbol} ≈ {number(result, precision)} {target.symbol}</p><p>{ui('Independent check')}: {number(convertUnit(result, to, from)!, precision)} {source.symbol}</p></> : <p role="status" className="pt-error">{ui('Enter a valid nonnegative measurement. Temperatures may be negative, but cannot be below absolute zero.')}</p>}</div>
    <section className="pt-working"><h3>{ui('Conversion method')}</h3><code>({ui('Value')} × {source.factor} + {source.offset ?? 0} − {target.offset ?? 0}) ÷ {target.factor}</code><p>{ui('Displayed values are rounded. Calculations and the reverse check use full precision.')}</p></section>
    {group === 'Data size' && <p className="lt-notice">{ui('Decimal prefixes: 1 kB = 1,000 B. Binary prefixes: 1 KiB = 1,024 B. One byte contains eight bits.')}</p>}
    {group === 'Volume' && <p className="lt-notice">{ui('US gal and US fl oz are US liquid measures. Volume-to-mass conversion needs an ingredient density and is not included.')}</p>}
    {group === 'Temperature' && <p className="lt-notice">{ui('These are absolute temperatures. Temperature differences require a different calculation.')}</p>}
    <p className="lt-storage-note"><a href="https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8" target="_blank" rel="noreferrer">{ui('Unit definitions: NIST')}</a> · <a href="https://physics.nist.gov/cuu/Units/binary.html" target="_blank" rel="noreferrer">{ui('Binary prefixes: NIST')}</a></p>
  </section>;
}
