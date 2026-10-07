/** Calculator input is deliberately numeric: no expressions or thousands separators. */
export function decimalInput(input: string): number | null {
  const clean = input.trim().replaceAll('−', '-');
  if (!/^[+-]?(?:\d{1,12}(?:[.,]\d{1,12})?|[.,]\d{1,12})$/.test(clean)) return null;
  const value = Number(clean.replace(',', '.'));
  return Number.isFinite(value) && Math.abs(value) <= 1e12 ? value : null;
}
export const percentageModes = ['amount', 'share', 'discount', 'successive', 'vat-add', 'vat-remove', 'change', 'reverse-increase', 'reverse-decrease', 'points', 'compound', 'tip', 'scale'] as const;
export type PercentageMode = typeof percentageModes[number];
export type Calculation = { result: number; steps: string[]; check: string; extra?: { label: string; value: number } };
export type CalculationError = 'number' | 'positive' | 'rate' | 'periods' | 'range';
export const percentageLabels: Record<PercentageMode, string> = {
  amount: 'Percentage of an amount', share: 'Part as a percentage', discount: 'Discount', successive: 'Successive discounts',
  'vat-add': 'Add VAT', 'vat-remove': 'Remove VAT', change: 'Percentage change', 'reverse-increase': 'Before an increase', 'reverse-decrease': 'Before a decrease',
  points: 'Percentage points', compound: 'Hypothetical compound growth', tip: 'Tip and equal shares', scale: 'Serving-size change',
};
export const percentageDefaults: Record<PercentageMode, [number, number, number]> = {
  amount: [80, 25, 0], share: [30, 120, 0], discount: [80, 25, 0], successive: [100, 20, 10],
  'vat-add': [100, 20, 0], 'vat-remove': [120, 20, 0], change: [80, 100, 0], 'reverse-increase': [120, 20, 0], 'reverse-decrease': [80, 20, 0],
  points: [40, 50, 0], compound: [1000, 5, 2], tip: [60, 10, 3], scale: [4, 6, 0],
};
export const percentageFields: Record<PercentageMode, string[]> = {
  amount: ['Whole amount', 'Rate (%)'], share: ['Part', 'Whole amount'], discount: ['Original amount', 'Discount (%)'], successive: ['Original amount', 'First discount (%)', 'Second discount (%)'],
  'vat-add': ['Net amount', 'VAT rate (%)'], 'vat-remove': ['Gross amount', 'VAT rate (%)'], change: ['Old amount', 'New amount'],
  'reverse-increase': ['Final amount', 'Increase (%)'], 'reverse-decrease': ['Final amount', 'Decrease (%)'], points: ['Old rate (%)', 'New rate (%)'],
  compound: ['Starting amount', 'Growth per period (%)', 'Periods'], tip: ['Bill before tip', 'Tip (%)', 'People'], scale: ['Original servings', 'Target servings'],
};
const n = (value: number) => Number(value.toPrecision(12)).toString();
export function calculatePercentage(mode: PercentageMode, a: number, b: number, c = 0): Calculation | CalculationError {
  if (![a, b, c].every(value => Number.isFinite(value) && Math.abs(value) <= 1e12)) return 'number';
  if (!percentageModes.includes(mode)) return 'number';
  if (a < 0 || b < 0 && !['change', 'compound'].includes(mode)) return 'positive';
  let result: number, steps: string[], check: string, extra: Calculation['extra'];
  const factor = 1 + b / 100;
  switch (mode) {
    case 'amount': result = a * b / 100; steps = [`${n(a)} × ${n(b)} ÷ 100 = ${n(result)}`]; check = `${n(result)}${a === 0 ? ' = 0' : ` ÷ ${n(a)} × 100 = ${n(b)}%`}`; break;
    case 'share': if (b <= 0) return 'positive'; result = a / b * 100; steps = [`${n(a)} ÷ ${n(b)} × 100 = ${n(result)}%`]; check = `${n(result)} ÷ 100 × ${n(b)} = ${n(a)}`; break;
    case 'discount': case 'reverse-decrease':
      if (b > 100 || mode === 'reverse-decrease' && b === 100) return 'rate';
      result = mode === 'discount' ? a * (1 - b / 100) : a / (1 - b / 100);
      steps = [`1 − ${n(b)} ÷ 100 = ${n(1 - b / 100)}`, `${n(a)} ${mode === 'discount' ? '×' : '÷'} ${n(1 - b / 100)} = ${n(result)}`];
      check = mode === 'discount' ? `${n(result)} + ${n(a * b / 100)} = ${n(a)}` : `${n(result)} × ${n(1 - b / 100)} = ${n(a)}`;
      if (mode === 'discount') extra = { label: 'Amount saved', value: a - result }; break;
    case 'successive':
      if (b > 100 || c < 0 || c > 100) return 'rate';
      { const first = a * (1 - b / 100); result = first * (1 - c / 100); steps = [`${n(a)} × ${n(1 - b / 100)} = ${n(first)}`, `${n(first)} × ${n(1 - c / 100)} = ${n(result)}`]; check = `${n(result)} + ${n(a - result)} = ${n(a)}`; extra = { label: 'Combined discount (%)', value: (1 - (1 - b / 100) * (1 - c / 100)) * 100 }; } break;
    case 'vat-add': case 'reverse-increase':
      result = mode === 'vat-add' ? a * factor : a / factor; steps = [`1 + ${n(b)} ÷ 100 = ${n(factor)}`, `${n(a)} ${mode === 'vat-add' ? '×' : '÷'} ${n(factor)} = ${n(result)}`]; check = mode === 'vat-add' ? `${n(result)} − ${n(result - a)} = ${n(a)}` : `${n(result)} × ${n(factor)} = ${n(a)}`; if (mode === 'vat-add') extra = { label: 'VAT amount', value: result - a }; break;
    case 'vat-remove': result = a / factor; steps = [`${n(a)} ÷ ${n(factor)} = ${n(result)}`]; check = `${n(result)} × ${n(factor)} = ${n(a)}`; extra = { label: 'VAT amount', value: a - result }; break;
    case 'change': if (a <= 0 || b < 0) return 'positive'; result = (b - a) / a * 100; steps = [`(${n(b)} − ${n(a)}) ÷ ${n(a)} × 100 = ${n(result)}%`]; check = `${n(a)} × (1 + ${n(result)} ÷ 100) = ${n(b)}`; break;
    case 'points': if (a > 100 || b > 100) return 'rate'; result = b - a; steps = [`${n(b)} − ${n(a)} = ${n(result)}`]; check = `${n(a)} + ${n(result)} = ${n(b)}`; if (a > 0) extra = { label: 'Relative change (%)', value: (b - a) / a * 100 }; break;
    case 'compound':
      if (b < -100 || b > 1000) return 'rate';
      if (!Number.isInteger(c) || c < 0 || c > 100) return 'periods';
      result = a * factor ** c; steps = [`${n(a)} × ${n(factor)}^${c} = ${n(result)}`]; check = factor === 0 && c > 0 ? `${n(a)} × 0 = 0` : `${n(result)} ÷ ${n(factor ** c)} ≈ ${n(a)}`; extra = { label: 'Total change', value: result - a }; break;
    case 'tip': if (!Number.isInteger(c) || c <= 0 || c > 1000) return 'positive'; result = a * factor / c; steps = [`${n(a)} × ${n(factor)} = ${n(a * factor)}`, `${n(a * factor)} ÷ ${c} = ${n(result)}`]; check = `${n(result)} × ${c} ≈ ${n(a * factor)}`; extra = { label: 'Total with tip', value: a * factor }; break;
    case 'scale': if (a <= 0 || b <= 0) return 'positive'; result = b / a; steps = [`${n(b)} ÷ ${n(a)} = ${n(result)}`]; check = `${n(a)} × ${n(result)} = ${n(b)}`; extra = { label: 'Serving change (%)', value: (result - 1) * 100 }; break;
  }
  return Number.isFinite(result) && Math.abs(result) <= 1e15 ? { result, steps, check, extra } : 'range';
}

