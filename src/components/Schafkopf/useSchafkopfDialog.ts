import { useEffect, useEffectEvent } from "react";

/** Shared focus handling for body portals and fullscreen dialogs. */
export default function useSchafkopfDialog(key: string | null, onDismiss: () => void) {
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (!key) return;
    const dialog = document.querySelector<HTMLElement>(`[data-sk-dialog="${key}"]`);
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
    )].filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest("[inert]"));
    const focusFirst = () => (focusable()[0] ?? dialog).focus({ preventScroll: true });
    // Make every sibling along the portal's ancestor chain inert, retaining
    // any existing inert state. This also works inside native fullscreen.
    const siblings = new Map<HTMLElement, boolean>();
    let branch: HTMLElement = dialog.closest<HTMLElement>(".sk-rulebook-backdrop") ?? dialog;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement) || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
        siblings.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      branch = branch.parentElement;
      if (branch === document.body || branch.matches(".sk-immersive")) break;
    }
    focusFirst();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(); return; }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
      if (!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const onFocus = (event: FocusEvent) => { if (!dialog.contains(event.target as Node)) focusFirst(); };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocus);
      siblings.forEach((inert, element) => { element.inert = inert; });
      if (previousFocus?.isConnected && !previousFocus.closest("[inert]")) previousFocus.focus({ preventScroll: true });
    };
  }, [key]);
}
