import VisibleGameResult from "@/components/chess/VisibleGameResult";
import InviteFriendButton from "@/components/chess/InviteFriendButton";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { playChessSound, stopSound } from "@/games/chess/audio/chessAudio";
import { useVariantRecordAudio } from "@/games/chess/audio/useVariantRecordAudio";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Chess, type Square } from "chess.js";

import Board from "../singleplayer/Board";
import PromotionBar from "../singleplayer/PromotionBar";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { getSquareName, type PieceType } from "../../../utils/chessUtils";
import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../../../utils/sound";
import {
  createCoolingHotPotatoState,
  dropHotPotatoAfterBlast,
  pickUpHotPotato,
  createInitialHotPotatoState,
  createRespawnedHotPotatoState,
  findKingSquare,
  getHotPotatoSquareAfterMove,
  getNormalChessOutcome,
  resolveHotPotatoExplosion,
  type DestroyedPiece,
  type HotPotatoOutcome,
  type HotPotatoState,
  type HotPotatoStates,
} from "../../../games/chess/variants/HotPotato";
import VariantRoomSetup from "./VariantRoomSetup";

type PlayerColor = "white" | "black";
type ChessSide = "w" | "b";
type PromotionPiece = "q" | "r" | "b" | "n";

type VariantRoom = {
  id: string;
  code: string;
  host_id: string;
  variant: string;
  status: "waiting" | "playing" | "finished";
};

type VariantRoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  chosen_color: PlayerColor;
};

type HotPotatoRecord = {
  ply: number;
  moveNumber: number;
  color: ChessSide;
  san: string;
  piece: PieceType;
  from: Square;
  to: Square;
  captured?: PieceType;
  fenBefore: string;
  fenAfter: string;
  hotPotatoesAfter: HotPotatoStates;
  explosionSquaresAfter: Square[];
  blownUpKingSquaresAfter: Square[];
  potatoTransferred: boolean;
  destroyedPieces: DestroyedPiece[];
  spawnSerialsAfter: Record<ChessSide, number>;
  explosionCountAfter: number;
  transferCountAfter: number;
  destroyedPieceCountAfter: number;
};

type HotPotatoStoredState = {
  seed: number;
  spawnSerials: Record<ChessSide, number>;
  hotPotatoes: HotPotatoStates;
  records: HotPotatoRecord[];
  explosionSquares: Square[];
  blownUpKingSquares: Square[];
  explosionCount: number;
  transferCount: number;
  destroyedPieceCount: number;
};

type VariantGame = {
  room_id: string;
  variant: "hot-potato";
  seed: number;
  initial_fen: string;
  fen: string;
  moves: string[];
  state: HotPotatoStoredState;
  status: "waiting" | "playing" | "finished";
  winner: "white" | "black" | "draw" | null;
  end_reason: string | null;
  version: number;
  last_move_from: string | null;
  last_move_to: string | null;
  white_rematch_ready: boolean | null;
  black_rematch_ready: boolean | null;
  undo_requested_by: string | null;
  undo_requested_version: number | null;
  undo_last_requested_by: string | null;
  undo_last_requested_version: number | null;
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function createSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] >>> 0;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomForSpawn(seed: number, owner: ChessSide, spawnSerial: number) {
  const ownerSalt = owner === "w" ? 0x51f15e : 0xa4b1c3;
  const mixed =
    (seed ^
      ownerSalt ^
      Math.imul((spawnSerial + 1) >>> 0, 0x9e3779b1) ^
      0x85ebca6b) >>>
    0;
  return mulberry32(mixed);
}

function initialStoredState(seed: number): HotPotatoStoredState {
  const game = new Chess(START_FEN);
  const spawnSerials = { w: 0, b: 0 };

  return {
    seed,
    spawnSerials,
    hotPotatoes: {
      w: createInitialHotPotatoState(game, randomForSpawn(seed, "w", 0), "w"),
      b: createInitialHotPotatoState(game, randomForSpawn(seed, "b", 0), "b"),
    },
    records: [],
    explosionSquares: [],
    blownUpKingSquares: [],
    explosionCount: 0,
    transferCount: 0,
    destroyedPieceCount: 0,
  };
}