export const numberBases = [2, 8, 10, 16] as const;
export type NumberBase = typeof numberBases[number];
export function parseBaseInteger(input: string, base: NumberBase): bigint | null {
  if (!numberBases.includes(base)) return null;
  let clean = input.trim();
  if (clean.length > 259) return null;
  const negative = clean.startsWith('-') || clean.startsWith('−');
  clean = clean.replace(/^[+−-]/, '');
  const prefix = clean.match(/^0([box])/i);
  if (prefix) {
    const prefixBase = { b: 2, o: 8, x: 16 }[prefix[1].toLowerCase()];
    if (prefixBase === base) clean = clean.slice(2);
    else if (!(base === 16 && prefixBase === 2)) return null; // 0B is also a valid unprefixed hexadecimal number.
  }
  if (!clean || clean.length > 256) return null;
  let result = 0n;
  for (const char of clean.toUpperCase()) {
    const digit = '0123456789ABCDEF'.indexOf(char);
    if (digit < 0 || digit >= base) return null;
    result = result * BigInt(base) + BigInt(digit);
  }
  return negative ? -result : result;
}
export function baseRepresentations(value: bigint) { return Object.fromEntries(numberBases.map(base => [base, value.toString(base).toUpperCase()])) as Record<NumberBase, string>; }
export function placeValueTerms(value: bigint, base: NumberBase) {
  const digits = (value < 0n ? -value : value).toString(base).toUpperCase();
  return digits.split('').map((digit, index) => ({ digit, power: digits.length - index - 1, value: BigInt('0123456789ABCDEF'.indexOf(digit)) * BigInt(base) ** BigInt(digits.length - index - 1) }));
}
export function toggleBit(value: bigint, bit: number): bigint {
  if (value < 0n || value > 65535n || !Number.isInteger(bit) || bit < 0 || bit > 15) throw new RangeError('Expected an unsigned 16-bit number');
  return value ^ (1n << BigInt(bit));
}
