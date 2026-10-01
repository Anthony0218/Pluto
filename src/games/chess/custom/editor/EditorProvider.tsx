import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { ui } from "@/i18n/ui";
import { createId, createVariantFromPreset, type PresetId } from "../engine/presets.ts";
import { parseVariantJson, serializeVariant } from "../engine/serialization.ts";
import type { GameVariant } from "../engine/types.ts";
import { validateVariant, type ValidationIssue } from "../engine/validation.ts";
import { createCommunityService } from "../storage/communityService.ts";
import { createSupabaseVariantRepository } from "../storage/supabaseVariantRepository.ts";
import { draftStorage, localVariantRepository, type VariantRepository, type VariantSummary } from "../storage/variantRepository.ts";
import { EDITOR_SECTIONS, EditorContext, type EditorContextValue, type EditorSection, type Toast } from "./editorContext.ts";
import { createHistory, editorReducer } from "./editorStore.ts";

/** Identity/timestamps change on save; they never make a variant "dirty". */
function contentSignature(variant: GameVariant) {
  return JSON.stringify({ ...variant, id: "", version: 0, updatedAt: "", createdAt: "" });
}

function downloadJson(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "Unknown error");

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "variant";

/**
 * Signed-in players save to their account (Supabase); everyone else saves in
 * this browser. If the cloud is unreachable, saving falls back to the browser.
 */
