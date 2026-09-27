import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import SideBar from "./SideBar";

export default function NavigationDrawer({ onClose }: { onClose: () => void }) {
  useUiLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  function close() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) onClose();
    else setClosing(true);
  }
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(onClose, 250);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  return (
    <dialog
      ref={dialog}
      id="app-navigation"
      aria-label={ui("Pluto navigation")}
      onCancel={event => { event.preventDefault(); close(); }}
      data-closing={closing || undefined}
      onAnimationEnd={event => { if (event.target === event.currentTarget && closing) onClose(); }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-80 max-w-[90vw] border-l border-white/10 bg-transparent p-0 text-white shadow-2xl backdrop:bg-black/55 backdrop:backdrop-blur-md"
    >
      <div className="relative h-full">
        <button
          type="button"
          autoFocus
          onClick={close}
          aria-label={ui("Close navigation")}
          className="absolute right-3 top-5 z-10 rounded-lg p-2 text-zinc-300 hover:bg-white/10"
        >
          <X size={20} />
        </button>
        <SideBar onNavigate={close} />
      </div>
    </dialog>
  );
}
