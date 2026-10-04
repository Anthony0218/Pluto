import { POWER_NAME, type PowerKind } from './config.ts';
import { matchSettings } from './progression.ts';
import type { GameEvent, GameState, Player, MatchSettings } from './types.ts';
export function reviewStats(s: GameState, p: Player): [string, string | number][] {
  const n = (value: number | undefined) => Math.round(value ?? 0), yes = (value: boolean | undefined) => value ? 'Yes' : 'No';
  const stats = p.stats;
  return [['Placement', p.placement === null ? '—' : `#${p.placement}`], ['Final match result', s.result === 'tie' && s.tiedIds?.includes(p.id) ? 'Tie' : s.winnerId === p.id ? 'Winner' : p.alive ? 'Survived' : 'Eliminated'],
    ['Final normal-phase size', n(stats?.normalFinalMass ?? p.mass)], ['Maximum size', n(stats?.maxMass ?? p.mass)], ['Food eaten', p.foodEaten], ['Players eaten', p.playersEaten],
    ['Total growth', n(stats?.totalGrowth)], ['2x Growth items collected', n(stats?.collected?.multiplier)], ['2x activations', n(stats?.growthActivations)], ['Growth /2 collected', n(stats?.collected?.divider)], ['Hostile animal attacks received', n(stats?.hostileAttacks)], ['Deaths', n(stats?.deaths)], ['Lives remaining', p.lives ?? (p.alive ? 1 : 0)], ['Respawns', n(stats?.respawns)],
    ['Humans eaten', n(stats?.collected?.human)], ['Monster factories eaten', Object.entries(stats?.collected ?? {}).filter(([key])=>key.startsWith('factory')).reduce((total,[,count])=>total+count,0)], ['Pigeon quest completed', yes(stats?.pigeonQuest)], ['Cat quest completed', yes(stats?.catQuest)],
    ['Animal Escapes used', n(stats?.escapes)], ['Hell assists used', n(stats?.hellAssists)], ['Time in Hell', `${(stats?.hellTime ?? 0).toFixed(1)}s`],
    ['Hell elimination cause', stats?.hellCause ?? '—'], ['Fell into lava', yes(stats?.fellInLava)], ['Survived Hell', yes(stats?.survivedHell)],
    ['Jump uses / collected', `${n(stats?.jumpUses)} / ${n(stats?.collected?.jump)}`], ['Successful gap jumps', n(stats?.gapJumps)], ['Strike uses / collected', `${n(stats?.strikeUses)} / ${n(stats?.collected?.strike)}`], ['Strike-assisted devours', n(stats?.strikeDevours)], ['Companion time', `${n(stats?.companionSeconds)}s`], ['Companion feeds', n(stats?.companionFeeds)], ['Vehicles eaten', n(stats?.vehicles)], ['Buildings eaten', n(stats?.buildings)], ['Trees eaten', n(stats?.trees)], ['Choking events', n(stats?.chokes)], ['Friendly animal growth', n(stats?.friendlyGrowth)], ...(stats?.hostileLoss ? [['Hostile animal size loss', n(stats.hostileLoss)] as [string, number]] : [])];
}
export const timelineLabel: Partial<Record<GameEvent['type'], string>> = {
  shock: 'Shock', shockHit: 'Shocked', jump: 'Jump', strike: 'Strike', hellStart: 'Hell Sudden Death', sweep: 'Black hole sweep', groundDestroyed: 'Platform destroyed', escape: 'Animal Escape', hellAssist: 'Hell animal assist',
  fall: 'Falling', lava: 'Fell into lava', respawn: 'Respawn', questComplete: 'Quest completed!', eat: 'Player consumed', eliminated: 'Eliminated', win: 'Winner', tie: 'Tie',
};

export function reviewSettings(options: Partial<MatchSettings> = {}): [string, string | number][] {
  const s = matchSettings(options);
  return [['Match duration', `${s.matchDuration/60} min`], ['Animals', s.animalsEnabled ? 'ON' : 'OFF'], ['Hell Sudden Death', s.hellEnabled ? 'ON' : 'OFF'], ['Lives', s.livesEnabled ? 'ON' : 'OFF'], ['Starting lives', s.livesEnabled ? 3 : 1],
    ...(s.mode === 'solo' ? [['Bots', s.botsEnabled ? 'ON' : 'OFF'] as [string,string]] : []),
    ...(s.mode === 'solo' && s.botsEnabled ? [['Bot Difficulty', s.botDifficulty === 'easy' ? 'Easy' : s.botDifficulty === 'hard' ? 'Hard' : 'Medium'] as [string,string]] : [])];
}

export const collectionLabel = (kind: string) => ({ factoryCart: 'Monster factory · Small', factoryWorks: 'Monster factory · Large', factoryTower: 'Monster factory · Tower', factorySky: 'Monster factory · Skyscraper', human: 'Human', fish: 'Fish' } as Record<string,string>)[kind] ?? POWER_NAME[kind as PowerKind] ?? (kind.startsWith('pluto') ? 'Pluto' : (kind.charAt(0).toUpperCase()+kind.slice(1)).replace(/[A-Z]/g, (letter, index) => index ? ` ${letter.toLowerCase()}` : letter));
