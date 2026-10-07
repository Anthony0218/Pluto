import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/context/AuthContext";
import { createNotesStore, type Note, type NoteBlock } from "@/data/notes";

const storage = (() => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } })();
const store = createNotesStore(storage);
if (typeof window !== "undefined") window.addEventListener("storage", event => { if (event.storageArea === storage) store.sync(event.key); });

/** The signed-in account's notes (or the guest's), kept in this browser. */
export function useNotes() {
  const { user, loading } = useAuth(), account = user?.id ?? "guest";
  const subscribe = useCallback((notify: () => void) => store.subscribe(account, notify), [account]);
  const snapshot = useCallback(() => store.read(account), [account]);
  const notes = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    notes, loading, sessionOnly: store.isVolatile(account),
    /** Stores the note and marks it as just edited, which is what puts it at the top of the list. */
    save: (note: Note) => !loading && store.save(account, { ...note, updatedAt: Date.now() }),
    remove: (id: string) => !loading && store.remove(account, id),
    /** Adds blocks to a note (a new one when `id` is null). Returns the note's id, or null when it could not be saved. */
    append: (id: string | null, blocks: NoteBlock[], title?: string) => loading ? null : store.append(account, id, blocks, title),
  };
}
