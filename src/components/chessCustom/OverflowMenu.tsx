import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ui } from "@/i18n/ui";
import { MoreIcon } from "./icons/ChessCustomIcons";

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "danger";
  /** Only shown below the `sm` breakpoint (actions that collapse on phones). */
  mobileOnly?: boolean;
}

/** A small keyboard-friendly actions menu (Escape closes, arrows move). */
export default function OverflowMenu({ items, label, guide, className = "" }: { items: MenuItem[]; label: string; guide?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const visible = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])].filter((item) => item.offsetParent !== null);
    visible()[0]?.focus();
    function onPointer(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      const items = visible();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        button.current?.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      } else if (event.key === "Tab") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-guide={guide}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-2 focus-visible:outline-amber-300 ${open ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:text-white"}`}
      >
        <MoreIcon size={18} />
      </button>
      {open && (
        <ul ref={menu} id={id} role="menu" aria-label={label} className="absolute bottom-full right-0 z-50 mb-2 min-w-[180px] rounded-2xl border border-amber-300/20 bg-[#101318] p-1.5 shadow-2xl">
          {items.map((item) => (
            <li key={item.id} role="none" className={item.mobileOnly ? "sm:hidden" : ""}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition focus-visible:outline-none ${
                  item.tone === "danger" ? "text-red-200 hover:bg-red-500/15 focus:bg-red-500/15" : "text-zinc-200 hover:bg-white/[0.07] focus:bg-white/[0.07]"
                }`}
              >
                {item.icon}
                {ui(item.label)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
