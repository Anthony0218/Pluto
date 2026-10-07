/**
 * The Calculator app: a keypad calculator that keeps the whole expression and applies × and ÷ before + and −.
 * State only changes through `pressCalculatorKey`, so the screen, the keyboard and the tests share one behaviour.
 */
export const calculatorOperators = ['+', '−', '×', '÷'] as const;
export type CalculatorOperator = typeof calculatorOperators[number];
export type CalculatorKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | CalculatorOperator | '=' | 'clear' | 'back' | 'sign' | 'percent';
export type CalculatorError = 'divide' | 'range';
export type CalculatorState = {
  /** Finished operands; each one is followed by the operator at the same index. */
  terms: number[]; operators: CalculatorOperator[];
  /** The operand being typed, as plain decimal text ('' until a digit is pressed). */
  entry: string;
  /** `entry` is the result of "=": the next digit starts a new calculation, an operator continues with it. */
  fresh: boolean;
  /** The expression behind the last result. */
  last: { terms: number[]; operators: CalculatorOperator[] } | null;
  error: CalculatorError | null;
};
/** Fifteen significant digits is what a double holds exactly, and what the keypad lets you type. */
export const CALCULATOR_LIMITS = { digits: 15, terms: 40, magnitude: 1e15 } as const;
export const emptyCalculator = (): CalculatorState => ({ terms: [], operators: [], entry: '', fresh: false, last: null, error: null });

/** Removes binary noise (0.1 + 0.2) and writes the number without an exponent so it can be edited digit by digit. */
export function plainNumber(value: number): string {
  const rounded = Number(value.toPrecision(CALCULATOR_LIMITS.digits));
  if (Object.is(rounded, -0) || rounded === 0) return '0';
  const text = String(rounded);
  return text.includes('e') ? rounded.toFixed(20).replace(/\.?0+$/, '') : text;
}

/** × and ÷ first, then + and −, left to right. `operators` has one item fewer than `terms`. */
export function evaluateTerms(terms: readonly number[], operators: readonly CalculatorOperator[]): number | CalculatorError {
  if (!terms.length) return 0;
  const sums: number[] = [terms[0]], signs: (1 | -1)[] = [1];
  for (const [index, operator] of operators.entries()) {
    const next = terms[index + 1];
    if (operator === '×') sums[sums.length - 1] *= next;
    else if (operator === '÷') { if (next === 0) return 'divide'; sums[sums.length - 1] /= next; }
    else { sums.push(next); signs.push(operator === '+' ? 1 : -1); }
  }
  const result = sums.reduce((total, value, index) => total + signs[index] * value, 0);
  return Number.isFinite(result) && Math.abs(result) <= CALCULATOR_LIMITS.magnitude ? Number(result.toPrecision(CALCULATOR_LIMITS.digits)) : 'range';
}

const digitCount = (entry: string) => entry.replace(/[-.]/g, '').length;

export function pressCalculatorKey(state: CalculatorState, key: CalculatorKey): CalculatorState {
  if (key === 'clear') return emptyCalculator();
  // After an error every key starts over; digits are kept as the first key of the new calculation.
  if (state.error) return /^[0-9.]$/.test(key) ? pressCalculatorKey(emptyCalculator(), key) : emptyCalculator();
  const { terms, operators, entry } = state;

  if (/^[0-9]$/.test(key)) {
    if (state.fresh) return { ...emptyCalculator(), entry: key };
    if (digitCount(entry) >= CALCULATOR_LIMITS.digits) return state;
    return { ...state, entry: entry === '0' ? key : entry === '-0' ? `-${key}` : entry + key };
  }
  if (key === '.') {
    if (state.fresh) return { ...emptyCalculator(), entry: '0.' };
    if (entry.includes('.') || digitCount(entry) >= CALCULATOR_LIMITS.digits) return state;
    return { ...state, entry: entry === '' || entry === '-' ? `${entry}0.` : `${entry}.` };
  }
  if (key === 'sign') {
    if (entry === '' || Number(entry) === 0) return state;
    return { ...state, entry: entry.startsWith('-') ? entry.slice(1) : `-${entry}` };
  }
  if (key === 'back') {
    if (state.fresh) return emptyCalculator();
    if (entry) { const shorter = entry.slice(0, -1); return { ...state, entry: shorter === '-' ? '' : shorter }; }
    // Nothing typed yet: take back the operator and reopen the operand before it.
    if (!terms.length) return state;
    return { ...state, terms: terms.slice(0, -1), operators: operators.slice(0, -1), entry: plainNumber(terms[terms.length - 1]) };
  }
  if (key === 'percent') {
    if (entry === '') return state;
    const operator = operators[operators.length - 1];
    // "200 + 10 %" adds ten percent of 200; after × or ÷ the entry simply becomes a hundredth.
    const base = operator === '+' || operator === '−' ? evaluateTerms(terms, operators.slice(0, -1)) : 1;
    if (typeof base === 'string') return { ...emptyCalculator(), error: base };
    const value = base * Number(entry) / 100;
    return Number.isFinite(value) && Math.abs(value) <= CALCULATOR_LIMITS.magnitude ? { ...state, entry: plainNumber(value) } : { ...emptyCalculator(), error: 'range' };
  }
  if (key === '=') {
    const allTerms = entry === '' ? terms : [...terms, Number(entry)];
    if (!allTerms.length || (!operators.length && state.fresh)) return state;
    // "5 + =" has no second operand: the dangling operator is dropped.
    const used = operators.slice(0, allTerms.length - 1);
    const result = evaluateTerms(allTerms, used);
    if (typeof result === 'string') return { ...emptyCalculator(), error: result };
    return { terms: [], operators: [], entry: plainNumber(result), fresh: true, last: { terms: allTerms, operators: used }, error: null };
  }
  // An operator: finish the operand, or swap the operator when none was typed.
  const operator = key as CalculatorOperator;
  if (entry === '') return terms.length ? { ...state, operators: [...operators.slice(0, -1), operator] } : { ...state, terms: [0], operators: [operator] };
  if (terms.length >= CALCULATOR_LIMITS.terms) return state;
  return { terms: [...terms, Number(entry)], operators: [...operators, operator], entry: '', fresh: false, last: null, error: null };
}

/** Keyboard key → calculator key (null when the key is not ours). Comma works as a decimal point. */
export function calculatorKeyFromKeyboard(key: string): CalculatorKey | null {
  if (/^[0-9]$/.test(key)) return key as CalculatorKey;
  switch (key) {
    case '.': case ',': return '.';
    case '+': return '+';
    case '-': case '−': return '−';
    case '*': case 'x': case 'X': case '×': return '×';
    case '/': case '÷': case ':': return '÷';
    case '=': case 'Enter': return '=';
    case 'Backspace': return 'back';
    case 'Escape': case 'Delete': case 'c': case 'C': return 'clear';
    case '%': return 'percent';
    default: return null;
  }
}

/** Digits a field of the Percentage Calculator accepts from its keypad: the same plain decimal text as above. */
export function pressFieldKey(value: string, key: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back' | 'sign' | 'clear', maxLength = 16): string {
  if (key === 'clear') return '';
  if (key === 'back') return value.slice(0, -1);
  if (key === 'sign') return value.startsWith('-') || value.startsWith('−') ? value.slice(1) : value ? `-${value}` : '-';
  if (value.length >= maxLength) return value;
  if (key === '.') return /[.,]/.test(value) ? value : value === '' || value === '-' ? `${value}0.` : `${value}.`;
  return value === '0' ? key : value === '-0' ? `-${key}` : value + key;
}
