import { useEffect, useRef, useState } from "react";
import { issueCounts } from "@/games/chess/custom/engine/validation";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import PlayModeDialog from "./dialogs/PlayModeDialog";
import { CheckIcon, CreateIcon, DuplicateIcon, PlayIcon, RedoIcon, SaveIcon, UndoIcon } from "./icons/ChessCustomIcons";
import { Button, IconButton, inputClass } from "./ui";

function SaveAsPopover({ onClose }: { onClose: () => void }) {
  const { variant, saveAs } = useEditor();
  const [name, setName] = useState(`${variant.name} (copy)`);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.select();
  }, []);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (await saveAs(name)) onClose();
      }}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-amber-300/25 bg-[#101318] p-3 shadow-2xl"
    >
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500" htmlFor="save-as-name">
        {ui("Save as a new variant")}
      </label>
      <input id="save-as-name" ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1.5`} maxLength={80} />
      <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">{ui("The copy is added to My Games and opened here; the original keeps its last saved version.")}</p>
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

/** Persistent Create bar: name, save state, undo/redo, Save, Save As and Play. */
export default function VariantToolbar() {
  const { variant, dispatch, canUndo, canRedo, dirty, inLibrary, save, issues, toast, playSaved } = useEditor();
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const counts = issueCounts(issues);
  const status = dirty ? ui("Unsaved changes") : inLibrary ? ui("Saved") : ui("Not saved yet");

  return (
    <div className="relative z-40 -mx-4 border-b border-white/[0.06] bg-[#07090b]/90 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[min(100%,260px)] flex-1 items-center gap-3">
          <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-200 sm:flex">
            <CreateIcon size={20} />
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
            <p className="flex items-center gap-1.5 px-2 text-[11px] text-zinc-500" aria-live="polite">
              {toast ? (
                <span className={toast.tone === "error" ? "text-red-300" : toast.tone === "info" ? "text-sky-300" : "text-emerald-300"}>{toast.text}</span>
              ) : (
                <>
                  <span className={`inline-flex items-center gap-1 font-semibold ${dirty ? "text-amber-200" : inLibrary ? "text-emerald-300" : "text-zinc-400"}`}>
                    {dirty ? <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" /> : inLibrary ? <CheckIcon size={12} /> : null}
                    {status}
                  </span>
                  {inLibrary && <span>· v{variant.version}</span>}
                  {counts.error > 0 && <span className="text-red-300"> · {counts.error} {ui("errors")}</span>}
                  {counts.error === 0 && counts.warning > 0 && <span className="text-amber-300"> · {counts.warning} {ui("warnings")}</span>}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <IconButton label={ui("Undo (Ctrl+Z)")} disabled={!canUndo} onClick={() => dispatch({ type: "undo" })}>
            <UndoIcon size={17} />
          </IconButton>
          <IconButton label={ui("Redo (Ctrl+Shift+Z)")} disabled={!canRedo} onClick={() => dispatch({ type: "redo" })}>
            <RedoIcon size={17} />
          </IconButton>
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <Button tone={dirty || !inLibrary ? "primary" : "ghost"} onClick={() => void save()} title={ui("Save (Ctrl+S)")}>
            <SaveIcon size={16} />
            <span className="hidden sm:inline">{ui("Save")}</span>
          </Button>
          <div className="relative">
            <IconButton label={ui("Save As / Duplicate")} active={saveAsOpen} onClick={() => setSaveAsOpen((open) => !open)}>
              <DuplicateIcon size={17} />
            </IconButton>
            {saveAsOpen && <SaveAsPopover onClose={() => setSaveAsOpen(false)} />}
          </div>
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <Button tone="blue" onClick={() => setPlayOpen(true)} title={ui("Choose how to play your variant")}>
            <PlayIcon size={16} />
            <span className="hidden md:inline">{ui("Play")}</span>
          </Button>
        </div>
      </div>
      <PlayModeDialog
        open={playOpen}
        variantName={variant.name}
        onClose={() => setPlayOpen(false)}
        onChoose={(mode) => {
          setPlayOpen(false);
          playSaved(variant.id, mode);
        }}
      />
    </div>
  );
}
