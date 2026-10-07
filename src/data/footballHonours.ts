// Selected historical facts. Do not silently reinterpret these as live totals.
export const clubHonoursCutoff = '2024/25';
export const honoursVerifiedOn = '2026-10-06';
export type ClubHonours = { id: string; name: string; league: string; domesticLabel: string; leagueTitles: number; cup: string; cupTitles: number; ucl: number; europa: number; conference: number; sources: string[]; note?: string };
const uclSource = 'https://www.uefa.com/uefachampionsleague/history/winners/';
const europaSource = 'https://www.uefa.com/uefaeuropaleague/history/';
export const clubHonours: ClubHonours[] = [
  { id: 'bayern', name: 'Bayern München', league: 'Bundesliga', domesticLabel: 'Bundesliga titles since 1963', leagueTitles: 33, cup: 'DFB-Pokal', cupTitles: 20, ucl: 6, europa: 1, conference: 0, sources: ['https://fcbayern.com/en/club/honours', 'https://www.bundesliga.com/de/bundesliga/news/fc-bayern-munchen-zahlen-rekorde-fakten-meisterschaft-31878'], note: 'Excludes the 1932 German championship; Bundesliga began in 1963.' },
  { id: 'liverpool', name: 'Liverpool', league: 'Premier League', domesticLabel: 'English top-flight titles', leagueTitles: 20, cup: 'FA Cup', cupTitles: 8, ucl: 6, europa: 3, conference: 0, sources: ['https://www.liverpoolfc.com/history/honours'], note: 'Includes 18 First Division titles and two Premier League titles through 2024/25.' },
  { id: 'real', name: 'Real Madrid', league: 'La Liga', domesticLabel: 'Spanish top-flight titles', leagueTitles: 36, cup: 'Copa del Rey', cupTitles: 20, ucl: 15, europa: 2, conference: 0, sources: ['https://www.realmadrid.com/en-US/the-club/historia/futbol/primer-equipo-masculino/trofeos'] },
  { id: 'juventus', name: 'Juventus', league: 'Serie A', domesticLabel: 'Italian championship titles', leagueTitles: 36, cup: 'Coppa Italia', cupTitles: 15, ucl: 2, europa: 3, conference: 0, sources: ['https://www.legaseriea.it/team/juventus/palmares', 'https://www.juventus.com/en/news/articles/all-the-records-from-rome', uclSource, europaSource], note: 'Uses the league organiser’s 36 recognised titles; excludes revoked or unassigned championships.' },
  { id: 'psg', name: 'Paris Saint-Germain', league: 'Ligue 1', domesticLabel: 'French top-flight titles', leagueTitles: 13, cup: 'Coupe de France', cupTitles: 16, ucl: 1, europa: 0, conference: 0, sources: ['https://news.psg.fr/communiques-de-presse/equipe-premiere/une-16e-coupe-de-france-pour-le-paris-saint-germain', 'https://www.uefa.com/uefachampionsleague/history/seasons/2025/'] },
  { id: 'benfica', name: 'Benfica', league: 'Primeira Liga', domesticLabel: 'Portuguese league titles', leagueTitles: 38, cup: 'Taça de Portugal', cupTitles: 26, ucl: 2, europa: 0, conference: 0, sources: ['https://www.slbenfica.pt/pt-pt/instituicao/clube/palmares', uclSource], note: 'Taça de Portugal is distinct from the former Campeonato de Portugal competition.' },
  { id: 'chelsea', name: 'Chelsea', league: 'Premier League', domesticLabel: 'English top-flight titles', leagueTitles: 6, cup: 'FA Cup', cupTitles: 8, ucl: 2, europa: 2, conference: 1, sources: ['https://www.chelseafc.com/en/trophy-cabinet', 'https://www.chelseafc.com/en/news/article/weve-won-it-all-again-chelseas-european-trophy-cabinet'] },
  { id: 'sevilla', name: 'Sevilla', league: 'La Liga', domesticLabel: 'Spanish top-flight titles', leagueTitles: 1, cup: 'Copa del Rey', cupTitles: 5, ucl: 0, europa: 7, conference: 0, sources: ['https://sevillafc.es/el-club/palmares', 'https://www.uefa.com/uefaeuropaleague/news/0278-15f537b7c75c-39eb83ca154a-1000--meet-the-winners-sevilla/'] },
  { id: 'roma', name: 'Roma', league: 'Serie A', domesticLabel: 'Italian championship titles', leagueTitles: 3, cup: 'Coppa Italia', cupTitles: 9, ucl: 0, europa: 0, conference: 1, sources: ['https://www.asroma.com/en/club/history/honours'] },
];
export const domesticLeagues = ['Bundesliga', 'Premier League', 'La Liga', 'Serie A', 'Ligue 1', 'Primeira Liga'];
export type WorldCupHonours = { team: string; years: number[] };
export const mensWorldCups: WorldCupHonours[] = [
  { team: 'Brazil', years: [1958, 1962, 1970, 1994, 2002] }, { team: 'Germany', years: [1954, 1974, 1990, 2014] },
  { team: 'Italy', years: [1934, 1938, 1982, 2006] }, { team: 'Argentina', years: [1978, 1986, 2022] },
  { team: 'France', years: [1998, 2018] }, { team: 'Uruguay', years: [1930, 1950] }, { team: 'Spain', years: [2010, 2026] }, { team: 'England', years: [1966] },
];
export const womensWorldCups: WorldCupHonours[] = [
  { team: 'United States', years: [1991, 1999, 2015, 2019] }, { team: 'Germany', years: [2003, 2007] },
  { team: 'Norway', years: [1995] }, { team: 'Japan', years: [2011] }, { team: 'Spain', years: [2023] },
];
export const worldCupSources = {
  men: 'https://www.fifa.com/en/tournaments/mens/worldcup/articles/world-cup-champions-1982-2026-italy-argentina-germany-brazil-france-spain',
  women: 'https://www.uefa.com/womensworldcup/news/027a-166817b8be17-9e0082e122cd-1000--women-s-world-cup-groups-and-matches-netherlands-face-us-eng/',
};
export const honoursLabels = ['European Cup / Champions League', 'UEFA Cup / Europa League', 'Conference League', ...new Set(clubHonours.flatMap(c => [c.domesticLabel, ...(c.note ? [c.note] : [])])), ...mensWorldCups.map(t => t.team), ...womensWorldCups.map(t => t.team)];
