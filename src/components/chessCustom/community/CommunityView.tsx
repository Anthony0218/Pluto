import { variants } from "@/data/chessVariants";
import { VariantArtwork, VariantCardFrame, VariantDesignCard } from "@/components/chess/VariantDesignCard";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { KING_BEHAVIORS, matchKingBehavior } from "@/games/chess/custom/engine/presets";
import { VICTORY_LABELS } from "@/games/chess/custom/engine/victory";
import type { VariantPreview } from "@/games/chess/custom/library/preview";
import type { PlayMode } from "@/games/chess/custom/library/navigation";
import type { CommunityEntry, CommunitySort } from "@/games/chess/custom/storage/communityService";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import BoardThumbnail from "../BoardThumbnail";
import Dialog from "../dialogs/Dialog";
import PlayModeDialog from "../dialogs/PlayModeDialog";
import { errorText, timeAgo } from "../format";
import { ChevronDownIcon, ChevronUpIcon, CommunityIcon, LayersIcon, PlayIcon, PrivateIcon, RefreshIcon, RemixIcon, SearchIcon, ShareIcon, ViewIcon } from "../icons/ChessCustomIcons";
import { Button, Chip, EmptyState, Segmented, inputClass } from "../ui";
import PublishVariantDialog from "./PublishVariantDialog";
import UserLink from "@/components/social/UserLink";

/** Variant author, linked to their profile. Pluto's own variants have no player account. */
function Author({ entry, className = "" }: { entry: CommunityEntry; className?: string }) {
  if (entry.ownerId === "pluto") return <span className={className}>{entry.authorName}</span>;
  return <UserLink userId={entry.ownerId} username={entry.ownerId ? null : entry.authorName} className={className}>{entry.authorName}</UserLink>;
}

const PAGE = 24;
type Previews = Record<string, { preview: VariantPreview; layerCount: number }>;

function CommunityPreview({ entry, preview, className }: { entry: CommunityEntry; preview?: VariantPreview; className: string }) {
  const card = entry.official ? variants.find((card) => card.customId === entry.id || card.id === entry.builtin?.id) : undefined;
  if (card) return <div className={className}><VariantArtwork variant={card} compact /></div>;
  return entry.builtin ? (
    <span role="img" aria-label={entry.name} className={`flex items-center justify-center text-7xl ${className}`}>{entry.builtin.icon}</span>
  ) : <BoardThumbnail preview={preview} label={`${entry.name} ${ui("board preview")}`} className={className} />;
}

function ConfigurationChip({ entry }: { entry: CommunityEntry }) {
  return <Chip tone={entry.configurable === false ? "zinc" : "emerald"}>{ui(entry.configurable === false ? "Not configurable" : "Configurable")}</Chip>;
}

function VoteControl({ entry, onVote, disabled, reason }: { entry: CommunityEntry; onVote: (value: -1 | 0 | 1) => void; disabled: boolean; reason?: string }) {
  const button = (value: 1 | -1) => {
    const active = entry.myVote === value;
    const Icon = value === 1 ? ChevronUpIcon : ChevronDownIcon;
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
    <div className="flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-black/30 px-1" title={`${entry.upvotes} ${ui("up")} · ${entry.downvotes} ${ui("down")}`}>
      {button(1)}
      <span className={`min-w-6 text-center text-sm font-bold ${entry.score > 0 ? "text-emerald-200" : entry.score < 0 ? "text-red-200" : "text-zinc-300"}`}>{entry.score}</span>
      {button(-1)}
    </div>
  );
}

