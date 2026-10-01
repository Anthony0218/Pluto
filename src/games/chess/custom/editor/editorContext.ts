import { createContext, useContext, type Dispatch } from "react";
import type { PresetId } from "../engine/presets.ts";
import type { GameVariant, PositionSetup } from "../engine/types.ts";
import type { ValidationIssue } from "../engine/validation.ts";
import type { LibraryEntry, PublishedRecord } from "../library/metadata.ts";
import type { ChessCustomRoute, CreateStep, PlayMode } from "../library/navigation.ts";
import type { CommunityService } from "../storage/communityService.ts";
import type { VariantSummary } from "../storage/variantRepository.ts";
import type { EditorAction } from "./editorStore.ts";

export interface Toast {
  id: number;
  text: string;
  tone: "success" | "error" | "info";
}

/** A load that would replace edited, unsaved work and is waiting for the player's decision. */
export interface PendingReplace {
  name: string;
  run: () => void | Promise<void>;
}

export interface ShareDetails {
  name: string;
  description: string;
  tags: string[];
}

export interface EditorContextValue {
  variant: GameVariant;
  testSetup: PositionSetup;
  dispatch: Dispatch<EditorAction>;
  canUndo: boolean;
  canRedo: boolean;
  issues: ValidationIssue[];
  /** Edited since it was loaded or last saved. */
  dirty: boolean;
  /** Reads the latest dirty state, even between renders (navigation guards). */
  isDirty: () => boolean;
  /** The working variant has a saved copy in My Games. */
  inLibrary: boolean;

  /* Navigation */
  route: ChessCustomRoute;
  /** Current Create step; "overview" outside of Create. */
  step: CreateStep;
  go: (route: ChessCustomRoute, options?: { search?: string; replace?: boolean }) => void;
  goToStep: (step: CreateStep) => void;

  selectedPieceId: string | null;
  setSelectedPieceId: (id: string | null) => void;
  focusTarget: string | null;
  focusIssue: (issue: ValidationIssue) => void;
  /** Which position the simulation starts from: the variant's start, or the scratch test position. */
  simulationSource: "start" | "test";
  setSimulationSource: (source: "start" | "test") => void;

  /* My Games */
  saved: VariantSummary[];
  library: LibraryEntry[];
  libraryStatus: "loading" | "ready";
  published: Record<string, PublishedRecord>;
  save: () => Promise<boolean>;
  saveAs: (name: string) => Promise<boolean>;
  duplicateSaved: (id: string) => Promise<void>;
  deleteSaved: (id: string, options?: { unpublish?: boolean }) => Promise<boolean>;
  exportSaved: (id: string) => Promise<void>;
  /** Read a saved variant without opening it. */
  loadSaved: (id: string) => Promise<GameVariant | null>;
  /** Open a saved variant in Create → Overview (or a given step). */
  editVariant: (id: string, step?: CreateStep) => void;
  /** Start a fresh variant and open Create → Overview. */
  createNew: () => void;
  /** Play a saved variant (or the working copy when it is already open). */
  playSaved: (id: string, mode: PlayMode) => void;
  /** Play a variant that is not in My Games (e.g. from Community) as an unsaved copy. */
  playCopy: (variant: GameVariant, mode: PlayMode) => void;
  /** Throw away edits since the last save (or start over if it was never saved). */
  discardChanges: () => Promise<void>;
  pendingReplace: PendingReplace | null;
  resolveReplace: (choice: "save" | "discard" | "cancel") => Promise<void>;

  /* Create */
  /** Replace board, pieces and rules with a preset while keeping name, description and identity (undoable). */
  applyBasePreset: (id: PresetId) => void;
  exportJson: (variant?: GameVariant) => void;
  importJson: (text: string) => { errors: string[]; warnings: string[] };

  /* Community */
  community: CommunityService;
  userId: string | null;
  share: (id: string, details: ShareDetails) => Promise<boolean>;
  unshare: (id: string) => Promise<boolean>;
  remix: (publishedId: string) => Promise<void>;
  refreshPublished: () => Promise<void>;

  toast: Toast | null;
  notify: (text: string, tone?: Toast["tone"]) => void;
  /** Where saves go: the signed-in account or this browser; `error` when the cloud is unreachable. */
  storage: { mode: "cloud" | "local"; error: string | null; localCount: number };
  moveLocalToCloud: () => Promise<void>;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor() {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor must be used inside <EditorProvider>");
  return value;
}
