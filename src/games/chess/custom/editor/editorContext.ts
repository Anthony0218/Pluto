import { createContext, useContext, type Dispatch } from "react";
import type { PresetId } from "../engine/presets.ts";
import type { GameVariant, PositionSetup } from "../engine/types.ts";
import type { ValidationIssue } from "../engine/validation.ts";
import type { CommunityService } from "../storage/communityService.ts";
import type { VariantSummary } from "../storage/variantRepository.ts";
import type { EditorAction } from "./editorStore.ts";

export const EDITOR_SECTIONS = [
  "overview",
  "board",
  "teams",
  "pieces",
  "rules",
  "events",
  "victory",
  "test",
  "simulation2d",
  "simulation",
  "presets",
  "saved",
  "community",
] as const;
export type EditorSection = (typeof EDITOR_SECTIONS)[number];

export interface Toast {
  id: number;
  text: string;
  tone: "success" | "error" | "info";
}

export interface EditorContextValue {
  variant: GameVariant;
  testSetup: PositionSetup;
  dispatch: Dispatch<EditorAction>;
  canUndo: boolean;
  canRedo: boolean;
  issues: ValidationIssue[];
  dirty: boolean;
  section: EditorSection;
  setSection: (section: EditorSection) => void;
  selectedPieceId: string | null;
  setSelectedPieceId: (id: string | null) => void;
  focusTarget: string | null;
  focusIssue: (issue: ValidationIssue) => void;
  /** Which position the 3D simulation starts from. */
  simulationSource: "start" | "test";
  setSimulationSource: (source: "start" | "test") => void;
  saved: VariantSummary[];
  save: () => Promise<void>;
  saveAs: (name: string) => Promise<void>;
  openSaved: (id: string) => Promise<void>;
  duplicateSaved: (id: string) => Promise<void>;
  deleteSaved: (id: string) => Promise<void>;
  exportSaved: (id: string) => Promise<void>;
  loadPreset: (id: PresetId) => void;
  exportJson: (variant?: GameVariant) => void;
  importJson: (text: string) => { errors: string[]; warnings: string[] };
  toast: Toast | null;
  notify: (text: string, tone?: Toast["tone"]) => void;
  /** Where saves go: the signed-in account or this browser; `error` when the cloud is unreachable. */
  storage: { mode: "cloud" | "local"; error: string | null; localCount: number };
  moveLocalToCloud: () => Promise<void>;
  community: CommunityService;
  userId: string | null;
  /** Load a variant (e.g. from the community) as a new unsaved copy and open the simulation. */
  playVariant: (variant: GameVariant) => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor() {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor must be used inside <EditorProvider>");
  return value;
}