function DetailsDialog({ entry, preview, onClose, onPlay, onRemix, busy }: { entry: CommunityEntry | null; preview?: Previews[string]; onClose: () => void; onPlay: () => void; onRemix: () => void; busy: boolean }) {
  const { community } = useEditor();
  const [details, setDetails] = useState<Awaited<ReturnType<typeof community.details>> | null>(null);
  const [seen, setSeen] = useState<string | null>(null);
  if ((entry?.id ?? null) !== seen) {
    setSeen(entry?.id ?? null);
    setDetails(null);
  }
  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    community.details(entry.id).then(
      (result) => !cancelled && setDetails(result),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [community, entry]);
  const behavior = details?.settings ? KING_BEHAVIORS.find((item) => item.id === matchKingBehavior(details.settings)) : undefined;
  const victory = details?.victoryConditions.filter((condition) => condition.enabled && condition.type !== "eventOutcome").map((condition) => VICTORY_LABELS[condition.type]) ?? [];
  return (
    <Dialog
      open={Boolean(entry)}
      onClose={onClose}
      size="lg"
      eyebrow={ui("Community variant")}
      title={entry?.name ?? ""}
      description={entry ? <>{ui("by")} <Author entry={entry} className="font-semibold text-zinc-200" /> · {ui("published")} {timeAgo(entry.publishedAt)}</> : undefined}
      footer={
        <>
          {entry?.configurable !== false && <Button onClick={onRemix} disabled={busy}>
            <RemixIcon size={15} />
            {ui("Remix")}
          </Button>}
          <Button tone="primary" onClick={onPlay} disabled={busy || entry?.builtin?.available === false}>
            <PlayIcon size={15} />
            {ui("Play")}
          </Button>
        </>
      }
    >
      {entry && (
        <div className="grid gap-5 sm:grid-cols-[240px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
            <CommunityPreview entry={entry} preview={preview?.preview} className="aspect-square w-full" />
          </div>
          <div className="space-y-4 text-sm">
            <p className="whitespace-pre-line leading-6 text-zinc-300">{entry.description || ui("No description.")}</p>
            <div className="flex flex-wrap gap-1.5">
              {entry.boardSize && <Chip>{entry.boardSize}</Chip>}
              {(preview?.layerCount ?? 1) > 1 && <Chip tone="sky">{preview?.layerCount} {ui("Layers")}</Chip>}
              {!entry.builtin && <Chip>{entry.pieceTypes} {ui("piece types")}</Chip>}
              {!entry.official && <Chip>{entry.playCount} {ui("plays")}</Chip>}
              <ConfigurationChip entry={entry} />
              {!entry.official && <Chip tone={entry.score > 0 ? "emerald" : "zinc"}>{entry.score} {ui("score")}</Chip>}
              {(details?.tags ?? entry.builtin?.tags)?.map((tag) => <Chip key={tag} tone="violet">{tag}</Chip>)}
            </div>
            {details ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("King rule")}</dt>
                  <dd className="mt-1 text-zinc-100">{ui(behavior?.label ?? "Custom king rules")}</dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("Victory")}</dt>
                  <dd className="mt-1 text-zinc-100">{victory.map((label) => ui(label)).join(" · ") || ui("Events decide")}</dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("Players")}</dt>
                  <dd className="mt-1 text-zinc-100">{details.teams.map((team) => `${team.name}${team.alliance ? ` (${team.alliance})` : ""}`).join(" · ")}</dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("Events")}</dt>
                  <dd className="mt-1 text-zinc-100">{details.eventCount}</dd>
                </div>
                {details.pieceNames.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:col-span-2">
                    <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("Pieces")}</dt>
                    <dd className="mt-1 text-zinc-100">{details.pieceNames.join(", ")}</dd>
                  </div>
                )}
              </dl>
            ) : entry.builtin ? (
              <p className="text-xs leading-5 text-zinc-400">
                {ui("This built-in variant uses its own game rules and cannot be remixed in Create.")}
                {entry.builtin.rulesRoute && <Link className="ml-2 text-amber-200 underline" to={entry.builtin.rulesRoute}>{ui("Rules")}</Link>}
                {!entry.builtin.available && <span className="mt-2 block">{ui("Coming soon")}</span>}
              </p>
            ) : (
              <p className="text-xs text-zinc-500" role="status">
                {ui("Loading the rules…")}
              </p>
            )}
            {entry.configurable !== false && <p className="text-xs leading-5 text-zinc-500">{ui("Remix copies this variant into My Games so you can change anything. The original stays untouched.")}</p>}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Public discovery: variants other players have shared. */
