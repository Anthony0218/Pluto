import { Cloud, Copy, Download, FolderOpen, HardDrive, Save, Trash2, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import { Button, Chip, EmptyState, IconButton, SectionHeading } from "../ui";

export default function SavedSection() {
  const { saved, openSaved, duplicateSaved, deleteSaved, exportSaved, save, variant, dirty, importJson, notify, storage, moveLocalToCloud } = useEditor();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function importFile(file: File) {
    const result = importJson(await file.text());
    if (result.errors.length) notify(`Import failed: ${result.errors[0]}`, "error");
  }

  return (
    <div>
      <SectionHeading
        eyebrow="Library"
        title="Saved variants"
        description={ui("Export JSON to back variants up or share them — imports are validated before they are applied. Publish to the Community tab to let others play.")}
        actions={
          <>
            <Button tone="primary" onClick={() => void save()}>
              <Save size={15} />
              {ui("Save current")}
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={15} />
              {ui("Import JSON")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.target.value = "";
              }}
            />
          </>
        }
      />
      <div className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${storage.error ? "border-amber-300/30 bg-amber-300/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}>
        {storage.mode === "cloud" ? <Cloud size={18} className="text-sky-300" /> : <HardDrive size={18} className="text-zinc-400" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-100">{storage.mode === "cloud" ? (storage.error ? ui("Your account storage is unreachable") : ui("Saved to your account")) : ui("Saved in this browser")}</p>
          <p className="text-xs text-zinc-500">
            {storage.mode === "cloud"
              ? storage.error
                ? `${ui("Showing this browser's copies; saves fall back here until it is back.")} (${storage.error})`
                : ui("Your variants follow you to any device you sign in on.")
              : ui("Sign in to keep variants in your account and use them on every device.")}
          </p>
        </div>
        {storage.mode === "local" && (
          <Link to="/login" className="rounded-xl border border-sky-400/40 bg-sky-400/15 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-400/25">
            {ui("Sign in")}
          </Link>
        )}
        {storage.mode === "cloud" && !storage.error && storage.localCount > 0 && (
          <Button size="sm" tone="blue" onClick={() => void moveLocalToCloud()}>
            <Upload size={13} />
            {ui("Move")} {storage.localCount} {ui("browser variant(s) to your account")}
          </Button>
        )}
      </div>
      {saved.length === 0 ? (
        <EmptyState icon={<FolderOpen size={20} />} title={ui("Nothing saved yet")} action={<Button tone="primary" onClick={() => void save()}>{ui("Save")} “{variant.name}”</Button>}>
          {ui("Save your variant to keep it, duplicate it into remixes, or export it as JSON.")}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {saved.map((entry) => {
            const isCurrent = entry.id === variant.id;
            return (
              <li key={entry.id} className={`rounded-2xl border p-4 ${isCurrent ? "border-amber-300/40 bg-amber-300/[0.04]" : "border-white/[0.08] bg-[#0d1014]/90"}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-serif text-lg text-white">
                      <span className="truncate">{entry.name}</span>
                      {isCurrent && <Chip tone="amber">{dirty ? ui("Open · unsaved edits") : ui("Open")}</Chip>}
                    </p>
                    {entry.description && <p className="mt-0.5 line-clamp-2 text-sm text-zinc-400">{entry.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Chip>{entry.boardSize}</Chip>
                      <Chip>{entry.pieceCount} {ui("piece types")}</Chip>
                      <Chip>v{entry.version}</Chip>
                      <Chip>{new Date(entry.updatedAt).toLocaleString()}</Chip>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <IconButton label={ui("Duplicate")} onClick={() => void duplicateSaved(entry.id)}>
                      <Copy size={14} />
                    </IconButton>
                    <IconButton label={ui("Export JSON")} onClick={() => void exportSaved(entry.id)}>
                      <Download size={14} />
                    </IconButton>
                    <IconButton label={ui("Delete")} onClick={() => setConfirmDelete(entry.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
                {confirmDelete === entry.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                    {ui("Delete permanently from this browser?")}
                    <Button size="sm" tone="danger" onClick={() => void deleteSaved(entry.id).then(() => setConfirmDelete(null))}>
                      {ui("Delete")}
                    </Button>
                    <Button size="sm" onClick={() => setConfirmDelete(null)}>
                      {ui("Cancel")}
                    </Button>
                  </div>
                ) : confirmOpen === entry.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                    {ui("Discard unsaved changes to the current variant?")}
                    <Button size="sm" tone="primary" onClick={() => void openSaved(entry.id)}>
                      {ui("Open anyway")}
                    </Button>
                    <Button size="sm" onClick={() => setConfirmOpen(null)}>
                      {ui("Cancel")}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" className="mt-3" disabled={isCurrent && !dirty} onClick={() => (dirty && !isCurrent ? setConfirmOpen(entry.id) : void openSaved(entry.id))}>
                    <FolderOpen size={13} />
                    {isCurrent ? ui("Revert to saved") : ui("Open")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
