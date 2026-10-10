import { useEffect, useEffectEvent, type RefObject } from 'react';

/** Page shortcuts also work before the first click, without intercepting text or browser shortcuts. */
export function useTodoKeyboard(newItem: () => void, search: RefObject<HTMLInputElement | null>) {
  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || target.matches('input, textarea, select') || target.isContentEditable) return;
    // Landing-page demos receive shortcuts only when focus is already inside that demo.
    if (window.location.pathname !== '/tools/todo-list' && !target.closest('.todo-workbench')) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); newItem(); }
    if (event.key === '/') { event.preventDefault(); search.current?.focus(); }
  });
  useEffect(() => {
    const handle = (event: KeyboardEvent) => shortcut(event);
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, []);
}
