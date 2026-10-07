import { clubHonours, clubHonoursCutoff, worldCupSources } from './footballHonours';
import { footballEdition } from './footballLearning';
import { footballHistoryLicense, footballHistoryVerifiedOn } from './footballTournamentHistory';

export type CreditResource = {
  name: string;
  description: string;
  license: string;
  homepage: string;
  notices?: string;
  detail?: string;
  links?: { name: string; href: string }[];
};

// Add future engines, datasets and assets here. Package credits are generated separately.
export const engineCredits: CreditResource[] = [
  {
    name: 'Stockfish 18 / Stockfish.js',
    description: 'Chess computer opponents and analysis. Browser port by Nathan Rugg and Chess.com; Stockfish by Tord Romstad, Marco Costalba, Joona Kiiski, Gary Linscott and contributors. Neural networks by Linmiao Xu.',
    license: 'GPL-3.0',
    homepage: 'https://github.com/nmrugg/stockfish.js/tree/93c994592dcf3b4b21052ab925e9b534df9c0918',
    notices: '/licenses/Stockfish-GPL-3.0.txt',
    detail: 'stockfish-18-lite-single.js / .wasm · npm stockfish 18.0.8',
    links: [{ name: 'Corresponding source & build scripts', href: 'https://github.com/nmrugg/stockfish.js/archive/93c994592dcf3b4b21052ab925e9b534df9c0918.zip' }, { name: 'Engine distribution notes', href: '/stockfish/SOURCE.txt' }],
  },
  {
    name: 'KataGo / David J. Wu (lightvector) & contributors',
    description: 'Go neural network weights used by the browser engine. The compact b10 model provides local play and coaching estimates; the native KataGo executable is not bundled.',
    license: 'CC0-1.0 (weights) · MIT (upstream code)',
    homepage: 'https://github.com/lightvector/KataGo/tree/master/cpp/tests/models',
    notices: 'https://katagotraining.org/network_license/',
    detail: 'g170e-b10c128-s1141046784-d204142634.bin.gz · SHA-256: 1a8e05a4ea3fca20dab79410cbb566c760767fcdd2fa0b701cfe259a84cc8b04',
  },
  {
    name: 'Web KaTrain / Sir-Teo & contributors',
    description: 'Vendored TypeScript Go engine using TensorFlow.js and Pako. Local adaptations use positional superko, no handicap bonus, forbidden suicide and 6.5 komi.',
    license: 'MIT',
    homepage: 'https://github.com/Sir-Teo/web-katrain/tree/8dd813aeb565cbdad5215dc75204fc40fd519c50',
    notices: '/go-engine/Web-KaTrain-LICENSE.txt',
  },
  { name: 'TensorFlow.js / Google & contributors', description: 'Neural network inference with WASM and WebGPU backends for the Go engine.', license: 'Apache-2.0', homepage: 'https://github.com/tensorflow/tfjs', notices: '/go-engine/TensorFlow-LICENSE.txt' },
  { name: 'Pako / Vitaly Puzrin & Andrei Tuputcyn', description: 'Decompression of the bundled Go neural network model.', license: '(MIT AND Zlib)', homepage: 'https://github.com/nodeca/pako', notices: '/go-engine/pako-LICENSE.txt' },
];

export const atlasCredits: CreditResource[] = [
  { name: 'Natural Earth / world-atlas', description: 'Admin-0 country boundaries at 1:110m, converted to TopoJSON through world-atlas. The map renders de facto boundaries; quiz eligibility is configured separately.', license: 'Public domain (data) · ISC (world-atlas)', homepage: 'https://www.naturalearthdata.com/', notices: 'https://www.naturalearthdata.com/about/terms-of-use/' },
  { name: 'United Nations Statistics Division / M49', description: 'Country identifiers and statistical regions, selected and normalized for Atlas Arena.', license: 'UN terms of use', homepage: 'https://unstats.un.org/unsd/methodology/m49/overview/', notices: 'https://www.un.org/en/about-us/terms-of-use' },
  { name: 'GeoNames', description: 'Country names, capitals, coordinates, languages, currencies, neighbors and major cities from countryInfo.txt and cities15000.zip. Records are selected, normalized and bundled for the game.', license: 'CC-BY-4.0', homepage: 'https://www.geonames.org/', notices: 'https://creativecommons.org/licenses/by/4.0/' },
  { name: 'The World Bank / World Development Indicators', description: 'Population (SP.POP.TOTL) and surface area (AG.SRF.TOTL.K2), with observation years preserved. Values are selected and bundled for Atlas comparisons.', license: 'CC-BY-4.0 + World Bank terms', homepage: 'https://data.worldbank.org/', notices: 'https://data.worldbank.org/summary-terms-of-use' },
  { name: 'Wikidata / Wikimedia contributors', description: 'Highest points (P610) and elevations (P2044), selected through SPARQL and bundled for the stat modes.', license: 'CC0-1.0 (structured data)', homepage: 'https://www.wikidata.org/', notices: 'https://www.wikidata.org/wiki/Wikidata:Licensing' },
  { name: 'The World Factbook / Central Intelligence Agency', description: 'Independence dates, founding events, former country names and background summaries for Atlas History Battle, from the final (2026) edition. Entries are selected, parsed and bundled for the game; this use is not endorsed by the CIA.', license: 'Public domain (US Government work)', homepage: 'https://www.cia.gov/the-world-factbook/', notices: 'https://github.com/factbook/factbook.json/blob/master/LICENSE.md', links: [{ name: 'factbook.json mirror', href: 'https://github.com/factbook/factbook.json' }] },
  { name: 'flag-icons / Lipis & contributors', description: 'Bundled SVG country flags used in Atlas Arena and the interface.', license: 'MIT', homepage: 'https://github.com/lipis/flag-icons/tree/v7.5.0', notices: '/licenses/third-party-notices.txt' },
  { name: 'World Bank / Climate Change Knowledge Portal', description: 'Selected historical mean temperatures for Atlas Extreme Geography, covering 1995–2014. Values are curated from country summaries.', license: 'CC-BY-4.0 + World Bank terms', homepage: 'https://climateknowledgeportal.worldbank.org/', notices: 'https://data.worldbank.org/summary-terms-of-use' },
];

