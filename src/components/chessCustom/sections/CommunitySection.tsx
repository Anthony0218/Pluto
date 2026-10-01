import { ChevronDown, ChevronUp, Globe, Pencil, Play, RefreshCw, Search, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CommunityEntry, CommunitySort } from "@/games/chess/custom/storage/communityService";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import { Button, Chip, EmptyState, Panel, SectionHeading, Segmented, inputClass } from "../ui";

const PAGE = 24;
const errorText = (error: unknown) => (error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "Something went wrong");

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return ui("today");
  if (days === 1) return ui("yesterday");
  if (days < 30) return `${days} ${ui("days ago")}`;
  return new Date(iso).toLocaleDateString();
}

function VoteControl({ entry, onVote, disabled, reason }: { entry: CommunityEntry; onVote: (value: -1 | 0 | 1) => void; disabled: boolean; reason?: string }) {
  const button = (value: 1 | -1) => {
    const active = entry.myVote === value;
    const Icon = value === 1 ? ChevronUp : ChevronDown;
    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={active}
        aria-label={value === 1 ? ui("Upvote") : ui("Downvote")}
        title={reason ?? (active ? ui("Remove your vote") : value === 1 ? ui("Upvote") : ui("Downvote"))}
        onClick={() => onVote(active ? 0 : value)}
        className={`flex h-7 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${
          active ? (value === 1 ? "bg-emerald-400/20 text-emerald-200" : "bg-red-400/20 text-red-200") : "text-zinc-400 hover:bg-white/[0.08] hover:text-white"
        }`}
      >
        <Icon size={18} />
      </button>
    );
  };
  return (
    <div className="flex flex-col items-center rounded-xl border border-white/[0.08] bg-black/30 px-1 py-1" title={`${entry.upvotes} up · ${entry.downvotes} down`}>
      {button(1)}
      <span className={`py-0.5 text-sm font-bold ${entry.score > 0 ? "text-emerald-200" : entry.score < 0 ? "text-red-200" : "text-zinc-300"}`}>{entry.score}</span>
      {button(-1)}
    </div>
  );
}

