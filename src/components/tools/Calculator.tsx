import { useState, type KeyboardEvent } from 'react';
import { Delete } from 'lucide-react';
import { calculatorKeyFromKeyboard, calculatorOperators, emptyCalculator, plainNumber, pressCalculatorKey, type CalculatorError, type CalculatorKey, type CalculatorOperator, type CalculatorState } from '@/data/calculator';
import { ui, useUiLanguage } from '@/i18n/ui';
import SaveToNotes from './SaveToNotes';
import './practicalTools.css';
import './calculator.css';

type KeyKind = 'digit' | 'function' | 'operator' | 'equals';
const keypad: { key: CalculatorKey; label: string; kind: KeyKind; name?: string }[] = [
  { key: 'clear', label: 'AC', kind: 'function', name: 'Clear' }, { key: 'sign', label: '±', kind: 'function', name: 'Change sign' }, { key: 'percent', label: '%', kind: 'function', name: 'Percent' }, { key: '÷', label: '÷', kind: 'operator', name: 'Divide' },
  { key: '7', label: '7', kind: 'digit' }, { key: '8', label: '8', kind: 'digit' }, { key: '9', label: '9', kind: 'digit' }, { key: '×', label: '×', kind: 'operator', name: 'Multiply' },
  { key: '4', label: '4', kind: 'digit' }, { key: '5', label: '5', kind: 'digit' }, { key: '6', label: '6', kind: 'digit' }, { key: '−', label: '−', kind: 'operator', name: 'Subtract' },
  { key: '1', label: '1', kind: 'digit' }, { key: '2', label: '2', kind: 'digit' }, { key: '3', label: '3', kind: 'digit' }, { key: '+', label: '+', kind: 'operator', name: 'Add' },
  { key: '0', label: '0', kind: 'digit' }, { key: '.', label: '.', kind: 'digit', name: 'Decimal point' }, { key: 'back', label: '⌫', kind: 'function', name: 'Delete last digit' }, { key: '=', label: '=', kind: 'equals', name: 'Equals' },
];
const calculationErrors: Record<CalculatorError, string> = { divide: 'Cannot divide by zero', range: 'The result is too large' };
const HISTORY_LENGTH = 6;
type HistoryItem = { id: number; expression: NonNullable<CalculatorState['last']>; result: string };

/** Locale-aware digits: grouping in the whole part, the typed decimals kept as they are (so "1.50" stays "1.50"). */
function useCalculatorNumbers() {
  const { language } = useUiLanguage();
  const locale = language === 'bar' ? 'de-DE' : language;
  const separator = new Intl.NumberFormat(locale).formatToParts(1.5).find(part => part.type === 'decimal')?.value ?? '.';
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const entry = (text: string) => {
    const negative = text.startsWith('-'), [integer, fraction] = (negative ? text.slice(1) : text).split('.');
    return `${negative ? '−' : ''}${whole.format(BigInt(integer || '0'))}${fraction === undefined ? '' : separator + fraction}`;
  };
  const value = (number: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(number).replace('-', '−');
  const expression = (terms: readonly number[], operators: readonly CalculatorOperator[]) => terms.map((term, index) => `${term < 0 && index ? `(${value(term)})` : value(term)}${operators[index] ? ` ${operators[index]}` : ''}`).join(' ');
  return { separator, entry, expression };
}

export default function Calculator() {
  // One state object, so quick key presses always build on the previous one.
  const [{ state, history }, setCalculator] = useState<{ state: CalculatorState; history: HistoryItem[] }>(() => ({ state: emptyCalculator(), history: [] }));
  const format = useCalculatorNumbers();
  const press = (key: CalculatorKey) => setCalculator(current => {
    const next = pressCalculatorKey(current.state, key);
    // Only a real calculation is worth keeping: "7 =" is not.
    const solved = key === '=' && next !== current.state && next.fresh && next.last && next.last.operators.length > 0;
    return { state: next, history: solved ? [{ id: (current.history[0]?.id ?? 0) + 1, expression: next.last!, result: next.entry }, ...current.history].slice(0, HISTORY_LENGTH) : current.history };
  });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = calculatorKeyFromKeyboard(event.key);
    if (!key) return;
    // Enter always means "=", even while a keypad button has the focus.
    event.preventDefault();
    press(key);
  };
  const readout = state.error ? ui(calculationErrors[state.error]) : format.entry(state.entry || (state.terms.length ? plainNumber(state.terms[state.terms.length - 1]) : '0'));
  const expression = state.last ? `${format.expression(state.last.terms, state.last.operators)} =` : format.expression(state.terms, state.operators);
  // A finished calculation, not a number that was only typed.
  const solved = !!state.last && state.fresh && !state.error && state.last.operators.length > 0;
  const pendingOperator = !state.entry && state.operators.length ? state.operators[state.operators.length - 1] : null;
  return <section className="calc-layout" aria-label={ui('Calculator')}>
    <div className="calc-body" role="group" aria-label={ui('Calculator keypad')} tabIndex={0} onKeyDown={onKeyDown}>
      <div className="calc-display">
        <p className="calc-expression" aria-label={ui('Calculation')}>{expression || ' '}</p>
        <output className={`calc-readout${state.error ? ' is-error' : readout.length > 16 ? ' is-longer' : readout.length > 11 ? ' is-long' : ''}`} aria-live="polite" aria-atomic="true">{readout}</output>
      </div>
      {solved && <SaveToNotes heading={ui('Calculator')} lines={[`${expression} ${readout}`]} />}
      <div className="calc-keys">{keypad.map(item => <button type="button" key={item.key} className={`calc-key calc-key--${item.kind}`} aria-label={item.name ? ui(item.name) : undefined}
        aria-pressed={calculatorOperators.includes(item.key as CalculatorOperator) ? pendingOperator === item.key : undefined} onClick={() => press(item.key)}>
        {item.key === 'back' ? <Delete size={22} aria-hidden /> : item.key === '.' ? format.separator : item.label}
      </button>)}</div>
    </div>
    <aside className="calc-side" aria-label={ui('History')}>
      <h2>{ui('History')}</h2>
      {history.length ? <><div className="calc-history">{history.map(item => <button type="button" key={item.id} aria-label={`${ui('Use this result')}: ${format.entry(item.result)}`} onClick={() => setCalculator(current => ({ ...current, state: { ...emptyCalculator(), entry: item.result, fresh: true, last: item.expression } }))}>
        <span>{format.expression(item.expression.terms, item.expression.operators)} =</span><strong>{format.entry(item.result)}</strong>
      </button>)}</div><button type="button" className="lt-text-link" onClick={() => setCalculator(current => ({ ...current, history: [] }))}>{ui('Clear history')}</button></>
        : <p className="calc-empty">{ui('Your last calculations appear here. Select one to keep working with its result.')}</p>}
      <p className="lt-storage-note">{ui('× and ÷ are calculated before + and −. You can also type on your keyboard: Enter for =, Backspace to delete, Esc to clear.')}</p>
    </aside>
  </section>;
}
