import InviteFriendButton from "@/components/chess/InviteFriendButton";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
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
  BOSS_MAX_HP,
  BOSS_MAX_RAGE,
  BOSS_STARTING_FEN,
  bossPowerIcon,
  bossPowerLabel,
  bossRepetitionKey,
  canUseBossPower,
  cloneBossBattleState,
  completeOrdinaryPly,
  createInitialBossBattleState,
  damageBoss,
  findKingSquare,
  getBossPowerCooldown,
  getBossRage,
  getDarkStepSquares,
  getSummonSquares,
  isThreefoldBossBattle,
  useDarkStepPower,
  useShockwavePower,
  useSummonPower,
  type BossBattleState,
  type BossPowerId,
  type BossSide,
  type BossTargetMode,
} from "../../../games/chess/variants/bossBattle";

type PlayerColor = "white" | "black";
type PromotionPiece = "q" | "r" | "b" | "n";

type FinishedGame = {
  winner: PlayerColor | "draw";
  reason:
    | "boss_hp"
    | "checkmate"
    | "stalemate"
    | "fifty"
    | "repetition"
    | "resignation";
} | null;

type BossHistoryEntry = {
  ply: number;
  moveNumber: number;
  color: BossSide;
  kind: "move" | "power";
  san: string;
  from: Square | null;
  to: Square | null;
  piece: PieceType | null;
  captured: PieceType | null;
  fenAfter: string;
  stateAfter: BossBattleState;
  bossDamaged: boolean;
  power: BossPowerId | null;
};

type BossStoredState = {
  boss: BossBattleState;
  history: BossHistoryEntry[];
  capturedWhite: PieceType[];
  capturedBlack: PieceType[];
};

type VariantRoom = {
  id: string;
  code: string;
  host_id: string;
  variant: "boss";
  status: "waiting" | "playing" | "finished";
};

type VariantRoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  chosen_color: PlayerColor;
};

type VariantGame = {
  room_id: string;
  variant: "boss";
  seed: number;
  initial_fen: string;
  fen: string;
  moves: string[];
  state: BossStoredState;
  status: "waiting" | "playing" | "finished";
  winner: PlayerColor | "draw" | null;
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

function sideFromPlayerColor(color: PlayerColor): BossSide {
  return color === "white" ? "w" : "b";
}

function initialStoredState(): BossStoredState {
  return {
    boss: createInitialBossBattleState(),
    history: [],
    capturedWhite: [],
    capturedBlack: [],
  };
}

function normalizeStoredState(value: unknown): BossStoredState {
  const fallback = initialStoredState();

  if (!value || typeof value !== "object") return fallback;

  const raw = value as Partial<BossStoredState>;

  return {
    boss:
      raw.boss && typeof raw.boss === "object"
        ? (raw.boss as BossBattleState)
        : fallback.boss,
    history: Array.isArray(raw.history)
      ? (raw.history as BossHistoryEntry[])
      : [],
    capturedWhite: Array.isArray(raw.capturedWhite)
      ? (raw.capturedWhite as PieceType[])
      : [],
    capturedBlack: Array.isArray(raw.capturedBlack)
      ? (raw.capturedBlack as PieceType[])
      : [],
  };
}

function capturedFromHistory(history: BossHistoryEntry[]) {
  const capturedWhite: PieceType[] = [];
  const capturedBlack: PieceType[] = [];

  for (const entry of history) {
    if (!entry.captured || entry.kind !== "move") continue;

    if (entry.color === "w") {
      capturedBlack.push(entry.captured);
    } else {
      capturedWhite.push(entry.captured);
    }
  }

  return { capturedWhite, capturedBlack };
}

function previousSnapshot(state: BossStoredState): {
  fen: string;
  state: BossStoredState;
  lastFrom: string | null;
  lastTo: string | null;
} | null {
  if (state.history.length === 0) return null;

  const previousHistory = state.history.slice(0, -1);

  if (previousHistory.length === 0) {
    return {
      fen: BOSS_STARTING_FEN,
      state: initialStoredState(),
      lastFrom: null,
      lastTo: null,
    };
  }

  const previous = previousHistory[previousHistory.length - 1];
  const captured = capturedFromHistory(previousHistory);

  return {
    fen: previous.fenAfter,
    state: {
      boss: cloneBossBattleState(previous.stateAfter),
      history: previousHistory,
      capturedWhite: captured.capturedWhite,
      capturedBlack: captured.capturedBlack,
    },
    lastFrom: previous.from && previous.to ? previous.from : null,
    lastTo: previous.from && previous.to ? previous.to : null,
  };
}

function bossHearts(hp: number): string {
  return `${"♥".repeat(Math.max(0, hp))}${"♡".repeat(
    Math.max(0, BOSS_MAX_HP - hp),
  )}`;
}

function getFinish(
  game: Chess,
  bossState: BossBattleState,
  history: BossHistoryEntry[],
): FinishedGame {
  if (bossState.hp <= 0) {
    return { winner: "white", reason: "boss_hp" };
  }

  if (game.isCheckmate()) {
    return {
      winner: game.turn() === "w" ? "black" : "white",
      reason: "checkmate",
    };
  }

  if (game.isStalemate()) {
    if (game.turn() === "b") {
      const bossHasPower = (
        ["shockwave", "summon", "dark_step"] as BossPowerId[]
      ).some((power) => canUseBossPower(game, bossState, power));

      if (!bossHasPower) {
        return { winner: "draw", reason: "stalemate" };
      }
    } else {
      return { winner: "draw", reason: "stalemate" };
    }
  }

  if (game.isDrawByFiftyMoves()) {
    return { winner: "draw", reason: "fifty" };
  }

  const repetitionKeys = [
    bossRepetitionKey(
      new Chess(BOSS_STARTING_FEN),
      createInitialBossBattleState(),
    ),
    ...history.map((entry) =>
      bossRepetitionKey(
        new Chess(entry.fenAfter, { skipValidation: true }),
        entry.stateAfter,
      ),
    ),
  ];

  if (isThreefoldBossBattle(repetitionKeys)) {
    return { winner: "draw", reason: "repetition" };
  }

  return null;
}

function finishLabel(result: FinishedGame): string {
  if (!result) return "";

  if (result.reason === "boss_hp") {
    return "The Boss has lost all 5 HP.";
  }

  if (result.reason === "checkmate") return "Checkmate.";
  if (result.reason === "stalemate") return "Stalemate.";
  if (result.reason === "fifty") return "50-move rule.";
  if (result.reason === "repetition") return "Threefold repetition.";
  if (result.reason === "resignation") return "Resignation.";

  return "Game finished.";
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
    <section className="rounded-3xl border border-white/5 bg-zinc-900/80 p-4 shadow-xl shadow-black/20">
      <h2 className="font-black text-zinc-100">{ui(title)}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatusCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg">{icon}</span>
        <span className="font-black text-violet-200">{value}</span>
      </div>
      <p className="mt-1 text-[10px] text-zinc-600">{ui(label)}</p>
    </div>
  );
}

