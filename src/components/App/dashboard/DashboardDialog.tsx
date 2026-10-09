import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";

export default function DashboardDialog({ title, onClose, children, drawer = false, scrollable = false }: { title: string; onClose: () => void; children: ReactNode; drawer?: boolean; /** A drawer normally fits one screen; a scrollable one grows with its content. */ scrollable?: boolean }) {
  useUiLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    ref.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; if (previousFocus instanceof HTMLElement) previousFocus.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={title} className={`dashboard-dialog ${drawer ? "dashboard-drawer" : ""}${drawer && scrollable ? " is-scrollable" : ""}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="p-5"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{title}</h2><button type="button" autoFocus className="dash-icon-button" aria-label={ui("Close")} onClick={onClose}><X size={20} /></button></div>{children}</div>
  </dialog>;
}
