import { createContext, useContext } from "react";
import type { GameDefinition } from "@/games/cards/engine/types";
import type { EditorSection, ValidationIssue } from "@/games/cards/engine/validation";

export type EditorMode = "basic" | "advanced";

export interface CardEditorContextValue {
  def: GameDefinition;
  /** Mutate a deep copy; the editor re-validates after every change. */
  edit: (mutate: (draft: GameDefinition) => void) => void;
  mode: EditorMode;
  issues: ValidationIssue[];
  goTo: (section: EditorSection | "validation" | "preview" | "publish", targetId?: string) => void;
}

export const CardEditorContext = createContext<CardEditorContextValue | null>(null);

export function useCardEditor() {
  const value = useContext(CardEditorContext);
  if (!value) throw new Error("useCardEditor must be used inside the card game editor.");
  return value;
}

/** Issues for one entity (phase, rule, action …) to show next to it. */
export function useIssuesFor(targetId: string | undefined) {
  const { issues } = useCardEditor();
  return targetId ? issues.filter((issue) => issue.targetId === targetId && issue.severity !== "success") : [];
}
