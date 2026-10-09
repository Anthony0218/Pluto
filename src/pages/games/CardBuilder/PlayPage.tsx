import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { GameDefinition } from "@/games/cards/engine/types";
import { useCardGameRepository } from "@/games/cards/storage/useCardGameRepository";
import { findTemplate } from "@/games/cards/templates";
import { findVersion } from "@/games/cards/versioning";
import TestMatch from "@/components/cardBuilder/game/TestMatch";
import CreateRoomPanel from "@/components/cardBuilder/online/CreateRoomPanel";
import { Segmented } from "@/components/chessCustom/ui";
import CardBuilderLayout from "./CardBuilderLayout";

/** `onlineVersionId` is set for versions stored in the account — only those can host an online room. */
type Source = { def: GameDefinition; label: string; onlineVersionId: string | null } | { error: string } | null;

/** `/games/card-builder/play?template=…` or `?game=…&version=…[&mode=online]` — a local test table or an online room. */
export default function PlayPage() {
  useGameLanguage();
  const [params] = useSearchParams();
  const templateId = params.get("template");
  const gameId = params.get("game");
  const versionId = params.get("version");
  const quick = params.get("quick") === "1";
  const [mode, setMode] = useState<"local" | "online">(params.get("mode") === "online" ? "online" : "local");
  const { repository, local } = useCardGameRepository();
  const template = templateId ? findTemplate(templateId) : undefined;
  const [loaded, setLoaded] = useState<Source>(null);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = gameId.startsWith("local-") || repository.kind !== "cloud" ? null : await repository.load(gameId).catch(() => null);
        const record = cloud ?? (await local.load(gameId));
        const version = record && versionId ? findVersion(record, versionId) : undefined;
        if (cancelled) return;
        // Sessions always use one immutable published version.
        if (!version || version.status !== "published") setLoaded({ error: "That published version could not be found." });
        else setLoaded({ def: version.definition, label: `${version.definition.name} · v${version.version}`, onlineVersionId: cloud ? version.id : null });
      } catch (error) {
        if (!cancelled) setLoaded({ error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, versionId, repository, local]);

  const source: Source = template ? { def: template.definition, label: template.definition.name, onlineVersionId: null } : gameId ? loaded : { error: "Choose a template or a published game to play." };
  return (
    <CardBuilderLayout crumbs={[{ label: source && "label" in source ? source.label : "Play" }]}>
      {!source && <p className="text-sm text-zinc-500">{gameUi("Loading…")}</p>}
      {source && "error" in source && <p className="text-sm text-red-300">{gameUi(source.error)}</p>}
      {gameUi(source && "def" in source && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-black">{gameUi(source.label)}</h1>
            <Segmented
              label={gameUi("Where to play")}
              value={mode}
              onChange={setMode}
              options={[
                { id: "local", label: "On this device" },
                { id: "online", label: "Online room" },
              ]}
            />
          </div>
          {mode === "local" ? <TestMatch def={source.def} autoStart={quick} /> : <CreateRoomPanel def={source.def} versionId={source.onlineVersionId} />}
        </>
      ))}
    </CardBuilderLayout>
  );
}
