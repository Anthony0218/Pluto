/** Small, bounded educational models. No expression evaluation or external data. */
export type Vector2 = readonly [number, number];
export type Matrix2 = readonly [Vector2, Vector2];
const finite = (values: readonly number[], bound = 1e6) => values.every(value => Number.isFinite(value) && Math.abs(value) <= bound);
export function transformVector(matrix: Matrix2, vector: Vector2): Vector2 | null {
  if (!finite([...matrix[0], ...matrix[1], ...vector])) return null;
  return [matrix[0][0] * vector[0] + matrix[0][1] * vector[1], matrix[1][0] * vector[0] + matrix[1][1] * vector[1]];
}
export const determinant2 = (matrix: Matrix2) => matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
export function residual2(matrix: Matrix2, vector: Vector2, target: Vector2): Vector2 | null {
  if (!finite(target)) return null;
  const result = transformVector(matrix, vector);
  return result ? [result[0] - target[0], result[1] - target[1]] : null;
}
export type LinearSystemResult = { kind: 'unique'; vector: Vector2; residual: Vector2 } | { kind: 'none' | 'infinite' };
/** Integer coefficients make singularity classification exact within these bounds. */
export function solveIntegerSystem(matrix: Matrix2, target: Vector2): LinearSystemResult | null {
  const values = [...matrix[0], ...matrix[1], ...target];
  if (!values.every(value => Number.isSafeInteger(value) && Math.abs(value) <= 10000)) return null;
  const [[a,b],[c,d]] = matrix, [e,f] = target, det = determinant2(matrix);
  if (det === 0) {
    const inconsistent = a * f !== c * e || b * f !== d * e || (a === 0 && b === 0 && e !== 0) || (c === 0 && d === 0 && f !== 0);
    return { kind: inconsistent ? 'none' : 'infinite' };
  }
  const vector: Vector2 = [(e*d-b*f)/det, (a*f-e*c)/det];
  // Nearly dependent equations can produce a large solution even with bounded
  // coefficients. Check it directly rather than applying the UI input limit.
  const residual: Vector2 = [a*vector[0]+b*vector[1]-e, c*vector[0]+d*vector[1]-f];
  return { kind: 'unique', vector, residual };
}
export function sequenceTerm(kind: 'reciprocal' | 'alternating' | 'geometric', n: number): number | null {
  if (!Number.isInteger(n) || n < 1 || n > 1000) return null;
  return kind === 'reciprocal' ? 1/n : kind === 'alternating' ? (n % 2 ? -1 : 1) : 2 ** (-n);
}
export function geometricSeries(first: number, ratio: number, count: number) {
  if (!finite([first], 100) || !Number.isFinite(ratio) || Math.abs(ratio) >= 1 || !Number.isInteger(count) || count < 1 || count > 1000) return null;
  const limit = first / (1-ratio), remainder = first * ratio ** count / (1-ratio);
  return { partial: limit - remainder, limit, remainder };
}
export function conditionalProbability(both: number, group: number): number | null {
  if (!Number.isInteger(both) || !Number.isInteger(group) || group <= 0 || group > 10000 || both < 0 || both > group) return null;
  return both / group;
}
export function binomialDistribution(trials: number, probability: number): number[] | null {
  if (!Number.isInteger(trials) || trials < 1 || trials > 20 || !Number.isFinite(probability) || probability < 0 || probability > 1) return null;
  let choose = 1;
  return Array.from({length: trials + 1}, (_, k) => {
    if (k > 0) choose = choose * (trials-k+1)/k;
    return choose * probability ** k * (1-probability) ** (trials-k);
  });
}
/** Spaces/semicolons separate values; decimal commas are unambiguous within a token. */
export function parseDataset(source: string): number[] | null {
  if (!source.trim() || source.length > 2000) return null;
  const parts = source.trim().split(/[\s;]+/);
  if (parts.length > 100 || parts.some(part => !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(part))) return null;
  const values = parts.map(part => Number(part.replace(',', '.')));
  return finite(values) ? values : null;
}
export function summarizeDataset(values: readonly number[]) {
  if (!values.length || values.length > 100 || !finite(values)) return null;
  const sorted = [...values].sort((a,b) => a-b), n = sorted.length;
  const mean = values.reduce((sum,value) => sum+value,0)/n;
  const median = n % 2 ? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2;
  const squares = values.reduce((sum,value) => sum+(value-mean)**2,0);
  return { mean, median, range: sorted[n-1]-sorted[0], populationVariance: squares/n, sampleVariance: n > 1 ? squares/(n-1) : null, standardDeviation: Math.sqrt(squares/n), sorted };
}
export function proportionUncertainty(successes: number, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 100000 || !Number.isInteger(successes) || successes < 0 || successes > count) return null;
  const proportion = successes/count, standardError = Math.sqrt(proportion*(1-proportion)/count);
  const interval = successes >= 10 && count-successes >= 10 ? [Math.max(0, proportion-1.96*standardError), Math.min(1, proportion+1.96*standardError)] as const : null;
  return { proportion, standardError, interval };
}
export function atLeastOne(probability: number, trials: number): number | null {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1 || !Number.isInteger(trials) || trials < 1 || trials > 20) return null;
  return probability === 1 ? 1 : -Math.expm1(trials * Math.log1p(-probability));
}
/** Seeded, reproducible Bernoulli experiment; intentionally capped to keep UI responsive. */
export function simulateAtLeastOne(probability: number, trials: number, repetitions: number, seed: number) {
  const exact = atLeastOne(probability, trials);
  if (exact === null || !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10000 || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) return null;
  let state = seed >>> 0, successes = 0;
  const random = () => { state = (Math.imul(1664525,state)+1013904223) >>> 0; return state/4294967296; };
  for (let i=0; i<repetitions; i++) {
    let any = false;
    // Consume all trials even after a success for consistent experiment indexing.
    for (let j=0; j<trials; j++) if (random() < probability) any = true;
    if (any) successes++;
  }
  return { successes, repetitions, estimate: successes/repetitions, exact, standardError: Math.sqrt(exact*(1-exact)/repetitions) };
}
