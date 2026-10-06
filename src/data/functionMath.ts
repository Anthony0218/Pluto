/** Bounded mathematical grammar. No JavaScript execution, properties, or implicit multiplication. */
export const functionNames = ['sin', 'cos', 'tan', 'sqrt', 'abs', 'ln', 'log', 'exp'] as const;
type FunctionName = typeof functionNames[number];
export type Expression = { kind: 'number'; value: number } | { kind: 'x' } | { kind: 'unary'; sign: number; arg: Expression } | { kind: 'binary'; op: string; left: Expression; right: Expression } | { kind: 'call'; name: FunctionName; arg: Expression };
export type ParsedFunction = { expression: Expression; error?: never } | { error: 'syntax' | 'limit'; expression?: never };
export function parseFunction(source: string): ParsedFunction {
  if (source.length > 200) return { error: 'limit' };
  const tokens = source.toLowerCase().replaceAll('−', '-').match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|\S/g) ?? [];
  if (!tokens.length || tokens.length > 100) return { error: 'limit' };
  let index = 0, depth = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];
  const fail = (): never => { throw new Error('syntax'); };
  function atom(): Expression {
    if (++depth > 24) fail();
    let result: Expression;
    const token = take();
    if (token === '(') { result = sum(); if (take() !== ')') fail(); }
    else if (token === 'x') result = { kind: 'x' };
    else if (token === 'pi' || token === 'e') result = { kind: 'number', value: token === 'pi' ? Math.PI : Math.E };
    else if (functionNames.includes(token as FunctionName)) {
      if (take() !== '(') fail();
      const arg = sum(); if (take() !== ')') fail(); result = { kind: 'call', name: token as FunctionName, arg };
    } else if (token && /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/.test(token) && Number.isFinite(Number(token))) result = { kind: 'number', value: Number(token) };
    else return fail();
    depth--; return result;
  }
  function power(): Expression { const left = atom(); return peek() === '^' ? (take(), { kind: 'binary', op: '^', left, right: unary() }) : left; }
  function unary(): Expression {
    if (peek() === '+' || peek() === '-') { if (++depth > 24) fail(); const sign = take() === '-' ? -1 : 1; const arg = unary(); depth--; return { kind: 'unary', sign, arg }; }
    return power();
  }
  function product(): Expression { let left = unary(); while (peek() === '*' || peek() === '/') { const op = take(); left = { kind: 'binary', op, left, right: unary() }; } return left; }
  function sum(): Expression { let left = product(); while (peek() === '+' || peek() === '-') { const op = take(); left = { kind: 'binary', op, left, right: product() }; } return left; }
  try { const expression = sum(); return index === tokens.length ? { expression } : { error: 'syntax' }; } catch { return { error: 'syntax' }; }
}
const finite = (value: number) => Number.isFinite(value) && Math.abs(value) <= 1e12 ? value : null;
export function evaluateFunction(node: Expression, x: number): number | null {
  if (!Number.isFinite(x)) return null;
  if (node.kind === 'number') return finite(node.value);
  if (node.kind === 'x') return finite(x);
  if (node.kind === 'unary') { const arg = evaluateFunction(node.arg, x); return arg === null ? null : finite(node.sign * arg); }
  if (node.kind === 'call') {
    const a = evaluateFunction(node.arg, x); if (a === null) return null;
    switch (node.name) {
      case 'sin': return finite(Math.sin(a)); case 'cos': return finite(Math.cos(a));
      case 'tan': return Math.abs(Math.cos(a)) < 1e-12 ? null : finite(Math.tan(a));
      case 'sqrt': return a < 0 ? null : finite(Math.sqrt(a)); case 'abs': return Math.abs(a);
      case 'ln': return a <= 0 ? null : finite(Math.log(a)); case 'log': return a <= 0 ? null : finite(Math.log10(a)); case 'exp': return finite(Math.exp(a));
    }
  }
  const a = evaluateFunction(node.left, x), b = evaluateFunction(node.right, x);
  if (a === null || b === null) return null;
  switch (node.op) {
    case '+': return finite(a + b); case '-': return finite(a - b); case '*': return finite(a * b); case '/': return b === 0 ? null : finite(a / b);
    case '^': return a === 0 && b <= 0 ? null : finite(a ** b); default: return null;
  }
}
type Interval = [number, number];
const bounded = (lo: number, hi: number): Interval | null => finite(lo) === null || finite(hi) === null ? null : [lo, hi];
/** Conservative interval bounds: null means continuity/domain could not be established. */
export function functionInterval(node: Expression, lo: number, hi: number): Interval | null {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return null;
  if (node.kind === 'number') return bounded(node.value, node.value);
  if (node.kind === 'x') return bounded(lo, hi);
  if (node.kind === 'unary') { const a = functionInterval(node.arg, lo, hi); return !a ? null : node.sign === 1 ? a : [-a[1], -a[0]]; }
  if (node.kind === 'call') {
    const a = functionInterval(node.arg, lo, hi); if (!a) return null;
    switch (node.name) {
      case 'sin': case 'cos': {
        if (a[1] - a[0] >= 2 * Math.PI) return [-1, 1];
        const offset = node.name === 'sin' ? Math.PI / 2 : 0;
        const fn = node.name === 'sin' ? Math.sin : Math.cos;
        const values = [fn(a[0]), fn(a[1])];
        const first = Math.ceil((a[0] - offset) / Math.PI), last = Math.floor((a[1] - offset) / Math.PI);
        for (let k = first; k <= last; k++) values.push(k % 2 === 0 ? 1 : -1);
        return [Math.min(...values), Math.max(...values)];
      }
      case 'tan': return Math.floor((a[0] + Math.PI / 2) / Math.PI) !== Math.floor((a[1] + Math.PI / 2) / Math.PI) || Math.abs(Math.cos(a[0])) < 1e-12 || Math.abs(Math.cos(a[1])) < 1e-12 ? null : bounded(Math.tan(a[0]), Math.tan(a[1]));
      case 'sqrt': return a[0] < 0 ? null : bounded(Math.sqrt(a[0]), Math.sqrt(a[1]));
      case 'ln': case 'log': return a[0] <= 0 ? null : bounded(node.name === 'ln' ? Math.log(a[0]) : Math.log10(a[0]), node.name === 'ln' ? Math.log(a[1]) : Math.log10(a[1]));
      case 'exp': return bounded(Math.exp(a[0]), Math.exp(a[1]));
      case 'abs': return bounded(a[0] <= 0 && a[1] >= 0 ? 0 : Math.min(Math.abs(a[0]), Math.abs(a[1])), Math.max(Math.abs(a[0]), Math.abs(a[1])));
    }
  }
  const a = functionInterval(node.left, lo, hi), b = functionInterval(node.right, lo, hi); if (!a || !b) return null;
  if (node.op === '+') return bounded(a[0] + b[0], a[1] + b[1]);
  if (node.op === '-') return bounded(a[0] - b[1], a[1] - b[0]);
  if (node.op === '*' || node.op === '/') {
    if (node.op === '/' && b[0] <= 0 && b[1] >= 0) return null;
    const c: Interval = node.op === '/' ? [1 / b[1], 1 / b[0]] : b;
    const values = [a[0] * c[0], a[0] * c[1], a[1] * c[0], a[1] * c[1]];
    return bounded(Math.min(...values), Math.max(...values));
  }
  if (node.op === '^') {
    if (b[0] === b[1] && Number.isInteger(b[0])) {
      const n = b[0]; if (n <= 0 && a[0] <= 0 && a[1] >= 0) return null;
      const values = [a[0] ** n, a[1] ** n]; if (n > 0 && n % 2 === 0 && a[0] <= 0 && a[1] >= 0) values.push(0);
      return bounded(Math.min(...values), Math.max(...values));
    }
    if (a[0] < 0 || a[0] === 0 && b[0] <= 0) return null;
    const values = [a[0] ** b[0], a[0] ** b[1], a[1] ** b[0], a[1] ** b[1]];
    if (a[0] <= 1 && a[1] >= 1 || b[0] <= 0 && b[1] >= 0) values.push(1);
    return bounded(Math.min(...values), Math.max(...values));
  }
  return null;
}
export type PlotPoint = { x: number; y: number };
export function sampleFunction(node: Expression, min: number, max: number, samples = 400): PlotPoint[][] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max || !Number.isInteger(samples) || samples < 2 || samples > 2000) return [];
  const segments: PlotPoint[][] = []; let segment: PlotPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = min + (max - min) * i / samples, y = evaluateFunction(node, x);
    const previous = segment.at(-1);
    if (y === null || previous && !functionInterval(node, previous.x, x)) { if (segment.length) segments.push(segment); segment = []; }
    if (y !== null) segment.push({ x, y });
  }
  if (segment.length) segments.push(segment); return segments;
}
export function numericalSlope(node: Expression, x: number, h = .01) {
  if (!Number.isFinite(x) || !Number.isFinite(h) || h < 1e-6 || h > 1 || !functionInterval(node, x - h, x + h)) return null;
  const center = evaluateFunction(node, x), left = evaluateFunction(node, x - h), right = evaluateFunction(node, x + h), halfLeft = evaluateFunction(node, x - h / 2), halfRight = evaluateFunction(node, x + h / 2);
  if (center === null || left === null || right === null || halfLeft === null || halfRight === null) return null;
  const backward = (center - halfLeft) / (h / 2), forward = (halfRight - center) / (h / 2), coarse = (right - left) / (2 * h), value = (halfRight - halfLeft) / h;
  const coarseGap = Math.abs((right - center) / h - (center - left) / h), halfGap = Math.abs(forward - backward);
  if (halfGap > 1e-8 && halfGap >= coarseGap * .8) return null;
  // Reject a likely corner/discontinuity. Numerical agreement is evidence, not a proof.
  if (Math.abs(forward - backward) > Math.max(.1, Math.abs(value) * .1) || finite(value) === null) return null;
  return { value, coarse, difference: Math.abs(value - coarse), backward, forward };
}
export function numericalIntegral(node: Expression, from: number, to: number, intervals = 64) {
  if (![from, to].every(Number.isFinite) || Math.abs(from) > 1e4 || Math.abs(to) > 1e4 || !Number.isInteger(intervals) || intervals < 4 || intervals > 512) return null;
  const lo = Math.min(from, to), hi = Math.max(from, to), direction = from <= to ? 1 : -1;
  if (lo === hi) return evaluateFunction(node, lo) === null ? null : { value: 0, coarse: 0, difference: 0 };
  function integrate(count: number): number | null {
    const width = (hi - lo) / count; let sum = 0;
    for (let i = 0; i < count; i++) {
      const a = lo + width * i, b = i === count - 1 ? hi : lo + width * (i + 1);
      if (!functionInterval(node, a, b)) return null;
      const left = evaluateFunction(node, a), right = evaluateFunction(node, b); if (left === null || right === null) return null;
      sum += (left + right) * (b - a) / 2;
    }
    return finite(direction * sum);
  }
  const coarse = integrate(intervals), value = integrate(intervals * 2);
  return coarse === null || value === null ? null : { value, coarse, difference: Math.abs(value - coarse) };
}
