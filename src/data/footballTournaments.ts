import { worldCupSources } from './footballHonours.ts';
import { footballTournamentHistory } from './footballTournamentHistory.ts';
// team is the beneficiary, including for own goals; shootout kicks are separate.
export type FinalGoal = { player?: string; team: string; minute?: string; kind?: 'penalty' | 'own-goal' };
export type TournamentFinal = { year: number; teams: [string, string]; score: [number, number]; date?: string; venue?: string; extraTime?: boolean; penalties?: [number, number]; goals?: FinalGoal[]; format?: 'aggregate' | 'replay' | 'final-round'; source: string };
export type TournamentEditionResult = { year: number; winner: string; runnerUp: string; source: string };
export type FootballTournament = { id: string; name: string; national: boolean; winners: { team: string; years: number[] }[]; editions?: TournamentEditionResult[]; finals: TournamentFinal[]; coverage: string; source: string };
export type ChampionshipEdition = { year: number; winner?: string; runnerUp?: string; source?: string; final?: TournamentFinal };

/** Preserve repeated wins and missing details, scoped to one competition. */
export function championshipEditions(tournament: FootballTournament): ChampionshipEdition[] {
 const years = [...new Set([...(tournament.editions ?? []).map(e => e.year), ...tournament.winners.flatMap(w => w.years), ...tournament.finals.map(f => f.year)])].sort((a, b) => b - a);
 return years.map(year => {
  const edition = tournament.editions?.find(e => e.year === year);
  const final = tournament.finals.find(f => f.year === year);
  const result = final && (final.penalties ?? final.score);
  const finalWinner = final && result && result[0] !== result[1] ? final.teams[result[0] > result[1] ? 0 : 1] : undefined;
  const winner = edition?.winner ?? tournament.winners.find(w => w.years.includes(year))?.team ?? finalWinner;
  return { year, winner, runnerUp: edition?.runnerUp ?? (winner ? final?.teams.find(team => team !== winner) : undefined), source: edition?.source ?? final?.source, final };
 });
}

export function previousChampionship(tournament: FootballTournament, year: number) {
 return championshipEditions(tournament).find(edition => edition.year < year);
}

