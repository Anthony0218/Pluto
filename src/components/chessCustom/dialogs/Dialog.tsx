import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ui } from "@/i18n/ui";
import { CloseIcon } from "../icons/ChessCustomIcons";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog for Chess Custom: focus moves in on open, Tab stays inside,
 * Escape closes, and focus returns to whatever opened it.
 */
export default function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = "md",
  initialFocus,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  initialFocus?: RefObject<HTMLElement | null>;
  tone?: "default" | "danger";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    // Content first, then the footer's actions; the close button only as a last resort.
    const target =
      initialFocus?.current ??
      panel.current?.querySelector<HTMLElement>(`[data-dialog-body] :is(${FOCUSABLE})`) ??
      panel.current?.querySelector<HTMLElement>(`[data-dialog-footer] :is(${FOCUSABLE})`) ??
      panel.current;
    target?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      opener?.focus?.();
    };
  }, [open, initialFocus]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" };
  return createPortal(
    <div className="chess-custom-dialog fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[min(92vh,var(--app-height,100vh))] w-full ${widths[size]} flex-col overflow-hidden rounded-t-3xl border bg-[#0d1014] text-zinc-100 shadow-[0_30px_80px_rgba(0,0,0,.7)] outline-none sm:rounded-3xl ${
          tone === "danger" ? "border-red-400/25" : "border-amber-300/20"
        }`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_50%_0%,rgba(252,211,77,.10),transparent_70%)]" />
        <header className="relative flex items-start gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300/80">{eyebrow}</p>}
            <h2 id={titleId} className="mt-1 font-serif text-2xl leading-tight text-white">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1.5 text-sm leading-6 text-zinc-400">
                {description}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label={ui("Close")} className="-mr-1 rounded-xl p-2 text-zinc-500 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300">
            <CloseIcon size={18} />
          </button>
        </header>
        {children && (
          <div data-dialog-body className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {children}
          </div>
        )}
        {footer && <footer data-dialog-footer className="relative flex flex-wrap justify-end gap-2 border-t border-white/[0.06] bg-black/20 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
