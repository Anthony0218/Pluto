import { FEEDBACK_HISTORY } from "../config.ts";
import type { FeedbackEvent, Match } from "../types.ts";

export function log(state: Match, message: string) {
  state.log = [message, ...state.log].slice(0, 35);
}
// Records a structured notification and mirrors it to the text dispatch feed.
export function emit(state: Match, event: Omit<FeedbackEvent, "id">) {
  state.eventSeq++;
  state.events = [...state.events, { ...event, id: state.eventSeq }].slice(
    -FEEDBACK_HISTORY,
  );
  log(state, event.text);
}
