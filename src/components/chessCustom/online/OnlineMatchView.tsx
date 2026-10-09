import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import InviteFriendButton from "@/components/chess/InviteFriendButton";
import { recordCreatedGameInviteCode } from "@/components/social/GameInviteDelivery";
import { useInviteAutoCreate } from "@/hooks/useInviteAutoCreate";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Chess3DCameraView } from "@/games/chess/3d/chess3dAppearance";
import { playChessSound } from "@/games/chess/audio/chessAudio";
import { boardLayers, sameCoord } from "@/games/chess/custom/engine/board";
import { getLegalMoves } from "@/games/chess/custom/engine/game";
import type { Coord, Move } from "@/games/chess/custom/engine/types";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { coordKey } from "@/games/chess/custom/editor/editorUtils";
import { createOnlineMatch, getOnlineMatch, joinOnlineMatch, previewOnlineMatch, submitOnlineMove, type OnlinePreview, type OnlineSnapshot } from "@/games/chess/custom/multiplayer/client";
import { validateOnlineVariant } from "@/games/chess/custom/multiplayer/protocol";
import { createVariantFromPreset, PRESETS } from "@/games/chess/custom/engine/presets";
import { createPlutoVariant, isPlutoCustomId } from "@/games/chess/custom/library/plutoVariants";
import { parseVariantJson } from "@/games/chess/custom/engine/serialization";
import { getBoardTheme } from "@/games/chess/custom/themes";
import Board2D, { type CellHighlight } from "../Board2D";
import { Button, Panel, SectionHeading } from "../ui";

const Board3D = lazy(() => import("@/components/chess3d/Board3DScene"));

