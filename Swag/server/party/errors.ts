import type { ErrorCode } from "../../src/games/party/types.ts";
// An expected, player-facing rejection with a machine-readable code.
export class PartyError extends Error {
  readonly code: ErrorCode;
  constructor(message: string, code: ErrorCode = "INVALID") {
    super(message);
    this.code = code;
  }
}
// Rule and validation errors are thrown as plain `Error`/`PartyError` with a message written for
// players. Anything else (TypeError, RangeError, …) is a bug: players get a generic message and the
// details go to the server log only.
export function isExpectedError(error: unknown): error is Error {
  return (
    error instanceof PartyError ||
    (error instanceof Error && error.constructor === Error)
  );
}
export function clientError(error: unknown): { message: string; code: ErrorCode } {
  if (error instanceof PartyError) return { message: error.message, code: error.code };
  if (error instanceof SyntaxError) return { message: "Invalid message.", code: "INVALID" };
  if (isExpectedError(error)) return { message: error.message, code: "INVALID" };
  return { message: "Something went wrong on the server. Please try again.", code: "SERVER_ERROR" };
}
