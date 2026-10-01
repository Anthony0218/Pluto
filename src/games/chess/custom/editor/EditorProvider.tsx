import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { ui } from "@/i18n/ui";
import { createPlutoVariant, isPlutoCustomId } from "../library/plutoVariants.ts";
import { createVariantFromPreset, PRESETS, type PresetId } from "../engine/presets.ts";
import { parseVariantJson, serializeVariant } from "../engine/serialization.ts";
import type { GameVariant } from "../engine/types.ts";
import { validateVariant, type ValidationIssue } from "../engine/validation.ts";
import { toLibraryEntries, type PublishedRecord } from "../library/metadata.ts";
import { chessCustomPath, parseChessCustomPath, type ChessCustomRoute, type CreateStep, type PlayMode } from "../library/navigation.ts";
import { createUntitledVariant, ensureStarterVariant, withBasePreset } from "../library/starter.ts";
import { createCommunityService } from "../storage/communityService.ts";
import { createSupabaseVariantRepository } from "../storage/supabaseVariantRepository.ts";
import { draftStorage, localVariantRepository, type VariantRepository, type VariantSummary } from "../storage/variantRepository.ts";
import { createId } from "../engine/presets.ts";
import { EditorContext, type EditorContextValue, type PendingReplace, type ShareDetails, type Toast } from "./editorContext.ts";
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

/** The working copy on first load: a requested preset, the autosaved draft, or a fresh variant. */
function initialDocument(): { variant: GameVariant; pristine: boolean } {
  const requestedPreset = new URLSearchParams(window.location.search).get("preset");
  if (isPlutoCustomId(requestedPreset)) return { variant: parseVariantJson(JSON.stringify(createPlutoVariant(requestedPreset))).variant!, pristine: true };
  const preset = PRESETS.find((entry) => entry.id === requestedPreset);
  if (preset) return { variant: createVariantFromPreset(preset.id), pristine: true };
  const draft = draftStorage.read();
  if (draft) return { variant: draft, pristine: draftStorage.readClean() };
  return { variant: createUntitledVariant(), pristine: true };
}

