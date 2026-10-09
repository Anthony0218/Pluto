import { ATLAS_SCORING, GUESS_SCORING } from "./config.ts";
import type { AtlasMultiplayerMode } from "./multiplayer.ts";
import { EXTREME_GEOGRAPHY, REGION_BUILDER, STAT_BATTLE, STAT_DETECTIVE, STAT_RANKING } from "./trials/config.ts";
import { HISTORY_BATTLE, HISTORY_SOURCE } from "./trials/historyBattle.ts";
import { LANGUAGE_GUESSER } from "./trials/languageGuesser.ts";
import type { AtlasMode } from "./types.ts";

/**
 * Every Atlas Arena mode in menu order. Local-only modes are excluded from online selection;
 * this table says which engine runs each of the three, and holds the rules shown on the menu.
 */
export type ArenaModeId =
  | "map-battle" | "higher-lower" | "guess-country" | "flag-battle" | "stat-ranking" | "stat-battle"
  | "region-builder" | "stat-detective" | "extreme-geography" | "history-battle" | "map-fill" | "language-guesser";
export type TrialKind = "country-guesser" | "stat-detective" | "region-builder" | "stat-ranking" | "extreme-geography" | "stat-battle" | "language-guesser" | "history-battle";
export type ModeAccent = "cyan" | "amber" | "violet" | "emerald" | "rose" | "sky";
/** turns: each player plays their own run in turn · pins / duel: everyone plays the same rounds on one screen. */
export type HotseatKind = "turns" | "pins" | "duel";
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

const race = "Online uses a bounded, shared deck, a 3-minute limit, and server-graded answers. Runs resume after reconnecting. Ordinary correct answers earn 1,000, wrong answers zero; ranking uses partial placement credit, clues lower the award.";
const turns = (what: string) => `2–4 players share one device and take turns, each playing ${what}. Pass the device when your run ends — the highest score wins.`;
const knowledge = `${ATLAS_SCORING.normalCorrect.toLocaleString("en")} points for a correct answer before time runs out. Only Ranked can add a speed bonus`;

