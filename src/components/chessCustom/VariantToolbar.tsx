import { CopyPlus, Play, Redo2, Save, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { issueCounts } from "@/games/chess/custom/engine/validation";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import { Button, IconButton, inputClass } from "./ui";

function SaveAsPopover({ onClose }: { onClose: () => void }) {
  const { variant, saveAs } = useEditor();
  const [name, setName] = useState(`${variant.name} remix`);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.select();
  }, []);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await saveAs(name);
        onClose();
      }}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-amber-300/25 bg-[#101318] p-3 shadow-2xl"
    >
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500" htmlFor="save-as-name">
        {ui("Save a copy as")}
      </label>
      <input id="save-as-name" ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1.5`} maxLength={80} />
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" onClick={onClose}>
          {ui("Cancel")}
        </Button>
        <Button size="sm" tone="primary" type="submit" disabled={!name.trim()}>
          {ui("Save copy")}
        </Button>
      </div>
    </form>
  );
}

export default function VariantToolbar() {
  const { variant, dispatch, canUndo, canRedo, dirty, save, setSection, issues, toast } = useEditor();
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const counts = issueCounts(issues);

  return (
    <div className="relative z-40 -mx-4 border-b border-white/[0.06] bg-[#07090b]/90 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:sticky lg:top-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[min(100%,260px)] flex-1 items-center gap-3">
          <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 font-serif text-lg text-amber-200 sm:flex">
            ⚙
          </span>
          <div className="min-w-0 flex-1">
            <label htmlFor="variant-name" className="sr-only">
              {ui("Variant name")}
            </label>
            <input
              id="variant-name"
              value={variant.name}
              maxLength={80}
              onChange={(event) => dispatch({ type: "update", recipe: (current) => ({ ...current, name: event.target.value }), coalesceKey: "name" })}
              className="w-full min-w-0 max-w-[420px] truncate rounded-lg border border-transparent bg-transparent px-2 py-1 font-serif text-lg text-white outline-none transition hover:border-white/10 focus:border-amber-300/40 focus:bg-black/30"
            />
            <p className="px-2 text-[11px] text-zinc-500" aria-live="polite">
              {toast ? (
                <span className={toast.tone === "error" ? "text-red-300" : toast.tone === "info" ? "text-sky-300" : "text-emerald-300"}>{toast.text}</span>
              ) : (
                <>
                  {dirty ? ui("Unsaved changes") : ui("All changes saved")} · v{variant.version}
                  {counts.error > 0 && <span className="text-red-300"> · {counts.error} {ui("errors")}</span>}
                  {counts.error === 0 && counts.warning > 0 && <span className="text-amber-300"> · {counts.warning} {ui("warnings")}</span>}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <IconButton label={ui("Undo (Ctrl+Z)")} disabled={!canUndo} onClick={() => dispatch({ type: "undo" })}>
            <Undo2 size={16} />
          </IconButton>
          <IconButton label={ui("Redo (Ctrl+Shift+Z)")} disabled={!canRedo} onClick={() => dispatch({ type: "redo" })}>
            <Redo2 size={16} />
          </IconButton>
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <Button tone={dirty ? "primary" : "ghost"} onClick={() => void save()} title={ui("Save (Ctrl+S)")}>
            <Save size={15} />
            <span className="hidden sm:inline">{ui("Save")}</span>
          </Button>
          <div className="relative">
            <IconButton label={ui("Save as…")} active={saveAsOpen} onClick={() => setSaveAsOpen((open) => !open)}>
              <CopyPlus size={16} />
            </IconButton>
            {saveAsOpen && <SaveAsPopover onClose={() => setSaveAsOpen(false)} />}
          </div>
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <Button tone="blue" onClick={() => setSection("simulation")} title={ui("Play your variant in the 3D or 2D simulation")}>
            <Play size={15} />
            <span className="hidden md:inline">{ui("Simulate / Test")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
