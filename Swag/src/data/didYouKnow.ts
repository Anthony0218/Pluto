export type DidYouKnowFact = { id: string; category: "chess" | "variant" | "nature" | "geography" | "cards" | "strategy"; text: string; gameRoute?: string; enabled: boolean };
const facts: Omit<DidYouKnowFact, "id" | "enabled">[] = [
  { category: "chess", text: "A knight is the only standard chess piece that can jump over other pieces.", gameRoute: "/games/chess" },
  { category: "chess", text: "Castling is the only standard chess move in which two pieces move on one turn.", gameRoute: "/games/chess" },
  { category: "chess", text: "A pawn can promote when it reaches the opposite end of the board.", gameRoute: "/games/chess" },
  { category: "chess", text: "Stalemate is a draw, even when one player has a winning material advantage.", gameRoute: "/games/chess" },
  { category: "chess", text: "The queen combines the movement patterns of a rook and a bishop.", gameRoute: "/games/chess" },
  { category: "chess", text: "A bishop stays on the same color of square for its entire game.", gameRoute: "/games/chess" },
  { category: "chess", text: "En passant is available only immediately after a qualifying two-square pawn move.", gameRoute: "/games/chess" },
  { category: "chess", text: "Controlling the center often gives your pieces more room to move.", gameRoute: "/games/chess" },
  { category: "chess", text: "A knight in the center can reach more squares than a knight on the edge.", gameRoute: "/games/chess" },
  { category: "chess", text: "Connected passed pawns can be especially dangerous in an endgame.", gameRoute: "/games/chess" },
  { category: "chess", text: "The king becomes an important active piece in many endgames.", gameRoute: "/games/chess" },
  { category: "chess", text: "Checkmate ends the game; the king is never actually captured.", gameRoute: "/games/chess" },
  { category: "chess", text: "An open file can give a rook a powerful route into the opponent's position.", gameRoute: "/games/chess" },
  { category: "chess", text: "Doubled pawns can be weak, but the open files they create may also be useful.", gameRoute: "/games/chess" },
  { category: "chess", text: "Chess puzzles help train tactical pattern recognition.", gameRoute: "/games/chess/puzzles" },
  { category: "variant", text: "In Tectonic Chess, a changing board orientation makes familiar positions feel new.", gameRoute: "/games/chess/variants" },
  { category: "variant", text: "Chess Roulette rewards players who adapt to unexpected outcomes.", gameRoute: "/games/chess/variants" },
  { category: "variant", text: "Hot Potato Chess adds a bomb to your normal tactical calculations.", gameRoute: "/games/chess/variants" },
  { category: "variant", text: "Chess Collapse changes the playable board, so space becomes precious.", gameRoute: "/games/chess/variants" },
  { category: "variant", text: "Mutation Chess can change a piece's role during a game.", gameRoute: "/games/chess/variants" },
  { category: "variant", text: "Chess Market adds resource decisions beyond ordinary chess material.", gameRoute: "/games/chess/variants" },
  { category: "nature", text: "Octopuses have three hearts.", gameRoute: "/games/natura" },
  { category: "nature", text: "A group of flamingos is commonly called a flamboyance.", gameRoute: "/games/natura" },
  { category: "nature", text: "Cheetahs are the fastest land animals over short distances.", gameRoute: "/games/natura" },
  { category: "nature", text: "Sea otters sometimes use rocks to open shellfish.", gameRoute: "/games/natura" },
  { category: "nature", text: "Ravens can solve complex problems.", gameRoute: "/games/natura" },
  { category: "nature", text: "Elephants use very low-frequency sounds to communicate across long distances.", gameRoute: "/games/natura" },
  { category: "nature", text: "Axolotls can regenerate limbs and several other tissues.", gameRoute: "/games/natura" },
  { category: "nature", text: "Honeybees use a waggle dance to communicate information about food locations.", gameRoute: "/games/natura" },
  { category: "nature", text: "Some penguin species breed through harsh Antarctic winters.", gameRoute: "/games/natura" },
  { category: "nature", text: "Wolves usually live in family groups.", gameRoute: "/games/natura" },
  { category: "nature", text: "Dolphins use individually distinctive signature whistles.", gameRoute: "/games/natura" },
  { category: "nature", text: "Chameleons change color for communication and temperature control as well as camouflage.", gameRoute: "/games/natura" },
  { category: "nature", text: "Some corvids can remember individual human faces.", gameRoute: "/games/natura" },
  { category: "nature", text: "Many migratory birds use environmental cues including Earth's magnetic field.", gameRoute: "/games/natura" },
  { category: "geography", text: "Africa is crossed by both the Equator and the Prime Meridian.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "Russia spans eleven time zones.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "Canada has the world's longest coastline.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "The Nile and Amazon are both among the world's longest rivers; exact rankings depend on how they are measured.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "Mount Everest is Earth's highest mountain above mean sea level.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "The Pacific is Earth's largest ocean.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "Vatican City is the smallest independent state by area.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "Indonesia is made up of thousands of islands.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "The Sahara is Earth's largest hot desert.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "Antarctica is a desert because it receives very little precipitation.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "Lake Baikal is the world's deepest freshwater lake.", gameRoute: "/games/atlas-arena" },
  { category: "geography", text: "The Andes form the longest continental mountain range.", gameRoute: "/games/atlas-arena" },
  { category: "cards", text: "Trick-taking games are built around winning individual rounds called tricks.", gameRoute: "/games/schafkopf" },
  { category: "cards", text: "Remembering played cards is a valuable skill in many traditional card games.", gameRoute: "/games/watten" },
  { category: "cards", text: "Schafkopfen has a strong cultural association with Bavaria.", gameRoute: "/games/schafkopf" },
  { category: "cards", text: "Watten is traditionally played in parts of the Alpine region.", gameRoute: "/games/watten" },
  { category: "cards", text: "Team card games reward reading legal play patterns and tracking tricks.", gameRoute: "/games/schafkopf" },
  { category: "strategy", text: "Playing different strategy games exposes you to different kinds of patterns.", gameRoute: "/games" },
  { category: "strategy", text: "A tactic addresses an immediate position; a strategy guides longer-term choices.", gameRoute: "/games" },
  { category: "strategy", text: "Perfect-information games reveal the full game state; hidden-information games keep part of it secret.", gameRoute: "/games" },
  { category: "strategy", text: "Randomness makes players weigh possible outcomes instead of a single fixed future.", gameRoute: "/games" },
  { category: "strategy", text: "Competitive ratings should be based on completed ranked matches.", gameRoute: "/games/chess" },
  { category: "strategy", text: "Puzzle difficulty and player rating measure different things.", gameRoute: "/games/chess/puzzles" },
  { category: "strategy", text: "A leaderboard is clearest when it ranks one specific achievement.", gameRoute: "/games" },
  { category: "strategy", text: "Understanding why a move failed can teach more than replaying the answer.", gameRoute: "/games/chess/puzzles" },
];

export const didYouKnowFacts: DidYouKnowFact[] = facts.map((fact, index) => ({ ...fact, id: `fact-${String(index + 1).padStart(2, "0")}`, enabled: true }));

export function dailyFacts(date: string, count = 5): DidYouKnowFact[] {
  const active = didYouKnowFacts.filter(fact => fact.enabled);
  const seed = [...date].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  const shuffle = [...active];
  let state = seed || 1;
  for (let i = shuffle.length - 1; i > 0; i--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    [shuffle[i], shuffle[j]] = [shuffle[j], shuffle[i]];
  }
  return shuffle.slice(0, count);
}
