import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { validateVariant } from "@/games/chess/custom/engine/validation";
import type { LibraryEntry, VariantVisibility } from "@/games/chess/custom/library/metadata";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import BoardThumbnail from "../BoardThumbnail";
import { PrivateIcon, PublicIcon, ShareIcon, WarningIcon } from "../icons/ChessCustomIcons";
import { Button, inputClass, labelClass } from "../ui";
import Dialog from "./Dialog";

const parseTags = (text: string) => [...new Set(text.split(",").map((tag) => tag.trim().slice(0, 24)).filter(Boolean))].slice(0, 6);

/**
 * Sharing publishes a snapshot of the saved variant to Community, or takes it
 * back down. Publishing again updates the public copy.
 */
export default function ShareDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const open = Boolean(entry);
  return open && entry ? <ShareForm key={entry.id} entry={entry} onClose={onClose} /> : null;
}

function ShareForm({ entry, onClose }: { entry: LibraryEntry; onClose: () => void }) {
  useGameLanguage();
  const { userId, share, unshare, loadSaved, editVariant } = useEditor();
  const current = entry.meta.visibility;
  const [visibility, setVisibility] = useState<VariantVisibility>(userId ? "public" : "private");
  const [name, setName] = useState(entry.name);
  const [description, setDescription] = useState(entry.description ?? "");
  const [tags, setTags] = useState("");
  const [errors, setErrors] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadSaved(entry.id).then((variant) => {
      if (cancelled || !variant) return;
      setTags((variant.tags ?? []).join(", "));
      setErrors(validateVariant(variant).filter((issue) => issue.severity === "error").length);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.id, loadSaved]);

  const signedIn = Boolean(userId);
  const publishing = visibility === "public";
  const blocked = publishing && (!signedIn || (errors ?? 0) > 0 || !description.trim() || !name.trim());
  const primaryLabel = !publishing ? (current === "public" ? ui("Make Private") : ui("Keep Private")) : current === "public" ? ui("Update Public Version") : ui("Publish to Community");

  async function submit() {
    setBusy(true);
    const done = publishing ? await share(entry.id, { name, description, tags: parseTags(tags) }) : current === "public" ? await unshare(entry.id) : true;
    setBusy(false);
    if (done) onClose();
  }

  const option = (id: VariantVisibility, label: string, detail: string, Icon: typeof PublicIcon, disabled = false) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber-300 ${
        visibility === id ? "border-amber-300/60 bg-amber-300/[0.08]" : "border-white/[0.08] hover:border-white/20"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input type="radio" name="visibility" value={id} checked={visibility === id} disabled={disabled} onChange={() => setVisibility(id)} className="sr-only" />
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${visibility === id ? "border-amber-300/50 text-amber-200" : "border-white/10 text-zinc-400"}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          {ui(label)}
          {current === id && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{ui("Current")}</span>}
        </span>
        <span className="block text-xs leading-5 text-zinc-500">{ui(detail)}</span>
      </span>
    </label>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow={current === "public" ? ui("Manage sharing") : ui("Share")}
      title={ui("Publish to Community")}
      description={ui("Public variants appear in the Community tab, where other players can play and remix them.")}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {ui("Cancel")}
          </Button>
          <Button tone={publishing ? "primary" : current === "public" ? "danger" : "ghost"} disabled={busy || blocked} onClick={() => void submit()}>
            {publishing ? <ShareIcon size={15} /> : <PrivateIcon size={15} />}
            {gameUi(primaryLabel)}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="hidden rounded-2xl border border-white/[0.06] bg-black/30 p-3 sm:block">
          <BoardThumbnail preview={entry.preview} label={gameUi(`${entry.name} ${ui("preview")}`)} className="aspect-square w-full" />
          <p className="mt-2 text-center text-[11px] text-zinc-500">{ui("Preview image is generated from the board.")}</p>
        </div>
        <div className="space-y-3">
          <fieldset className="grid gap-2">
            <legend className={`${labelClass} mb-1.5`}>{ui("Visibility")}</legend>
            {gameUi(option("private", "Private", "Only you can see and play it.", PrivateIcon))}
            {gameUi(option("public", "Public", "Listed in Community for everyone.", PublicIcon, !signedIn))}
          </fieldset>
          {gameUi(!signedIn && (
            <p className="rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-3 py-2 text-xs text-sky-100">
              {ui("Sign in to publish variants to Community.")}{gameUi(" ")}
              <Link to="/login" className="font-semibold underline underline-offset-2">
                {ui("Sign in")}
              </Link>
            </p>
          ))}
          {gameUi(publishing && signedIn && (
            <>
              <label className="block">
                <span className={labelClass}>{ui("Title")}</span>
                <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block">
                <span className={labelClass}>{ui("Description")}</span>
                <textarea value={description} rows={3} maxLength={600} onChange={(event) => setDescription(event.target.value)} placeholder={ui("What makes it fun? Any rules players should know?")} className={`${inputClass} mt-1.5 resize-y`} />
                {!description.trim() && <span className="mt-1 block text-[11px] text-amber-200/80">{ui("A short description is required to publish.")}</span>}
              </label>
              <label className="block">
                <span className={labelClass}>{ui("Tags")}</span>
                <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={ui("e.g. portals, 3 layers, fast")} className={`${inputClass} mt-1.5`} />
                <span className="mt-1 block text-[11px] text-zinc-500">{ui("Comma separated, up to 6.")}</span>
              </label>
              {gameUi((errors ?? 0) > 0 && (
                <p className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  <WarningIcon size={15} className="mt-0.5 shrink-0" />
                  <span>
                    {ui("Fix the validation errors before publishing:")} {gameUi(errors)}.{gameUi(" ")}
                    <button
                      type="button"
                      className="font-semibold underline underline-offset-2"
                      onClick={() => {
                        onClose();
                        editVariant(entry.id);
                      }}
                    >
                      {ui("Open in Create")}
                    </button>
                  </span>
                </p>
              ))}
              {current === "public" && entry.meta.publishedOutdated && <p className="text-xs text-amber-200/80">{ui("You have edited this variant since publishing. Update the public version to share your changes.")}</p>}
            </>
          ))}
          {!publishing && current === "public" && <p className="text-xs leading-5 text-zinc-400">{ui("Making it private removes it from Community. Your copy in My Games is kept.")}</p>}
        </div>
      </div>
    </Dialog>
  );
}
