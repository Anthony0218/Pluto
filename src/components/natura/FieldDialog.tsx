import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useEffect, useRef, type ReactNode } from 'react';

/** Native dialog supplies inert background, focus containment and opener restoration. */
export default function FieldDialog({ title, close, className = '', restoreFocus = true, afterClose, children }: { title: string; close: () => void; className?: string; restoreFocus?: boolean; afterClose?: () => void; children: ReactNode }) {
  useGameLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const onClose = useRef(close);
  const onDismiss = useRef(afterClose);
  const shouldRestore = useRef(restoreFocus);
  useEffect(() => { onClose.current = close; onDismiss.current = afterClose; shouldRestore.current = restoreFocus; }, [close, afterClose, restoreFocus]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { dialog.close(); if (shouldRestore.current) opener?.focus(); onDismiss.current?.(); };
  }, []);
  return <dialog ref={ref} className={`nf-dialog ${className}`} aria-label={gameUi(title)} onCancel={e => { e.preventDefault(); onClose.current(); }}>
    {gameUi(children)}
  </dialog>;
}
