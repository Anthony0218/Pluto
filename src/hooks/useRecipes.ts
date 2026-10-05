import { useCallback, useSyncExternalStore } from 'react';
import { createRecipeStore, type Recipe } from '@/data/recipes';
import { useAuth } from '@/context/AuthContext';
const storage = (() => { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } })();
const store = createRecipeStore(storage);
if (typeof window !== 'undefined') window.addEventListener('storage', event => { if (event.storageArea === storage) store.sync(event.key); });
export function useRecipes() {
  const { user, loading } = useAuth();
  const account = user?.id ?? 'guest';
  const subscribe = useCallback((notify: () => void) => store.subscribe(account, notify), [account]);
  const snapshot = useCallback(() => store.read(account), [account]);
  const recipes = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { account, loading, recipes, sessionOnly: store.isVolatile(account), save: (recipe: Recipe) => !loading && store.save(account, recipe), remove: (id: string) => { if (!loading) store.remove(account, id); } };
}