/* =========================================================
   LOBBY
   ========================================================= */

export function BossBattleMultiplayerLobby() {
  useUiLanguage();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [displayName, setDisplayName] = useState(
    (profile as { username?: string | null } | null)?.username ?? "Player",
  );
  const [hostColor, setHostColor] = useState<PlayerColor>("white");
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(window.location.search).get("code")?.toUpperCase() ?? "");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    if (!user || busy) return;

    setBusy("create");
    setError(null);

    const { data, error: rpcError } = await supabase.rpc(
      "create_boss_variant_room",
      {
        p_initial_state: initialStoredState(),
        p_display_name: displayName.trim() || "Player",
        p_host_color: hostColor,
      },
    );

    setBusy(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    navigate(
      `/games/chess/variants/boss/multiplayer/${String(data).toUpperCase()}`,
    );
  }

  async function joinRoom() {
    if (!user || busy || !joinCode.trim()) return;

    setBusy("join");
    setError(null);

    const code = joinCode.trim().toUpperCase();

    const { error: rpcError } = await supabase.rpc("join_boss_variant_room", {
      p_code: code,
      p_display_name: displayName.trim() || "Player",
    });

    setBusy(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    navigate(`/games/chess/variants/boss/multiplayer/${code}`);
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[32px] border border-violet-400/15 bg-zinc-900/85 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-3xl">
              ♚
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-400">{ui("Asymmetric Multiplayer")}</p>
              <h1 className="mt-1 text-3xl font-black">{ui("Boss Battle Chess")}</h1>
              <p className="mt-1 text-sm text-zinc-500">{ui("White commands the full army. Black becomes the Boss.")}</p>
            </div>
          </div>

          <label className="mt-8 block text-xs font-black uppercase tracking-wider text-zinc-500">{ui("Display name")}</label>

          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 outline-none focus:border-violet-400/40"
          />

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {ui(error)}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <h2 className="font-black">{ui("Create room")}</h2>
              <p className="mt-1 text-xs text-zinc-500">{ui("Choose White or the Black Boss.")}</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHostColor("white")}
                  className={`rounded-xl border px-3 py-3 text-sm font-black ${
                    hostColor === "white"
                      ? "border-zinc-200/30 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-zinc-500"
                  }`}
                >{ui("♔ White Army")}</button>

                <button
                  type="button"
                  onClick={() => setHostColor("black")}
                  className={`rounded-xl border px-3 py-3 text-sm font-black ${
                    hostColor === "black"
                      ? "border-violet-300/30 bg-violet-400/15 text-violet-100"
                      : "border-white/10 bg-white/5 text-zinc-500"
                  }`}
                >{ui("♚ Boss")}</button>
              </div>

              <button
                type="button"
                onClick={createRoom}
                disabled={busy !== null}
                className="mt-4 w-full rounded-xl bg-violet-400 px-4 py-3 font-black text-violet-950 disabled:opacity-50"
              >
                {busy === "create" ? ui("Creating...") : ui("Create Boss Battle room")}
              </button>
            </section>

            <section className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <h2 className="font-black">{ui("Join room")}</h2>
              <p className="mt-1 text-xs text-zinc-500">{ui("The other side is assigned automatically.")}</p>

              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                placeholder={ui("ROOM CODE")}
                className="mt-4 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-violet-400/40"
              />

              <button
                type="button"
                onClick={joinRoom}
                disabled={busy !== null || !joinCode.trim()}
                className="mt-4 w-full rounded-xl border border-violet-300/20 bg-violet-400/10 px-4 py-3 font-black text-violet-200 disabled:opacity-50"
              >
                {busy === "join" ? ui("Joining...") : ui("Join room")}
              </button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

/* =========================================================
   GAME
   ========================================================= */

export function BossBattleMultiplayerGame() {
  useUiLanguage();
  const { roomCode = "" } = useParams();
  const { user } = useAuth();

  const [room, setRoom] = useState<VariantRoom | null>(null);
  const [players, setPlayers] = useState<VariantRoomPlayer[]>([]);
  const [gameState, setGameState] = useState<VariantGame | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [bossTargetMode, setBossTargetMode] = useState<BossTargetMode>(null);

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  const [moving, setMoving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const lastSeenVersionRef = useRef<number | null>(null);

  const me = players.find((player) => player.user_id === user?.id) ?? null;
  const opponent =
    players.find((player) => player.user_id !== user?.id) ?? null;

  const myColor = me?.chosen_color ?? null;
  const mySide = myColor ? sideFromPlayerColor(myColor) : null;

  const orientation: "white" | "black" =
    myColor === "black" ? "black" : "white";

  const storedState = useMemo(
    () => (gameState ? normalizeStoredState(gameState.state) : null),
    [gameState],
  );

  const liveGame = useMemo(
    () =>
      gameState?.fen
        ? new Chess(gameState.fen, { skipValidation: true })
        : new Chess(BOSS_STARTING_FEN),
    [gameState?.fen],
  );

  const previewEntry =
    historyPreviewPly !== null && storedState
      ? (storedState.history[historyPreviewPly - 1] ?? null)
      : null;

  const displayedGame = useMemo(
    () =>
      previewEntry
        ? new Chess(previewEntry.fenAfter, { skipValidation: true })
        : liveGame,
    [previewEntry, liveGame],
  );

  const displayedBossState =
    previewEntry?.stateAfter ??
    storedState?.boss ??
    createInitialBossBattleState();

  const displayedLastMove = previewEntry
    ? previewEntry.from && previewEntry.to
      ? { from: previewEntry.from, to: previewEntry.to }
      : null
    : gameState?.last_move_from && gameState.last_move_to
      ? {
          from: gameState.last_move_from as Square,
          to: gameState.last_move_to as Square,
        }
      : null;

  const bossSquare = findKingSquare(displayedGame, "b");

  const checkedKingSquare = displayedGame.isCheck()
    ? findKingSquare(displayedGame, displayedGame.turn() as BossSide)
    : null;

  const livePowerTargetSquares = useMemo(() => {
    if (
      !storedState ||
      historyPreviewPly !== null ||
      gameState?.status !== "playing" ||
      mySide !== "b" ||
      liveGame.turn() !== "b" ||
      moving
    ) {
      return [] as Square[];
    }

    if (bossTargetMode === "summon") {
      return getSummonSquares(liveGame);
    }

    if (bossTargetMode === "dark_step") {
      return getDarkStepSquares(liveGame);
    }

    return [] as Square[];
  }, [
    storedState,
    historyPreviewPly,
    gameState?.status,
    mySide,
    liveGame,
    moving,
    bossTargetMode,
  ]);

  const displayedShockwaveSquares =
    displayedBossState.lastPower === "shockwave"
      ? displayedBossState.lastPowerSquares
      : [];

  const finishedGame: FinishedGame =
    gameState?.status === "finished" && gameState.winner
      ? {
          winner: gameState.winner,
          reason:
            gameState.end_reason === "boss_hp"
              ? "boss_hp"
              : gameState.end_reason === "stalemate"
                ? "stalemate"
                : gameState.end_reason === "fifty"
                  ? "fifty"
                  : gameState.end_reason === "repetition"
                    ? "repetition"
                    : gameState.end_reason === "resignation"
                      ? "resignation"
                      : "checkmate",
        }
      : null;

  const loadAll = useCallback(async () => {
    if (!user || !roomCode) return;

    const { data: roomData, error: roomError } = await supabase
      .from("variant_rooms")
      .select("id, code, host_id, variant, status")
      .eq("code", roomCode.toUpperCase())
      .eq("variant", "boss")
      .single();

    if (roomError || !roomData) {
      setError(roomError?.message ?? "Room not found.");
      return;
    }

    const loadedRoom = roomData as VariantRoom;

    const [
      { data: playerData, error: playerError },
      { data: gameData, error: gameError },
    ] = await Promise.all([
      supabase
        .from("variant_room_players")
        .select("room_id, user_id, seat, display_name, chosen_color")
        .eq("room_id", loadedRoom.id)
        .order("seat", { ascending: true }),
      supabase
        .from("variant_games")
        .select(
          `
            room_id,
            variant,
            seed,
            initial_fen,
            fen,
            moves,
            state,
            status,
            winner,
            end_reason,
            version,
            last_move_from,
            last_move_to,
            white_rematch_ready,
            black_rematch_ready,
            undo_requested_by,
            undo_requested_version,
            undo_last_requested_by,
            undo_last_requested_version
          `,
        )
        .eq("room_id", loadedRoom.id)
        .single(),
    ]);

    if (playerError || gameError || !gameData) {
      setError(
        playerError?.message ??
          gameError?.message ??
          "Game could not be loaded.",
      );
      return;
    }

    setRoom(loadedRoom);
    setPlayers((playerData ?? []) as VariantRoomPlayer[]);
    setGameState(gameData as VariantGame);
    lastSeenVersionRef.current = Number((gameData as VariantGame).version);
  }, [roomCode, user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`boss-battle:${room.id}`)
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

          lastSeenVersionRef.current = Number(next.version);
          setGameState(next);
          setHistoryPreviewPly(null);
          setSelectedSquare(null);
          setLegalMoves([]);
          setPendingPromotion(null);
          setBossTargetMode(null);
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
          `
            room_id,
            variant,
            seed,
            initial_fen,
            fen,
            moves,
            state,
            status,
            winner,
            end_reason,
            version,
            last_move_from,
            last_move_to,
            white_rematch_ready,
            black_rematch_ready,
            undo_requested_by,
            undo_requested_version,
            undo_last_requested_by,
            undo_last_requested_version
          `,
        )
        .eq("room_id", room.id)
        .single();

      if (!data) return;

      const next = data as VariantGame;

      if (
        lastSeenVersionRef.current !== Number(next.version) ||
        next.undo_requested_by !== gameState?.undo_requested_by ||
        next.white_rematch_ready !== gameState?.white_rematch_ready ||
        next.black_rematch_ready !== gameState?.black_rematch_ready ||
        next.status !== gameState?.status
      ) {
        lastSeenVersionRef.current = Number(next.version);
        setGameState(next);
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [
    room,
    gameState?.undo_requested_by,
    gameState?.white_rematch_ready,
    gameState?.black_rematch_ready,
    gameState?.status,
  ]);

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function clearPowerTarget() {
    setBossTargetMode(null);
  }

  async function submitAction({
    nextGame,
    nextStoredState,
    san,
    kind,
    from,
    to,
    finish,
  }: {
    nextGame: Chess;
    nextStoredState: BossStoredState;
    san: string;
    kind: "move" | "power";
    from: Square | null;
    to: Square | null;
    finish: FinishedGame;
  }) {
    if (!room || !gameState) return false;

    setMoving(true);
    setError(null);

    const version = gameState.version;

    setGameState((current) =>
      current
        ? {
            ...current,
            fen: nextGame.fen(),
            moves: [...(current.moves ?? []), san],
            state: nextStoredState,
            status: finish ? "finished" : "playing",
            winner: finish?.winner ?? null,
            end_reason: finish?.reason ?? null,
            last_move_from: from,
            last_move_to: to,
            version: current.version + 1,
          }
        : current,
    );

    const { error: rpcError } = await supabase.rpc("play_boss_action", {
      p_room_id: room.id,
      p_expected_version: version,
      p_action_kind: kind,
      p_new_fen: nextGame.fen(),
      p_san: san,
      p_new_state: nextStoredState,
      p_from: from,
      p_to: to,
      p_winner: finish?.winner ?? null,
      p_end_reason: finish?.reason ?? null,
    });

    setMoving(false);

    if (rpcError) {
      setError(rpcError.message);
      await loadAll();
      return false;
    }

    return true;
  }

  async function makeMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ) {
    if (
      !room ||
      !gameState ||
      !storedState ||
      !mySide ||
      moving ||
      bossTargetMode ||
      historyPreviewPly !== null ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== mySide
    ) {
      return;
    }

    const nextGame = new Chess(liveGame.fen(), {
      skipValidation: true,
    });

    let move;
    try {
      move = nextGame.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      });
    } catch {
      setError("Illegal move.");
      return;
    }

    if (!move) return;

    let nextBossState = cloneBossBattleState(storedState.boss);
    let bossDamaged = false;

    if (!nextGame.isCheckmate()) {
      if (move.color === "w" && nextGame.isCheck()) {
        const damage = damageBoss(nextBossState);
        nextBossState = damage.state;
        bossDamaged = damage.damaged;
      } else {
        nextBossState = completeOrdinaryPly(
          nextBossState,
          move.color as BossSide,
        );
      }
    } else {
      nextBossState = completeOrdinaryPly(
        nextBossState,
        move.color as BossSide,
      );
    }

    let nextCapturedWhite = [...storedState.capturedWhite];
    let nextCapturedBlack = [...storedState.capturedBlack];

    if (move.captured) {
      if (move.color === "w") {
        nextCapturedBlack.push(move.captured as PieceType);
      } else {
        nextCapturedWhite.push(move.captured as PieceType);
      }
    }

    const historyEntry: BossHistoryEntry = {
      ply: storedState.history.length + 1,
      moveNumber: Math.floor(storedState.history.length / 2) + 1,
      color: move.color as BossSide,
      kind: "move",
      san: move.san,
      from: move.from as Square,
      to: move.to as Square,
      piece: move.piece as PieceType,
      captured: move.captured ? (move.captured as PieceType) : null,
      fenAfter: nextGame.fen(),
      stateAfter: cloneBossBattleState(nextBossState),
      bossDamaged,
      power: null,
    };

    const nextHistory = [...storedState.history, historyEntry];

    const nextStoredState: BossStoredState = {
      boss: nextBossState,
      history: nextHistory,
      capturedWhite: nextCapturedWhite,
      capturedBlack: nextCapturedBlack,
    };

    const finish = getFinish(nextGame, nextBossState, nextHistory);

    clearSelection();
    setPendingPromotion(null);
    clearPowerTarget();

    if (move.captured) {
      playPieceCaptureSound(move.piece);
    } else {
      playPieceMoveSound(move.piece);
    }

    await submitAction({
      nextGame,
      nextStoredState,
      san: move.san,
      kind: "move",
      from: move.from as Square,
      to: move.to as Square,
      finish,
    });
  }

  async function commitPower(power: BossPowerId, target?: Square) {
    if (
      !room ||
      !gameState ||
      !storedState ||
      mySide !== "b" ||
      moving ||
      historyPreviewPly !== null ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== "b" ||
      liveGame.isCheck()
    ) {
      return;
    }

    const result =
      power === "shockwave"
        ? useShockwavePower(liveGame, storedState.boss)
        : power === "summon" && target
          ? useSummonPower(liveGame, storedState.boss, target)
          : power === "dark_step" && target
            ? useDarkStepPower(liveGame, storedState.boss, target)
            : null;

    if (!result) {
      setError("That Boss power cannot be used right now.");
      clearPowerTarget();
      return;
    }

    const from =
      power === "dark_step" && result.affectedSquares.length >= 2
        ? result.affectedSquares[0]
        : null;

    const to =
      power === "dark_step" && result.affectedSquares.length >= 2
        ? result.affectedSquares[1]
        : (target ?? null);

    const san = `${bossPowerIcon(power)} ${bossPowerLabel(power)}`;

    const historyEntry: BossHistoryEntry = {
      ply: storedState.history.length + 1,
      moveNumber: Math.floor(storedState.history.length / 2) + 1,
      color: "b",
      kind: "power",
      san,
      from,
      to,
      piece: "k",
      captured: null,
      fenAfter: result.game.fen(),
      stateAfter: cloneBossBattleState(result.state),
      bossDamaged: false,
      power,
    };

    const nextHistory = [...storedState.history, historyEntry];

    const nextStoredState: BossStoredState = {
      ...storedState,
      boss: cloneBossBattleState(result.state),
      history: nextHistory,
    };

    const finish = getFinish(result.game, result.state, nextHistory);

    clearSelection();
    clearPowerTarget();
    setPendingPromotion(null);

    playPieceMoveSound("k");

    await submitAction({
      nextGame: result.game,
      nextStoredState,
      san,
      kind: "power",
      from,
      to,
      finish,
    });
  }

  function choosePower(power: BossPowerId) {
    if (
      !storedState ||
      mySide !== "b" ||
      liveGame.turn() !== "b" ||
      gameState?.status !== "playing" ||
      moving ||
      !canUseBossPower(liveGame, storedState.boss, power)
    ) {
      return;
    }

    clearSelection();

    if (power === "shockwave") {
      void commitPower("shockwave");
      return;
    }

    setBossTargetMode((current) =>
      current === power ? null : (power as BossTargetMode),
    );
  }

  function selectPiece(square: Square) {
    if (
      !storedState ||
      !mySide ||
      moving ||
      bossTargetMode ||
      historyPreviewPly !== null ||
      gameState?.status !== "playing" ||
      liveGame.turn() !== mySide
    ) {
      return;
    }

    const piece = liveGame.get(square);

    if (!piece || piece.color !== mySide) {
      clearSelection();
      return;
    }

    setSelectedSquare(square);
    setLegalMoves(
      liveGame
        .moves({ square, verbose: true })
        .map((move) => move.to as Square),
    );
    playPieceSelectSound(piece.type);
  }

  function handleSquareClick(row: number, column: number) {
    if (
      !storedState ||
      !mySide ||
      moving ||
      historyPreviewPly !== null ||
      gameState?.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== mySide
    ) {
      return;
    }

    const square = getSquareName(row, column);

    if (bossTargetMode) {
      if (mySide !== "b" || !livePowerTargetSquares.includes(square)) {
        clearPowerTarget();
        return;
      }

      void commitPower(bossTargetMode, square);
      return;
    }

    if (!selectedSquare) {
      selectPiece(square);
      return;
    }

    if (square === selectedSquare) {
      clearSelection();
      return;
    }

    const clicked = liveGame.get(square);

    if (clicked?.color === mySide) {
      selectPiece(square);
      return;
    }

    if (!legalMoves.includes(square)) {
      clearSelection();
      return;
    }

    const selectedPiece = liveGame.get(selectedSquare);

    const reachesPromotionRank =
      selectedPiece?.type === "p" &&
      ((selectedPiece.color === "w" && square[1] === "8") ||
        (selectedPiece.color === "b" && square[1] === "1"));

    if (reachesPromotionRank) {
      setPendingPromotion({
        from: selectedSquare,
        to: square,
      });
      clearSelection();
      return;
    }

    void makeMove(selectedSquare, square);
  }

  async function requestUndo() {
    if (
      !room ||
      !gameState ||
      !storedState ||
      storedState.history.length === 0 ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      actionBusy
    ) {
      return;
    }

    const previous = previousSnapshot(storedState);
    if (!previous) return;

    setActionBusy("undo");
    setError(null);

    const { error: rpcError } = await supabase.rpc("request_boss_undo", {
      p_room_id: room.id,
      p_previous_fen: previous.fen,
      p_previous_state: previous.state,
      p_previous_last_from: previous.lastFrom,
      p_previous_last_to: previous.lastTo,
    });

    setActionBusy(null);

    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function respondUndo(accept: boolean) {
    if (!room || !gameState?.undo_requested_by || actionBusy) return;

    setActionBusy("undo-response");
    setError(null);

    const { error: rpcError } = await supabase.rpc("respond_boss_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });

    setActionBusy(null);

    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function resign() {
    if (!room || gameState?.status !== "playing" || actionBusy) return;

    setActionBusy("resign");
    setError(null);

    const { error: rpcError } = await supabase.rpc("resign_boss_game", {
      p_room_id: room.id,
    });

    setActionBusy(null);

    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function requestRematch() {
    if (!room || gameState?.status !== "finished" || actionBusy) return;

    setActionBusy("rematch");
    setError(null);

    const { error: rpcError } = await supabase.rpc("request_boss_rematch", {
      p_room_id: room.id,
      p_next_state: initialStoredState(),
    });

    setActionBusy(null);

    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  if (!room || !gameState || !storedState || !me) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent p-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <p className="font-black">{ui("Loading Boss Battle room…")}</p>
          {error && <p className="mt-3 text-sm text-red-300">{ui(error)}</p>}
        </div>
      </main>
    );
  }

  const canMove =
    gameState.status === "playing" &&
    liveGame.turn() === mySide &&
    !gameState.undo_requested_by &&
    !moving;

  const isBossPlayer = mySide === "b";
  const bossCanUsePowers =
    isBossPlayer &&
    gameState.status === "playing" &&
    liveGame.turn() === "b" &&
    !liveGame.isCheck() &&
    !gameState.undo_requested_by &&
    !moving;

  const myRematchReady =
    myColor === "white"
      ? Boolean(gameState.white_rematch_ready)
      : Boolean(gameState.black_rematch_ready);

  const opponentRematchReady =
    myColor === "white"
      ? Boolean(gameState.black_rematch_ready)
      : Boolean(gameState.white_rematch_ready);

  const rage = getBossRage(displayedBossState);
  async function copyRoomCode() {
    const code = room?.code ?? roomCode.toUpperCase();

    try {
      await navigator.clipboard.writeText(code);

      setCodeCopied(true);

      window.setTimeout(() => {
        setCodeCopied(false);
      }, 1600);
    } catch {
      setError("Could not copy room code.");
    }
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1460px]">
        <ChessPageHeader className="mb-6 flex flex-col gap-4 rounded-3xl border border-violet-400/10 bg-zinc-900/75 px-5 py-4 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between" description={<> {ui("Room")}<span className="font-mono">{room.code}</span> </>}>


          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm">
            {gameState.status === "waiting" ? ui("Waiting for opponent…") : gameState.status === "finished" ? ui("Game finished") : canMove ? ui("Your turn") : ui("Opponent's turn")}
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
                  <p className="font-black">
                    {me.display_name} ·{" "}
                    {myColor === "black" ? ui("Boss") : ui("White Army")}
                  </p>
                  <p className="text-xs text-zinc-500">{ui("You")}</p>
                </div>

                <div className="rounded-xl bg-white/5 p-3">
                  <p className="font-black">
                    {opponent ? `${opponent.display_name} · ${
                          opponent.chosen_color === "black"
                            ? "Boss"
                            : "White Army"
                        }` : ui("Waiting…")}
                  </p>
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
                    storedState.history.length === 0 ||
                    Boolean(gameState.undo_requested_by) ||
                    Boolean(actionBusy)
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black disabled:opacity-40"
                >{ui("↶ Request Undo")}</button>

                <button
                  type="button"
                  onClick={resign}
                  disabled={
                    gameState.status !== "playing" || Boolean(actionBusy)
                  }
                  className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm font-black text-red-300 disabled:opacity-40"
                >{ui("Resign")}</button>

                <Link
                  to="/games/chess/variants/boss/multiplayer"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm font-black text-zinc-300"
                >{ui("Leave room")}</Link>
              </div>
            </Panel>

            <Panel title={ui("Action History")}>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-white/5 bg-black/20">
                {storedState.history.length === 0 ? (
                  <p className="px-4 py-7 text-center text-xs text-zinc-600">{ui("No actions yet")}</p>
                ) : (
                  storedState.history.map((entry) => (
                    <button
                      key={entry.ply}
                      type="button"
                      onClick={() => {
                        setHistoryPreviewPly(entry.ply);
                        clearSelection();
                        clearPowerTarget();
                        setPendingPromotion(null);
                      }}
                      className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-left text-xs last:border-0 ${
                        historyPreviewPly === entry.ply
                          ? "bg-violet-400/10 text-violet-200"
                          : "text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      <span>
                        {entry.moveNumber}
                        {entry.color === "w" ? "." : "..."} {entry.san}
                      </span>
                      <span>{entry.bossDamaged ? "♥−1" : ""}</span>
                    </button>
                  ))
                )}
              </div>
            </Panel>
          </aside>

          <section className="mx-auto w-full max-w-[820px] min-w-0">
            {historyPreviewPly !== null && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">{ui("History Preview")}</p>
                  <p className="text-sm text-zinc-400">{ui("Position after action")}{historyPreviewPly}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setHistoryPreviewPly(null)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black"
                >{ui("Back to live board")}</button>
              </div>
            )}

            {bossTargetMode && historyPreviewPly === null && mySide === "b" && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">{ui("Boss Power Targeting")}</p>
                  <p className="text-sm text-zinc-400">
                    {bossTargetMode === "summon" ? ui("Choose an empty square on rank 6 or 7.") : ui("Choose a safe Dark Step destination.")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearPowerTarget}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black"
                >{ui("Cancel")}</button>
              </div>
            )}

            {pendingPromotion && historyPreviewPly === null && (
              <div className="relative mb-3">
                <PromotionBar
                  onPromote={(piece) =>
                    void makeMove(
                      pendingPromotion.from,
                      pendingPromotion.to,
                      piece,
                    )
                  }
                />
              </div>
            )}

            <div className="relative">
              <Board
                board={displayedGame.board()}
                selectedSquare={
                  historyPreviewPly !== null ? null : selectedSquare
                }
                legalMoves={historyPreviewPly !== null ? [] : legalMoves}
                lastMove={displayedLastMove}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreviewPly !== null || !canMove
                    ? () => {}
                    : handleSquareClick
                }
                bossSquare={bossSquare}
                bossPowerTargetSquares={
                  historyPreviewPly === null ? livePowerTargetSquares : []
                }
                bossPowerTargetMode={
                  historyPreviewPly === null ? bossTargetMode : null
                }
                bossShockwaveSquares={displayedShockwaveSquares}
                bossArmorActive={displayedBossState.armorPliesRemaining > 0}
                bossRage={rage}
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
                      {codeCopied ? ui("✓ Copied to clipboard") : ui("Click this box to copy the code")}
                    </p>
                  </button>
                    <InviteFriendButton overlay />
                </div>
              )}

              {finishedGame && historyPreviewPly === null && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-zinc-950/80 p-6 backdrop-blur-sm">
                  <div className="max-w-sm rounded-3xl border border-violet-300/20 bg-zinc-900 p-6 text-center shadow-2xl">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-300">{ui("Game Over")}</p>

                    <h2 className="mt-3 text-3xl font-black">
                      {finishedGame.winner === "draw" ? ui("Draw") : finishedGame.winner === myColor ? ui("You win") : ui("You lose")}
                    </h2>

                    <p className="mt-3 text-sm text-zinc-500">
                      {finishLabel(finishedGame)}
                    </p>

                    <button
                      type="button"
                      onClick={requestRematch}
                      disabled={myRematchReady || Boolean(actionBusy)}
                      className="mt-5 w-full rounded-xl bg-violet-400 px-4 py-3 font-black text-violet-950 disabled:opacity-50"
                    >
                      {myRematchReady ? ui("Waiting for opponent…") : ui("Play again")}
                    </button>

                    {opponentRematchReady && !myRematchReady && (
                      <p className="mt-3 text-xs text-emerald-300">{ui("Opponent wants a rematch.")}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <Panel title={ui("Boss Status")}>
              <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.06] p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{ui("Boss HP")}</p>

                <p className="mt-2 text-2xl font-black tracking-widest text-red-300">
                  {bossHearts(displayedBossState.hp)}
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  {displayedBossState.hp}/{BOSS_MAX_HP}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <StatusCard
                  icon="🛡"
                  label={ui("Armor")}
                  value={
                    displayedBossState.armorPliesRemaining > 0
                      ? `${displayedBossState.armorPliesRemaining} plies`
                      : "Off"
                  }
                />

                <StatusCard
                  icon="🔥"
                  label={ui("Rage")}
                  value={`${rage}/${BOSS_MAX_RAGE}`}
                />

                <StatusCard
                  icon="👹"
                  label={ui("Summons")}
                  value={displayedBossState.summons}
                />

                <StatusCard
                  icon="♚"
                  label={ui("Boss turns")}
                  value={displayedBossState.bossTurnsCompleted}
                />
              </div>
            </Panel>

            <Panel title={ui("Boss Powers")}>
              {!isBossPlayer && (
                <p className="mb-3 text-xs text-zinc-600">{ui("Only the Black Boss player can activate powers.")}</p>
              )}

              {isBossPlayer &&
                liveGame.turn() === "b" &&
                liveGame.isCheck() &&
                gameState.status === "playing" && (
                  <div className="mb-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs text-red-300">{ui("The Boss is in check. Powers are locked until the check is answered normally.")}</div>
                )}

              <div className="space-y-2">
                {(["shockwave", "summon", "dark_step"] as BossPowerId[]).map(
                  (power) => {
                    const cooldown = displayedBossState.cooldowns[power];
                    const enabled =
                      bossCanUsePowers &&
                      canUseBossPower(liveGame, storedState.boss, power);

                    return (
                      <button
                        key={power}
                        type="button"
                        onClick={() => choosePower(power)}
                        disabled={!enabled}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          bossTargetMode === power
                            ? "border-violet-300/35 bg-violet-400/15"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div>
                          <p className="font-black">
                            {bossPowerIcon(power)} {bossPowerLabel(power)}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            {power === "shockwave" ? ui("Push adjacent White pieces away") : power === "summon" ? ui("Create a Black pawn") : ui("Relocate the Boss safely")}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-black text-violet-200">
                            {cooldown > 0 ? `CD ${cooldown}` : ui("READY")}
                          </p>
                          <p className="mt-1 text-[9px] text-zinc-700">{ui("next CD")}{" "}
                            {getBossPowerCooldown(power, displayedBossState)}
                          </p>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </Panel>

            <Panel title={ui("Rules")}>
              <div className="space-y-2 text-xs leading-5 text-zinc-400">
                <p>{ui("♔ White begins with the normal full army.")}</p>
                <p>{ui("♚ Black begins with the Boss, six pawns, one knight and one bishop.")}</p>
                <p>{ui("♥ A non-mating White check removes 1 Boss HP when armor is inactive.")}</p>
                <p>{ui("🛡 After damage, the Boss receives 2 completed plies of HP-damage immunity.")}</p>
                <p>{ui("💥 Shockwave pushes adjacent non-King White pieces outward when possible.")}</p>
                <p>{ui("👹 Summon creates a Black pawn on an empty rank-6/7 square.")}</p>
                <p>{ui("🌑 Dark Step moves the Boss up to two squares to a safe empty square.")}</p>
                <p>{ui("⚡ Using a Boss power replaces Black's normal turn.")}</p>
              </div>
            </Panel>
          </aside>
        </div>

        {gameState.undo_requested_by && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
              {gameState.undo_requested_by === user?.id ? (
                <>
                  <h2 className="text-xl font-black">{ui("Undo requested")}</h2>
                  <p className="mt-2 text-sm text-zinc-500">{ui("Waiting for your opponent.")}</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-black">{ui("Opponent requests Undo")}</h2>

                  <p className="mt-2 text-sm text-zinc-500">{ui("Accepting restores the complete previous action. This includes Boss HP, armor, Rage progress, cooldowns, summons and power effects.")}</p>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void respondUndo(false)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black"
                    >{ui("Decline")}</button>

                    <button
                      type="button"
                      onClick={() => void respondUndo(true)}
                      className="rounded-xl bg-violet-400 px-4 py-3 font-black text-violet-950"
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