function normalizeState(value: unknown, seed: number): HotPotatoStoredState {
  const fallback = initialStoredState(seed);
  if (!value || typeof value !== "object") return fallback;

  const raw = value as Partial<HotPotatoStoredState> & {
    hotPotato?: HotPotatoState;
    spawnSerial?: number;
  };

  const spawnSerials =
    raw.spawnSerials &&
    typeof raw.spawnSerials.w === "number" &&
    typeof raw.spawnSerials.b === "number"
      ? raw.spawnSerials
      : { w: raw.spawnSerial ?? 0, b: 0 };

  const hotPotatoes =
    raw.hotPotatoes?.w && raw.hotPotatoes?.b
      ? raw.hotPotatoes
      : fallback.hotPotatoes;

  return {
    seed: typeof raw.seed === "number" ? raw.seed : seed,
    spawnSerials: { ...spawnSerials },
    hotPotatoes: {
      w: {
        ...hotPotatoes.w,
        owner: "w",
        blastPattern: hotPotatoes.w.blastPattern ?? "ring",
      },
      b: {
        ...hotPotatoes.b,
        owner: "b",
        blastPattern: hotPotatoes.b.blastPattern ?? "ring",
      },
    },
    records: Array.isArray(raw.records)
      ? (raw.records as HotPotatoRecord[])
      : [],
    explosionSquares: Array.isArray(raw.explosionSquares)
      ? (raw.explosionSquares as Square[])
      : [],
    blownUpKingSquares: Array.isArray(raw.blownUpKingSquares)
      ? (raw.blownUpKingSquares as Square[])
      : [],
    explosionCount:
      typeof raw.explosionCount === "number" ? raw.explosionCount : 0,
    transferCount:
      typeof raw.transferCount === "number" ? raw.transferCount : 0,
    destroyedPieceCount:
      typeof raw.destroyedPieceCount === "number" ? raw.destroyedPieceCount : 0,
  };
}

function previousSnapshot(state: HotPotatoStoredState) {
  if (state.records.length === 0) return null;

  const records = state.records.slice(0, -1);

  if (records.length === 0) {
    return {
      fen: START_FEN,
      state: initialStoredState(state.seed),
      from: null as string | null,
      to: null as string | null,
    };
  }

  const last = records[records.length - 1];

  return {
    fen: last.fenAfter,
    state: {
      seed: state.seed,
      spawnSerials: { ...last.spawnSerialsAfter },
      hotPotatoes: {
        w: { ...last.hotPotatoesAfter.w },
        b: { ...last.hotPotatoesAfter.b },
      },
      records,
      explosionSquares: [...last.explosionSquaresAfter],
      blownUpKingSquares: [...last.blownUpKingSquaresAfter],
      explosionCount: last.explosionCountAfter,
      transferCount: last.transferCountAfter,
      destroyedPieceCount: last.destroyedPieceCountAfter,
    } satisfies HotPotatoStoredState,
    from: last.from,
    to: last.to,
  };
}