export const ARENA_MODES: ArenaModeDef[] = [
  {
    id: "map-battle", title: "Map Battle", tagline: "Know the world", accent: "cyan", meta: "10 rounds · countries & pins",
    description: "Find countries and drop pins near countries or capitals. Confirm your selection before locking it in.",
    solo: { kind: "arena", mode: "map_click" }, online: "map_battle", hotseat: "turns", options: ["categories"], bestId: "map-battle",
    rules: {
      goal: "Locate countries and capitals in a mix of selection and closest-pin rounds.",
      play: ["Selection rounds: tap a country to preview it, then tap it again or Confirm selection to answer.", "Zoom with the buttons or the mouse wheel; very small states are drawn as dots.", "Pin rounds: place and adjust a pin, then submit. Country borders and a 20 km capital radius count as zero distance."],
      scoring: `${knowledge}. Wrong selections score nothing. Solo pins earn up to 1,000 by distance; online, the closest pins share 1,000 with no speed advantage.`,
      solo: "10 mixed map rounds with 30 seconds per answer. Difficulty sets the country pool.",
      multiplayer: "2–4 players answer the same question at once with 30 seconds on the clock. Every correct selection scores; the closest pins win pin rounds. Only Ranked awards speed bonuses on selections.",
      hotseat: turns("their own 10 questions"),
    },
  },
  {
    id: "higher-lower", title: "Higher or Lower", tagline: "Keep the streak", accent: "amber", meta: "Streak · one miss ends it",
    description: "Countries, cities, continents and subregions: population, area, highest peaks and more. Is the next one higher or lower?",
    solo: { kind: "arena", mode: "higher_lower" }, online: "higher_lower", hotseat: "turns", options: ["stats"], bestId: "higher-lower",
    rules: {
      goal: "Decide whether the second subject has a higher or lower value than the first.",
      play: ["Two subjects share a statistic, such as population, area or highest point.", "The first value is shown. Choose Higher or Lower for the second.", "The revealed card becomes the next comparison."],
      scoring: `${knowledge}.`,
      solo: "Keep your streak going as long as you can. One wrong call ends the run.",
      multiplayer: "10 comparisons for 2–4 players. Everyone answers every round, so a miss only costs that round.",
      hotseat: turns("their own streak"),
    },
  },
  {
    id: "guess-country", title: "Guess the Country", tagline: "Tip by tip", accent: "violet", meta: "8 countries · 5 tips each",
    description: "A new tip every round — numbers, summits, a sentence overheard on the street. Solve it with fewer clues for bonus points.",
    solo: { kind: "arena", mode: "guess_country" }, online: "guess_country", hotseat: "turns", options: [], bestId: "guess-country",
    rules: {
      goal: "Name the mystery country from four random tips and a final flag reveal.",
      play: ["The first four tips are drawn in random order from population, geography, languages, currency and other facts. The fifth tip always shows the flag.", "Choose from six suspects, search for a country or select it on the map, then submit. You have one guess per tip.", "A wrong guess reveals the next tip; alone you can also reveal it yourself for a smaller clue award. Online, pass to reveal once everyone answers. After the last tip the answer is shown."],
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
      scoring: `${knowledge}.`,
      solo: "12 rounds.",
      multiplayer: "10 rounds for 2–4 players with 20 seconds each; only Ranked awards speed bonuses.",
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
    id: "stat-battle", title: "Stat Battle", tagline: "Card duel", accent: "amber", meta: `First to ${STAT_BATTLE.winTarget} · vs AI or friends`,
    description: "Hold a hand of countries, read the category, and play the card you think wins. Spend giants wisely.",
    solo: { kind: "trial", trial: "stat-battle" }, online: "stat_battle", hotseat: "duel", options: [], bestId: "stat-battle",
    rules: {
      goal: `Be the first to win ${STAT_BATTLE.winTarget} rounds of a country card duel.`,
      play: [`Each side holds ${STAT_BATTLE.handSize} country cards. Every round reveals a category — for example "Population · higher wins" or "Area · lower wins".`, "Each player can reroll their entire hand up to three times per game, before laying a card.", "Everyone lays one card face down, then all are revealed. The best value takes the round; if the best value is shared, nobody scores.", "Played cards are replaced from the deck. Giants are strong, but lower-wins rounds punish them."],
      scoring: `First to ${STAT_BATTLE.winTarget} round wins takes the match. Your solo record counts 200 per round won and +1,000 for winning the match.`,
      solo: "Duel the computer. Difficulty sets how cleverly it plays.",
      multiplayer: "2–4 players at one live table: a duel for two, a free-for-all for three or four. You have 30 seconds to play each card, or your first card is played for you.",
      hotseat: "2–4 players on one device. Pass it over before each pick — each hand is shown only to its owner — then all cards are revealed together.",
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
      multiplayer: "Singleplayer and Hotseat only.", hotseat: turns("their own run"),
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
    id: "extreme-geography", title: "Extreme Geography", tagline: "Fast trivia", accent: "amber", meta: `${EXTREME_GEOGRAPHY.rounds} questions · ${EXTREME_GEOGRAPHY.timeLimitMs / 1000}s each`,
    description: "Which is coldest, warmest, largest, smallest or highest? Ten seconds a question, with double-point extreme rounds.",
    solo: { kind: "trial", trial: "extreme-geography" }, online: "extreme_geography", hotseat: "turns", options: [], bestId: "extreme-geography",
    rules: {
      goal: "Pick the most extreme country: the coldest, warmest, largest, smallest, highest, most crowded…",
      play: [`Each question shows ${EXTREME_GEOGRAPHY.choices} countries and a category. Only the countries shown are compared.`, `You have ${EXTREME_GEOGRAPHY.timeLimitMs / 1000} seconds. Every ${EXTREME_GEOGRAPHY.extremeEvery}th question is an Extreme round with ${EXTREME_GEOGRAPHY.extremeChoices} countries.`],
      scoring: `${EXTREME_GEOGRAPHY.correct} per correct answer with no speed bonus; Extreme rounds count ×${EXTREME_GEOGRAPHY.extremeMultiplier}.`,
      solo: `${EXTREME_GEOGRAPHY.rounds} questions.`,
      multiplayer: race, hotseat: turns(`their own ${EXTREME_GEOGRAPHY.rounds} questions`),
    },
  },
  {
    id: "history-battle", title: "History Battle", tagline: "Dates & empires", accent: "rose", meta: `${HISTORY_BATTLE.rounds} questions · ${HISTORY_BATTLE.options} options`,
    description: "Independence days, fallen empires and the names countries left behind. How well do you know how the map was made?",
    solo: { kind: "trial", trial: "history-battle" }, online: "history_battle", hotseat: "turns", options: [], bestId: "history-battle",
    rules: {
      goal: "Answer questions about how and when countries came to be.",
      play: ["Each question is about a country's past: the year it became independent, the power it broke away from, a founding event, or a name it used to carry.", `Pick one of ${HISTORY_BATTLE.options} options. Some questions name the country; in others the countries are the options.`, `After each answer you see the record behind it. Facts come from ${HISTORY_SOURCE} and an attributed United Nations record for Palestine.`],
      scoring: `${HISTORY_BATTLE.correct} points per correct answer plus ${HISTORY_BATTLE.streakBonus} for each correct answer in a row before it (up to +${HISTORY_BATTLE.maxStreakBonus}). Wrong answers score zero.`,
      solo: `${HISTORY_BATTLE.rounds} questions. Beginner sticks to well-known countries and widely spaced years; Expert adds founding dates and years only a few apart.`,
      multiplayer: race, hotseat: turns(`their own ${HISTORY_BATTLE.rounds} questions`),
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
      multiplayer: "Singleplayer and Hotseat only.",
      hotseat: turns("the same region"),
    },
  },
];

export const isOnlineMode = (mode: ArenaModeDef) => mode.id !== "map-fill" && mode.id !== "region-builder";
export const ONLINE_ARENA_MODES = ARENA_MODES.filter(isOnlineMode);
export const modeById = (id: string | undefined) => ARENA_MODES.find((mode) => mode.id === (id === "closest-wins" ? "map-battle" : id === "guess-country-mini" ? "guess-country" : id));
export const modeForOnline = (online: string | null | undefined) => ARENA_MODES.find((mode) => mode.online === (online === "closest_wins" ? "map_battle" : online === "country_guesser" ? "guess_country" : online));
/** Old Atlas Trials links (/trials/country-guesser …) lead to the same mode here. */
export const modeForTrial = (trial: string | undefined) => trial === "country-guesser" ? modeById("guess-country") : ARENA_MODES.find((mode) => mode.solo.kind === "trial" && mode.solo.trial === trial);
