import { useState } from 'react';
import { calculatePercentage, decimalInput, percentageDefaults, percentageFields, percentageLabels, percentageModes, type PercentageMode, type CalculationError } from '@/data/practicalMath';
import useToolNumber from '@/hooks/useToolNumber';
import { ui } from '@/i18n/ui';
import './practicalTools.css';

const calculationErrors: Record<CalculationError, string> = {
  number: 'Enter valid numbers using a decimal point or comma, without units or thousands separators.',
  positive: 'Use nonnegative amounts, a positive whole, and a positive whole number of people or servings.',
  rate: 'Check the rate range. Discounts cannot exceed 100%; reversing a 100% decrease is impossible. Growth must be between −100% and 1,000%.',
  periods: 'Use a whole number of periods from 0 to 100.', range: 'The result is too large. Try smaller values.',
};
export default function PercentageWorkbench({ initialMode = 'amount', modes = percentageModes }: { initialMode?: PercentageMode; modes?: readonly PercentageMode[] }) {
  const number = useToolNumber();
  const [mode, setMode] = useState<PercentageMode>(initialMode);
  const [values, setValues] = useState<string[]>(percentageDefaults[initialMode].map(String));
  const inputs = values.map(decimalInput);
  const calculation = inputs.some(value => value === null) ? 'number' : calculatePercentage(mode, inputs[0]!, inputs[1]!, inputs[2]!);
  const result = typeof calculation === 'string' ? null : calculation;
  const rate = result ? mode === 'share' ? result.result : mode === 'successive' ? result.extra?.value ?? null : ['amount', 'discount'].includes(mode) ? inputs[1]! : null : null;
  const suffix = ['share', 'change'].includes(mode) ? '%' : mode === 'points' ? ui('percentage points') : mode === 'scale' ? '×' : '';
  return <section className="pt-workbench" aria-label={ui('Percentage Calculator')}>
    <div className="pt-inputs"><label>{ui('Calculation')}<select value={mode} onChange={event => { const next = event.target.value as PercentageMode; setMode(next); setValues(percentageDefaults[next].map(String)); }}>{modes.map(item => <option key={item} value={item}>{ui(percentageLabels[item])}</option>)}</select></label>
      {percentageFields[mode].map((label, index) => <label key={`${mode}-${index}`}>{ui(label)}<input type="text" inputMode="decimal" value={values[index]} maxLength={26} aria-invalid={inputs[index] === null} onChange={event => setValues(values.map((value, item) => item === index ? event.target.value : value))} /></label>)}
    </div>
    <div className="pt-result" aria-live="polite" aria-atomic="true">{result ? <><p className="lt-eyebrow">{ui(mode === 'tip' ? 'Per person' : 'Result')}</p><output className="pt-output">{number(result.result)} {suffix}</output>{result.extra && <p>{ui(result.extra.label)}: <strong>{number(result.extra.value)}</strong></p>}{rate !== null && rate >= 0 && rate <= 100 && <><div className="pt-percent-bar" role="img" aria-label={`${number(rate)}% / 100%`}><span style={{ width: `${rate}%` }} /></div><p>{number(rate)} / 100</p></>}</> : <p role="status" className="pt-error">{ui(typeof calculation === 'string' ? calculationErrors[calculation] : '')}</p>}</div>
    {result && <div className="pt-working"><h3>{ui('Step-by-step explanations')}</h3><ol>{result.steps.map((step, index) => <li key={index}><code>{step}</code></li>)}</ol><p className="mf-verification"><strong>{ui('Independent check')}</strong><br /><code>{result.check}</code></p></div>}
    <p className="lt-storage-note">{ui('Results are displayed to six decimal places; calculations use unrounded values. Keep amounts in the same unit.')}</p>
    {mode === 'compound' && <p className="lt-notice">{ui('A fixed-rate illustration with no deposits, fees, taxes, or inflation. It is not a forecast.')}</p>}
    {mode === 'tip' && result && <p className="lt-notice">{ui('Round the total to cents first. Rounded per-person amounts may need a one-cent adjustment to add up.')}</p>}
    {['vat-add', 'vat-remove'].includes(mode) && <p className="lt-notice">{ui('Enter the rate that applies to your example. This calculator does not determine tax rules.')}</p>}
  </section>;
}
