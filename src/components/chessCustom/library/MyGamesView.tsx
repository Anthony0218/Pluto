import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { filterLibrary, LIBRARY_SORTS, sortLibrary, type LibraryEntry, type LibrarySort } from "@/games/chess/custom/library/metadata";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import DeleteVariantDialog from "../dialogs/DeleteVariantDialog";
import PlayModeDialog from "../dialogs/PlayModeDialog";
import ShareDialog from "../dialogs/ShareDialog";
import { CloudIcon, CreateIcon, DeviceIcon, ImportIcon, MyGamesIcon, SearchIcon, WarningIcon } from "../icons/ChessCustomIcons";
import { Button, inputClass } from "../ui";
import VariantCard, { type VariantCardActions } from "./VariantCard";

/** My Chess Games: the player's library and the Chess Custom home page. */
export default function MyGamesView() {
  const { library, libraryStatus, variant, dirty, inLibrary, createNew, editVariant, playSaved, duplicateSaved, exportSaved, importJson, notify, storage, moveLocalToCloud, discardChanges, goToStep } = useEditor();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("updated");
  const [playing, setPlaying] = useState<LibraryEntry | null>(null);
  const [sharing, setSharing] = useState<LibraryEntry | null>(null);
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => sortLibrary(filterLibrary(library, query), sort), [library, query, sort]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const actions = useMemo<VariantCardActions>(
    () => ({
      onPlay: setPlaying,
      onEdit: (entry) => editVariant(entry.id),
      onShare: setSharing,
      onDelete: setDeleting,
      onDuplicate: (entry) => void duplicateSaved(entry.id),
      onExport: (entry) => void exportSaved(entry.id),
    }),
    [editVariant, duplicateSaved, exportSaved],
  );

  async function importFile(file: File) {
    const result = importJson(await file.text());
    if (result.errors.length) notify(`${ui("Import failed:")} ${result.errors[0]}`, "error");
  }

  return (
    <div className="pt-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300/80">{ui("My Games")}</p>
          <h1 className="mt-1.5 font-serif text-[32px] leading-tight text-white sm:text-[40px]">{ui("My Chess Games")}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{ui("Every chess variant you have created or saved. Play them, keep refining them, or share them with the community.")}</p>
        </div>
        <button
          type="button"
          data-guide="create-new"
          onClick={createNew}
          className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 px-5 py-3.5 text-left font-semibold text-zinc-950 shadow-[0_12px_40px_rgba(252,211,77,.25)] transition hover:shadow-[0_16px_50px_rgba(252,211,77,.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950/10">
            <CreateIcon size={24} />
          </span>
          <span>
            <span className="block text-base">{ui("Create New Chess Variant")}</span>
            <span className="block text-xs font-medium text-zinc-900/70">{ui("Board, pieces, rules — step by step")}</span>
          </span>
        </button>
      </header>

      {dirty && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] px-4 py-3 text-sm">
          <WarningIcon size={18} className="text-amber-300" />
          <p className="min-w-[min(100%,220px)] flex-1 text-amber-50">
            <span className="font-semibold">“{variant.name}”</span> {inLibrary ? ui("has unsaved changes.") : ui("is not saved to My Games yet.")}
          </p>
          {confirmDiscard ? (
            <>
              <span className="text-xs text-amber-100">{ui("Discard these changes?")}</span>
              <Button size="sm" tone="danger" onClick={() => void discardChanges().then(() => setConfirmDiscard(false))}>
                {ui("Discard")}
              </Button>
              <Button size="sm" onClick={() => setConfirmDiscard(false)}>
                {ui("Cancel")}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" tone="primary" onClick={() => goToStep("overview")}>
                {ui("Continue editing")}
              </Button>
              <Button size="sm" onClick={() => setConfirmDiscard(true)}>
                {ui("Discard")}
              </Button>
            </>
          )}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <span className="sr-only">{ui("Search your variants")}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui("Search your variants")} className={`${inputClass} pl-9`} />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          {ui("Sort")}
          <select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)} className={`${inputClass} w-auto cursor-pointer py-1.5`}>
            {LIBRARY_SORTS.map((option) => (
              <option key={option.id} value={option.id} className="bg-zinc-900">
                {ui(option.label)}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" onClick={() => fileRef.current?.click()} className="ml-auto">
          <ImportIcon size={15} />
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
      </div>

      {libraryStatus === "loading" ? (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy="true" aria-label={ui("Loading your variants")}>
          {[0, 1, 2].map((index) => (
            <li key={index} className="h-[420px] rounded-3xl border border-white/[0.06] bg-white/[0.02] motion-safe:animate-pulse" />
          ))}
        </ul>
      ) : library.length === 0 ? (
        <section className="flex flex-col items-center rounded-3xl border border-dashed border-amber-300/20 bg-[radial-gradient(ellipse_at_50%_0%,rgba(252,211,77,.08),transparent_60%)] px-6 py-16 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-300/30 bg-amber-300/10 text-amber-200">
            <MyGamesIcon size={34} />
          </span>
          <h2 className="font-serif text-2xl text-white">{ui("Create your first Chess Variant")}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{ui("Design the board, redefine pieces, change the rules, and play it against other players.")}</p>
          <Button tone="primary" className="mt-5" onClick={createNew}>
            <CreateIcon size={16} />
            {ui("Create New Chess Variant")}
          </Button>
        </section>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.06] px-4 py-10 text-center text-sm text-zinc-500">{ui("No variants match your search.")}</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((entry, index) => (
            <li key={entry.id} className="flex">
              <div className="flex w-full flex-col [&>article]:flex-1">
                <VariantCard entry={entry} guide={index === 0} editing={entry.id === variant.id ? (dirty ? "dirty" : "clean") : undefined} actions={actions} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={`mt-8 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${storage.error ? "border-amber-300/30 bg-amber-300/[0.06]" : "border-white/[0.06] bg-white/[0.02]"}`}>
        {storage.mode === "cloud" ? <CloudIcon size={18} className="text-sky-300" /> : <DeviceIcon size={18} className="text-zinc-400" />}
        <p className="min-w-0 flex-1 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-200">{storage.mode === "cloud" ? (storage.error ? ui("Your account storage is unreachable") : ui("Saved to your account")) : ui("Saved in this browser")}</span>
          {" — "}
          {storage.mode === "cloud"
            ? storage.error
              ? `${ui("Showing this browser's copies; saves fall back here until it is back.")} (${storage.error})`
              : ui("Your variants follow you to any device you sign in on.")
            : ui("Sign in to keep variants in your account and share them with the community.")}
        </p>
        {storage.mode === "local" && (
          <Link to="/login" className="rounded-xl border border-sky-400/40 bg-sky-400/15 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-400/25">
            {ui("Sign in")}
          </Link>
        )}
        {storage.mode === "cloud" && !storage.error && storage.localCount > 0 && (
          <Button size="sm" tone="blue" onClick={() => void moveLocalToCloud()}>
            {ui("Move")} {storage.localCount} {ui("browser variant(s) to your account")}
          </Button>
        )}
      </div>

      <PlayModeDialog
        open={Boolean(playing)}
        variantName={playing?.name ?? ""}
        onClose={() => setPlaying(null)}
        onChoose={(mode) => {
          const entry = playing;
          setPlaying(null);
          if (entry) playSaved(entry.id, mode);
        }}
      />
      <ShareDialog entry={sharing} onClose={() => setSharing(null)} />
      <DeleteVariantDialog entry={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
