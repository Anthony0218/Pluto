import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { GameDefinition } from "@/games/cards/engine/types";
import { useCardGameRepository } from "@/games/cards/storage/useCardGameRepository";
import { blankTemplate, findTemplate } from "@/games/cards/templates";
import { latestVersion, type GameRecord } from "@/games/cards/versioning";
import CardGameEditor from "@/components/cardBuilder/editor/CardGameEditor";
import CardBuilderLayout from "./CardBuilderLayout";

/**
 * `identity` is what the session shows ("new:<template>" or "game:<id>");
 * `key` is the editor instance, which survives the first save of a new game.
 */
type Session = { key: string; identity: string; def: GameDefinition; record: GameRecord | null } | { key: string; identity: string; error: string } | null;

function fromTemplate(templateId: string | null): GameDefinition {
  const template = findTemplate(templateId ?? "") ?? { definition: blankTemplate };
  const def = structuredClone(template.definition);
  return { ...def, id: "new-game", name: template.definition === blankTemplate ? "My card game" : `My ${def.name}`, templateId: template.definition.id };
}

/** `/games/create` (new, optionally ?template=…) and `/games/create/:gameId` (edit). */
export default function CreatePage() {
  useGameLanguage();
  const { gameId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const templateId = params.get("template");
  const { repository, local } = useCardGameRepository();
  const pageIdentity = gameId ? `game:${gameId}` : `new:${templateId}`;
  const [session, setSession] = useState<Session>(() => (gameId ? null : { key: pageIdentity, identity: pageIdentity, def: fromTemplate(templateId), record: null }));
  // Set by the first save of a new game until the URL has caught up.
  const [pendingIdentity, setPendingIdentity] = useState<string | null>(null);
  const store = gameId?.startsWith("local-") ? local : repository;

  // Opening another game (or a template) starts a new editor; the editor's own first save does not.
  const sessionRecordId = session && "record" in session ? session.record?.id : undefined;
  if (gameId && pendingIdentity) setPendingIdentity(null);
  if (!gameId && session?.identity !== pageIdentity && session?.identity !== pendingIdentity) {
    setSession({ key: `${pageIdentity}#${session?.key ?? ""}`, identity: pageIdentity, def: fromTemplate(templateId), record: null });
  }
  useEffect(() => {
    if (!gameId) return;
    if (sessionRecordId === gameId) return;
    let cancelled = false;
    (async () => {
      try {
        const record = (await store.load(gameId)) ?? (await local.load(gameId));
        if (cancelled) return;
        const identity = `game:${gameId}`;
        setSession(record ? { key: identity, identity, def: latestVersion(record).definition, record } : { key: identity, identity, error: "This game could not be found." });
      } catch (error) {
        if (!cancelled) setSession({ key: `game:${gameId}`, identity: `game:${gameId}`, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, store, local, sessionRecordId]);

  const onSaved = (record: GameRecord) => {
    const identity = `game:${record.id}`;
    setSession((current) => (current && "def" in current ? { ...current, identity, record, def: latestVersion(record).definition } : current));
    if (record.id !== gameId) {
      setPendingIdentity(identity);
      navigate(`/games/create/${encodeURIComponent(record.id)}`, { replace: true });
    }
  };

  const name = session && "def" in session ? session.def.name : "Create";
  return (
    <CardBuilderLayout crumbs={[{ label: gameId ? name : "New game" }]}>
      {!session && <p className="text-sm text-zinc-500">{gameUi("Loading…")}</p>}
      {session && "error" in session && <p className="text-sm text-red-300">{gameUi(session.error)}</p>}
      {session && "def" in session && <CardGameEditor key={session.key} initial={session.def} initialRecord={session.record} repository={store} fallback={local} onSaved={onSaved} />}
    </CardBuilderLayout>
  );
}