export const toolCredits: CreditResource[] = [
  { name: 'node-qrcode / Ryan Day & contributors', description: 'Local QR code generation and PNG/SVG downloads. Link and text content stays in the browser.', license: 'MIT', homepage: 'https://github.com/soldair/node-qrcode/tree/v1.5.4', notices: '/licenses/third-party-notices.txt', detail: 'qrcode 1.5.4' },
  { name: 'IANA / Time Zone Database', description: 'Representative map coordinates for Time Zone Planner. Time conversion and daylight-saving rules use the browser’s Intl implementation.', license: 'Public domain', homepage: 'https://www.iana.org/time-zones', notices: 'https://data.iana.org/time-zones/tzdb/LICENSE' },
  { name: 'web-push / Marco Castelluccio & contributors', description: 'Server-side Web Push delivery for opted-in Day Planner and Birthday Reminders notifications. This Edge Function dependency is listed separately from the installed npm inventory.', license: 'MPL-2.0', homepage: 'https://github.com/web-push-libs/web-push/tree/v3.6.7', notices: 'https://github.com/web-push-libs/web-push/blob/v3.6.7/LICENSE', detail: 'npm:web-push@3.6.7' },
];

export const learningCredits: CreditResource[] = [
  { name: 'Wikidata / Football tournament history', description: 'CC0 structured winner, runner-up and final-result facts for six tournaments from their first editions. Small factual corrections are checked against linked organiser reports; match prose and media are not copied.', license: 'CC0-1.0 (structured data)', homepage: 'https://www.wikidata.org/', notices: footballHistoryLicense, detail: `Verified ${footballHistoryVerifiedOn}` },
  { name: 'The IFAB / Laws of the Game', description: 'Reference for the football rules guide and interactive scenarios. Explanations and pitch diagrams are authored for Pluto; the linked laws may change edition.', license: 'Reference', homepage: 'https://www.theifab.com/documents/', detail: footballEdition },
  { name: 'FIFA', description: 'Primary references for World Cup winning years and selected final results. Historical facts are curated with source links in the football reference.', license: 'Reference', homepage: worldCupSources.men, links: [{ name: 'FIFA Women’s World Cup', href: 'https://www.fifa.com/en/tournaments/womens/womensworldcup' }] },
  { name: 'UEFA', description: 'Primary references for European club competition winners and selected finals, plus women’s World Cup history. Coverage and source links are shown beside the records.', license: 'Reference', homepage: 'https://www.uefa.com/uefachampionsleague/history/', links: [{ name: 'UEFA Women’s Champions League', href: 'https://www.uefa.com/womenschampionsleague/history/' }, { name: 'UEFA Europa League', href: 'https://www.uefa.com/uefaeuropaleague/history/' }, { name: 'UEFA Conference League', href: 'https://www.uefa.com/uefaconferenceleague/history/' }, { name: 'Women’s World Cup history', href: worldCupSources.women }] },
  { name: 'Club & league honours references', description: 'Official club and league records for the selected club trophy snapshots. These are historical totals with a stated cutoff, rather than live standings.', license: 'Reference', homepage: clubHonours[0].sources[0], detail: clubHonoursCutoff, links: clubHonours.flatMap(club => club.sources.map((href, index) => ({ name: `${club.name}${index ? ` · ${index + 1}` : ''}`, href }))) },
  { name: 'Yamaha / Musical Instrument Guide', description: 'Reference for music notation and instrument explanations. Pluto’s score drawings and teaching melodies are original; playback uses synthesized audio.', license: 'Reference', homepage: 'https://www.yamaha.com/en/musical_instrument_guide/', links: [{ name: 'Guitar notation & TAB', href: 'https://hub.yamaha.com/guitars/g-how-to/a-guitarists-guide-to-reading-sheet-music-and-tablature/' }] },
];

export const assetCredits: CreditResource[] = [
  { name: 'Lichess / lichess.org & contributors', description: 'Imported chess puzzles and the chess opening catalogue. The opening book is generated from lichess-org/chess-openings; puzzle records retain their Lichess source.', license: 'CC0-1.0', homepage: 'https://database.lichess.org/', notices: 'https://github.com/lichess-org/chess-openings' },
  { name: 'Free Stuff 1 – Chess Set / Tinymen', description: '3D chess-piece models by Tinymen, distributed through CGTrader. The license restricts extraction and redistribution of the model files; browser delivery requires appropriate permission or safeguards.', license: 'CGTrader Royalty Free License (no AI)', homepage: 'https://www.cgtrader.com/free-3d-models/sports/game/free-stuff-1-chess-set', notices: 'https://help.cgtrader.com/hc/en-us/articles/360015124437-Royalty-Free-License' },
  { name: 'Geist / The Geist Project Authors', description: 'Self-hosted interface font supplied through Fontsource.', license: 'OFL-1.1', homepage: 'https://github.com/vercel/geist-font', notices: '/licenses/third-party-notices.txt' },
];
