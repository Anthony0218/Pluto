import { applyGoMove, createInitialGoState, hashGoBoard, type GoMove, type GoState } from "./rules.ts";

export type GoLesson = { id: string; label: string; title: string; body: string; initial: GoState; moves: GoMove[]; captions: string[]; target?: number; blocked?: GoMove };
function position(black: number[], white: number[], player: "black" | "white" = "black") {
  const state = createInitialGoState(9);
  black.forEach(index => state.board[index] = "black");
  white.forEach(index => state.board[index] = "white");
  state.currentPlayer = player;
  state.positionHashes = [hashGoBoard(state.board)];
  return state;
}
const place = (row: number, col: number): GoMove => ({ type: "place", row, col });
const ko = position([12, 20, 30], [13, 21, 23, 31]);
const koCapture = applyGoMove(ko, place(2, 4));
export const goLessons: GoLesson[] = [
  { id: "turns", label: "Turns", title: "Play on intersections", body: "Black starts. Place one stone on an empty intersection, then White plays. Stones stay where they are placed.", initial: createInitialGoState(), moves: [place(2, 2), place(6, 6), place(2, 6)], captions: ["Black to play.", "Black claims C7. White's turn.", "White answers at G3.", "Black expands at G7."] },
  { id: "liberties", label: "Liberties", title: "Connected stones share breathing space", body: "A liberty is an empty point directly above, below, left or right of a stone. Diagonals do not connect. A group with one liberty is in atari.", initial: position([40], [], "white"), moves: [place(3, 4), place(4, 5), place(5, 4)], target: 40, captions: ["The marked stone has four liberties.", "White removes one liberty.", "Black connects. Both stones share the group's liberties.", "White reduces the group's liberties again."] },
  { id: "capture", label: "Capture", title: "Fill the last liberty", body: "When your move removes an enemy group's last liberty, every stone in that group is captured. The newly empty points become liberties.", initial: position([31, 39, 41], [40]), moves: [place(5, 4)], target: 40, captions: ["White is in atari. E4 is its last liberty.", "Black plays E4. The white stone is captured."] },
  { id: "groups", label: "Groups", title: "Capture the entire group", body: "Connected stones live and die together. Filling a group's final liberty removes all its stones at once.", initial: position([31, 32, 39, 42, 49], [40, 41]), moves: [place(5, 5)], target: 40, captions: ["Two white stones share one remaining liberty at F4.", "F4 captures both white stones."] },
  { id: "suicide", label: "Suicide", title: "A stone needs a liberty", body: "You cannot place a stone that leaves your own group with no liberties. Captures happen first, so a move that captures an opponent may create the liberty it needs.", initial: position([], [31, 39, 41, 49]), moves: [], blocked: place(4, 4), captions: ["Black cannot play E5: no liberties and no capture. Try the marked intersection."] },
  { id: "ko", label: "Ko", title: "Do not repeat a position", body: "This game uses positional superko: a placement cannot recreate any earlier board position. In a ko fight, play elsewhere before trying to recapture.", initial: koCapture, moves: [], blocked: place(2, 3), captions: ["Black just captured D7 by playing E7. White cannot immediately recapture at D7: that would repeat the previous board."] },
  { id: "score", label: "Scoring", title: "Stones plus surrounded territory", body: "Chinese area scoring counts stones and empty points surrounded only by your colour. White adds 6.5 komi. Two consecutive passes start scoring review: tap any dead group to mark it, then confirm the result. Online ranked matches use the server's immediate area score.", initial: position([0, 1, 2, 9, 11, 18, 19, 20], [60, 61, 62, 69, 71, 78, 79, 80]), moves: [{ type: "pass" }, { type: "pass" }], captions: ["Each side has eight stones and one surrounded point. The open outside region is neutral.", "Black passes. White can still play.", "White passes. Black: 9. White: 15.5 including komi. White wins by 6.5."] },
];