function PublishPanel({ onPublished }: { onPublished: () => void }) {
  const { variant, issues, userId, community, notify } = useEditor();
  const [description, setDescription] = useState(variant.description ?? "");
  const [busy, setBusy] = useState(false);
  const [seenVariant, setSeenVariant] = useState(variant.id);
  if (seenVariant !== variant.id) {
    setSeenVariant(variant.id);
    setDescription(variant.description ?? "");
  }
  const errors = issues.filter((issue) => issue.severity === "error").length;

  if (!userId) {
    return (
      <Panel title={ui("Share your variant")}>
        <p className="text-sm text-zinc-400">{ui("Sign in to publish variants and vote on other players' creations. Anyone can browse and play.")}</p>
        <Link to="/login" className="mt-3 inline-flex rounded-xl border border-sky-400/40 bg-sky-400/15 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-400/25">
          {ui("Sign in")}
        </Link>
      </Panel>
    );
  }

  return (
    <Panel title={`${ui("Publish")} “${variant.name}”`} eyebrow={ui("Share a snapshot with everyone")}>
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("Description")}</span>
        <textarea
          value={description}
          rows={4}
          maxLength={600}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={ui("What makes it fun? Any rules players should know?")}
          className={`${inputClass} mt-1.5 resize-y`}
        />
      </label>
      <p className="mt-1 text-right text-[11px] text-zinc-600">{description.length}/600</p>
      {errors > 0 && <p className="mt-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">{ui("Fix the validation errors before publishing:")} {errors}</p>}
      <Button
        tone="primary"
        className="mt-3 w-full"
        disabled={busy || errors > 0 || !description.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await community.publish(variant, description.trim());
            notify(`${ui("Published to the community:")} “${variant.name}”`);
            onPublished();
          } catch (error) {
            notify(`${ui("Could not publish")} — ${errorText(error)}`, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Send size={15} />
        {ui("Publish / update")}
      </Button>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">{ui("Publishing shares the current version. Later edits stay private until you publish again.")}</p>
    </Panel>
  );
}

export default function CommunitySection() {
  const { community, userId, playVariant, setSection, notify } = useEditor();
  const [sort, setSort] = useState<CommunitySort>("top");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // Debounce typing into the search box.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    community.list(sort, search, PAGE, 0).then(
      (rows) => {
        if (cancelled) return;
        setEntries(rows);
        setHasMore(rows.length === PAGE);
        setStatus("ready");
      },
      (failure) => {
        if (cancelled) return;
        setError(errorText(failure));
        setStatus("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [community, sort, search, reload, userId]);

  const refresh = useCallback(() => {
    setStatus("loading");
    setReload((value) => value + 1);
  }, []);

  async function loadMore() {
    const rows = await community.list(sort, search, PAGE, entries.length);
    setEntries((current) => [...current, ...rows]);
    setHasMore(rows.length === PAGE);
  }

  async function vote(entry: CommunityEntry, value: -1 | 0 | 1) {
    const previous = entries;
    // Optimistic update, then reconcile with the server's totals.
    const delta = (vote: number) => ({ up: vote === 1 ? 1 : 0, down: vote === -1 ? 1 : 0 });
    const before = delta(entry.myVote);
    const after = delta(value);
    const upvotes = entry.upvotes - before.up + after.up;
    const downvotes = entry.downvotes - before.down + after.down;
    setEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, myVote: value, upvotes, downvotes, score: upvotes - downvotes } : item)));
    try {
      const totals = await community.vote(entry.id, value);
      setEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, ...totals, score: totals.upvotes - totals.downvotes } : item)));
    } catch (failure) {
      setEntries(previous);
      notify(`${ui("Vote failed")} — ${errorText(failure)}`, "error");
    }
  }

  async function open(entry: CommunityEntry, then: "play" | "edit") {
    setBusyId(entry.id);
    try {
      const variant = await community.load(entry.id);
      playVariant(variant);
      if (then === "edit") setSection("overview");
    } catch (failure) {
      notify(errorText(failure), "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <SectionHeading
        eyebrow="Community"
        title="Play what others built"
        description={ui("Browse variants published by other players, vote for your favourites, and open any of them as your own copy to play or remix.")}
        actions={
          <Button onClick={refresh}>
            <RefreshCw size={15} />
            {ui("Refresh")}
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented
              label="Sort"
              value={sort}
              onChange={(next) => {
                setSort(next);
                setStatus("loading");
              }}
              options={[
                { id: "top", label: "Top rated" },
                { id: "new", label: "Newest" },
                { id: "played", label: "Most played" },
              ]}
            />
            <label className="relative min-w-[200px] flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <span className="sr-only">{ui("Search variants")}</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui("Search by name, description or author")} className={`${inputClass} pl-9`} />
            </label>
          </div>

          {status === "loading" && entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500" role="status">
              {ui("Loading community variants…")}
            </p>
          ) : status === "error" ? (
            <EmptyState icon={<Globe size={20} />} title={ui("The community is unavailable right now")} action={<Button onClick={refresh}>{ui("Try again")}</Button>}>
              {error}
            </EmptyState>
          ) : entries.length === 0 ? (
            <EmptyState icon={<Globe size={20} />} title={search ? ui("No variants match your search") : ui("Nothing published yet")}>
              {ui("Be the first: publish your variant with a short description.")}
            </EmptyState>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {entries.map((entry) => {
                const own = entry.ownerId === userId;
                return (
                  <li key={entry.id} className="flex gap-3 rounded-2xl border border-white/[0.08] bg-[#0d1014]/90 p-4">
                    <VoteControl entry={entry} onVote={(value) => void vote(entry, value)} disabled={!userId || own} reason={!userId ? ui("Sign in to vote") : own ? ui("You can't vote on your own variant") : undefined} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-serif text-lg text-white">{entry.name}</h3>
                      <p className="text-xs text-zinc-500">
                        {ui("by")} <span className="text-zinc-300">{entry.authorName}</span> · {timeAgo(entry.publishedAt)}
                        {own && <span className="text-amber-200"> · {ui("yours")}</span>}
                      </p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-zinc-400">{entry.description || ui("No description.")}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Chip>{entry.boardSize}</Chip>
                        <Chip>{entry.pieceTypes} {ui("piece types")}</Chip>
                        <Chip>
                          {entry.playCount} {ui("plays")}
                        </Chip>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" tone="primary" disabled={busyId === entry.id} onClick={() => void open(entry, "play")}>
                          <Play size={13} />
                          {ui("Play")}
                        </Button>
                        <Button size="sm" disabled={busyId === entry.id} onClick={() => void open(entry, "edit")}>
                          <Pencil size={13} />
                          {ui("Remix")}
                        </Button>
                        {own &&
                          (confirmUnpublish === entry.id ? (
                            <>
                              <Button
                                size="sm"
                                tone="danger"
                                onClick={async () => {
                                  try {
                                    await community.unpublish(entry.id);
                                    setEntries((current) => current.filter((item) => item.id !== entry.id));
                                    notify(ui("Unpublished"), "info");
                                  } catch (failure) {
                                    notify(errorText(failure), "error");
                                  }
                                  setConfirmUnpublish(null);
                                }}
                              >
                                {ui("Confirm unpublish")}
                              </Button>
                              <Button size="sm" onClick={() => setConfirmUnpublish(null)}>
                                {ui("Cancel")}
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" tone="danger" onClick={() => setConfirmUnpublish(entry.id)}>
                              <Trash2 size={13} />
                              {ui("Unpublish")}
                            </Button>
                          ))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {hasMore && status === "ready" && (
            <div className="mt-4 text-center">
              <Button onClick={() => void loadMore()}>{ui("Load more")}</Button>
            </div>
          )}
        </div>
        <div className="xl:order-none order-first">
          <PublishPanel onPublished={refresh} />
        </div>
      </div>
    </div>
  );
}
