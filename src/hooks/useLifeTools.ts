import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createLifeToolsStore, type Collection, type LifeToolsState } from '@/data/lifeToolsStorage';
const storage = (() => { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } })();
const store = createLifeToolsStore(storage);
if (typeof window !== 'undefined') window.addEventListener('storage', event => { if (event.storageArea === storage) store.sync(event.key); });
export function useLifeTools() {
  const { user, loading } = useAuth(), account = user?.id ?? 'guest';
  const subscribe = useCallback((notify: () => void) => store.subscribe(account, notify), [account]);
  const snapshot = useCallback(() => store.read(account), [account]);
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { state, account, loading, sessionOnly: store.isVolatile(account),
    save: <K extends Collection>(collection: K, value: LifeToolsState[K][number]) => !loading && store.save(account, collection, value),
    remove: (collection: Collection, id: string) => !loading && store.remove(account, collection, id),
    update: useCallback((change: (state: LifeToolsState) => LifeToolsState) => !loading && store.update(account, change), [loading, account]),
  };
}
