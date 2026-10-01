import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Bot, Globe2, Play, Plus, Settings2, Wand2 } from "lucide-react";
import { deckSize } from "@/games/cards/cards/card";
import { useCardGameRepository } from "@/games/cards/storage/useCardGameRepository";
import { TEMPLATES, type TemplateInfo } from "@/games/cards/templates";
import { latestPublished, latestVersion, type GameRecord } from "@/games/cards/versioning";
import CardView from "@/components/cardBuilder/game/CardView";
import { Chip, Panel } from "@/components/chessCustom/ui";
import CardBuilderLayout, { CardBuilderTabs } from "./CardBuilderLayout";
import { JoinRoomForm } from "./RoomPage";

const linkButton = "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-amber-300";
const ghost = `${linkButton} border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/20 hover:bg-white/[0.08]`;
const primary = `${linkButton} border-amber-300/60 bg-amber-300 text-zinc-950 hover:bg-amber-200`;

const FAN: Record<string, { rank: "6" | "7" | "A" | "K" | "10"; suit: "hearts" | "spades" | "clubs" | "diamonds" }[]> = {
  "blank-game": [],
  "durak-6a": [
    { rank: "6", suit: "spades" },
    { rank: "10", suit: "hearts" },
    { rank: "A", suit: "clubs" },
  ],
  "short-deck-poker": [
    { rank: "A", suit: "spades" },
    { rank: "A", suit: "hearts" },
    { rank: "6", suit: "diamonds" },
  ],
  "high-card-battle": [
    { rank: "K", suit: "diamonds" },
    { rank: "K", suit: "clubs" },
  ],
  "kings-and-sevens": [
    { rank: "7", suit: "hearts" },
    { rank: "K", suit: "spades" },
  ],
};

function TemplateCard({ template }: { template: TemplateInfo }) {
  const def = template.definition;
  const fan = FAN[template.id] ?? [];
  return (
    <article className="flex flex-col rounded-3xl border border-white/10 bg-zinc-900/70 p-5 shadow-xl shadow-black/20">
      <div className="flex h-24 items-center gap-1">
        {fan.length ? fan.map((card, index) => <CardView key={index} size="md" card={{ id: `${card.rank}${card.suit}`, ...card }} />) : <CardView size="md" label="Blank card back" />}
      </div>
      <h2 className="mt-3 text-xl font-bold text-white">{def.name}</h2>
      <p className="mt-1 text-sm text-zinc-400">{template.tagline}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip>{def.players.min === def.players.max ? def.players.min : `${def.players.min}–${def.players.max}`} players</Chip>
        <Chip>{deckSize(def.deck)} cards</Chip>
        <Chip>{def.phases.length} phase{def.phases.length === 1 ? "" : "s"}</Chip>
        {def.rules.length > 0 && <Chip tone="violet">{def.rules.length} rule{def.rules.length === 1 ? "" : "s"}</Chip>}
        {template.fixture && <Chip tone="sky">developer fixture</Chip>}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link className={ghost} to={`/games/card-builder/templates/${template.id}#rules`}>
          <BookOpen size={14} /> View rules
        </Link>
        <Link className={ghost} to={`/games/card-builder/templates/${template.id}#configuration`}>
          <Settings2 size={14} /> View configuration
        </Link>
        <Link className={ghost} to={`/games/create?template=${template.id}`}>
          <Wand2 size={14} /> Use as template
        </Link>
        <Link className={ghost} to={`/games/card-builder/simulation?template=${template.id}`}>
          <Bot size={14} /> Simulate
        </Link>
        <Link className={primary} to={`/games/card-builder/play?template=${template.id}&quick=1`}>
          <Play size={14} /> Start test game
        </Link>
      </div>
    </article>
  );
}

function MyGames() {
  const { repository, local } = useCardGameRepository();
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([repository.list().catch((cause) => (setError(cause instanceof Error ? cause.message : String(cause)), [] as GameRecord[])), repository === local ? Promise.resolve([] as GameRecord[]) : local.list()]).then(([primaryList, localList]) => {
      if (!cancelled) setGames([...primaryList, ...localList.filter((game) => !primaryList.some((entry) => entry.id === game.id))]);
    });
    return () => {
      cancelled = true;
    };
  }, [repository, local]);
  return (
    <Panel title="My games" eyebrow={repository.kind === "cloud" ? "Your account and this browser" : "Saved in this browser"} actions={<Link className={primary} to="/games/create"><Plus size={14} /> New game</Link>}>
      {error && <p className="mb-2 text-xs text-amber-200">Account games could not be loaded ({error}). Showing games saved in this browser.</p>}
      {games === null && <p className="text-sm text-zinc-500">Loading…</p>}
      {games?.length === 0 && <p className="text-sm text-zinc-500">Nothing yet — start from a template above or a blank game.</p>}
      <ul className="divide-y divide-white/[0.06]">
        {games?.map((game) => {
          const latest = latestVersion(game);
          const published = latestPublished(game);
          return (
            <li key={game.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-zinc-100">{game.name}</p>
                <p className="text-xs text-zinc-500">
                  v{latest.version} {latest.status} · updated {new Date(game.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <Link className={ghost} to={`/games/create/${encodeURIComponent(game.id)}`}>
                Edit
              </Link>
              <Link className={ghost} to={`/games/card-builder/simulation?game=${encodeURIComponent(game.id)}`}>
                <Bot size={14} /> Simulate
              </Link>
              {published && (
                <Link className={ghost} to={`/games/card-builder/play?game=${encodeURIComponent(game.id)}&version=${encodeURIComponent(published.id)}`}>
                  <Play size={14} /> Play v{published.version}
                </Link>
              )}
              {published && repository.kind === "cloud" && !game.id.startsWith("local-") && (
                <Link className={ghost} to={`/games/card-builder/play?game=${encodeURIComponent(game.id)}&version=${encodeURIComponent(published.id)}&mode=online`}>
                  <Globe2 size={14} /> Host online
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export default function CardBuilderHome() {
  return (
    <CardBuilderLayout>
      <header className="mb-8 max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">Card Builder</p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">Invent your own card game</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Every game here is built from the same deck — 32 cards from 7 to Ace, or 36 with the 6s — and the same set of building blocks: zones, phases, actions, rules and end conditions. Start from a template, change what you like, test it with bots and publish it.
        </p>
      </header>
      <CardBuilderTabs active="games" />
      <section aria-label="Templates" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </section>
      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MyGames />
        <Panel title="Join a room" eyebrow="Play online">
          <p className="mb-3 text-sm text-zinc-400">Got a code from a friend? Enter it to take a seat at their table.</p>
          <JoinRoomForm />
        </Panel>
      </div>
    </CardBuilderLayout>
  );
}