export default function EditorProvider({ children, repository: override }: { children: ReactNode; repository?: VariantRepository }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const cloudRepository = useMemo(() => (userId ? createSupabaseVariantRepository(supabase) : null), [userId]);
  const repository = override ?? cloudRepository ?? localVariantRepository;
  const community = useMemo(() => createCommunityService(supabase), []);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [history, dispatch] = useReducer(editorReducer, undefined, () => createHistory(draftStorage.read() ?? createVariantFromPreset("standard")));
  const { variant, testSetup } = history.present;
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [saved, setSaved] = useState<VariantSummary[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [simulationSource, setSimulationSource] = useState<"start" | "test">("start");
  const [toast, setToast] = useState<Toast | null>(null);
  const [params, setParams] = useSearchParams();
  const toastTimer = useRef<number | undefined>(undefined);

  const requested = params.get("section") as EditorSection | null;
  const section: EditorSection = requested && EDITOR_SECTIONS.includes(requested) ? requested : "overview";
  const setSection = useCallback(
    (next: EditorSection) => {
      setParams((current) => {
        const copy = new URLSearchParams(current);
        if (next === "overview") copy.delete("section");
        else copy.set("section", next);
        return copy;
      });
    },
    [setParams],
  );

  const notify = useCallback((text: string, tone: Toast["tone"] = "success") => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const refreshSaved = useCallback(async () => {
    try {
      setSaved(await repository.list());
      setStorageError(null);
    } catch (error) {
      // Cloud unreachable or not migrated yet: keep working with this browser's copies.
      setStorageError(errorText(error));
      setSaved(await localVariantRepository.list());
    }
    setLocalCount(repository === localVariantRepository ? 0 : (await localVariantRepository.list()).length);
  }, [repository]);

  const loadStored = useCallback(
    async (id: string) => {
      try {
        return (await repository.load(id)) ?? (await localVariantRepository.load(id));
      } catch {
        return localVariantRepository.load(id);
      }
    },
    [repository],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(refreshSaved)
      .then(async () => {
        // A draft that matches its saved copy is clean.
        const stored = await loadStored(variant.id);
        if (!cancelled && stored) setSavedSignature(contentSignature(stored));
      });
    return () => {
      cancelled = true;
    };
    // Runs when the storage backend changes (sign in/out); later loads set the signature explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  // Autosave the working draft so a refresh never loses edits.
  useEffect(() => {
    const timer = window.setTimeout(() => draftStorage.write(variant), 500);
    return () => window.clearTimeout(timer);
  }, [variant]);

  const signature = useMemo(() => contentSignature(variant), [variant]);
  const dirty = savedSignature !== signature;
  const issues = useMemo(() => validateVariant(variant), [variant]);

  const loadVariant = useCallback((next: GameVariant, cleanSignature: string | null) => {
    dispatch({ type: "load", variant: next });
    setSavedSignature(cleanSignature);
    setSelectedPieceId(null);
  }, []);

  /** Save to the active backend, falling back to this browser if the cloud fails. */
  const store = useCallback(
    async (toSave: GameVariant): Promise<{ stored: GameVariant; fallback: boolean } | { error: string }> => {
      try {
        return { stored: await repository.save(toSave), fallback: false };
      } catch (error) {
        if (repository === localVariantRepository) return { error: errorText(error) };
        try {
          return { stored: await localVariantRepository.save(toSave), fallback: true };
        } catch {
          return { error: errorText(error) };
        }
      }
    },
    [repository],
  );

  const persist = useCallback(
    async (toSave: GameVariant, message: string) => {
      const result = await store(toSave);
      if ("error" in result) return notify(`${ui("Could not save")} — ${result.error}`, "error");
      dispatch({ type: "replaceIdentity", variant: result.stored });
      setSavedSignature(contentSignature(result.stored));
      await refreshSaved();
      notify(result.fallback ? ui("Couldn't reach your account — saved in this browser instead") : message, result.fallback ? "info" : "success");
    },
    [store, refreshSaved, notify],
  );

  const value: EditorContextValue = {
    variant,
    testSetup,
    dispatch,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    issues,
    dirty,
    section,
    setSection,
    selectedPieceId,
    setSelectedPieceId,
    focusTarget,
    focusIssue: (issue: ValidationIssue) => {
      setSection(issue.section);
      setFocusTarget(issue.targetId ?? null);
      if (issue.section === "pieces" && issue.targetId) setSelectedPieceId(issue.targetId);
    },
    simulationSource,
    setSimulationSource,
    saved,
    save: () => persist(variant, `${ui("Saved")} “${variant.name}”`),
    saveAs: (name: string) => {
      const now = new Date().toISOString();
      return persist(
        { ...variant, id: createId("variant"), name: name.trim() || variant.name, version: 1, createdAt: now, remixedFrom: variant.id, originalVariantId: variant.originalVariantId ?? variant.id },
        `${ui("Saved as")} “${name.trim() || variant.name}”`,
      );
    },
    openSaved: async (id: string) => {
      const stored = await loadStored(id);
      if (!stored) return notify(ui("That variant no longer exists."), "error");
      loadVariant(stored, contentSignature(stored));
      setSection("overview");
      notify(`${ui("Opened")} “${stored.name}”`, "info");
    },
    duplicateSaved: async (id: string) => {
      const stored = await loadStored(id);
      if (!stored) return;
      const now = new Date().toISOString();
      const result = await store({ ...stored, id: createId("variant"), name: `${stored.name} (copy)`, version: 1, createdAt: now, remixedFrom: stored.id, originalVariantId: stored.originalVariantId ?? stored.id });
      if ("error" in result) return notify(`${ui("Could not duplicate")} — ${result.error}`, "error");
      await refreshSaved();
      notify(`${ui("Duplicated")} “${stored.name}”`);
    },
    deleteSaved: async (id: string) => {
      try {
        await repository.remove(id);
      } catch (error) {
        if (repository === localVariantRepository) return notify(`${ui("Could not delete")} — ${errorText(error)}`, "error");
      }
      if (repository !== localVariantRepository) await localVariantRepository.remove(id);
      if (id === variant.id) setSavedSignature(null);
      await refreshSaved();
      notify(ui("Variant deleted"), "info");
    },
    exportSaved: async (id: string) => {
      const stored = await loadStored(id);
      if (stored) downloadJson(`${slug(stored.name)}.chess-variant.json`, serializeVariant(stored));
    },
    loadPreset: (id: PresetId) => {
      loadVariant(createVariantFromPreset(id), null);
      setSection("overview");
    },
    exportJson: (target = variant) => downloadJson(`${slug(target.name)}.chess-variant.json`, serializeVariant(target)),
    importJson: (text: string) => {
      const result = parseVariantJson(text);
      if (result.variant) {
        loadVariant(result.variant, null);
        setSection("overview");
        notify(`${ui("Imported")} “${result.variant.name}”`);
      }
      return { errors: result.errors, warnings: result.warnings };
    },
    toast,
    notify,
    storage: { mode: repository === localVariantRepository ? "local" : "cloud", error: storageError, localCount },
    moveLocalToCloud: async () => {
      if (repository === localVariantRepository) return;
      let moved = 0;
      for (const summary of await localVariantRepository.list()) {
        const local = await localVariantRepository.load(summary.id);
        if (!local) continue;
        try {
          await repository.save(local);
          await localVariantRepository.remove(summary.id);
          moved += 1;
        } catch (error) {
          notify(`${ui("Stopped after")} ${moved}: ${errorText(error)}`, "error");
          break;
        }
      }
      await refreshSaved();
      if (moved) notify(`${ui("Variants moved to your account:")} ${moved}`);
    },
    community,
    userId,
    playVariant: (next: GameVariant) => {
      loadVariant(next, null);
      setSimulationSource("start");
      setSection("simulation");
      notify(`“${next.name}” — ${ui("your copy to play and remix")}`, "info");
    },
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
