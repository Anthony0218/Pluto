import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { memo } from "react";
import type { LibraryEntry } from "@/games/chess/custom/library/metadata";
import { getBoardTheme } from "@/games/chess/custom/themes";
import { ui } from "@/i18n/ui";
import BoardThumbnail from "../BoardThumbnail";
import { timeAgo } from "../format";
import { DeleteIcon, DuplicateIcon, EditIcon, ExportIcon, LayersIcon, PlayIcon, PrivateIcon, PublicIcon, ShareIcon } from "../icons/ChessCustomIcons";
import OverflowMenu from "../OverflowMenu";

export interface VariantCardActions {
  onPlay: (entry: LibraryEntry) => void;
  onEdit: (entry: LibraryEntry) => void;
  onShare: (entry: LibraryEntry) => void;
  onDelete: (entry: LibraryEntry) => void;
  onDuplicate: (entry: LibraryEntry) => void;
  onExport: (entry: LibraryEntry) => void;
}

const actionClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

/** A saved variant presented as a playable game. */
function VariantCard({ entry, editing, guide, actions }: { entry: LibraryEntry; editing?: "clean" | "dirty"; guide?: boolean; actions: VariantCardActions }) {
  useGameLanguage();
  const theme = getBoardTheme(entry.preview?.theme ?? "classic-wood");
  const isPublic = entry.meta.visibility === "public";
  const layers = entry.layerCount ?? 1;
  const headingId = `variant-${entry.id}`;
  return (
    <article aria-labelledby={headingId} className="group/card flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d1014]/90 shadow-[0_18px_40px_rgba(0,0,0,.3)] transition hover:border-amber-300/30 hover:shadow-[0_24px_60px_rgba(0,0,0,.45)]">
      <div className="relative" style={{ background: theme.backdrop }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(56,189,248,.14),transparent_60%)]" />
        <button type="button" onClick={() => actions.onPlay(entry)} tabIndex={-1} aria-hidden="true" className="block w-full px-8 pb-5 pt-9">
          <BoardThumbnail preview={entry.preview} label={gameUi(`${entry.name} ${ui("board preview")}`)} className="mx-auto aspect-square w-full max-w-[200px] drop-shadow-[0_14px_22px_rgba(0,0,0,.55)] transition duration-300 motion-safe:group-hover/card:scale-[1.03]" />
        </button>
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold backdrop-blur-md ${
            isPublic ? "border-sky-400/40 bg-sky-400/15 text-sky-100" : "border-white/15 bg-black/50 text-zinc-300"
          }`}
        >
          {isPublic ? <PublicIcon size={13} /> : <PrivateIcon size={13} />}
          {gameUi(isPublic ? ui("Public") : ui("Private"))}
          {isPublic && entry.meta.publishedOutdated && <span className="text-amber-200" title={ui("Edited since publishing")}>{gameUi("·")}{ui("update available")}</span>}
        </span>
        {gameUi(editing && (
          <span className="absolute right-3 top-3 rounded-full border border-amber-300/40 bg-amber-300/15 px-2.5 py-1 text-[11px] font-bold text-amber-100 backdrop-blur-md">
            {gameUi(editing === "dirty" ? ui("Editing · unsaved") : ui("Open in Create"))}
          </span>
        ))}
        {gameUi(layers > 1 && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-sky-100 backdrop-blur-md">
            <LayersIcon size={13} />
            {gameUi(layers)}
          </span>
        ))}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 id={headingId} className="truncate font-serif text-xl text-white">
          {gameUi(entry.name)}
        </h3>
        {entry.description ? <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-400">{gameUi(entry.description)}</p> : <p className="mt-1 text-sm italic text-zinc-600">{ui("No description yet.")}</p>}
        <dl className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
            <dt className="sr-only">{ui("Board")}</dt>
            <dd>{gameUi(entry.boardSize)}</dd>
          </div>
          {gameUi(layers > 1 && (
            <div className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 text-sky-200">
              <dt className="sr-only">{ui("Layers")}</dt>
              <dd>
                {gameUi(layers)} {ui("Layers")}
              </dd>
            </div>
          ))}
          {gameUi((entry.teamCount ?? 2) > 2 && (
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
              <dt className="sr-only">{ui("Players")}</dt>
              <dd>
                {gameUi(entry.teamCount)} {ui("players")}
              </dd>
            </div>
          ))}
          {gameUi(entry.kingRule && (
            <div className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-amber-200">
              <dt className="sr-only">{ui("King rule")}</dt>
              <dd>{ui(entry.kingRule)}</dd>
            </div>
          ))}
          {entry.victory?.slice(0, 1).map((label) => (
            <div key={label} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-zinc-300">
              <dt className="sr-only">{ui("Victory")}</dt>
              <dd>{ui(label)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-zinc-500">
          {ui("Edited")} <time dateTime={entry.meta.updatedAt}>{gameUi(timeAgo(entry.meta.updatedAt))}</time>
        </p>

        <div className="mt-auto flex items-center gap-1.5 pt-4">
          <button type="button" data-guide={guide ? "card-play" : undefined} onClick={() => actions.onPlay(entry)} className={`${actionClass} flex-1 border-amber-300/60 bg-amber-300 text-zinc-950 hover:bg-amber-200 sm:flex-none`}>
            <PlayIcon size={15} />
            {ui("Play")}
          </button>
          <button type="button" onClick={() => actions.onEdit(entry)} className={`${actionClass} hidden border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:text-white sm:inline-flex`}>
            <EditIcon size={15} />
            {ui("Edit")}
          </button>
          <button
            type="button"
            data-guide={guide ? "card-share" : undefined}
            onClick={() => actions.onShare(entry)}
            className={`${actionClass} hidden sm:inline-flex ${isPublic ? "border-sky-400/40 bg-sky-400/15 text-sky-100 hover:bg-sky-400/25" : "border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:text-white"}`}
          >
            <ShareIcon size={15} />
            {gameUi(isPublic ? ui("Manage Sharing") : ui("Share"))}
          </button>
          <button type="button" onClick={() => actions.onDelete(entry)} aria-label={gameUi(`${ui("Delete")} ${entry.name}`)} title={ui("Delete")} className={`${actionClass} hidden border-red-400/20 bg-red-500/[0.06] text-red-200 hover:bg-red-500/15 sm:inline-flex`}>
            <DeleteIcon size={15} />
            <span className="hidden xl:inline">{ui("Delete")}</span>
          </button>
          <OverflowMenu
            label={gameUi(`${ui("More actions for")} ${entry.name}`)}
            guide={guide ? "card-more" : undefined}
            className="ml-auto"
            items={[
              { id: "edit", label: "Edit", icon: <EditIcon size={16} />, onSelect: () => actions.onEdit(entry), mobileOnly: true },
              { id: "share", label: isPublic ? "Manage Sharing" : "Share", icon: <ShareIcon size={16} />, onSelect: () => actions.onShare(entry), mobileOnly: true },
              { id: "duplicate", label: "Duplicate", icon: <DuplicateIcon size={16} />, onSelect: () => actions.onDuplicate(entry) },
              { id: "export", label: "Export JSON", icon: <ExportIcon size={16} />, onSelect: () => actions.onExport(entry) },
              { id: "delete", label: "Delete", icon: <DeleteIcon size={16} />, onSelect: () => actions.onDelete(entry), tone: "danger", mobileOnly: true },
            ]}
          />
        </div>
      </div>
    </article>
  );
}

export default memo(VariantCard);
