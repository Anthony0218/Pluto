import { ATLAS_SCORING, GUESS_SCORING } from "./config.ts";
import { maxPlayersFor, type AtlasMultiplayerMode } from "./multiplayer.ts";
import { COUNTRY_GUESSER, EXTREME_GEOGRAPHY, REGION_BUILDER, STAT_BATTLE, STAT_DETECTIVE, STAT_RANKING } from "./trials/config.ts";
import { LANGUAGE_GUESSER } from "./trials/languageGuesser.ts";
import type { AtlasMode } from "./types.ts";

/**
 * Every Atlas Arena mode in menu order. Each one can be played alone, online and on one shared device (hotseat);
 * this table says which engine runs each of the three, and holds the rules shown on the menu.
 */
export type ArenaModeId =
  | "map-battle" | "closest-wins" | "higher-lower" | "guess-country" | "flag-battle" | "stat-ranking" | "stat-battle"
  | "region-builder" | "stat-detective" | "guess-country-mini" | "extreme-geography" | "territory-battle" | "speed-run" | "map-fill" | "language-guesser";
export type TrialKind = "country-guesser" | "stat-detective" | "region-builder" | "stat-ranking" | "extreme-geography" | "stat-battle" | "language-guesser";
export type ModeAccent = "cyan" | "amber" | "violet" | "emerald" | "rose" | "sky";
/** turns: each player plays their own run in turn · pins / territory / duel: head-to-head on one screen. */
export type HotseatKind = "turns" | "pins" | "territory" | "duel";
export type ModeOption = "categories" | "stats" | "scope";
export type ModeRules = { goal: string; play: string[]; scoring: string; solo: string; multiplayer: string; hotseat: string };
export type ArenaModeDef = {
  id: ArenaModeId; title: string; tagline: string; description: string; meta: string; accent: ModeAccent;
  solo: { kind: "arena"; mode: AtlasMode } | { kind: "trial"; trial: TrialKind };
  online: AtlasMultiplayerMode; hotseat: HotseatKind;
  /** Extra settings before a game (difficulty is always asked). */
  options: ModeOption[];
  /** Personal-best key; the former Atlas Trials modes keep their old ids so earlier records survive. */
  bestId: string;
  rules: ModeRules;
};

const race = "Online uses a bounded, shared deck, a 3-minute limit (90 seconds for Speed Run), and server-graded answers. Runs resume after reconnecting. Ordinary correct answers earn 1,000, wrong answers zero; ranking uses partial placement credit, clues lower the award, and Map Fill mistakes cost 25. Speed Run is +150 / −150.";
const turns = (what: string) => `2–4 players share one device and take turns, each playing ${what}. Pass the device when your run ends — the highest score wins.`;
const speed = `${ATLAS_SCORING.normalCorrect.toLocaleString("en")} points for a correct answer plus up to ${ATLAS_SCORING.maxSpeedBonus} for speed`;

