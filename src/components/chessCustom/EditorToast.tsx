import { useEditor } from "@/games/chess/custom/editor/editorContext";

/** Floating status message for views without the editor toolbar (the simulation). */
export default function EditorToast() {
  const { toast } = useEditor();
  if (!toast) return null;
  const tone = toast.tone === "error" ? "border-red-400/40 text-red-100" : toast.tone === "info" ? "border-sky-400/40 text-sky-100" : "border-emerald-400/40 text-emerald-100";
  return (
    <div role="status" aria-live="polite" className={`fixed bottom-24 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full border bg-black/80 px-4 py-2 text-sm shadow-2xl backdrop-blur-xl ${tone}`}>
      {toast.text}
    </div>
  );
}
