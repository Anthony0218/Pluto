/**
 * Kings & Sevens — a small developer fixture proving rule priority and
 * scoring. Same flow as High Card Battle, but the compare phase has special
 * rules layered above the general "higher card wins" rule:
 *
 *   priority 100  a 7 beats an Ace or a King
 *   priority 50   a King beats everything else
 *   priority 10   otherwise the higher card wins
 *
 * The round winner scores 1 point plus 1 per heart among the won cards.
 * First to 20 points wins.
 */
import type { ConditionNode, GameDefinition, RuleDefinition } from "../engine/types.ts";
import { higherCardRules, highCardBattleTemplate, tieRule } from "./highCardBattle.ts";

const top = (seat: number) => ({ top: { zone: "table", player: { seat } } });
const isCompare: ConditionNode = { type: "phaseEquals", phase: "compare" };

const specialRules: RuleDefinition[] = [0, 1].flatMap((seat): RuleDefinition[] => [
  {
    id: `seven-topples-seat-${seat + 1}`,
    name: `7 beats Ace and King (seat ${seat + 1})`,
    trigger: "PHASE_STARTED",
    priority: 100,
    stopProcessing: true,
    condition: { type: "and", children: [isCompare, { type: "rankEquals", card: top(seat), rank: "7" }, { type: "rankIn", card: top(1 - seat), ranks: ["A", "K"] }] },
    effects: [{ type: "setVariable", var: "roundWinner", value: { player: { seat } } }],
  },
  {
    id: `king-rules-seat-${seat + 1}`,
    name: `King beats everything except 7 (seat ${seat + 1})`,
    trigger: "PHASE_STARTED",
    priority: 50,
    stopProcessing: true,
    condition: {
      type: "and",
      children: [isCompare, { type: "rankEquals", card: top(seat), rank: "K" }, { type: "not", child: { type: "rankIn", card: top(1 - seat), ranks: ["K", "7"] } }],
    },
    effects: [{ type: "setVariable", var: "roundWinner", value: { player: { seat } } }],
  },
]);

const hearts = { countWhere: { zone: "table", player: "all" as const }, where: { type: "suitEquals", card: "each", suit: "hearts" } as ConditionNode };

export const kingsAndSevensTemplate: GameDefinition = {
  ...structuredClone(highCardBattleTemplate),
  id: "kings-and-sevens",
  templateId: "kings-and-sevens",
  name: "Kings & Sevens",
  description: "High Card Battle with special rules: 7 topples Aces and Kings, Kings beat the rest, hearts are worth points. First to 20.",
  settings: [
    { key: "targetScore", label: "Points to win", type: "integer", default: 20, min: 5, max: 60 },
    { key: "shuffleWinnings", label: "Shuffle won cards", type: "boolean", default: true },
  ],
  rules: [
    ...specialRules,
    ...higherCardRules(10),
    tieRule,
  ],
  phases: highCardBattleTemplate.phases.map((phase) =>
    phase.id !== "resolve"
      ? structuredClone(phase)
      : {
          ...structuredClone(phase),
          description: "The winner scores (1 + hearts won) and puts the cards under their stack; ties go back.",
          onEnter: [
            {
              type: "if",
              condition: { type: "compare", left: { var: "tied" }, op: "eq", right: true },
              then: [{ type: "forEachPlayer", effects: [{ type: "moveCards", from: { zone: "table", player: "each" }, to: { zone: "stack", player: "each" }, position: "bottom" }] }],
              else: [
                { type: "incrementScore", player: { var: "roundWinner" }, amount: { add: [1, hearts] } },
                { type: "awardCards", from: [{ zone: "table", player: "all" }], player: { var: "roundWinner" }, to: "stack", position: "bottom", shuffle: { setting: "shuffleWinnings" } },
                { type: "endRound" },
                { type: "startRound" },
              ],
            },
          ],
        },
  ),
  endConditions: [
    { id: "target", type: "FIRST_TO_SCORE", label: "First to the target score", target: { setting: "targetScore" } },
    { id: "out-of-cards", type: "LAST_ACTIVE_PLAYER", label: "Opponent ran out of cards", outcome: "lastWins" },
  ],
  events: [{ type: "PHASE_STARTED", description: "Comparison rules run by priority: 100 (7 beats A/K), 50 (King), 10 (higher card), 0 (tie)." }],
  rulebook: {
    overview: "A scoring twist on High Card Battle that shows off rule priorities.",
    setup: "Shuffle and split the 32 cards into two face-down stacks.",
    gameplay: "Reveal top cards together. A 7 beats an Ace or a King. A King beats every other card. Otherwise the higher card wins; equal ranks go back under their stacks. The winner scores 1 point plus 1 for every heart in the won cards, then puts the cards under their stack.",
    winning: "First to 20 points (configurable) wins. A player who runs out of cards loses.",
  },
};
