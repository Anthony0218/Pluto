import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useState } from "react";
import type { LibraryEntry } from "@/games/chess/custom/library/metadata";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import { DeleteIcon } from "../icons/ChessCustomIcons";
import { Button } from "../ui";
import Dialog from "./Dialog";

/** Deleting is never one accidental click away. */
export default function DeleteVariantDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  useGameLanguage();
  const { deleteSaved, storage } = useEditor();
  const [busy, setBusy] = useState(false);
  const [alsoUnpublish, setAlsoUnpublish] = useState(true);
  const isPublic = entry?.meta.visibility === "public";
  return (
    <Dialog
      open={Boolean(entry)}
      onClose={onClose}
      size="sm"
      tone="danger"
      eyebrow={ui("Delete variant")}
      title={<>{ui("Delete")} “{gameUi(entry?.name)}”?</>}
      description={gameUi(`${ui("This cannot be undone.")} ${storage.mode === "cloud" ? ui("It is removed from your account.") : ui("It is removed from this browser.")}`)}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {ui("Cancel")}
          </Button>
          <Button
            tone="danger"
            disabled={busy || !entry}
            onClick={async () => {
              if (!entry) return;
              setBusy(true);
              const done = await deleteSaved(entry.id, { unpublish: isPublic && alsoUnpublish });
              setBusy(false);
              if (done) onClose();
            }}
          >
            <DeleteIcon size={15} />
            {ui("Delete")}
          </Button>
        </>
      }
    >
      {gameUi(isPublic && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm">
          <input type="checkbox" checked={alsoUnpublish} onChange={(event) => setAlsoUnpublish(event.target.checked)} className="mt-0.5 accent-amber-300" />
          <span>
            <span className="block font-semibold text-zinc-100">{ui("Also remove it from Community")}</span>
            <span className="text-xs text-zinc-500">{ui("Otherwise the public copy stays playable until you unpublish it there.")}</span>
          </span>
        </label>
      ))}
    </Dialog>
  );
}