/** Stoppage time stays within its period: 90+5 precedes minute 91 in extra time. */
export function chronologicalGoals(goals: FinalGoal[]): FinalGoal[] {
 const minute = (value?: string) => {
  const match = value?.trim().match(/^(\d+)(?:\+(\d+))?[′']?$/);
  return match ? Number(match[1]) + Number(match[2] ?? 0) / 1000 : Infinity;
 };
 return [...goals].sort((a, b) => minute(a.minute) - minute(b.minute));
}
const goal = (player: string, team: string, minute: string, kind?: FinalGoal['kind']): FinalGoal => ({ player, team, minute, ...(kind ? { kind } : {}) });
const uclFinals: TournamentFinal[] = [
 { year: 2025, teams: ['Paris Saint-Germain', 'Inter'], score: [5, 0], date: '2025-05-31', venue: 'Munich', goals: [goal('Achraf Hakimi','Paris Saint-Germain','12'),goal('Désiré Doué','Paris Saint-Germain','20'),goal('Désiré Doué','Paris Saint-Germain','63'),goal('Khvicha Kvaratskhelia','Paris Saint-Germain','73'),goal('Senny Mayulu','Paris Saint-Germain','87')], source: 'https://www.uefa.com/uefachampionsleague/news/0299-1de417608530-15b01ff7b150-1000/' },
 { year: 2024, teams: ['Borussia Dortmund', 'Real Madrid'], score: [0, 2], date: '2024-06-01', venue: 'Wembley Stadium, London', goals: [goal('Dani Carvajal','Real Madrid','74'),goal('Vinícius Júnior','Real Madrid','83')], source: 'https://www.uefa.com/uefachampionsleague/news/028e-1b07e18d875a-ba78e4b9d9fc-1000/' },
];
const uwclFinals: TournamentFinal[] = [
 { year: 2025, teams: ['Arsenal', 'Barcelona'], score: [1, 0], date: '2025-05-24', venue: 'Lisbon', goals: [goal('Stina Blackstenius','Arsenal','74')], source: 'https://www.uefa.com/womenschampionsleague/news/0299-1dd5c8a328c2-7b437755e07f-1000/' },
 { year: 2024, teams: ['Barcelona', 'Lyon'], score: [2, 0], date: '2024-05-25', venue: 'San Mamés, Bilbao', goals: [goal('Aitana Bonmatí','Barcelona','63'),goal('Alexia Putellas','Barcelona','90+5')], source: 'https://www.uefa.com/womenschampionsleague/news/028d-1af9862331e9-90fcbcd9c8ba-1000/' },
];
const europaFinals: TournamentFinal[] = [
 { year: 2025, teams: ['Tottenham Hotspur', 'Manchester United'], score: [1, 0], date: '2025-05-21', venue: 'Bilbao', goals: [goal('Brennan Johnson','Tottenham Hotspur','42')], source: 'https://www.uefa.com/uefaeuropaleague/news/0299-1dcffd82d4a0-c280ee5f9c62-1000/' },
 { year: 2024, teams: ['Atalanta', 'Bayer Leverkusen'], score: [3, 0], date: '2024-05-22', venue: 'Dublin', goals: ['12','26','75'].map(minute => goal('Ademola Lookman','Atalanta',minute)), source: 'https://www.uefa.com/uefaeuropaleague/news/028d-1af3bf5e7e68-7d9202792002-1000/' },
];
const conferenceFinals: TournamentFinal[] = [
 { year: 2022, teams: ['Roma', 'Feyenoord'], score: [1, 0], date: '2022-05-25', venue: 'National Arena, Tirana', goals: [goal('Nicolò Zaniolo','Roma','32')], source: 'https://www.uefa.com/uefaconferenceleague/news/0275-153b4c3b58ce-9dd2bc95bfd0-1000--roma-win-the-europa/' },
 { year: 2025, teams: ['Real Betis', 'Chelsea'], score: [1, 4], date: '2025-05-28', venue: 'Wrocław', goals: [goal('Abdessamad Ezzalzouli','Real Betis','9'),goal('Enzo Fernández','Chelsea','65'),goal('Nicolas Jackson','Chelsea','71'),goal('Jadon Sancho','Chelsea','83'),goal('Moisés Caicedo','Chelsea','90+1')], source: 'https://www.uefa.com/uefaconferenceleague/news/0299-1dde1ba33803-6370dd142717-1000/' },
 { year: 2024, teams: ['Olympiacos', 'Fiorentina'], score: [1, 0], extraTime: true, date: '2024-05-29', venue: 'Athens', goals: [goal('Ayoub El Kaabi','Olympiacos','116')], source: 'https://www.uefa.com/uefaconferenceleague/news/028d-1b01e5ec31a5-144c1f00e4f3-1000/' },
];
const worldFinals: TournamentFinal[] = [
 { year: 2022, teams: ['Argentina', 'France'], score: [3, 3], extraTime: true, penalties: [4, 2], date: '2022-12-18', venue: 'Lusail Stadium', goals: [goal('Lionel Messi','Argentina','23','penalty'),goal('Ángel Di María','Argentina','36'),goal('Kylian Mbappé','France','80','penalty'),goal('Kylian Mbappé','France','81'),goal('Lionel Messi','Argentina','108'),goal('Kylian Mbappé','France','118','penalty')], source: 'https://www.fifa.com/fr/tournaments/mens/worldcup/articles/argentine-france-messi-mbappe-qatar-2022' },
 { year: 2018, teams: ['France', 'Croatia'], score: [4, 2], date: '2018-07-15', venue: 'Luzhniki Stadium, Moscow', goals: [goal('Mario Mandžukić','France','18','own-goal'),goal('Ivan Perišić','Croatia','28'),goal('Antoine Griezmann','France','38','penalty'),goal('Paul Pogba','France','59'),goal('Kylian Mbappé','France','65'),goal('Mario Mandžukić','Croatia','69')], source: 'https://inside.fifa.com/tournaments/mens/worldcup/2018russia/news/worldcupathome-france-croatia-russia-2018-3072767' },
];
const womenFinals: TournamentFinal[] = [
 { year: 2023, teams: ['Spain', 'England'], score: [1, 0], date: '2023-08-20', venue: 'Stadium Australia, Sydney', goals: [goal('Olga Carmona','Spain','29')], source: 'https://www.fifa.com/de/tournaments/womens/womensworldcup/australia-new-zealand2023/articles/frauen-wm-2023-finale-spanien-weltmeister-england' },
 { year: 2019, teams: ['United States', 'Netherlands'], score: [2, 0], date: '2019-07-07', venue: 'Lyon', goals: [goal('Megan Rapinoe','United States','61','penalty'),goal('Rose Lavelle','United States','69')], source: 'https://inside.fifa.com/tournaments/womens/womensworldcup/france2019/news/youth-and-experience-blend-in-usa-s-successful-title-defence' },
];
function historicalTournament(id: string, name: string, national: boolean, detailedFinals: TournamentFinal[], source: string): FootballTournament {
 const editions = footballTournamentHistory[id];
 const finals = editions.flatMap(edition => {
  const final = detailedFinals.find(match => match.year === edition.year) ?? edition.final;
  return final ? [final] : [];
 });
 const winners = new Map<string, number[]>();
 editions.forEach(({ year, winner }) => winners.set(winner, [...(winners.get(winner) ?? []), year]));
 return { id, name, national, editions, finals, source, coverage: `Complete winners and runners-up: ${editions[0].year}–${editions.at(-1)!.year}`, winners: [...winners].map(([team, years]) => ({ team, years })) };
}
export const footballTournaments: FootballTournament[] = [
 historicalTournament('world-men','FIFA World Cup — Men',true,worldFinals,worldCupSources.men),
 historicalTournament('world-women','FIFA World Cup — Women',true,womenFinals,worldCupSources.women),
 historicalTournament('ucl-men','UEFA Champions League — Men',false,uclFinals,'https://www.uefa.com/uefachampionsleague/history/'),
 historicalTournament('ucl-women','UEFA Champions League — Women',false,uwclFinals,'https://www.uefa.com/womenschampionsleague/history/'),
 historicalTournament('europa-men','UEFA Europa League — Men',false,europaFinals,'https://www.uefa.com/uefaeuropaleague/history/'),
 historicalTournament('conference-men','UEFA Conference League — Men',false,conferenceFinals,'https://www.uefa.com/uefaconferenceleague/history/'),
];
export const footballFlags: Record<string, string> = { Argentina:'ar', France:'fr', Germany:'de', Brazil:'br', Italy:'it', Spain:'es', England:'gb-eng', Uruguay:'uy', 'United States':'us', Norway:'no', Japan:'jp', Croatia:'hr', Netherlands:'nl', Hungary:'hu', Sweden:'se', Czechoslovakia:'cz', China:'cn' };
