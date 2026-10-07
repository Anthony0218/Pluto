import { useRef, useState, type KeyboardEvent } from 'react';
import { CornerDownLeft, Delete } from 'lucide-react';
import { pressFieldKey } from '@/data/calculator';
import { calculatePercentage, decimalInput, percentageDefaults, percentageFields, percentageLabels, percentageModes, type PercentageMode, type CalculationError } from '@/data/practicalMath';
import useToolNumber from '@/hooks/useToolNumber';
import { ui, useUiLanguage } from '@/i18n/ui';
import SaveToNotes from './SaveToNotes';
import './practicalTools.css';
import './calculator.css';

const calculationErrors: Record<CalculationError, string> = {
  number: 'Enter valid numbers using a decimal point or comma, without units or thousands separators.',
  positive: 'Use nonnegative amounts, a positive whole, and a positive whole number of people or servings.',
  rate: 'Check the rate range. Discounts cannot exceed 100%; reversing a 100% decrease is impossible. Growth must be between −100% and 1,000%.',
  periods: 'Use a whole number of periods from 0 to 100.', range: 'The result is too large. Try smaller values.',
};
type FieldKey = Parameters<typeof pressFieldKey>[1];
type PadKey = FieldKey | 'next';
const keypad: { key: PadKey; label: string; kind: 'digit' | 'function' | 'equals'; wide?: boolean; name?: string }[] = [
  { key: '7', label: '7', kind: 'digit' }, { key: '8', label: '8', kind: 'digit' }, { key: '9', label: '9', kind: 'digit' }, { key: 'back', label: '⌫', kind: 'function', name: 'Delete last digit' },
  { key: '4', label: '4', kind: 'digit' }, { key: '5', label: '5', kind: 'digit' }, { key: '6', label: '6', kind: 'digit' }, { key: 'clear', label: 'AC', kind: 'function', name: 'Clear all values' },
  { key: '1', label: '1', kind: 'digit' }, { key: '2', label: '2', kind: 'digit' }, { key: '3', label: '3', kind: 'digit' }, { key: 'sign', label: '±', kind: 'function', name: 'Change sign' },
  { key: '0', label: '0', kind: 'digit', wide: true }, { key: '.', label: '.', kind: 'digit', name: 'Decimal point' }, { key: 'next', label: 'Next', kind: 'equals', name: 'Next value' },
];
const FIELD_LENGTH = 26;

