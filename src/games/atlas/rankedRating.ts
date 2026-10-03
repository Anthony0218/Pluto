/** Standard Glicko-2, one game per rating period; simultaneous opponents are rated from their pre-match values. */
export type Rating = { rating: number; deviation: number; volatility: number; matchesPlayed: number };
export const INITIAL_RATING: Rating = { rating: 1500, deviation: 350, volatility: 0.06, matchesPlayed: 0 };
const SCALE = 173.7178, TAU = 0.5, EPSILON = 1e-6;
const g = (phi: number) => 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
const expected = (mu: number, otherMu: number, otherPhi: number) => 1 / (1 + Math.exp(-g(otherPhi) * (mu - otherMu)));

function update(player: Rating, opponent: Rating, score: number): Rating {
  const mu = (player.rating - 1500) / SCALE, phi = player.deviation / SCALE;
  const otherMu = (opponent.rating - 1500) / SCALE, otherPhi = opponent.deviation / SCALE;
  const factor = g(otherPhi), e = expected(mu, otherMu, otherPhi);
  const variance = 1 / (factor * factor * e * (1 - e));
  const delta = variance * factor * (score - e), a = Math.log(player.volatility ** 2);
  const f = (x: number) => {
    const ex = Math.exp(x), denominator = phi * phi + variance + ex;
    return ex * (delta * delta - phi * phi - variance - ex) / (2 * denominator * denominator) - (x - a) / (TAU * TAU);
  };
  let A = a, B: number;
  if (delta * delta > phi * phi + variance) B = Math.log(delta * delta - phi * phi - variance);
  else { let k = 1; while (f(a - k * TAU) < 0) k += 1; B = a - k * TAU; }
  let fA = f(A), fB = f(B);
  for (let i = 0; Math.abs(B - A) > EPSILON && i < 100; i += 1) {
    const C = A + (A - B) * fA / (fB - fA), fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
    B = C; fB = fC;
  }
  const volatility = Math.exp(A / 2), phiStar = Math.sqrt(phi * phi + volatility * volatility);
  const nextPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / variance);
  const nextMu = mu + nextPhi * nextPhi * factor * (score - e);
  const next = { rating: 1500 + SCALE * nextMu, deviation: SCALE * nextPhi, volatility, matchesPlayed: player.matchesPlayed + 1 };
  // Established wins/losses move at least 20 points (100-point divisions take about five wins).
  // Placements retain uncertainty-driven Glicko-2 movement; draws retain their strength adjustment.
  if (player.matchesPlayed >= 10 && score !== 0.5) {
    const movement = Math.max(20, Math.min(40, Math.abs(next.rating - player.rating)));
    next.rating = Math.max(100, Math.min(10000, player.rating + (score === 1 ? movement : -movement)));
  }
  if (!Object.values(next).every(Number.isFinite)) throw new Error("Glicko-2 produced an invalid rating.");
  return next;
}

export function calculateMatchResult(a: Rating, b: Rating, result: "a" | "b" | "draw") {
  for (const player of [a, b]) if (!(player.deviation > 0 && player.volatility > 0 && Number.isFinite(player.rating))) throw new Error("Invalid Glicko-2 player.");
  const aScore = result === "a" ? 1 : result === "b" ? 0 : 0.5;
  return { a: update(a, b, aScore), b: update(b, a, 1 - aScore) };
}
