import { createId } from "../engine/presets.ts";
import type { EventActionType, EventTriggerType, GameEvent } from "../engine/types.ts";

/* Human-readable names for the event builder and rule summaries. */

export const TRIGGER_LABELS: Record<EventTriggerType, string> = {
  gameStart: "The game starts",
  turnStart: "A turn starts",
  turnEnd: "A turn ends",
  pieceMove: "A piece moves",
  pieceCapture: "A piece captures",
  pieceCaptured: "A piece is captured",
  kingCaptured: "A king is captured",
  pieceEnterSquare: "A piece enters a square",
  pieceLeaveSquare: "A piece leaves a square",
  promotion: "A piece promotes",
  afterTurnNumber: "Turn number is reached",
  pieceCountEquals: "Total pieces reach a count",
  teamPieceCountEquals: "A team's pieces reach a count",
  onlyKingsRemain: "Only kings remain",
  tileEntered: "A piece enters a tile type",
};

export const ACTION_LABELS: Record<EventActionType, string> = {
  spawnPiece: "Spawn piece",
  removePiece: "Remove piece",
  transformPiece: "Transform piece",
  movePiece: "Move piece",
  teleportPiece: "Teleport piece",
  changeTeam: "Change team",
  changePieceRule: "Change piece rule",
  changeTile: "Change tile",
  disableTile: "Disable tile",
  enableTile: "Enable tile",
  triggerAnimation: "Trigger animation",
  displayMessage: "Display message",
  addTurn: "Add a turn",
  skipTurn: "Skip a turn",
  endGame: "End game (material decides)",
  declareWinner: "Declare winner",
  declareLoser: "Declare loser",
  declareDraw: "Declare draw",
  setRoyalMode: "Change king rule",
  suddenDeath: "Sudden death",
};

export function newEvent(): GameEvent {
  return {
    id: createId("event"),
    name: "New event",
    enabled: true,
    trigger: { type: "pieceCaptured", team: "any" },
    delayTurns: 0,
    conditionMode: "all",
    conditions: [],
    actions: [{ id: createId("act"), type: "displayMessage", message: "Something happened!" }],
    elseActions: [],
    once: false,
  };
}