/**
 * Owns the working variant, the player's library and Chess Custom navigation.
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
  const [initial] = useState(initialDocument);
  const [history, dispatch] = useReducer(editorReducer, initial.variant, createHistory);
  const { variant, testSetup } = history.present;
  const [cleanSignature, setCleanSignature] = useState<string | null>(() => (initial.pristine ? contentSignature(initial.variant) : null));
  const [saved, setSaved] = useState<VariantSummary[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<"loading" | "ready">("loading");
  const [published, setPublished] = useState<Record<string, PublishedRecord>>({});
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [simulationSource, setSimulationSource] = useState<"start" | "test">("start");
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const route = useMemo(() => parseChessCustomPath(pathname), [pathname]);

  const signature = useMemo(() => contentSignature(variant), [variant]);
  const dirty = cleanSignature !== signature;
  // Refs let guards read the latest state between a save and the next render.
  const variantRef = useRef(variant);
  const signatureRef = useRef(signature);
  const cleanRef = useRef(cleanSignature);
  useEffect(() => {
    variantRef.current = variant;
    signatureRef.current = signature;
    cleanRef.current = cleanSignature;
  });
  const isDirty = useCallback(() => cleanRef.current !== signatureRef.current, []);
  const markClean = useCallback((next: GameVariant | null) => {
    const value = next ? contentSignature(next) : null;
    cleanRef.current = value;
    setCleanSignature(value);
  }, []);

  // A preset in the URL has been loaded; drop it so a refresh keeps the player's edits.
  useEffect(() => {
    if (!params.has("preset")) return;
    setParams((current) => {
      const copy = new URLSearchParams(current);
      copy.delete("preset");
      return copy;
    }, { replace: true });
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback(
    (next: ChessCustomRoute, options: { search?: string; replace?: boolean } = {}) => navigate(`${chessCustomPath(next)}${options.search ?? ""}`, { replace: options.replace }),
    [navigate],
  );
  const goToStep = useCallback((step: CreateStep) => go({ view: "create", step }), [go]);

  const notify = useCallback((text: string, tone: Toast["tone"] = "success") => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const refreshSaved = useCallback(async () => {
    let ok = true;
    let list: VariantSummary[];
    try {
      list = await repository.list();
      setStorageError(null);
    } catch (error) {
      // Cloud unreachable or not migrated yet: keep working with this browser's copies.
      ok = false;
      setStorageError(errorText(error));
      list = await localVariantRepository.list();
    }
    setSaved(list);
    const local = repository === localVariantRepository ? 0 : (await localVariantRepository.list()).length;
    setLocalCount(local);
    return { ok, list, local };
  }, [repository]);

  const refreshPublished = useCallback(async () => {
    if (!userId) return setPublished({});
    try {
      setPublished(await community.listMine(userId));
    } catch {
      // Unknown visibility reads as private; sharing still reports its own errors.
      setPublished({});
    }
  }, [community, userId]);

  useEffect(() => {
    void Promise.resolve().then(refreshPublished);
  }, [refreshPublished]);

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
    void (async () => {
      const result = await refreshSaved();
      if (cancelled) return;
      if (result.ok) {
        // First visit with an empty library: seed the starter variant once.
        try {
          const scope = repository === localVariantRepository ? "local" : `user:${userId ?? "unknown"}`;
          const starter = await ensureStarterVariant({ repository, scope, existingCount: result.list.length + result.local });
          if (starter && !cancelled) await refreshSaved();
        } catch {
          /* The starter is a convenience; an empty library has its own empty state. */
        }
      }
      if (cancelled) return;
      setLibraryStatus("ready");
      // A draft that matches its saved copy is clean.
      const stored = await loadStored(variantRef.current.id);
      if (!cancelled && stored) markClean(stored);
    })();
    return () => {
      cancelled = true;
    };
    // Runs when the storage backend changes (sign in/out); later loads set the signature explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  const issues = useMemo(() => validateVariant(variant), [variant]);
  const inLibrary = saved.some((entry) => entry.id === variant.id);
  const library = useMemo(() => toLibraryEntries(saved, published, userId), [saved, published, userId]);

  // Autosave the working draft so a refresh never loses edits (and remembers whether it had any).
  useEffect(() => {
    const timer = window.setTimeout(() => draftStorage.write(variant, !dirty), 500);
    return () => window.clearTimeout(timer);
  }, [variant, dirty]);

  const loadVariant = useCallback(
    (next: GameVariant, clean: boolean) => {
      dispatch({ type: "load", variant: next });
      variantRef.current = next;
      signatureRef.current = contentSignature(next);
      markClean(clean ? next : null);
      setSelectedPieceId(null);
      setSimulationSource("start");
    },
    [markClean],
  );

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
      if ("error" in result) {
        notify(`${ui("Could not save")} — ${result.error}`, "error");
        return false;
      }
      dispatch({ type: "replaceIdentity", variant: result.stored });
      markClean(result.stored);
      await refreshSaved();
      notify(result.fallback ? ui("Couldn't reach your account — saved in this browser instead") : message, result.fallback ? "info" : "success");
      return true;
    },
    [store, refreshSaved, notify, markClean],
  );

  const save = useCallback(() => persist(variantRef.current, `${ui("Saved")} “${variantRef.current.name}”`), [persist]);

  /** Run a load that replaces the working copy, asking first if that would drop unsaved edits. */
  const guardReplace = useCallback(
    (targetId: string | null, run: () => void | Promise<void>) => {
      if (!isDirty() || targetId === variantRef.current.id) return void run();
      setPendingReplace({ name: variantRef.current.name, run });
    },
    [isDirty],
  );

  const openStored = useCallback(
    async (id: string) => {
      const stored = await loadStored(id);
      if (!stored) {
        notify(ui("That variant no longer exists."), "error");
        return false;
      }
      loadVariant(stored, true);
      return true;
    },
    [loadStored, loadVariant, notify],
  );

  const value: EditorContextValue = {
    variant,
    testSetup,
    dispatch,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    issues,
    dirty,
    isDirty,
    inLibrary,
    route,
    step: route.view === "create" ? route.step : "overview",
    go,
    goToStep,
    selectedPieceId,
    setSelectedPieceId,
    focusTarget,
    focusIssue: (issue: ValidationIssue) => {
      goToStep(issue.section);
      setFocusTarget(issue.targetId ?? null);
      if (issue.section === "pieces" && issue.targetId) setSelectedPieceId(issue.targetId);
    },
    simulationSource,
    setSimulationSource,
    saved,
    library,
    libraryStatus,
    published,
    save,
    saveAs: (name: string) => {
      const now = new Date().toISOString();
      const current = variantRef.current;
      return persist(
        { ...current, id: createId("variant"), name: name.trim() || current.name, version: 1, createdAt: now, remixedFrom: current.id, originalVariantId: current.originalVariantId ?? current.id },
        `${ui("Saved as")} “${name.trim() || current.name}”`,
      );
    },
    duplicateSaved: async (id: string) => {
      const stored = await loadStored(id);
      if (!stored) return;
      const now = new Date().toISOString();
      const result = await store({ ...stored, id: createId("variant"), name: `${stored.name} (copy)`.slice(0, 80), version: 1, createdAt: now, remixedFrom: stored.id, originalVariantId: stored.originalVariantId ?? stored.id });
      if ("error" in result) return notify(`${ui("Could not duplicate")} — ${result.error}`, "error");
      await refreshSaved();
      notify(`${ui("Duplicated")} “${stored.name}”`);
    },
    deleteSaved: async (id: string, options = {}) => {
      const record = published[id];
      if (options.unpublish && record) {
        try {
          await community.unpublish(record.publishedId);
        } catch (error) {
          notify(`${ui("Could not remove it from Community")} — ${errorText(error)}`, "error");
          return false;
        }
      }
      try {
        await repository.remove(id);
      } catch (error) {
        if (repository === localVariantRepository) {
          notify(`${ui("Could not delete")} — ${errorText(error)}`, "error");
          return false;
        }
      }
      if (repository !== localVariantRepository) await localVariantRepository.remove(id);
      // Deleting the open variant closes it rather than leaving an orphaned "unsaved" copy.
      if (id === variantRef.current.id) loadVariant(createUntitledVariant(), true);
      await Promise.all([refreshSaved(), refreshPublished()]);
      notify(ui("Variant deleted"), "info");
      return true;
    },
    exportSaved: async (id: string) => {
      const stored = await loadStored(id);
      if (stored) downloadJson(`${slug(stored.name)}.chess-variant.json`, serializeVariant(stored));
    },
    loadSaved: loadStored,
    editVariant: (id: string, step: CreateStep = "overview") => {
      if (id === variantRef.current.id) return goToStep(step);
      guardReplace(id, async () => {
        if (await openStored(id)) goToStep(step);
      });
    },
    createNew: () =>
      guardReplace(null, () => {
        loadVariant(createUntitledVariant(), true);
        goToStep("overview");
      }),
    playSaved: (id: string, mode: PlayMode) => {
      if (id === variantRef.current.id) {
        setSimulationSource("start");
        return go({ view: "play", mode });
      }
      guardReplace(id, async () => {
        if (await openStored(id)) go({ view: "play", mode });
      });
    },
    playCopy: (next: GameVariant, mode: PlayMode) =>
      guardReplace(null, () => {
        loadVariant(next, true);
        go({ view: "play", mode });
      }),
    discardChanges: async () => {
      const current = variantRef.current;
      const stored = saved.some((entry) => entry.id === current.id) ? await loadStored(current.id) : null;
      loadVariant(stored ?? createUntitledVariant(), true);
    },
    pendingReplace,
    resolveReplace: async (choice) => {
      const pending = pendingReplace;
      setPendingReplace(null);
      if (!pending || choice === "cancel") return;
      if (choice === "save" && !(await save())) return;
      await pending.run();
    },
    applyBasePreset: (id: PresetId) => {
      dispatch({ type: "replaceContent", variant: withBasePreset(variantRef.current, createVariantFromPreset(id)) });
      setSelectedPieceId(null);
      notify(`${ui("Based on")} ${ui(PRESETS.find((preset) => preset.id === id)?.name ?? id)} — ${ui("undo with Ctrl+Z")}`, "info");
    },
    exportJson: (target = variant) => downloadJson(`${slug(target.name)}.chess-variant.json`, serializeVariant(target)),
    importJson: (text: string) => {
      const result = parseVariantJson(text);
      const imported = result.variant;
      if (imported) {
        guardReplace(null, () => {
          loadVariant(imported, false);
          goToStep("overview");
          notify(`${ui("Imported")} “${imported.name}” — ${ui("save it to add it to My Games")}`);
        });
      }
      return { errors: result.errors, warnings: result.warnings };
    },
    community,
    userId,
    share: async (id: string, details: ShareDetails) => {
      if (!userId) {
        notify(ui("Sign in to share variants with the community."), "error");
        return false;
      }
      const stored = await loadStored(id);
      if (!stored) {
        notify(ui("That variant no longer exists."), "error");
        return false;
      }
      const name = details.name.trim().slice(0, 80) || stored.name;
      const description = details.description.trim().slice(0, 600);
      const tags = details.tags.length ? details.tags : undefined;
      let next: GameVariant = { ...stored, name, description, tags };
      if (validateVariant(next).some((issue) => issue.severity === "error")) {
        notify(ui("Fix the validation errors in Create before sharing."), "error");
        return false;
      }
      // Keep My Games in step with the published title, description and tags.
      if (name !== stored.name || description !== (stored.description ?? "") || JSON.stringify(tags) !== JSON.stringify(stored.tags)) {
        const result = await store(next);
        if ("error" in result) {
          notify(`${ui("Could not save")} — ${result.error}`, "error");
          return false;
        }
        next = result.stored;
        if (variantRef.current.id === id) {
          const wasClean = !isDirty();
          const patched = { ...variantRef.current, name, description, tags, version: next.version, updatedAt: next.updatedAt };
          dispatch({ type: "update", recipe: (current) => ({ ...current, name, description, tags }) });
          dispatch({ type: "replaceIdentity", variant: patched });
          if (wasClean) markClean(patched);
        }
      }
      try {
        await community.publish(next, description);
      } catch (error) {
        notify(`${ui("Could not publish")} — ${errorText(error)}`, "error");
        return false;
      }
      await Promise.all([refreshPublished(), refreshSaved()]);
      notify(`${ui("Published to Community:")} “${name}”`);
      return true;
    },
    unshare: async (id: string) => {
      const record = published[id];
      if (!record) return true;
      try {
        await community.unpublish(record.publishedId);
      } catch (error) {
        notify(`${ui("Could not make it private")} — ${errorText(error)}`, "error");
        return false;
      }
      await refreshPublished();
      notify(ui("Now private — removed from Community"), "info");
      return true;
    },
    remix: async (publishedId: string) => {
      let loaded: GameVariant;
      try {
        loaded = await community.load(publishedId);
      } catch (error) {
        return notify(errorText(error), "error");
      }
      guardReplace(null, async () => {
        const copy: GameVariant = { ...loaded, name: `${loaded.name} (Remix)`.slice(0, 80) };
        const result = await store(copy);
        if ("error" in result) return notify(`${ui("Could not save the remix")} — ${result.error}`, "error");
        await refreshSaved();
        loadVariant(result.stored, true);
        goToStep("overview");
        notify(`“${copy.name}” ${ui("added to My Games")}`);
      });
    },
    refreshPublished,
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
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
