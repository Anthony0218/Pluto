import { learningLessons, lessonStages, getLessonStages, type LessonStage } from "./learningCatalog.ts";
import { toolApps } from "./toolCatalog.ts";
import { mathExerciseIds } from "./mathExerciseIds.ts";

export type LessonProgress = { stage: LessonStage; completed: boolean; updatedAt: number };
export type LearningToolsProgress = {
  version: 1;
  lessons: Record<string, LessonProgress>;
  bookmarks: string[];
  favoriteTools: string[];
  recentTools: string[];
  solvedExercises: Record<string, string[]>;
};
type StoragePort = Pick<Storage, "getItem" | "setItem">;
const PREFIX = "pluto-learning-tools-v1:";
const lessonIds = new Set(learningLessons.map(lesson => lesson.id));
const normalizeStage = (id: string, stage: LessonStage): LessonStage => {
  const lesson = learningLessons.find(item => item.id === id);
  return lesson && !getLessonStages(lesson).includes(stage) ? "practice" : stage;
};
const toolIds = new Set(toolApps.map(tool => tool.id));
const empty = (): LearningToolsProgress => ({ version: 1, lessons: {}, bookmarks: [], favoriteTools: [], recentTools: [], solvedExercises: {} });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const validIds = (value: unknown, allowed: Set<string>) => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && allowed.has(id)))] : [];

export function parseLearningToolsProgress(raw: string | null): LearningToolsProgress {
  try {
    const data: unknown = JSON.parse(raw ?? "null");
    if (!object(data) || data.version !== 1) return empty();
    const lessons: Record<string, LessonProgress> = {};
    if (object(data.lessons)) for (const [id, value] of Object.entries(data.lessons)) {
      if (!lessonIds.has(id) || !object(value) || !lessonStages.includes(value.stage as LessonStage)) continue;
      if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) || value.updatedAt < 0) continue;
      lessons[id] = { stage: normalizeStage(id, value.stage as LessonStage), completed: value.completed === true, updatedAt: value.updatedAt };
    }
    const solvedExercises: Record<string, string[]> = {};
    if (object(data.solvedExercises)) for (const [id, value] of Object.entries(data.solvedExercises)) {
      const allowed = mathExerciseIds.get(id);
      if (!allowed) continue;
      const solved = validIds(value, allowed);
      if (solved.length) solvedExercises[id] = solved;
    }
    return { version: 1, lessons, bookmarks: validIds(data.bookmarks, lessonIds), favoriteTools: validIds(data.favoriteTools, toolIds), recentTools: validIds(data.recentTools, toolIds).slice(0, 6), solvedExercises };
  } catch { return empty(); }
}

/** Per-account browser storage. Failed writes retain a working session copy.
 * Snapshots stay referentially stable for React's useSyncExternalStore. */
export function createLearningToolsStore(storage: StoragePort | null) {
  const cache = new Map<string, { raw: string | null; state: LearningToolsProgress }>();
  const volatile = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  const key = (account: string) => PREFIX + account;
  function read(account: string): LearningToolsProgress {
    const previous = cache.get(account);
    if (volatile.has(account)) return previous?.state ?? empty();
    let raw: string | null;
    try { raw = storage?.getItem(key(account)) ?? null; }
    catch { if (previous) return previous.state; raw = null; }
    if (previous && previous.raw === raw) return previous.state;
    const state = parseLearningToolsProgress(raw);
    cache.set(account, { raw, state });
    return state;
  }
  function notify(account: string) { listeners.get(account)?.forEach(listener => listener()); }
  function update(account: string, change: (state: LearningToolsProgress) => LearningToolsProgress) {
    const current = read(account);
    const next = change(current);
    if (next === current) return;
    const state = parseLearningToolsProgress(JSON.stringify(next));
    const raw = JSON.stringify(state);
    cache.set(account, { raw, state });
    try {
      if (!storage) throw new Error("Storage unavailable");
      storage.setItem(key(account), raw);
      volatile.delete(account);
    } catch { volatile.add(account); }
    notify(account);
  }
  function toggle(account: string, field: "bookmarks" | "favoriteTools", id: string) {
    if (!(field === "bookmarks" ? lessonIds : toolIds).has(id)) return;
    update(account, state => ({ ...state, [field]: state[field].includes(id) ? state[field].filter(item => item !== id) : [...state[field], id] }));
  }
  return {
    read,
    subscribe(account: string, listener: () => void) {
      const accountListeners = listeners.get(account) ?? new Set<() => void>();
      accountListeners.add(listener);
      listeners.set(account, accountListeners);
      return () => { accountListeners.delete(listener); if (!accountListeners.size) listeners.delete(account); };
    },
    syncFromStorage(storageKey: string | null) {
      for (const account of cache.keys()) if (storageKey === null || storageKey === key(account)) {
        volatile.delete(account);
        read(account);
        notify(account);
      }
    },
    toggleBookmark: (account: string, id: string) => toggle(account, "bookmarks", id),
    toggleFavoriteTool: (account: string, id: string) => toggle(account, "favoriteTools", id),
    /** Replaces the whole favourites list, in the given order (the dashboard's "Your apps" row). */
    setFavoriteTools(account: string, ids: string[]) {
      update(account, state => ({ ...state, favoriteTools: [...new Set(ids.filter(id => toolIds.has(id)))] }));
    },
    visitTool(account: string, id: string) {
      if (!toolIds.has(id)) return;
      update(account, state => state.recentTools[0] === id ? state : { ...state, recentTools: [id, ...state.recentTools.filter(item => item !== id)].slice(0, 6) });
    },
    setLessonStage(account: string, id: string, stage: LessonStage, now = Date.now()) {
      if (!lessonIds.has(id) || !lessonStages.includes(stage)) return;
      stage = normalizeStage(id, stage);
      update(account, state => state.lessons[id]?.stage === stage ? state : { ...state, lessons: { ...state.lessons, [id]: { stage, completed: state.lessons[id]?.completed ?? false, updatedAt: now } } });
    },
    setLessonCompleted(account: string, id: string, completed: boolean, now = Date.now()) {
      if (!lessonIds.has(id)) return;
      update(account, state => ({ ...state, lessons: { ...state.lessons, [id]: { stage: state.lessons[id]?.stage ?? "learn", completed, updatedAt: now } } }));
    },
    recordSolvedExercise(account: string, lessonId: string, exerciseId: string) {
      if (!mathExerciseIds.get(lessonId)?.has(exerciseId)) return;
      update(account, state => {
        const solved = state.solvedExercises[lessonId] ?? [];
        return solved.includes(exerciseId) ? state : { ...state, solvedExercises: { ...state.solvedExercises, [lessonId]: [...solved, exerciseId] } };
      });
    },
    resetLessonExercises(account: string, lessonId: string) {
      if (!mathExerciseIds.has(lessonId)) return;
      update(account, state => {
        if (!state.solvedExercises[lessonId]) return state;
        const solvedExercises = { ...state.solvedExercises };
        delete solvedExercises[lessonId];
        return { ...state, solvedExercises };
      });
    },
  };
}