export default function PercentageWorkbench({ initialMode = 'amount', modes = percentageModes }: { initialMode?: PercentageMode; modes?: readonly PercentageMode[] }) {
  const number = useToolNumber();
  const { language } = useUiLanguage();
  const separator = new Intl.NumberFormat(language === 'bar' ? 'de-DE' : language).formatToParts(1.5).find(part => part.type === 'decimal')?.value ?? '.';
  const [mode, setMode] = useState<PercentageMode>(initialMode);
  const [values, setValues] = useState<string[]>(percentageDefaults[initialMode].map(String));
  // The keypad types into the active row. A row that was just selected is overwritten by the first digit, like a calculator entry.
  const [active, setActive] = useState(0);
  const [overwrite, setOverwrite] = useState(true);
  const fieldRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fields = percentageFields[mode];
  // "12." is a number still being typed, and an empty row is simply not filled in yet: neither is an error.
  const inputs = values.map(value => decimalInput(value.replace(/[.,]$/, '')));
  const blank = values.slice(0, fields.length).some(value => !value.trim());
  const calculation = inputs.some(value => value === null) ? 'number' : calculatePercentage(mode, inputs[0]!, inputs[1]!, inputs[2]!);
  const result = typeof calculation === 'string' ? null : calculation;
  const rate = result ? mode === 'share' ? result.result : mode === 'successive' ? result.extra?.value ?? null : ['amount', 'discount'].includes(mode) ? inputs[1]! : null : null;
  const suffix = ['share', 'change'].includes(mode) ? '%' : mode === 'points' ? ui('percentage points') : mode === 'scale' ? '×' : '';

  const setValue = (index: number, value: string) => setValues(current => current.map((item, position) => position === index ? value : item));
  const select = (index: number, focus = true) => { setActive(index); setOverwrite(true); if (focus) { fieldRefs.current[index]?.focus(); fieldRefs.current[index]?.select(); } };
  const press = (key: PadKey) => {
    if (key === 'next') { select((active + 1) % fields.length); return; }
    // Values the mode does not show stay valid, so clearing never breaks the calculation.
    if (key === 'clear') { setValues(current => current.map((item, index) => index < fields.length ? '' : item)); select(0); return; }
    const base = overwrite && key !== 'back' && key !== 'sign' ? '' : values[active];
    setValue(active, pressFieldKey(base, key, FIELD_LENGTH).replace('.', separator));
    setOverwrite(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'SELECT') return;
    if (target.tagName === 'INPUT') { if (event.key === 'Enter') { event.preventDefault(); press('next'); } return; }
    // A keypad button (or the device itself) has the focus: typing still lands in the active row.
    const key: PadKey | null = /^[0-9]$/.test(event.key) ? event.key as PadKey : event.key === '.' || event.key === ',' ? '.' : event.key === 'Backspace' ? 'back' : event.key === 'Escape' ? 'clear' : null;
    if (key) { event.preventDefault(); press(key); }
  };

  return <section className="calc-layout" aria-label={ui('Percentage Calculator')}>
    <div className="calc-body" role="group" aria-label={ui('Calculator keypad')} onKeyDown={onKeyDown}>
      <label className="calc-mode">{ui('Calculation')}<select value={mode} onChange={event => { const next = event.target.value as PercentageMode; setMode(next); setValues(percentageDefaults[next].map(String)); setActive(0); setOverwrite(true); }}>{modes.map(item => <option key={item} value={item}>{ui(percentageLabels[item])}</option>)}</select></label>
      <div className="calc-display calc-display--fields">
        {fields.map((label, index) => <label key={`${mode}-${index}`} className={`calc-field${active === index ? ' is-active' : ''}`}><span>{ui(label)}</span>
          <input ref={element => { fieldRefs.current[index] = element; }} type="text" inputMode="none" autoComplete="off" value={values[index]} maxLength={FIELD_LENGTH} aria-invalid={inputs[index] === null && values[index].trim() !== ''}
            onFocus={event => { setActive(index); setOverwrite(true); event.target.select(); }} onChange={event => { setValue(index, event.target.value); setOverwrite(false); }} /></label>)}
        <div className="calc-result" aria-live="polite" aria-atomic="true">{result
          ? <><p className="lt-eyebrow">{ui(mode === 'tip' ? 'Per person' : 'Result')}</p><output className={`calc-readout${number(result.result).length > 13 ? ' is-long' : ''}`}>= {number(result.result)} {suffix}</output>{result.extra && <p>{ui(result.extra.label)}: <strong>{number(result.extra.value)}</strong></p>}</>
          : blank ? <><p className="lt-eyebrow">{ui(mode === 'tip' ? 'Per person' : 'Result')}</p><output className="calc-readout">=</output></>
            : <p role="status" className="pt-error">{ui(typeof calculation === 'string' ? calculationErrors[calculation] : '')}</p>}{result && <SaveToNotes heading={`${ui('Percentage Calculator')} · ${ui(percentageLabels[mode])}`} lines={[...fields.map((label, index) => `${ui(label)}: ${values[index]}`), `${ui('Result')}: ${number(result.result)} ${suffix}`.trim(), ...(result.extra ? [`${ui(result.extra.label)}: ${number(result.extra.value)}`] : [])]} />}</div>
      </div>
      <div className="calc-keys">{keypad.map(item => <button type="button" key={item.key} className={`calc-key calc-key--${item.kind}${item.wide ? ' calc-key--wide' : ''}`} aria-label={item.name ? ui(item.name) : undefined} onClick={() => press(item.key)}>
        {item.key === 'back' ? <Delete size={22} aria-hidden /> : item.key === 'next' ? <><small>{ui('Next')}</small><CornerDownLeft size={17} aria-hidden /></> : item.key === '.' ? separator : item.label}
      </button>)}</div>
    </div>
    <div className="calc-side">
      {result ? <>{rate !== null && rate >= 0 && rate <= 100 && <><div className="pt-percent-bar" role="img" aria-label={`${number(rate)}% / 100%`}><span style={{ width: `${rate}%` }} /></div><p className="calc-rate">{number(rate)} / 100</p></>}
        <div className="pt-working"><h3>{ui('Step-by-step explanations')}</h3><ol>{result.steps.map((step, index) => <li key={index}><code>{step}</code></li>)}</ol><p className="mf-verification"><strong>{ui('Independent check')}</strong><br /><code>{result.check}</code></p></div></>
        : <p className="calc-empty">{ui('Enter a value in every row to see the result and the steps.')}</p>}
      <p className="lt-storage-note">{ui('Results are displayed to six decimal places; calculations use unrounded values. Keep amounts in the same unit.')}</p>
      {mode === 'compound' && <p className="lt-notice">{ui('A fixed-rate illustration with no deposits, fees, taxes, or inflation. It is not a forecast.')}</p>}
      {mode === 'tip' && result && <p className="lt-notice">{ui('Round the total to cents first. Rounded per-person amounts may need a one-cent adjustment to add up.')}</p>}
      {['vat-add', 'vat-remove'].includes(mode) && <p className="lt-notice">{ui('Enter the rate that applies to your example. This calculator does not determine tax rules.')}</p>}
    </div>
  </section>;
}