export default function OnlineMatchView() {
  useGameLanguage();
  const { variant: draft, userId } = useEditor();
  const [params, setParams] = useSearchParams();
  const room = params.get("room")?.toUpperCase() ?? "";
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "");
  const [match, setMatch] = useState<OnlineSnapshot | null>(null);
  const [preview, setPreview] = useState<OnlinePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<Move[] | null>(null);
  const [view, setView] = useState<"3d" | "2d">("2d");
  const [activeLayer, setActiveLayer] = useState(0);
  const [stackView, setStackView] = useState<"full" | "focus" | "isolated">("full");
  const [cameraView, setCameraView] = useState<Chess3DCameraView>({ id: 0, preset: "front" });
  const heardVersion = useRef(0);
  const inviteJoinStarted = useRef(false);

  useEffect(() => {
    if (!match) return;
    if (heardVersion.current && match.version > heardVersion.current && match.history.length) {
      playChessSound(match.state.result?.draw ? "draw" : match.state.result?.reason.startsWith("Checkmate") ? "checkmate" : match.state.effects.some((effect) => effect.kind === "capture" || effect.kind === "royalCapture") ? "capture" : "move");
    }
    heardVersion.current = match.version;
  }, [match]);

  useEffect(() => {
    if (!room || !userId) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const joining = params.get("join") === "1" && !inviteJoinStarted.current;
        const snapshot = await (joining ? joinOnlineMatch(room) : getOnlineMatch(room));
        if (joining) inviteJoinStarted.current = true;
        if (!cancelled) { setMatch((current) => !current || snapshot.version >= current.version ? snapshot : current); setError(null); }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Could not load room.";
        if (!cancelled && !message.includes("not a player in this room")) setError(message);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [room, userId, params]);

  useEffect(() => {
    if (!userId || code.length !== 6 || match) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void previewOnlineMatch(code).then((result) => {
        if (!cancelled) { setPreview(result); setError(null); }
      }).catch(() => { if (!cancelled) setPreview(null); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [code, match, userId]);

  // A preset invite can arrive while the editor is already mounted with a different working copy.
  const inviteVariant = useMemo(() => {
    const id = params.get("preset");
    if (isPlutoCustomId(id)) return parseVariantJson(JSON.stringify(createPlutoVariant(id))).variant ?? draft;
    const preset = PRESETS.find(item => item.id === id);
    return preset ? createVariantFromPreset(preset.id) : draft;
  }, [params, draft]);
  useInviteAutoCreate(() => perform(async () => { const created = await createOnlineMatch(inviteVariant); recordCreatedGameInviteCode(created.code, "/chess-custom/play/multiplayer"); return created; }), !!userId && validateOnlineVariant(inviteVariant).length === 0);
  async function perform(action: () => Promise<OnlineSnapshot>) {
    setBusy(true);
    setError(null);
    try {
      const snapshot = await action();
      setMatch(snapshot);
      setSelectedId(null);
      setPromotion(null);
      setParams((current) => { const next = new URLSearchParams(current); next.set("room", snapshot.code); return next; });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Room request failed.");
    } finally { setBusy(false); }
  }

  const variant = match?.variant ?? draft;
  const state = match?.state;
  const layers = state ? boardLayers(state.board) : boardLayers(variant.board);
  const shownLayer = layers.find((layer) => layer.z === activeLayer) ?? layers[0];
  const myTeam = match ? variant.teams[match.seat]?.id : undefined;
  const myTurn = Boolean(match?.status === "playing" && state && state.turn === myTeam && !state.result);
  const selected = state?.pieces.find((piece) => piece.id === selectedId);
  const legal = useMemo(() => state && selected && myTurn ? getLegalMoves(variant, state, { pieceId: selected.id }) : [], [variant, state, selected, myTurn]);
  const marks = useMemo(() => {
    const result = new Map<string, CellHighlight>();
    const last = match?.history.at(-1)?.move;
    if (last) { result.set(coordKey(last.from), "lastFrom"); result.set(coordKey(last.to), "lastTo"); }
    for (const move of legal) result.set(coordKey(move.to), move.captureIds.length ? "capture" : move.landing ? "special" : "move");
    if (selected) result.set(coordKey(selected), "selected");
    return result;
  }, [match?.history, legal, selected]);
  const layerMarks = useMemo(() => new Map([...marks].flatMap(([key, mark]) => {
    const [x, y, z = "0"] = key.split(",");
    return Number(z) === activeLayer ? [[`${x},${y}`, mark] as const] : [];
  })), [marks, activeLayer]);
  const theme = getBoardTheme(variant.theme.boardTheme);

  async function send(move: Move) {
    if (!match) return;
    await perform(() => submitOnlineMove(match, { pieceId: move.pieceId, from: move.from, to: move.to, promotionPieceId: move.promotion }));
  }
  function click(coord: Coord) {
    if (!state || !myTurn || busy || promotion) return;
    const choices = legal.filter((move) => sameCoord(move.to, coord));
    if (choices.length > 1 && choices.every((move) => move.promotion)) { setPromotion(choices); return; }
    if (choices.length) { void send(choices[0]); return; }
    const piece = state.pieces.find((entry) => sameCoord(entry, coord) && entry.team === myTeam);
    setSelectedId(piece?.id ?? null);
  }

  if (!userId) return <div className="mx-auto max-w-3xl py-16"><SectionHeading eyebrow="Online Multiplayer" title={gameUi("Sign in to play")} description={gameUi("Online rooms keep one server validated copy of the variant and game state.")} /><Link to="/login" className="inline-flex rounded-xl bg-amber-300 px-4 py-2 font-semibold text-zinc-950">{gameUi("Sign in")}</Link></div>;

  if (!match) return <div className="mx-auto max-w-4xl space-y-5 py-8">
    <SectionHeading eyebrow="Online Multiplayer" title={gameUi("Create or join a private game")} description={gameUi("Share a room code so every player receives the same rules and board.")} />
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{gameUi(error)}</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title={gameUi("Create room")}><p className="mb-3 text-sm text-zinc-400">{gameUi("Host with your current variant: ")}<strong className="text-white">{gameUi(draft.name)}</strong></p><p className="mb-4 text-xs text-zinc-500">{gameUi(layers.length)}{gameUi(" layer(s) · ")}{gameUi(layers.map((layer) => `${layer.width}×${layer.height}`).join(" / "))}</p>{validateOnlineVariant(draft).map((issue) => <p key={issue} className="mb-2 text-xs text-red-300">{gameUi(issue)}</p>)}<Button tone="primary" disabled={busy || validateOnlineVariant(draft).length > 0} onClick={() => void perform(() => createOnlineMatch(draft))}>{gameUi("Create private game")}</Button></Panel>
      <Panel title={gameUi("Join room")}><label className="block text-sm text-zinc-400">{gameUi("Room code ")}<input value={code} onChange={(event) => { setCode(event.target.value.toUpperCase().slice(0, 6)); setPreview(null); }} maxLength={6} className="mt-2 block w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 font-mono tracking-widest text-white" /></label>{preview && <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-300"><strong className="block text-sm text-white">{gameUi(preview.variant.name)}</strong><p>{gameUi(preview.playersJoined)} / {gameUi(preview.variant.teams.length)}{gameUi(" players · ")}{gameUi(boardLayers(preview.variant.board).length)}{gameUi(" layers · ")}{gameUi(boardLayers(preview.variant.board).map((layer) => `${layer.width}×${layer.height}`).join(" / "))}</p><p>{gameUi("King: ")}{gameUi(preview.variant.settings.royalMode)}{gameUi(" · Victory: ")}{gameUi(preview.variant.victoryConditions.filter((rule) => rule.enabled).map((rule) => rule.type).join(", ") || "Custom rules")}</p><div className="mx-auto max-w-[220px]"><Board2D board={preview.variant.board} variant={preview.variant} theme={getBoardTheme(preview.variant.theme.boardTheme)} pieces={preview.variant.setup.pieces.filter((piece) => (piece.z ?? 0) === 0).map((piece, index) => ({ key: `preview-${index}`, type: piece.type, team: piece.team, x: piece.x, y: piece.y }))} highlights={new Map()} label={gameUi("Room board preview")} onCellClick={() => {}} /></div></div>}<Button tone="blue" className="mt-4" disabled={busy || code.length !== 6 || preview?.status !== "waiting"} onClick={() => void perform(() => joinOnlineMatch(code))}>{gameUi("Join game")}</Button></Panel>
    </div>
  </div>;

  const pieces3D = state!.pieces.map((piece) => {
    const def = variant.pieces.find((entry) => entry.id === piece.type);
    const team = variant.teams.find((entry) => entry.id === piece.team);
    return { id: piece.id, x: piece.x, y: piece.y, z: piece.z ?? 0, base: def?.model.base ?? "pawn" as const, set: team?.modelSet ?? "light" as const, accent: def?.model.accent, tint: def?.model.tint, scale: def?.model.scale };
  });
  const pieces2D = state!.pieces.flatMap((piece) => (piece.z ?? 0) === activeLayer ? [{ key: piece.id, type: piece.type, team: piece.team, x: piece.x, y: piece.y }] : []);
  const effects = state!.effects.map((effect, index) => ({ ...effect, id: match.version * 100 + index }));

  return <div className="space-y-4 py-5">
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/20 bg-black/50 p-4">
      <div className="flex-1"><p className="text-xs font-black uppercase tracking-widest text-amber-200">{gameUi("Private room · ")}{gameUi(match.code)}</p><h1 className="font-serif text-2xl text-white">{gameUi(variant.name)}</h1><p className="text-xs text-zinc-400">{gameUi(layers.length)}{gameUi(" layers · ")}{gameUi(layers.map((layer) => `${layer.width}×${layer.height}`).join(" / "))} · {gameUi(variant.settings.royalMode)} · {gameUi(variant.victoryConditions.filter((entry) => entry.enabled).map((entry) => entry.type).join(", "))}</p></div>
      <Button size="sm" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/chess-custom/play/multiplayer?room=${match.code}`)}>{gameUi("Copy invite link")}</Button>
      <Button size="sm" onClick={() => { setView("2d"); setMatch(null); setParams((current) => { const next = new URLSearchParams(current); next.delete("room"); return next; }); }}>{gameUi("Leave view")}</Button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{gameUi(error)}</p>}
    <div className="flex flex-wrap gap-2 text-xs text-zinc-300" aria-label={gameUi("Room seats")}>
      {variant.teams.map((team, index) => <span key={team.id} className={`rounded-full border px-3 py-1.5 ${index === match.seat ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/[0.04]"}`}>{gameUi(team.name)}: {gameUi(match.players[index] ? index === match.seat ? "You" : "Joined" : "Open")}{match.status === "waiting" && !match.players[index] && <InviteFriendButton />}</span>)}
    </div>
    <p className="text-sm text-zinc-300" aria-live="polite">{gameUi(match.status === "waiting" ? `Waiting for ${variant.teams.length - match.players.length} more player${variant.teams.length - match.players.length === 1 ? "" : "s"} to join…` : state!.result ? state!.result.reason : `${variant.teams.find((team) => team.id === state!.turn)?.name} to move${myTurn ? " · your turn" : ""}`)}</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" tone={view === "2d" ? "blue" : "ghost"} onClick={() => setView("2d")}>2D</Button><Button size="sm" tone={view === "3d" ? "blue" : "ghost"} onClick={() => setView("3d")}>3D</Button>
      {layers.length > 1 && <><select aria-label={gameUi("Active layer")} value={activeLayer} onChange={(event) => setActiveLayer(Number(event.target.value))} className="rounded-lg border border-white/10 bg-zinc-900 px-2 text-xs text-white">{layers.map((layer) => <option key={layer.z} value={layer.z}>{gameUi(layer.name)}</option>)}</select><select aria-label={gameUi("Stack view")} value={stackView} onChange={(event) => setStackView(event.target.value as typeof stackView)} className="rounded-lg border border-white/10 bg-zinc-900 px-2 text-xs text-white"><option value="full">{gameUi("Full stack")}</option><option value="focus">{gameUi("Focus layer")}</option><option value="isolated">{gameUi("Isolated layer")}</option></select></>}
      {view === "3d" && <select aria-label={gameUi("Camera angle")} value={cameraView.preset} onChange={(event) => setCameraView((current) => ({ id: current.id + 1, preset: event.target.value as Chess3DCameraView["preset"] }))} className="rounded-lg border border-white/10 bg-zinc-900 px-2 text-xs text-white"><option value="classic">{gameUi("Isometric")}</option><option value="top">{gameUi("Top")}</option><option value="front">{gameUi("Front")}</option><option value="side">{gameUi("Side")}</option><option value="white">{gameUi("Player")}</option><option value="black">{gameUi("Opponent")}</option></select>}
    </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="relative h-[min(72vh,780px)] min-h-[400px] overflow-hidden rounded-2xl border border-white/10 bg-[#050608]">
        {view === "3d" ? <Suspense fallback={<p className="p-6 text-zinc-400">Loading board…</p>}><Board3D className="absolute! inset-0" width={state!.board.width} height={state!.board.height} cells={state!.board.cells} layers={state!.board.layers} pieces={pieces3D} marks={marks} selectedPieceId={selectedId} theme={theme} skin="classic" cameraView={cameraView} effects={effects} trail={match.history.length ? [match.history.at(-1)!.move.from, match.history.at(-1)!.move.to] : null} visibleLayers={stackView === "isolated" ? [activeLayer] : undefined} focusLayer={stackView === "focus" ? activeLayer : undefined} enablePan onCellClick={(x, y, z = 0) => { setActiveLayer(z); click({ x, y, z }); }} /></Suspense> : <div className="mx-auto flex h-full max-w-[700px] items-center p-4"><Board2D board={shownLayer} variant={variant} theme={theme} pieces={pieces2D} highlights={layerMarks} label={gameUi("Online Chess Custom board")} onCellClick={(coord) => click({ ...coord, z: activeLayer })} /></div>}
        {promotion && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75"><div className="rounded-2xl border border-amber-300/30 bg-zinc-950 p-5"><p className="mb-3 text-sm text-white">{gameUi("Choose promotion")}</p><div className="flex gap-2">{promotion.map((move) => <Button key={move.promotion} onClick={() => void send(move)}>{gameUi(variant.pieces.find((piece) => piece.id === move.promotion)?.name ?? move.promotion)}</Button>)}</div><Button className="mt-3" size="sm" onClick={() => setPromotion(null)}>{gameUi("Cancel")}</Button></div></div>}
      </div>
      <Panel title={gameUi("Move history")}><ol className="max-h-[65vh] space-y-1 overflow-y-auto text-xs text-zinc-300">{match.history.map((entry, index) => <li key={index} className="rounded-lg bg-white/[0.04] px-2 py-1.5"><span className="mr-2 text-zinc-600">{gameUi(index + 1)}.</span>{gameUi(entry.notation)}</li>)}</ol></Panel>
    </div>
  </div>;
}