export default function CommunityView({ scope = "players" }: { scope?: "pluto" | "players" }) {
  const { community, userId, playCopy, remix, notify, refreshPublished } = useEditor();
  const navigate = useNavigate();
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);
  const [sort, setSort] = useState<CommunitySort>("top");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [previews, setPreviews] = useState<Previews>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CommunityEntry | null>(null);
  const [playing, setPlaying] = useState<CommunityEntry | null>(null);
  const [unpublishing, setUnpublishing] = useState<CommunityEntry | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [reload, setReload] = useState(0);

  // Debounce typing into the search box.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadPreviews = useCallback(
    (rows: CommunityEntry[]) => {
      community.previews(rows.map((row) => row.id)).then(
        (found) => setPreviews((current) => ({ ...current, ...found })),
        () => undefined,
      );
    },
    [community],
  );

  useEffect(() => {
    let cancelled = false;
    community.list(sort, search, PAGE, 0, scope).then(
      (rows) => {
        if (cancelled) return;
        setEntries(rows);
        setRemoteUnavailable(community.remoteUnavailable);
        setHasMore(rows.length === PAGE);
        setStatus("ready");
        loadPreviews(rows);
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
  }, [community, sort, search, reload, userId, loadPreviews, scope]);

  const refresh = useCallback(() => {
    setStatus("loading");
    setReload((value) => value + 1);
  }, []);

  async function loadMore() {
    const rows = await community.list(sort, search, PAGE, entries.length, scope);
    setEntries((current) => [...current, ...rows]);
    setHasMore(rows.length === PAGE);
    loadPreviews(rows);
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

  async function play(entry: CommunityEntry, mode: PlayMode) {
    if (entry.builtin) {
      if (!entry.builtin.available) return;
      const route = mode === "singleplayer" ? entry.builtin.aiRoute : mode === "multiplayer" ? entry.builtin.multiplayerRoute : entry.builtin.hotseatRoute ?? entry.builtin.route;
      if (route) navigate(route);
      return;
    }
    setBusyId(entry.id);
    try {
      const variant = await community.load(entry.id);
      playCopy(variant, mode);
    } catch (failure) {
      notify(errorText(failure), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function doRemix(entry: CommunityEntry) {
    if (entry.configurable === false) return;
    setBusyId(entry.id);
    try {
      await remix(entry.id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pt-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300/80">{scope === "pluto" ? "Pluto" : ui("Community")}</p>
          <h1 className="mt-1.5 font-serif text-[32px] leading-tight text-white sm:text-[40px]">{ui(scope === "pluto" ? "Pluto Variants" : "Community Variants")}</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{ui(scope === "pluto" ? "Official chess variants by Pluto. Play a game or remix a configurable variant." : "Chess variants shared publicly by players. Play them as they are, or remix your own copy.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {scope === "players" && <Button tone="primary" onClick={() => setPublishing(true)}>
            <ShareIcon size={15} />
            {ui("Publish your variant")}
          </Button>}
          {scope === "players" && <Button onClick={refresh} aria-label={ui("Refresh")}>
            <RefreshIcon size={15} />
            <span className="hidden sm:inline">{ui("Refresh")}</span>
          </Button>}
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {scope === "players" && <Segmented
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
        />}
        <label className="relative min-w-[200px] flex-1 sm:max-w-md">
          <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <span className="sr-only">{ui("Search variants")}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui("Search by name, description or creator")} className={`${inputClass} pl-9`} />
        </label>
      </div>

      {scope === "players" && remoteUnavailable && <p role="status" className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">{ui("Player-published variants are unavailable right now.")}</p>}
      {status === "loading" && entries.length === 0 ? (
        <ul className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3" aria-busy="true" aria-label={ui("Loading community variants")}>
          {[0, 1, 2].map((index) => (
            <li key={index} className="min-h-[180px] rounded-[13px] border border-white/[0.06] bg-white/[0.02] motion-safe:animate-pulse" />
          ))}
        </ul>
      ) : status === "error" ? (
        <EmptyState icon={<CommunityIcon size={22} />} title={ui("The community is unavailable right now")} action={<Button onClick={refresh}>{ui("Try again")}</Button>}>
          {error}
        </EmptyState>
      ) : entries.length === 0 ? (
        <EmptyState icon={<CommunityIcon size={22} />} title={search ? ui("No variants match your search") : ui(scope === "pluto" ? "No Pluto variants available" : "Nothing published yet")}>
          {scope === "players" && ui("Be the first: publish one of your variants.")}
        </EmptyState>
      ) : (
        <ul className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {entries.map((entry) => {
            const card = entry.official ? variants.find((card) => card.customId === entry.id || card.id === entry.builtin?.id) : undefined;
            if (card) return (
              <li key={entry.id} className="flex">
                <VariantDesignCard variant={card} showConfigure={false} number={variants.indexOf(card) + 1} badge={ui(entry.configurable ? "Configurable" : "Not configurable")} actions={
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" tone="primary" disabled={busyId === entry.id || entry.builtin?.available === false} onClick={() => setPlaying(entry)}><PlayIcon size={14} />{ui(entry.builtin?.available === false ? "Coming soon" : "Play")}</Button>
                    <Button size="sm" onClick={() => setViewing(entry)}><ViewIcon size={14} />{ui("View")}</Button>
                    {entry.configurable !== false && <Button size="sm" disabled={busyId === entry.id} onClick={() => void doRemix(entry)}><RemixIcon size={14} />{ui("Remix")}</Button>}
                    <span className="ml-auto self-center text-[10px] text-zinc-500">{ui("by")} <Author entry={entry} className="text-zinc-300" /></span>
                  </div>
                } />
              </li>
            );
            const own = !entry.official && entry.ownerId === userId;
            const extra = previews[entry.id];
            return (
              <li key={entry.id} className="flex">
                <VariantCardFrame labelledBy={`community-${entry.id}`} artwork={
                  <button type="button" onClick={() => setViewing(entry)} className="relative flex h-full min-h-[180px] w-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_110%,rgba(56,189,248,.12),transparent_60%),#090b0e] p-3 transition hover:bg-sky-400/[0.06] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-300" aria-label={`${ui("View")} ${entry.name}`}>
                    <CommunityPreview entry={entry} preview={extra?.preview} className="mx-auto aspect-square w-full max-w-[180px] drop-shadow-[0_14px_22px_rgba(0,0,0,.55)]" />
                    {(extra?.layerCount ?? 1) > 1 && (
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-semibold text-sky-100">
                        <LayersIcon size={12} />
                        {extra?.layerCount}
                      </span>
                    )}
                    {own && <span className="absolute left-2 top-2 rounded-full border border-amber-300/40 bg-amber-300/15 px-2 py-1 text-[9px] font-bold text-amber-100">{ui("Yours")}</span>}
                  </button>
                }>
                  <h3 id={`community-${entry.id}`} className="font-serif text-[20px] leading-tight text-white">
                    {entry.name}
                  </h3>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {ui("by")} <Author entry={entry} className="text-zinc-300" /> · {timeAgo(entry.publishedAt)}
                  </p>
                  <p className="mt-2 line-clamp-2 font-serif text-[12px] leading-[1.45rem] text-zinc-400">{entry.description || ui("No description.")}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {entry.boardSize && <Chip>{entry.boardSize}</Chip>}
                    {(extra?.layerCount ?? 1) > 1 && <Chip tone="sky">{extra?.layerCount} {ui("Layers")}</Chip>}
                    {!entry.builtin && <Chip>{entry.pieceTypes} {ui("piece types")}</Chip>}
                    {!entry.official && <Chip>{entry.playCount} {ui("plays")}</Chip>}
                    <ConfigurationChip entry={entry} />
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                    <Button size="sm" tone="primary" disabled={busyId === entry.id || entry.builtin?.available === false} onClick={() => setPlaying(entry)}>
                      <PlayIcon size={14} />
                      {ui(entry.builtin?.available === false ? "Coming soon" : "Play")}
                    </Button>
                    <Button size="sm" onClick={() => setViewing(entry)}>
                      <ViewIcon size={14} />
                      {ui("View")}
                    </Button>
                    {entry.configurable !== false && <Button size="sm" disabled={busyId === entry.id} onClick={() => void doRemix(entry)}>
                      <RemixIcon size={14} />
                      {ui("Remix")}
                    </Button>}
                    {!entry.official && <div className="ml-auto">
                      <VoteControl entry={entry} onVote={(value) => void vote(entry, value)} disabled={!userId || own} reason={!userId ? ui("Sign in to vote") : own ? ui("You can't vote on your own variant") : undefined} />
                    </div>}
                  </div>
                  {own && (
                    <button type="button" onClick={() => setUnpublishing(entry)} className="mt-2 inline-flex items-center gap-1.5 self-start text-xs font-semibold text-zinc-400 underline-offset-2 hover:text-red-200 hover:underline">
                      <PrivateIcon size={13} />
                      {ui("Make private")}
                    </button>
                  )}
                </VariantCardFrame>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && status === "ready" && (
        <div className="mt-6 text-center">
          <Button onClick={() => void loadMore()}>{ui("Load more")}</Button>
        </div>
      )}

      <PublishVariantDialog open={publishing} onClose={() => setPublishing(false)} onPublished={refresh} />
      <DetailsDialog
        entry={viewing}
        preview={viewing ? previews[viewing.id] : undefined}
        busy={Boolean(viewing && busyId === viewing.id)}
        onClose={() => setViewing(null)}
        onPlay={() => {
          setPlaying(viewing);
          setViewing(null);
        }}
        onRemix={() => {
          const entry = viewing;
          setViewing(null);
          if (entry) void doRemix(entry);
        }}
      />
      <PlayModeDialog
        open={Boolean(playing)}
        variantName={playing?.name ?? ""}
        playerCount={playing?.playerCount}
        disabledModes={playing?.builtin ? {
          ...(!playing.builtin.aiRoute ? { singleplayer: ui("AI is not available for this variant.") } : {}),
          ...(!playing.builtin.multiplayerRoute ? { multiplayer: ui("Online play is not available for this variant.") } : {}),
          ...(!playing.builtin.route ? { hotseat: ui("Hotseat is not available for this variant.") } : {}),
        } : {}}
        onClose={() => setPlaying(null)}
        onChoose={(mode) => {
          const entry = playing;
          setPlaying(null);
          if (entry) void play(entry, mode);
        }}
      />
      <Dialog
        open={Boolean(unpublishing)}
        onClose={() => setUnpublishing(null)}
        size="sm"
        tone="danger"
        eyebrow={ui("Make private")}
        title={<>{ui("Remove")} “{unpublishing?.name}” {ui("from Community?")}</>}
        description={ui("Other players will no longer see it. Your copy in My Games is not affected.")}
        footer={
          <>
            <Button onClick={() => setUnpublishing(null)}>{ui("Cancel")}</Button>
            <Button
              tone="danger"
              onClick={async () => {
                const entry = unpublishing;
                setUnpublishing(null);
                if (!entry) return;
                try {
                  await community.unpublish(entry.id);
                  setEntries((current) => current.filter((item) => item.id !== entry.id));
                  await refreshPublished();
                  notify(ui("Now private — removed from Community"), "info");
                } catch (failure) {
                  notify(errorText(failure), "error");
                }
              }}
            >
              <PrivateIcon size={15} />
              {ui("Make private")}
            </Button>
          </>
        }
      />
    </div>
  );
}
