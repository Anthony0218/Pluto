import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import SideBar from "./SideBar";

export default function NavigationDrawer({ onClose }: { onClose: () => void }) {
  useUiLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      document.getElementById("navigation-toggle")?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      id="app-navigation"
      aria-label={ui("Pluto navigation")}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-80 max-w-[90vw] border-r border-white/10 bg-transparent p-0 text-white shadow-2xl backdrop:bg-black/55 backdrop:backdrop-blur-md"
    >
      <div className="relative h-full">
        <button
          type="button"
          autoFocus
          onClick={onClose}
          aria-label={ui("Close navigation")}
          className="absolute left-3 top-5 z-10 rounded-lg p-2 text-zinc-300 hover:bg-white/10"
        >
          <X size={20} />
        </button>
        <SideBar onNavigate={onClose} />
      </div>
    </dialog>
  );
}