function checkedKingSquare(game: Chess): Square | null {
  return game.isCheck() ? findKingSquare(game, game.turn()) : null;
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  useUiLanguage();
  return (
    <section className="rounded-3xl border border-white/5 bg-zinc-900/75 p-4 shadow-xl shadow-black/20">
      <h2 className="font-black text-zinc-100">{ui(title)}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function HotPotatoMultiplayerLobby() {
  useUiLanguage();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const profileName = (profile as { username?: string | null } | null)
    ?.username;
  const [displayName, setDisplayName] = useState(profileName ?? "Player");
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(window.location.search).get("code")?.toUpperCase() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    const seed = createSeed();
    const { data, error: rpcError } = await supabase.rpc(
      "create_hot_potato_variant_room",
      {
        p_seed: seed,
        p_initial_state: initialStoredState(seed),
        p_display_name: displayName.trim() || "Player",
        p_host_color: "black",
      },
    );
    setBusy(false);
    if (rpcError) return setError(rpcError.message);
    navigate(
      `/games/chess/variants/hot-potato/multiplayer/${String(data).toUpperCase()}`,
    );
  }

  async function joinRoom() {
    if (!user || busy || !joinCode.trim()) return;
    setBusy(true);
    setError(null);
    const code = joinCode.trim().toUpperCase();
    const { error: rpcError } = await supabase.rpc(
      "join_hot_potato_variant_room",
      { p_code: code, p_display_name: displayName.trim() || "Player" },
    );
    setBusy(false);
    if (rpcError) return setError(rpcError.message);
    navigate(`/games/chess/variants/hot-potato/multiplayer/${code}`);
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
      <div className="mx-auto max-w-3xl rounded-[32px] border border-orange-400/15 bg-zinc-900/80 p-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-3xl">
            💣
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-400">{ui("Multiplayer Variant")}</p>
            <h1 className="text-3xl font-black">{ui("Chess Hot Potato")}</h1>
            <p className="text-sm text-zinc-500">{ui("Same bomb, fuse and explosion on both browsers.")}</p>
          </div>
        </div>

        <label className="mt-7 block text-xs font-black uppercase tracking-wider text-zinc-500">{ui("Display name")}</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 outline-none"
        />

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {ui(error)}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <h2 className="font-black">{ui("Create room")}</h2>

            <button
              type="button"
              onClick={createRoom}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-orange-400 px-4 py-3 font-black text-orange-950 disabled:opacity-50"
            >{ui("Create room")}</button>
          </section>

          <section className="rounded-2xl border border-white/5 bg-black/20 p-4">
            <h2 className="font-black">{ui("Join room")}</h2>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={ui("ROOM CODE")}
              className="mt-4 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-mono uppercase tracking-widest outline-none"
            />
            <button
              type="button"
              onClick={joinRoom}
              disabled={busy || !joinCode.trim()}
              className="mt-4 w-full rounded-xl border border-orange-300/20 bg-orange-400/10 px-4 py-3 font-black text-orange-200 disabled:opacity-50"
            >{ui("Join room")}</button>
          </section>
        </div>
      </div>
    </main>
  );
}

export function HotPotatoMultiplayerGame() {
  useUiLanguage();
  const { roomCode = "" } = useParams();
  const { user } = useAuth();
  const [room, setRoom] = useState<VariantRoom | null>(null);
  const [players, setPlayers] = useState<VariantRoomPlayer[]>([]);
  const [gameState, setGameState] = useState<VariantGame | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );
  const [moving, setMoving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyRoomCode() {
    if (!room?.code || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy room code.");
    }
  }
  const versionRef = useRef<number | null>(null);

  const me = players.find((p) => p.user_id === user?.id) ?? null;
  const myColor = me?.chosen_color ?? null;
  const mySide: ChessSide | null =
    myColor === "white" ? "w" : myColor === "black" ? "b" : null;
  const orientation: "white" | "black" =
    myColor === "black" ? "black" : "white";

  const state = useMemo(
    () =>
      gameState
        ? normalizeState(gameState.state, Number(gameState.seed))
        : null,
    [gameState],
  );
  useVariantRecordAudio(state?.records ?? null, record => record.explosionSquaresAfter.length ? ["bombExplosion"] : []);
  useEffect(() => {
    if (state && gameState?.status === "playing" && Object.values(state.hotPotatoes).some(potato => potato.square !== null && !potato.dropped && potato.movesUntilExplosion > 0)) playChessSound("bombFuse");
    else stopSound("bombFuse");
    return () => stopSound("bombFuse");
  }, [state, gameState?.status]);
  const liveGame = useMemo(
    () =>
      gameState?.fen
        ? new Chess(gameState.fen, { skipValidation: true })
        : new Chess(),
    [gameState?.fen],
  );
  const previewRecord =
    historyPreviewPly !== null && state
      ? (state.records[historyPreviewPly - 1] ?? null)
      : null;
  const displayedGame = useMemo(
    () =>
      previewRecord
        ? new Chess(previewRecord.fenAfter, { skipValidation: true })
        : liveGame,
    [previewRecord, liveGame],
  );
  const displayedPotatoes =
    previewRecord?.hotPotatoesAfter ?? state?.hotPotatoes;
  const explosionSquares =
    previewRecord?.explosionSquaresAfter ?? state?.explosionSquares ?? [];
  const blownKings =
    previewRecord?.blownUpKingSquaresAfter ?? state?.blownUpKingSquares ?? [];
  const displayedLastMove = previewRecord
    ? { from: previewRecord.from, to: previewRecord.to }
    : gameState?.last_move_from && gameState.last_move_to
      ? {
          from: gameState.last_move_from as Square,
          to: gameState.last_move_to as Square,
        }
      : null;

  const loadAll = useCallback(async () => {
    if (!user || !roomCode) return;
    const { data: roomData, error: roomError } = await supabase
      .from("variant_rooms")
      .select("id, code, host_id, variant, status")
      .eq("code", roomCode.toUpperCase())
      .eq("variant", "hot-potato")
      .single();
    if (roomError || !roomData)
      return setError(roomError?.message ?? "Room not found");

    const loadedRoom = roomData as VariantRoom;
    const [
      { data: playerData, error: playerError },
      { data: gameData, error: gameError },
    ] = await Promise.all([
      supabase
        .from("variant_room_players")
        .select("room_id, user_id, seat, display_name, chosen_color")
        .eq("room_id", loadedRoom.id)
        .order("seat"),
      supabase
        .from("variant_games")
        .select(
          "room_id, variant, seed, initial_fen, fen, moves, state, status, winner, end_reason, version, last_move_from, last_move_to, white_rematch_ready, black_rematch_ready, undo_requested_by, undo_requested_version, undo_last_requested_by, undo_last_requested_version",
        )
        .eq("room_id", loadedRoom.id)
        .single(),
    ]);
    if (playerError || gameError || !gameData)
      return setError(
        playerError?.message ?? gameError?.message ?? "Could not load game",
      );
    setRoom(loadedRoom);
    setPlayers((playerData ?? []) as VariantRoomPlayer[]);
    setGameState(gameData as VariantGame);
    versionRef.current = Number((gameData as VariantGame).version);
  }, [roomCode, user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`hot-potato:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "variant_games",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const next = payload.new as VariantGame;
          versionRef.current = Number(next.version);
          setGameState(next);
          setHistoryPreviewPly(null);
          setSelectedSquare(null);
          setLegalMoves([]);
          setPromotion(null);
          setMoving(false);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "variant_room_players",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          void loadAll();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room, loadAll]);

  useEffect(() => {
    if (!room) return;
    const timer = window.setInterval(async () => {
      const { data } = await supabase
        .from("variant_games")
        .select(
          "room_id, variant, seed, initial_fen, fen, moves, state, status, winner, end_reason, version, last_move_from, last_move_to, white_rematch_ready, black_rematch_ready, undo_requested_by, undo_requested_version, undo_last_requested_by, undo_last_requested_version",
        )
        .eq("room_id", room.id)
        .single();
      if (
        data &&
        Number((data as VariantGame).version) !== versionRef.current
      ) {
        versionRef.current = Number((data as VariantGame).version);
        setGameState(data as VariantGame);
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [room]);

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  async function commitMove(
    from: Square,
    to: Square,
    promotionPiece?: PromotionPiece,
  ) {
    if (
      !room ||
      !gameState ||
      !state ||
      !mySide ||
      moving ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== mySide
    ) {
      return;
    }

    const beforeFen = liveGame.fen();
    const nextGame = new Chess(beforeFen, { skipValidation: true });

    let move;
    try {
      move = nextGame.move({
        from,
        to,
        ...(promotionPiece ? { promotion: promotionPiece } : {}),
      });
    } catch {
      setError("Illegal move");
      return;
    }
    if (!move) return;

    const nextHotPotatoes: HotPotatoStates = {
      w: { ...state.hotPotatoes.w },
      b: { ...state.hotPotatoes.b },
    };

    const spawnSerials = { ...state.spawnSerials };
    let nextExplosionSquares: Square[] = [];
    let nextBlownKings: Square[] = [];
    let destroyedPieces: DestroyedPiece[] = [];
    let potatoTransferred = false;
    let variantOutcome: HotPotatoOutcome = null;
    let explosionCount = state.explosionCount;
    let transferCount = state.transferCount;
    let destroyedPieceCount = state.destroyedPieceCount;

    const explodingOwners: ChessSide[] = [];

    for (const owner of ["w", "b"] as const) {
      const potato = nextHotPotatoes[owner];

      if (potato.square) {
        if (!pickUpHotPotato(potato, move)) continue;
        const carrier = potato.square;
        const carrierCaptured = carrier === move.to && carrier !== move.from;
        const epCaptured =
          move.flags.includes("e") &&
          carrier === (`${move.to[0]}${move.from[1]}` as Square);

        if (carrierCaptured || epCaptured) {
          potatoTransferred = true;
          transferCount += 1;
        }

        potato.square = getHotPotatoSquareAfterMove(carrier, {
          from: move.from,
          to: move.to,
          color: move.color,
          flags: move.flags,
        });

        potato.movesUntilExplosion -= 1;

        if (potato.movesUntilExplosion <= 0) {
          explodingOwners.push(owner);
        }
      } else if (potato.respawnMovesRemaining > 0) {
        potato.respawnMovesRemaining -= 1;

        if (potato.respawnMovesRemaining <= 0) {
          spawnSerials[owner] += 1;
          nextHotPotatoes[owner] = createRespawnedHotPotatoState(
            nextGame,
            owner,
            randomForSpawn(state.seed, owner, spawnSerials[owner]),
          );
        }
      }
    }

    for (const owner of explodingOwners) {
      const center = nextHotPotatoes[owner].square;
      if (!center) continue;

      const explosion = resolveHotPotatoExplosion(
        nextGame,
        center,
        nextHotPotatoes[owner].blastPattern,
      );

      nextExplosionSquares = [
        ...new Set([...nextExplosionSquares, ...explosion.explosionSquares]),
      ];
      nextBlownKings = [
        ...new Set([...nextBlownKings, ...explosion.blownUpKingSquares]),
      ];
      destroyedPieces = [...destroyedPieces, ...explosion.destroyedPieces];

      explosionCount += 1;
      destroyedPieceCount += explosion.destroyedPieces.length;
      nextHotPotatoes[owner] = createCoolingHotPotatoState(
        owner,
        nextHotPotatoes[owner].blastPattern,
      );
    }

    // A blast can destroy the carrier of the other bomb before its fuse
    // reaches zero. That bomb then begins its own independent cooldown.
    for (const owner of ["w", "b"] as const) {
      dropHotPotatoAfterBlast(nextGame, nextHotPotatoes[owner], nextExplosionSquares);
    }

    const whiteKingSquare = findKingSquare(nextGame, "w");
    const blackKingSquare = findKingSquare(nextGame, "b");
    const whiteKingHit =
      whiteKingSquare !== null && nextBlownKings.includes(whiteKingSquare);
    const blackKingHit =
      blackKingSquare !== null && nextBlownKings.includes(blackKingSquare);

    if (whiteKingHit || blackKingHit) {
      variantOutcome =
        whiteKingHit && blackKingHit
          ? "draw"
          : whiteKingHit
            ? "black"
            : "white";
    }

    const normalOutcome =
      variantOutcome === null ? getNormalChessOutcome(nextGame) : null;
    const outcome = variantOutcome ?? normalOutcome;

    const winner =
      outcome === "white" || outcome === "black" || outcome === "draw"
        ? outcome
        : null;

    const endReason =
      variantOutcome !== null
        ? "explosion"
        : nextGame.isCheckmate()
          ? "checkmate"
          : normalOutcome
            ? "draw"
            : null;

    const record: HotPotatoRecord = {
      ply: state.records.length + 1,
      moveNumber: Math.floor(state.records.length / 2) + 1,
      color: move.color,
      san: move.san,
      piece: move.piece as PieceType,
      from: move.from,
      to: move.to,
      captured: move.captured as PieceType | undefined,
      fenBefore: beforeFen,
      fenAfter: nextGame.fen(),
      hotPotatoesAfter: {
        w: { ...nextHotPotatoes.w },
        b: { ...nextHotPotatoes.b },
      },
      explosionSquaresAfter: [...nextExplosionSquares],
      blownUpKingSquaresAfter: [...nextBlownKings],
      potatoTransferred,
      destroyedPieces,
      spawnSerialsAfter: { ...spawnSerials },
      explosionCountAfter: explosionCount,
      transferCountAfter: transferCount,
      destroyedPieceCountAfter: destroyedPieceCount,
    };

    const nextState: HotPotatoStoredState = {
      seed: state.seed,
      spawnSerials,
      hotPotatoes: nextHotPotatoes,
      records: [...state.records, record],
      explosionSquares: nextExplosionSquares,
      blownUpKingSquares: nextBlownKings,
      explosionCount,
      transferCount,
      destroyedPieceCount,
    };

    setMoving(true);
    setError(null);
    clearSelection();
    setPromotion(null);

    setGameState((current) =>
      current
        ? {
            ...current,
            fen: nextGame.fen(),
            moves: [...current.moves, move.san],
            state: nextState,
            last_move_from: move.from,
            last_move_to: move.to,
            status: winner ? "finished" : current.status,
            winner,
            end_reason: endReason,
            version: current.version + 1,
          }
        : current,
    );

    if (move.captured) playPieceCaptureSound(move.piece);
    else playPieceMoveSound(move.piece);

    const { error: rpcError } = await supabase.rpc("play_hot_potato_move", {
      p_room_id: room.id,
      p_expected_version: gameState.version,
      p_new_fen: nextGame.fen(),
      p_san: move.san,
      p_new_state: nextState,
      p_from: move.from,
      p_to: move.to,
      p_winner: winner,
      p_end_reason: endReason,
    });

    if (rpcError) {
      setError(rpcError.message);
      await loadAll();
    }

    setMoving(false);
  }

  function handleSquareClick(row: number, column: number) {
    if (
      !gameState ||
      !mySide ||
      moving ||
      historyPreviewPly !== null ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== mySide
    )
      return;
    const square = getSquareName(row, column);
    if (!selectedSquare) {
      const piece = liveGame.get(square);
      if (!piece || piece.color !== mySide) return;
      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      setLegalMoves(liveGame.moves({ square, verbose: true }).map((m) => m.to));
      return;
    }
    const piece = liveGame.get(selectedSquare);
    if (
      piece?.type === "p" &&
      legalMoves.includes(square) &&
      (square[1] === "8" || square[1] === "1")
    ) {
      setPromotion({ from: selectedSquare, to: square });
      clearSelection();
      return;
    }
    if (!legalMoves.includes(square)) {
      const clicked = liveGame.get(square);
      if (clicked?.color === mySide) {
        setSelectedSquare(square);
        playPieceSelectSound(clicked.type);
        setLegalMoves(
          liveGame.moves({ square, verbose: true }).map((m) => m.to),
        );
      } else clearSelection();
      return;
    }
    void commitMove(selectedSquare, square);
  }

  async function requestUndo() {
    if (
      !room ||
      !gameState ||
      !state ||
      state.records.length === 0 ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      actionBusy
    )
      return;
    const previous = previousSnapshot(state);
    if (!previous) return;
    setActionBusy(true);
    const { error: rpcError } = await supabase.rpc("request_hot_potato_undo", {
      p_room_id: room.id,
      p_previous_fen: previous.fen,
      p_previous_state: previous.state,
      p_previous_last_from: previous.from,
      p_previous_last_to: previous.to,
    });
    setActionBusy(false);
    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function respondUndo(accept: boolean) {
    if (!room || !gameState?.undo_requested_by || actionBusy) return;
    setActionBusy(true);
    const { error: rpcError } = await supabase.rpc("respond_hot_potato_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });
    setActionBusy(false);
    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function resign() {
    if (!room || gameState?.status !== "playing" || actionBusy) return;
    setActionBusy(true);
    const { error: rpcError } = await supabase.rpc("resign_hot_potato_game", {
      p_room_id: room.id,
    });
    setActionBusy(false);
    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function requestRematch() {
    if (
      !room ||
      !gameState ||
      !state ||
      gameState.status !== "finished" ||
      actionBusy
    ) {
      return;
    }

    const seed = createSeed();

    setActionBusy(true);

    const { error: rpcError } = await supabase.rpc(
      "request_hot_potato_rematch",
      {
        p_room_id: room.id,
        p_next_seed: seed,
        p_next_state: initialStoredState(seed),
      },
    );

    setActionBusy(false);

    if (rpcError) {
      setError(rpcError.message);
    }

    await loadAll();
  }

  if (!room || !gameState || !state || !me) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent p-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <p className="font-black">{ui("Loading Hot Potato room…")}</p>
          {error && <p className="mt-3 text-sm text-red-300">{ui(error)}</p>}
        </div>
      </main>
    );
  }

  const opponent = players.find((p) => p.user_id !== user?.id) ?? null;
  const canMove =
    gameState.status === "playing" &&
    mySide === liveGame.turn() &&
    !gameState.undo_requested_by &&
    !moving;
  const finished = gameState.status === "finished" && gameState.winner;
  const myRematchReady =
    myColor === "white"
      ? Boolean(gameState.white_rematch_ready)
      : Boolean(gameState.black_rematch_ready);

  if (room.status === "waiting") {
    return (
      <VariantRoomSetup
        roomId={room.id}
        variantName={"Hot Potato Chess"}
        lobbyPath={"/games/chess/variants/hot-potato/multiplayer"}
        onStarted={() => void loadAll()}
      />
    );
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1460px]">
        <ChessPageHeader className="mb-6 flex flex-col gap-4 rounded-3xl border border-orange-400/10 bg-zinc-900/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" description={<> {ui("Room ")}{room.code} </>}>

          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm">
            {gameState.status === "waiting" ? ui("Waiting for opponent…") : finished ? ui("Game finished") : canMove ? ui("Your turn") : ui("Opponent's turn")}
          </div>
        </ChessPageHeader>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {ui(error)}
          </div>
        )}

        <div className="grid gap-6 chess-game-grid xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="space-y-4">
            <Panel title={ui("Players")}>
              <div className="space-y-2 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <b>{me.display_name}</b> · {myColor}
                  <p className="text-xs text-zinc-500">{ui("You")}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <b>{opponent?.display_name ?? "Waiting…"}</b>
                  {opponent ? ` · ${opponent.chosen_color}` : ""}
                  <p className="text-xs text-zinc-500">{ui("Opponent")}</p>
                </div>
              </div>
            </Panel>
            <Panel title={ui("Actions")}>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={requestUndo}
                  disabled={
                    gameState.status !== "playing" ||
                    state.records.length === 0 ||
                    Boolean(gameState.undo_requested_by) ||
                    actionBusy
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black disabled:opacity-40"
                >{ui("↶ Request Undo")}</button>
                <button
                  type="button"
                  onClick={resign}
                  disabled={gameState.status !== "playing" || actionBusy}
                  className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm font-black text-red-300 disabled:opacity-40"
                >{ui("Resign")}</button>
                <Link
                  to="/games/chess/variants/hot-potato/multiplayer"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm font-black"
                >{ui("Leave room")}</Link>
              </div>
            </Panel>
            <Panel title={ui("Move History")}>
              <ChessMoveHistoryList
                listClassName="max-h-80 rounded-xl border border-white/5 bg-black/20"
                selectedPly={historyPreviewPly}
                emptyLabel="No moves yet"
                entries={state.records.map((record) => ({
                  ply: record.ply,
                  side: record.color,
                  moveNumber: record.moveNumber,
                  content: <span className="truncate font-mono text-xs font-bold text-zinc-200">{record.san}</span>,
                  trailing: <span>{`${record.potatoTransferred ? "💣→" : ""}${record.explosionSquaresAfter.length ? "💥" : ""}`}</span>,
                }))}
                onSelect={(ply) => {
                  setHistoryPreviewPly(ply);
                  clearSelection();
                  setPromotion(null);
                }}
              />
            </Panel>
          </aside>

          <section className="mx-auto w-full max-w-[820px] min-w-0">
            {historyPreviewPly !== null && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-orange-400/20 bg-orange-400/[0.07] px-4 py-3">
                <span className="text-sm font-black">{ui("History · action")}{historyPreviewPly}
                </span>
                <button
                  onClick={() => setHistoryPreviewPly(null)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black"
                >{ui("Back to live")}</button>
              </div>
            )}
            {promotion && historyPreviewPly === null && (
              <div className="relative mb-3">
                <PromotionBar
                  onPromote={(piece) =>
                    void commitMove(promotion.from, promotion.to, piece)
                  }
                />
              </div>
            )}
            {finished && historyPreviewPly === null && (
              <VisibleGameResult
                winner={gameState.winner}
                playerColor={myColor}
                reason={gameState.end_reason}
                actions={
                  <button
                    type="button"
                    onClick={requestRematch}
                    disabled={myRematchReady || actionBusy}
                    className="mt-5 w-full rounded-xl bg-orange-400 px-4 py-3 font-black text-orange-950 disabled:opacity-50"
                  >
                    {myRematchReady ? ui("Waiting for opponent…") : ui("Play again")}
                  </button>
                }
              />
            )}

            <div className="relative">
              <Board
                board={displayedGame.board()}
                selectedSquare={
                  historyPreviewPly !== null ? null : selectedSquare
                }
                legalMoves={historyPreviewPly !== null ? [] : legalMoves}
                lastMove={displayedLastMove}
                checkedKingSquare={checkedKingSquare(displayedGame)}
                onSquareClick={
                  historyPreviewPly !== null || !canMove
                    ? () => {}
                    : handleSquareClick
                }
                hotPotatoes={(["w", "b"] as const)
                  .map((owner) => ({
                    owner,
                    square: displayedPotatoes?.[owner].square ?? null,
                    movesRemaining:
                      displayedPotatoes?.[owner].movesUntilExplosion ?? 0,
                  }))
                  .filter(
                    (
                      potato,
                    ): potato is {
                      owner: "w" | "b";
                      square: Square;
                      movesRemaining: number;
                    } => potato.square !== null,
                  )}
                hotPotatoExplosionSquares={explosionSquares}
                hotPotatoBlownUpKingSquares={blownKings}
                orientation={orientation}
              />
              {players.length < 2 && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-zinc-950/70 p-4 backdrop-blur-[3px]">
                  <button
                    type="button"
                    onClick={() => void copyRoomCode()}
                    className="w-full max-w-lg rounded-[30px] border border-white/15 bg-zinc-900/95 px-8 py-8 text-center shadow-2xl shadow-black/60 transition hover:border-amber-300/35 hover:bg-zinc-900 active:scale-[0.99]"
                    title={ui("Copy room code")}
                  >
                    <div className="text-4xl">🌐</div>

                    <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-amber-300">{ui("Waiting for players")}</p>

                    <h2 className="mt-2 text-2xl font-black text-white">
                      {players.length}{ui("/2 players connected")}</h2>

                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">{ui("Share this room code. The game starts automatically when everyone has joined.")}</p>

                    <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-5 py-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">{ui("Room Code")}</p>

                      <p className="mt-2 break-all font-mono text-4xl font-black tracking-[0.16em] text-amber-200 sm:text-5xl">
                        {room.code}
                      </p>
                    </div>

                    <p className="mt-4 text-xs font-bold text-zinc-400">
                      {copied ? ui("✓ Copied to clipboard") : ui("Click this box to copy the code")}
                    </p>
                  </button>
                    <InviteFriendButton overlay />
                </div>
              )}


            </div>
          </section>

          <aside className="space-y-4">
            <Panel title={ui("Hot Potato")}>
              <div className="space-y-3">
                {(["w", "b"] as const).map((owner) => {
                  const potato = displayedPotatoes?.[owner];

                  if (!potato) {
                    return null;
                  }

                  const patternLabel =
                    potato.blastPattern === "ring"
                      ? "Ring 1"
                      : potato.blastPattern === "cross2"
                        ? "Cross 2"
                        : "Diagonal 2";

                  return (
                    <div
                      key={owner}
                      className={`rounded-2xl border p-4 ${
                        owner === "w"
                          ? "border-amber-300/15 bg-amber-300/[0.04]"
                          : "border-violet-300/15 bg-violet-300/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                          {owner === "w" ? ui("White bomb") : ui("Black bomb")}
                        </p>

                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black text-zinc-300">
                          {patternLabel}
                        </span>
                      </div>

                      {potato.square ? (
                        <>
                          <div className="mt-3 flex items-end justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{ui("Carrier")}</p>
                              <p className="mt-1 font-mono text-xl font-black uppercase text-white">
                                {potato.square}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{ui("Explodes in")}</p>
                              <p className="mt-1 text-3xl font-black text-orange-200">
                                {potato.movesUntilExplosion}{potato.dropped ? ui(" · Paused on ground") : ""}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
                            <div
                              className="h-full rounded-full bg-orange-400 transition-all duration-300"
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (potato.movesUntilExplosion /
                                      Math.max(1, potato.fuseMovesTotal)) *
                                      100,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{ui("Cooling down")}</p>
                            <p className="mt-1 text-xs text-zinc-500">{ui("New random bomb for this side")}</p>
                          </div>

                          <span className="text-2xl font-black text-cyan-200">
                            {potato.respawnMovesRemaining}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Panel title={ui("Chaos Stats")}>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Explosions", state.explosionCount],
                  ["Transfers", state.transferCount],
                  ["Destroyed", state.destroyedPieceCount],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl bg-black/20 p-3"
                  >
                    <p className="text-xl font-black text-orange-300">
                      {value}
                    </p>
                    <p className="text-[9px] text-zinc-600">{ui(label)}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title={ui("Rules")}>
              <div className="space-y-2 text-xs leading-5 text-zinc-400">
                <p>{ui("💣 Random non-king carrier.")}</p>
                <p>{ui("⏱ Random 4–12 move fuse.")}</p>
                <p>{ui("↔ Capture transfers the bomb.")}</p>
                <p>{ui("💥 Carrier + 8 adjacent squares explode.")}</p>
                <p>{ui("❄ 5-move cooldown before respawn.")}</p>
              </div>
            </Panel>
          </aside>
        </div>

        {gameState.undo_requested_by && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6">
              {gameState.undo_requested_by === user?.id ? (
                <>
                  <h2 className="text-xl font-black">{ui("Undo requested")}</h2>
                  <p className="mt-2 text-sm text-zinc-500">{ui("Waiting for your opponent.")}</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-black">{ui("Opponent requests Undo")}</h2>
                  <p className="mt-2 text-sm text-zinc-500">{ui("This restores the full pre-move bomb/explosion state.")}</p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => void respondUndo(false)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black"
                    >{ui("Decline")}</button>
                    <button
                      onClick={() => void respondUndo(true)}
                      className="rounded-xl bg-orange-400 px-4 py-3 font-black text-orange-950"
                    >{ui("Accept")}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
