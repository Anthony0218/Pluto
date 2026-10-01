/**
 * Parameter specs shared by the condition and effect registries. They drive
 * three things from one place: server-side shape validation of user-made
 * definitions, reference checks (unknown zone/phase/variable), and the
 * generic form fields of the visual editor.
 */
import type { GameDefinition } from "./types.ts";

export type ParamKind =
  | "card"
  | "player"
  | "players"
  | "zone"
  | "zoneId"
  | "zoneIds"
  | "value"
  | "rank"
  | "ranks"
  | "suit"
  | "role"
  | "phase"
  | "compareOp"
  | "condition"
  | "effects"
  | "boolean"
  | "text"
  | "variable"
  | "playerVariable"
  | "position"
  | "mark";

export interface ParamSpec {
  key: string;
  kind: ParamKind;
  label: string;
  optional?: boolean;
  /** Used by the editor when the parameter is added. */
  default?: unknown;
  help?: string;
}

/** What a description needs to print names instead of ids. */
export interface DescribeContext {
  def?: Pick<GameDefinition, "zones" | "phases" | "settings" | "variables" | "playerVariables" | "actions">;
}
