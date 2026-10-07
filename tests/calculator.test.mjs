import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculatorKeyFromKeyboard, emptyCalculator, evaluateTerms, plainNumber, pressCalculatorKey, pressFieldKey } from '../src/data/calculator.ts';
import { toolApps } from '../src/data/toolCatalog.ts';
import { decimalInput } from '../src/data/practicalMath.ts';

const SYMBOLS = { '*': '×', '/': '÷', '-': '−', C: 'clear', '<': 'back', '~': 'sign', '%': 'percent' };
/** "12+3*4=" → the calculator after those keys. */
const run = (keys, state = emptyCalculator()) => [...keys].reduce((current, key) => pressCalculatorKey(current, SYMBOLS[key] ?? key), state);
const shown = keys => { const state = run(keys); return state.error ?? state.entry; };

test('the calculator applies × and ÷ before + and −, and keeps the expression behind a result', () => {
  assert.equal(shown('12+3*4='), '24');
  assert.equal(shown('2*3+4*5='), '26');
  assert.equal(shown('100-20/4-5='), '90');
  assert.equal(shown('8/2/2='), '2');
  assert.equal(shown('7='), '7');
  const state = run('12+3*4=');
  assert.deepEqual(state.last, { terms: [12, 3, 4], operators: ['+', '×'] });
  assert.ok(state.fresh && !state.terms.length && !state.operators.length);
  assert.equal(evaluateTerms([2, 3, 4], ['+', '×']), 14);
  assert.equal(evaluateTerms([], []), 0);
});

test('decimals are exact where people expect them to be', () => {
  assert.equal(shown('.1+.2='), '0.3');
  assert.equal(shown('1.10+2.20='), '3.3');
  assert.equal(shown('1/3*3='), '1');
  assert.equal(shown('0.1*3='), '0.3');
  assert.equal(shown('1..5'), '1.5', 'a second decimal point is ignored');
  assert.equal(shown('007'), '7', 'no leading zeros');
  assert.equal(shown('0.50'), '0.50', 'typed zeros stay while typing');
  assert.equal(plainNumber(1e-7), '0.0000001');
  assert.equal(plainNumber(-0), '0');
  assert.equal(plainNumber(123456789012345), '123456789012345');
  assert.equal(shown('123456789012345+1='), '123456789012346', 'fifteen-digit sums stay exact');
  assert.equal(shown('4.35*100='), '435');
  assert.equal(shown('1.005*1000='), '1005');
});

test('results continue, digits start over, and operators can be corrected', () => {
  assert.equal(shown('2+3=*4='), '20', 'an operator continues with the result');
  assert.equal(shown('2+3=7'), '7', 'a digit starts a new calculation');
  assert.equal(shown('2+3=='), '5', 'a second = changes nothing');
  assert.equal(shown('5+*3='), '15', 'the last operator wins');
  assert.equal(shown('5+='), '5', 'a dangling operator is dropped');
  assert.equal(shown('*3='), '0', 'an operator first starts from zero');
  assert.equal(shown('='), '');
});

test('sign, percent, backspace and clear behave like the keys on a pocket calculator', () => {
  assert.equal(shown('5~'), '-5');
  assert.equal(shown('5~~'), '5');
  assert.equal(shown('0~'), '0');
  assert.equal(shown('8*5~='), '-40');
  assert.equal(shown('200+10%='), '220', 'percent of the running total');
  assert.equal(shown('200-25%='), '150');
  assert.equal(shown('200*10%='), '20', 'a plain hundredth after ×');
  assert.equal(shown('50%'), '0.5');
  assert.equal(shown('2+3*4+10%='), '15.4', 'the base follows operator precedence: 10% of 14');
  assert.equal(shown('123<'), '12');
  assert.equal(shown('5~<'), '', 'no lone minus sign is left behind');
  assert.deepEqual(run('12+<'), { ...emptyCalculator(), entry: '12' }, 'backspace takes back the operator');
  assert.deepEqual(run('2+3=<'), emptyCalculator());
  assert.deepEqual(run('12+3C'), emptyCalculator());
});

test('errors are reported and the next key starts over', () => {
  assert.equal(shown('5/0='), 'divide');
  assert.equal(shown('5+3/0*2='), 'divide');
  assert.equal(shown('999999999999999*999999999999999='), 'range');
  assert.equal(shown('5/0=7'), '7');
  assert.deepEqual(run('5/0=+'), emptyCalculator());
  assert.equal(shown('1234567890123456789'), '123456789012345', 'fifteen digits at most');
  assert.equal(shown('5/0+10%'), 'divide');
});

test('the keyboard maps to the same keys', () => {
  for (const [key, expected] of [['7', '7'], [',', '.'], ['.', '.'], ['*', '×'], ['x', '×'], ['/', '÷'], ['-', '−'], ['+', '+'], ['Enter', '='], ['=', '='], ['Backspace', 'back'], ['Escape', 'clear'], ['%', 'percent']]) assert.equal(calculatorKeyFromKeyboard(key), expected, key);
  for (const key of ['a', 'Tab', 'ArrowLeft', 'F5', ' ']) assert.equal(calculatorKeyFromKeyboard(key), null, key);
});

test('Percentage Calculator keys write plain decimals its parser accepts', () => {
  const type = (keys, start = '') => [...keys].reduce((value, key) => pressFieldKey(value, SYMBOLS[key] ?? key), start);
  assert.equal(type('12.5'), '12.5');
  assert.equal(type('.5'), '0.5');
  assert.equal(type('1..2'), '1.2');
  assert.equal(type('5', '12,'), '12,5', 'a comma typed on the keyboard counts as the decimal point');
  assert.equal(type('.', '12,5'), '12,5');
  assert.equal(type('05'), '5');
  assert.equal(type('20~'), '-20');
  assert.equal(type('20~~'), '20');
  assert.equal(type('20<'), '2');
  assert.equal(type('20C'), '');
  assert.equal(type('9'.repeat(30)).length, 16);
  for (const value of [type('12.5'), type('20~'), type('.5'), '12,5']) assert.notEqual(decimalInput(value), null, value);
});

test('the app list starts with Calculator and Percentage Calculator, with birthdays and QR codes next', () => {
  assert.deepEqual(toolApps.slice(0, 4).map(tool => tool.id), ['calculator', 'percentage-calculator', 'birthday-reminders', 'qr-code-creator']);
  assert.ok(toolApps.every(tool => tool.status === 'available'));
  for (const id of ['weather-explorer', 'subscription-tracker', 'function-plotter']) assert.equal(toolApps.find(tool => tool.id === id), undefined, id);
  const icons = fs.readFileSync(new URL('../src/components/learning/CatalogIcon.tsx', import.meta.url), 'utf8');
  assert.match(icons, /calculator: Calculator, "percentage-calculator": Percent/);
  const page = fs.readFileSync(new URL('../src/pages/tools/ToolAppPage.tsx', import.meta.url), 'utf8');
  assert.ok(!/WeatherExplorer|FunctionPlotter/.test(page));
  for (const file of ['../src/components/tools/WeatherExplorer.tsx', '../src/data/weatherTools.ts']) assert.equal(fs.existsSync(new URL(file, import.meta.url)), false, file);
});
