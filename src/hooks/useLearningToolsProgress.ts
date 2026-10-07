import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";
import { createLearningToolsStore } from "@/data/learningToolsProgress";
import type { LessonStage } from "@/data/learningCatalog";

const browserStorage = (() => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } })();
const store = createLearningToolsStore(browserStorage);
if (typeof window !== "undefined") window.addEventListener("storage", event => {
  if (event.storageArea === browserStorage) store.syncFromStorage(event.key);
});

export function useLearningToolsProgress() {
  const { user, loading } = useAuth();
  const account = user?.id ?? "guest";
  const subscribe = useCallback((listener: () => void) => store.subscribe(account, listener), [account]);
  const snapshot = useCallback(() => store.read(account), [account]);
  const progress = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    progress,
    loading,
    toggleBookmark: (id: string) => { if (!loading) store.toggleBookmark(account, id); },
    toggleFavoriteTool: (id: string) => { if (!loading) store.toggleFavoriteTool(account, id); },
    setFavoriteTools: (ids: string[]) => { if (!loading) store.setFavoriteTools(account, ids); },
    visitTool: useCallback((id: string) => { if (!loading) store.visitTool(account, id); }, [account, loading]),
    setLessonStage: useCallback((id: string, stage: LessonStage) => { if (!loading) store.setLessonStage(account, id, stage); }, [account, loading]),
    setLessonCompleted: (id: string, completed: boolean) => { if (!loading) store.setLessonCompleted(account, id, completed); },
    recordSolvedExercise: (lessonId: string, exerciseId: string) => { if (!loading) store.recordSolvedExercise(account, lessonId, exerciseId); },
    resetLessonExercises: (lessonId: string) => { if (!loading) store.resetLessonExercises(account, lessonId); },
    account,
  };
}
