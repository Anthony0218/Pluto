/**
 * Built-in templates. Each one is an ordinary GameDefinition — the engine has
 * no idea which game it is running.
 */
import type { GameDefinition } from "../engine/types.ts";
import { blankTemplate } from "./blank.ts";
import { durakTemplate } from "./durak.ts";
import { highCardBattleTemplate } from "./highCardBattle.ts";
import { kingsAndSevensTemplate } from "./kingsAndSevens.ts";
import { pokerTemplate } from "./poker.ts";

export interface TemplateInfo {
  id: string;
  definition: GameDefinition;
  tagline: string;
  /** Hand-written highlights for "How this template is configured". */
  highlights: string[];
  /** Developer fixtures are listed after the main templates. */
  fixture?: boolean;
}

export const TEMPLATES: TemplateInfo[] = [
  {
    id: blankTemplate.id,
    definition: blankTemplate,
    tagline: "Start from a tiny playable skeleton.",
    highlights: [
      "Three zones: a hidden draw pile, a public discard pile, and a private hand per player.",
      "One repeating “Turn” phase with two actions (play or draw), each ending the turn with the generic endTurn effect.",
      "A single end condition: the first player whose hand is empty wins.",
    ],
  },
  {
    id: durakTemplate.id,
    definition: durakTemplate,
    tagline: "Attack, defend, throw in — don't be the fool.",
    highlights: [
      "Roles carry the game: attacker, defender and thrower are assigned by generic assignRole effects (the defender is “the next active player after the attacker”).",
      "Setup reveals the next card, slides it face up under the draw pile and derives trump from it with setTrumpSuit — so it is naturally the last card drawn.",
      "Beating a card is a defendCard action whose card condition is (same suit AND higher rank) OR (trump AND target not trump). Both-trump cases fall into the first branch.",
      "Covered attack cards get a “covered” mark; the defend phase ends when no uncovered attack card is left and every thrower has passed.",
      "Throw-ins use the reusable “rank already on the table” condition and are capped by the max-attack setting and the defender's hand size.",
      "Auto-pass: players whose only option is “Done” pass automatically, so the table never waits for someone with nothing to add.",
      "Refill draws attacker first and defender last (a player set ordered by role). Once the pile is gone, empty-handed players finish; “Only one player is left — that player loses” ends the game.",
      "The deck is the 36-card version (6 to Ace): the deck section simply includes the 6s and puts them lowest in the rank order.",
    ],
  },
  {
    id: pokerTemplate.id,
    definition: pokerTemplate,
    tagline: "Hold'em with 36 cards. A flush beats a full house.",
    highlights: [
      "Chips are the player score; the pot, the bet to match and the raise count are game variables. Every chip movement is ordinary arithmetic in effects (min, sub, div).",
      "Check, call, bet, raise and fold are parameterless actions. Their conditions decide when each button appears (e.g. “call” only when you have put in less than the current bet).",
      "Being “in the hand” is a role: folding removes it, and the turn passes to the next player who still has the role and chips (endTurn with a filter).",
      "A betting round ends when every player in the hand has acted and matched the bet, or is all-in — the same “everyone passed” pattern Durak uses for throw-ins. A bet or raise clears the others' passes.",
      "Hand strength is a list of declarative card combinations (pairs, runs, same-suit groups), weakest first. Short-deck rules just reorder the list so the flush sits above the full house; an Ace may count low in A-6-7-8-9.",
      "The showdown phase reveals the hands and runs “Find the best hand”, which gives the winner role (ties share it). The payout splits the pot with integer division; odd chips stay for the next hand.",
      "Busted players are eliminated; the game ends when one player has all the chips or after the hand limit (most chips wins).",
    ],
  },
  {
    id: highCardBattleTemplate.id,
    definition: highCardBattleTemplate,
    tagline: "Flip, compare, collect. Ties start a battle.",
    highlights: [
      "Each player has a private draw stack, a public battle spot and a captured pile (zones owned by every player).",
      "Reveal is a parameterless action anyone may take once per round (a per-player “revealed” variable); the phase moves on when every player has revealed.",
      "Compare is automatic: priority-10 rules set the round winner when one top card ranks higher; a priority-0 rule flags a tie.",
      "Resolve is automatic and reads lobby settings: a tie either adds face-down cards and goes back to Reveal (repeatable battles), returns the cards, or discards them.",
      "A ZONE_EMPTY rule shuffles a player's captured pile back into their stack when it runs out (only used with “captured pile” collection).",
      "End conditions: one player holds every card, the opponent cannot continue a battle, or the round limit picks the player with more cards.",
    ],
  },
  {
    id: kingsAndSevensTemplate.id,
    definition: kingsAndSevensTemplate,
    tagline: "Developer fixture: rule priority and scoring.",
    fixture: true,
    highlights: [
      "Priority 100: a 7 beats an Ace or King. Priority 50: a King beats everything else. Priority 10: the higher card wins. Each stops lower rules once it fires.",
      "Scoring uses a computed value: 1 + the number of hearts on the table (countWhere).",
      "FIRST_TO_SCORE ends the game at the target score.",
    ],
  },
];

export function findTemplate(id: string): TemplateInfo | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export { blankTemplate, durakTemplate, highCardBattleTemplate, kingsAndSevensTemplate, pokerTemplate };
