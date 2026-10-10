import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { validateVariant } from "@/games/chess/custom/engine/validation";
import type { LibraryEntry } from "@/games/chess/custom/library/metadata";
import { sortLibrary } from "@/games/chess/custom/library/metadata";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import BoardThumbnail from "../BoardThumbnail";
import Dialog from "../dialogs/Dialog";
import { PublicIcon, ShareIcon, WarningIcon } from "../icons/ChessCustomIcons";
import { Button, inputClass, labelClass } from "../ui";

/**
 * Publish from Community: pick one of your saved variants, give it a title
 * and description, and share it. Publishing an already-public variant updates it.
 */
export default function PublishVariantDialog({ open, onClose, onPublished }: { open: boolean; onClose: () => void; onPublished: () => void }) {
  return open ? <PublishForm onClose={onClose} onPublished={onPublished} /> : null;
}

function PublishForm({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  useGameLanguage();
  const { userId, library, libraryStatus, share, loadSaved, editVariant, go } = useEditor();
  const entries = sortLibrary(library, "updated");
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const [name, setName] = useState(selected?.name ?? "");
  const [description, setDescription] = useState(selected?.description ?? "");
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Before the library has loaded there is nothing to preselect; pick the newest once it arrives.
  if (!selectedId && entries[0]) choose(entries[0]);

  function choose(entry: LibraryEntry) {
    setSelectedId(entry.id);
    setName(entry.name);
    setDescription(entry.description ?? "");
    setTags([]);
    setErrors(null);
  }

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void loadSaved(selectedId).then((variant) => {
      if (cancelled || !variant) return;
      setTags(variant.tags ?? []);
      setErrors(validateVariant(variant).filter((issue) => issue.severity === "error").length);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadSaved]);

  const signedIn = Boolean(userId);
  const isPublic = selected?.meta.visibility === "public";
  const blocked = !signedIn || !selected || errors === null || errors > 0 || !name.trim() || !description.trim();

  async function submit() {
    if (!selected) return;
    setBusy(true);
    const done = await share(selected.id, { name, description, tags });
    setBusy(false);
    if (!done) return;
    onPublished();
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      eyebrow={ui("Community")}
      title={ui("Publish your variant")}
      description={ui("Choose one of your games, give it a name and a description, and share it with everyone.")}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {ui("Cancel")}
          </Button>
          <Button tone="primary" disabled={busy || blocked} onClick={() => void submit()}>
            <ShareIcon size={15} />
            {gameUi(isPublic ? ui("Update Public Version") : ui("Publish to Community"))}
          </Button>
        </>
      }
    >
      {gameUi(!signedIn ? (
        <p className="rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-3 py-2 text-sm text-sky-100">
          {ui("Sign in to publish variants to Community.")}{gameUi(" ")}
          <Link to="/login" className="font-semibold underline underline-offset-2">
            {ui("Sign in")}
          </Link>
        </p>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400">
          {gameUi(libraryStatus === "loading" ? (
            <span role="status">{ui("Loading your games…")}</span>
          ) : (
            <>
              <p>{ui("You don't have any saved games yet.")}</p>
              <Button
                className="mt-3"
                onClick={() => {
                  onClose();
                  go({ view: "create", step: "overview" });
                }}
              >
                {ui("Create a variant")}
              </Button>
            </>
          ))}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <fieldset className="min-w-0">
            <legend className={`${labelClass} mb-2`}>{ui("Your games")}</legend>
            <div className="grid max-h-[340px] gap-2 overflow-y-auto pr-1">
              {entries.map((entry) => {
                const active = entry.id === selectedId;
                return (
                  <label
                    key={entry.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-2.5 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber-300 ${
                      active ? "border-amber-300/60 bg-amber-300/[0.08]" : "border-white/[0.08] hover:border-white/20"
                    }`}
                  >
                    <input type="radio" name="publish-variant" value={entry.id} checked={active} onChange={() => choose(entry)} className="sr-only" />
                    <BoardThumbnail preview={entry.preview} label={gameUi(`${entry.name} ${ui("preview")}`)} className="aspect-square w-12 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-100">{gameUi(entry.name)}</span>
                      <span className="block truncate text-xs text-zinc-500">{gameUi(entry.description || ui("No description."))}</span>
                    </span>
                    {gameUi(entry.meta.visibility === "public" && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                        <PublicIcon size={12} />
                        {ui("Public")}
                      </span>
                    ))}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="min-w-0 space-y-3">
            <label className="block">
              <span className={labelClass}>{ui("Name")}</span>
              <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1.5`} />
            </label>
            <label className="block">
              <span className={labelClass}>{ui("Description")}</span>
              <textarea value={description} rows={5} maxLength={600} onChange={(event) => setDescription(event.target.value)} placeholder={ui("What makes it fun? Any rules players should know?")} className={`${inputClass} mt-1.5 resize-y`} />
              {!description.trim() && <span className="mt-1 block text-[11px] text-amber-200/80">{ui("A short description is required to publish.")}</span>}
            </label>
            {isPublic && <p className="text-xs leading-5 text-zinc-400">{ui("This variant is already public. Publishing again updates the public version.")}</p>}
            {gameUi((errors ?? 0) > 0 && selected && (
              <p className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                <WarningIcon size={15} className="mt-0.5 shrink-0" />
                <span>
                  {ui("Fix the validation errors before publishing:")} {gameUi(errors)}.{gameUi(" ")}
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-2"
                    onClick={() => {
                      onClose();
                      editVariant(selected.id);
                    }}
                  >
                    {ui("Open in Create")}
                  </button>
                </span>
              </p>
            ))}
          </div>
        </div>
      ))}
    </Dialog>
  );
}
