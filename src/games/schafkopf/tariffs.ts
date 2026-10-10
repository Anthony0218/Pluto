import type { Contract, GameRules } from './schafkopf.ts';
/** Missing per-variant tariffs retain the old shared Solo price in saved games. */
export function baseGameValue(contract: Contract, rules?: Partial<GameRules>): number {
  if (contract.kind === 'rufspiel') return rules?.rufspielValue ?? 10;
  if (contract.kind === 'wenz') return rules?.wenzValue ?? 30;
  if (contract.kind === 'ramsch') return rules?.ramschValue ?? 10;
  const keys = { farbwenz: 'farbwenzValue', geier: 'geierValue', farbgeier: 'farbgeierValue', bettel: 'bettelValue' } as const;
  if (contract.kind in keys) return rules?.[keys[contract.kind as keyof typeof keys]] ?? rules?.soloValue ?? 30;
  return rules?.soloValue ?? 30;
}