export const ARENA_MODES: ArenaModeDef[] = [
  {
    id: "map-battle", title: "Map Battle", tagline: "Know the world", accent: "cyan", meta: "10 questions · knowledge first",
    description: "Find the named country on the world map. Correct answers earn the points; speed adds at most 5%.",
    solo: { kind: "arena", mode: "map_click" }, online: "map_battle", hotseat: "turns", options: [], bestId: "map-battle",
    rules: {
      goal: "Click the named country on the world map.",
      play: ["Read the prompt and click the matching country on the world map.", "Zoom with the buttons or the mouse wheel; very small states are drawn as dots.", "You get one click per question: the right country lights up green, a wrong one red."],
      scoring: `${speed}. Wrong clicks score nothing.`,
      solo: "10 countries to locate. Difficulty sets the speed-bonus window and how obscure the countries get.",
      multiplayer: "2–4 players answer the same question at once with 20 seconds on the clock. Every correct click scores; speed adds at most 5%.",
      hotseat: turns("their own 10 questions"),
    },
  },
  {
    id: "closest-wins", title: "Closest Wins", tagline: "Drop a pin", accent: "sky", meta: "10 rounds · scored by distance",
    description: "Drop a pin near a country or capital. Country rounds use real borders; capital rounds use a city target.",
    solo: { kind: "arena", mode: "closest_wins" }, online: "closest_wins", hotseat: "pins", options: ["categories"], bestId: "closest-wins",
    rules: {
      goal: "Place your pin as close as possible to the country or capital in the question.",
      play: ["Click anywhere on land or sea to place your pin; click again to move it.", "Submit to lock it in. Inside a country's borders or within 20 km of a capital's center counts as 0 km.", "After the round, a dashed line shows where each distance was measured."],
      scoring: "Alone: 1,000 points for a zero-distance pin; outside, points fall with distance. Against others: only the closest pin scores 1,000 points.",
      solo: "10 rounds scored by distance.",
      multiplayer: "2–4 players pin the same country within 20 seconds. The closest pin wins the round; equally close pins share the points.",
      hotseat: "2–4 players pin each country one after another. The map is covered between turns so nobody sees an earlier pin, then all pins are revealed and the closest wins the round.",
    },
  },
  {
    id: "higher-lower", title: "Higher or Lower", tagline: "Keep the streak", accent: "amber", meta: "Streak · one miss ends it",
    description: "Countries, cities, continents and subregions: population, area, highest peaks and more. Is the next one higher or lower?",
    solo: { kind: "arena", mode: "higher_lower" }, online: "higher_lower", hotseat: "turns", options: ["stats"], bestId: "higher-lower",
    rules: {
      goal: "Decide whether the second subject has a higher or lower value than the first.",
      play: ["Two subjects share a statistic, such as population, area or highest point.", "The first value is shown. Choose Higher or Lower for the second.", "The revealed card becomes the next comparison."],
      scoring: `${speed}.`,
      solo: "Keep your streak going as long as you can. One wrong call ends the run.",
      multiplayer: "10 comparisons for 2–4 players. Everyone answers every round, so a miss only costs that round.",
      hotseat: turns("their own streak"),
    },
  },
  {
    id: "guess-country", title: "Guess the Country", tagline: "Tip by tip", accent: "violet", meta: "8 countries · 5 tips each",
    description: "A new tip every round — numbers, summits, a sentence overheard on the street. Solve it early for bonus points.",
    solo: { kind: "arena", mode: "guess_country" }, online: "guess_country", hotseat: "turns", options: [], bestId: "guess-country",
    rules: {
      goal: "Name the mystery country from four random tips and a final flag reveal.",
      play: ["The first four tips are drawn in random order from population, geography, languages, currency and other facts. The fifth tip always shows the flag.", "Type a country, pick it from the list (or click it on the map) and submit. You have one guess per tip.", "A wrong guess reveals the next tip. After the last tip the answer is shown."],
      scoring: `${GUESS_SCORING.first} points for solving, +${GUESS_SCORING.tipBonus[0]} on the first tip and +${GUESS_SCORING.tipBonus[1]} on the second. Online, the first solver gets ${GUESS_SCORING.first} and everyone else who solves the same tip ${GUESS_SCORING.other}.`,
      solo: "8 countries.",
      multiplayer: `2–4 players share each tip with ${GUESS_SCORING.tipSeconds} seconds per tip. Once someone is right, the others get a short last call.`,
      hotseat: turns("their own 8 countries"),
    },
  },
  {
    id: "flag-battle", title: "Flag Battle", tagline: "Flags & outlines", accent: "rose", meta: "12 flags · 4 options",
    description: "Name the country behind a flag, then pick the right flag for a country outline.",
    solo: { kind: "arena", mode: "flags" }, online: "flag_battle", hotseat: "turns", options: [], bestId: "flag-battle",
    rules: {
      goal: "Match flags with their countries.",
      play: ["Rounds alternate: name the country behind a flag, then choose the flag that belongs to a country outline.", "Pick one of four options."],
      scoring: `${speed}.`,
      solo: "12 rounds.",
      multiplayer: "10 rounds for 2–4 players with 20 seconds each; speed adds at most 5%.",
      hotseat: turns("their own 12 rounds"),
    },
  },
  {
    id: "stat-ranking", title: "Stat Ranking", tagline: "Drag to order", accent: "sky", meta: `${STAT_RANKING.rounds} rounds · perfect bonus`,
    description: "Sort the cards from highest to lowest, lock in, and watch them slide into the true order.",
    solo: { kind: "trial", trial: "stat-ranking" }, online: "stat_ranking", hotseat: "turns", options: [], bestId: "stat-ranking",
    rules: {
      goal: "Put countries in order of a statistic, highest first.",
      play: ["Drag the country cards into the order you think is right.", "Lock in to see the true order and each card's value."],
      scoring: `${STAT_RANKING.exact} points per card in exactly the right place, ${STAT_RANKING.offByOne} one place off, ${STAT_RANKING.offByTwo} two places off, and +${STAT_RANKING.perfectBonus} for a perfect order.`,
      solo: `${STAT_RANKING.rounds} rounds. Difficulty sets how many cards there are (${STAT_RANKING.cards.beginner}–${STAT_RANKING.cards.expert}) and how close their values sit.`,
      multiplayer: race, hotseat: turns(`their own ${STAT_RANKING.rounds} rounds`),
    },
  },
  {
    id: "stat-battle", title: "Stat Battle", tagline: "Card duel", accent: "amber", meta: `First to ${STAT_BATTLE.winTarget} · vs AI or a friend`,
    description: "Hold a hand of countries, read the category, and play the card you think wins. Spend giants wisely.",
    solo: { kind: "trial", trial: "stat-battle" }, online: "stat_battle", hotseat: "duel", options: [], bestId: "stat-battle",
    rules: {
      goal: `Be the first to win ${STAT_BATTLE.winTarget} rounds of a country card duel.`,
      play: [`Each side holds ${STAT_BATTLE.handSize} country cards. Every round reveals a category — for example "Population · higher wins" or "Area · lower wins".`, "Each player can reroll their entire hand up to three times per game, before laying a card.", "Both sides lay one card face down, then both are revealed. The better value takes the round; equal values are a tie.", "Played cards are replaced from the deck. Giants are strong, but lower-wins rounds punish them."],
      scoring: `First to ${STAT_BATTLE.winTarget} round wins takes the match. Your solo record counts 200 per round won and +1,000 for winning the match.`,
      solo: "Duel the computer. Difficulty sets how cleverly it plays.",
      multiplayer: "A live duel against one other player. You have 30 seconds to play each card, or your first card is played for you.",
      hotseat: "Two players on one device. Pass it over before each pick — each hand is shown only to its owner — then both cards are revealed together.",
    },
  },
  {
    id: "region-builder", title: "Region Builder", tagline: "Sudden death", accent: "violet", meta: "Endless · one mistake ends it",
    description: "Pick every country that belongs to the region. One wrong card and the run is over.",
    solo: { kind: "trial", trial: "region-builder" }, online: "region_builder", hotseat: "turns", options: [], bestId: "region-builder",
    rules: {
      goal: "Select every country that belongs to the named region.",
      play: ["A region such as the Nordic countries or the Maghreb appears with a spread of country cards.", "Tap its members one by one. When all are found, the next region starts.", "One wrong card ends the whole run."],
      scoring: `${REGION_BUILDER.perCountry} points per correct country, +${REGION_BUILDER.regionComplete} for completing a region, plus ${REGION_BUILDER.roundBonus} more for every region already completed.`,
      solo: "Endless: how many regions can you complete?",
      multiplayer: race, hotseat: turns("their own run"),
    },
  },
  {
    id: "stat-detective", title: "Stat Detective", tagline: "Read the numbers", accent: "emerald", meta: `${STAT_DETECTIVE.rounds} cases · ${STAT_DETECTIVE.lives} lives`,
    description: "A case file of raw statistics. Deduce which country they describe before your lives run out.",
    solo: { kind: "trial", trial: "stat-detective" }, online: "stat_detective", hotseat: "turns", options: [], bestId: "stat-detective",
    rules: {
      goal: "Work out which country a set of statistics describes.",
      play: ["Read the case file: population, area, density, land borders, highest point.", "Pick the country it describes from the suspects. A wrong suspect costs a life."],
      scoring: `${STAT_DETECTIVE.correct} per solved case plus ${STAT_DETECTIVE.streakBonus} for each case solved before it in a row (up to +${STAT_DETECTIVE.maxStreakBonus}).`,
      solo: `${STAT_DETECTIVE.rounds} cases and ${STAT_DETECTIVE.lives} lives. Difficulty sets the number of suspects.`,
      multiplayer: race, hotseat: turns(`their own ${STAT_DETECTIVE.rounds} cases`),
    },
  },
  {
    id: "guess-country-mini", title: "Guess the Country Mini Edition", tagline: "Clue by clue", accent: "cyan", meta: `${COUNTRY_GUESSER.rounds} countries · ${COUNTRY_GUESSER.lives} lives`,
    description: "One mystery country, six suspects. Reveal clues only when you need them — each extra clue lowers the prize.",
    solo: { kind: "trial", trial: "country-guesser" }, online: "country_guesser", hotseat: "turns", options: [], bestId: "country-guesser",
    rules: {
      goal: `Find the mystery country among ${COUNTRY_GUESSER.options} suspects with as few clues as possible.`,
      play: ["The first four clues are drawn in random order from a varied set of country facts. Reveal more only when you need them; the fifth keeps the decisive capital clue.", "Pick a suspect at any time. A wrong pick costs a life and rules that country out."],
      scoring: `${COUNTRY_GUESSER.pointsByClues.map((points) => points.toLocaleString("en")).join(", ")} points when solved with 1, 2, 3, 4 or 5 clues.`,
      solo: `${COUNTRY_GUESSER.rounds} countries and ${COUNTRY_GUESSER.lives} lives.`,
      multiplayer: race, hotseat: turns(`their own ${COUNTRY_GUESSER.rounds} countries`),
    },
  },
  {
    id: "extreme-geography", title: "Extreme Geography", tagline: "Fast trivia", accent: "amber", meta: `${EXTREME_GEOGRAPHY.rounds} questions · ${EXTREME_GEOGRAPHY.timeLimitMs / 1000}s each`,
    description: "Which is coldest, warmest, largest, smallest or highest? Ten seconds a question, with double-point extreme rounds.",
    solo: { kind: "trial", trial: "extreme-geography" }, online: "extreme_geography", hotseat: "turns", options: [], bestId: "extreme-geography",
    rules: {
      goal: "Pick the most extreme country: the coldest, warmest, largest, smallest, highest, most crowded…",
      play: [`Each question shows ${EXTREME_GEOGRAPHY.choices} countries and a category. Only the countries shown are compared.`, `You have ${EXTREME_GEOGRAPHY.timeLimitMs / 1000} seconds. Every ${EXTREME_GEOGRAPHY.extremeEvery}th question is an Extreme round with ${EXTREME_GEOGRAPHY.extremeChoices} countries.`],
      scoring: `${EXTREME_GEOGRAPHY.correct} per correct answer plus up to ${EXTREME_GEOGRAPHY.maxSpeedBonus} for speed; Extreme rounds count ×${EXTREME_GEOGRAPHY.extremeMultiplier}.`,
      solo: `${EXTREME_GEOGRAPHY.rounds} questions.`,
      multiplayer: race, hotseat: turns(`their own ${EXTREME_GEOGRAPHY.rounds} questions`),
    },
  },
  {
    id: "territory-battle", title: "Territory Battle", tagline: "Command a frontier", accent: "rose", meta: "6 cycles · supplied borders · strategic hubs",
    description: "Plan attacks and defenses across a connected regional map. Geographic knowledge makes your orders succeed.",
    solo: { kind: "arena", mode: "territory_battle" }, online: "territory_battle", hotseat: "territory", options: [], bestId: "territory-battle",
    rules: {
      goal: "Earn the most influence at the end of six cycles.",
      play: ["Choose a neighboring country to attack from your supplied frontier, or an owned country to defend.", "Solve a capital, border or currency challenge to execute your order. Homes cannot be captured.", "A correct defense blocks an attack. If both solve the same neutral target, ownership does not change."],
      scoring: "One influence per country; strategic hubs count as three. Navigation speed gives no advantage.",
      solo: "Six cycles against a rival commander. The rival chooses before seeing your order and has knowledge calibrated to your difficulty.",
      multiplayer: "Two players issue hidden simultaneous orders. Each cycle allows 40 seconds to plan and answer; both orders then resolve together.",
      hotseat: "Two players issue hidden orders behind handoff screens. Both finish their knowledge challenge before the cycle resolves.",
    },
  },
  {
    id: "speed-run", title: "Speed Run", tagline: "60-second sprint", accent: "amber", meta: "60 seconds · +150 / −150",
    description: "Answer as many choice questions as you can in 60 seconds, without a map.",
    solo: { kind: "arena", mode: "speed_run" }, online: "speed_run", hotseat: "turns", options: ["categories"], bestId: "speed-run",
    rules: {
      goal: "Answer as many questions as you can in 60 seconds.",
      play: ["Questions use choice buttons from your chosen categories. No map navigation is needed.", "Answer quickly and keep going until the clock runs out."],
      scoring: `+${ATLAS_SCORING.speedRunCorrect} per correct answer; ${ATLAS_SCORING.speedRunWrong} per wrong answer.`,
      solo: "One 60-second sprint.",
      multiplayer: race, hotseat: turns("their own 60 seconds"),
    },
  },
  {
    id: "language-guesser", title: "Language Guesser", tagline: "Read the sentence", accent: "violet", meta: `${LANGUAGE_GUESSER.rounds} sentences · 6 options`,
    description: "Read an everyday greeting and identify its language from six choices.",
    solo: { kind: "trial", trial: "language-guesser" }, online: "language_guesser", hotseat: "turns", options: [], bestId: "language-guesser",
    rules: {
      goal: "Identify the language of each sentence.",
      play: ["Read the sentence in its original script.", "Choose one of six language names. Each sentence has one answer."],
      scoring: `+${LANGUAGE_GUESSER.correct} for a correct answer; wrong answers score zero.`,
      solo: `${LANGUAGE_GUESSER.rounds} sentences. Harder levels offer more choices written in the same script.`,
      multiplayer: race, hotseat: turns(`their own ${LANGUAGE_GUESSER.rounds} sentences`),
    },
  },
  {
    id: "map-fill", title: "Map Fill", tagline: "No labels", accent: "emerald", meta: "7 regions · auto-zoom",
    description: "Fill every country in a region with no labels to guide you. The map zooms to your region.",
    solo: { kind: "arena", mode: "map_fill" }, online: "map_fill", hotseat: "turns", options: ["scope"], bestId: "map-fill",
    rules: {
      goal: "Find every country of a region on an unlabelled map.",
      play: ["Choose a region; the map zooms to it automatically.", "You are asked for one country at a time. Click it to fill it in.", "Wrong clicks count as mistakes and break your streak."],
      scoring: `${ATLAS_SCORING.mapFillCountry} per country plus ${ATLAS_SCORING.mapFillStreak} × your current streak, and ${ATLAS_SCORING.mapFillCompletion.toLocaleString("en")} for completing the region.`,
      solo: "Fill the whole region; your time is shown at the end.",
      multiplayer: `${race} Everyone fills the same region in the same order.`,
      hotseat: turns("the same region"),
    },
  },
];

export const modeById = (id: string | undefined) => ARENA_MODES.find((mode) => mode.id === id);
export const modeForOnline = (online: string | null | undefined) => ARENA_MODES.find((mode) => mode.online === online);
export const onlinePlayerLimit = (mode: ArenaModeDef) => maxPlayersFor(mode.online);
export const hotseatPlayerLimit = (mode: ArenaModeDef) => mode.hotseat === "territory" || mode.hotseat === "duel" ? 2 : 4;
/** Old Atlas Trials links (/trials/country-guesser …) lead to the same mode here. */
export const modeForTrial = (trial: string | undefined) => ARENA_MODES.find((mode) => mode.solo.kind === "trial" && mode.solo.trial === trial);
