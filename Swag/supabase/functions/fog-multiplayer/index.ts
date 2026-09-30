import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  Chess,
  type Color,
  type PieceSymbol,
  type Square,
} from "npm:chess.js@1.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const files = "abcdefgh";
type FogSide = "w" | "b";
type TwoPlayerColor = "white" | "black";
type PromotionPiece = "q" | "r" | "b" | "n";

type PrivateMoveRecord = {
  ply: number;
  moveNumber: number;
  color: FogSide;
  san: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: "p" | "n" | "b" | "r" | "q";
  promotion?: PromotionPiece;
  fenAfter: string;
};

type PrivateGameRow = {
  room_id: string;
  seed: number;
  initial_fen: string;
  fen: string;
  moves: PrivateMoveRecord[] | null;
  status: "waiting" | "playing" | "finished";
  winner: "white" | "black" | "draw" | null;
  end_reason: string | null;
  version: number;
  last_move_from: string | null;
  last_move_to: string | null;
  white_rematch_ready: boolean;
  black_rematch_ready: boolean;
  next_seed: number | null;
  undo_requested_by: string | null;
  undo_requested_version: number | null;
  undo_last_requested_by: string | null;
  undo_last_requested_version: number | null;
};

type RoomRow = {
  id: string;
  code: string;
  host_id: string;
  variant: string;
  max_players: number;
  status: "waiting" | "playing" | "finished";
};

type PlayerRow = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  chosen_color: TwoPlayerColor | null;
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function appError(message: string) {
  return response({ ok: false, error: message });
}

function randomSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] >>> 0;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number, salt: string): number {
  let value = (seed ^ hashString(salt)) >>> 0;
  value += 0x6d2b79f5;
  let result = value;
  result = Math.imul(result ^ (result >>> 15), result | 1);
  result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
  return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
}

function shuffled<T>(values: T[], seed: number, salt: string): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededRandom(seed, `${salt}:${i}`) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createRandomFogStartFen(seed: number): string {
  const slots = ["b", "c", "d", "f", "g"];
  const pieces = shuffled(["q", "b", "b", "n", "n"], seed, "back-rank");
  const back: Record<string, string> = { a: "r", e: "k", h: "r" };
  slots.forEach((file, index) => {
    back[file] = pieces[index];
  });
  const white = files
    .split("")
    .map((file) => back[file].toUpperCase())
    .join("");
  const black = files
    .split("")
    .map((file) => back[file].toLowerCase())
    .join("");
  return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${white} w KQkq - 0 1`;
}

function squareFromBoard(row: number, column: number): Square {
  return `${files[column]}${8 - row}` as Square;
}

function allBoardSquares(): Square[] {
  const result: Square[] = [];
  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of files) result.push(`${file}${rank}` as Square);
  }
  return result;
}

function raySquares(
  game: Chess,
  square: Square,
  directions: number[][],
): Square[] {
  const result: Square[] = [];
  const startFile = files.indexOf(square[0]);
  const startRank = Number(square[1]);

  for (const [df, dr] of directions) {
    let file = startFile + df;
    let rank = startRank + dr;

    while (file >= 0 && file < 8 && rank >= 1 && rank <= 8) {
      const target = `${files[file]}${rank}` as Square;
      result.push(target);
      if (game.get(target)) break;
      file += df;
      rank += dr;
    }
  }

  return result;
}

function attackSquares(
  game: Chess,
  square: Square,
  type: PieceSymbol,
  color: Color,
): Square[] {
  const file = files.indexOf(square[0]);
  const rank = Number(square[1]);
  const result: Square[] = [];
  const add = (f: number, r: number) => {
    if (f >= 0 && f < 8 && r >= 1 && r <= 8) {
      result.push(`${files[f]}${r}` as Square);
    }
  };

  if (type === "p") {
    const direction = color === "w" ? 1 : -1;
    add(file - 1, rank + direction);
    add(file + 1, rank + direction);
    return result;
  }

  if (type === "n") {
    for (const [df, dr] of [
      [1, 2],
      [2, 1],
      [2, -1],
      [1, -2],
      [-1, -2],
      [-2, -1],
      [-2, 1],
      [-1, 2],
    ]) {
      add(file + df, rank + dr);
    }
    return result;
  }

  if (type === "k") {
    for (let df = -1; df <= 1; df += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (df || dr) add(file + df, rank + dr);
      }
    }
    return result;
  }

  if (type === "b" || type === "q") {
    result.push(
      ...raySquares(game, square, [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]),
    );
  }
  if (type === "r" || type === "q") {
    result.push(
      ...raySquares(game, square, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]),
    );
  }

  return result;
}

function visibleSquares(game: Chess, side: FogSide): Square[] {
  const visible = new Set<Square>();

  for (const square of allBoardSquares()) {
    const piece = game.get(square);
    if (!piece || piece.color !== side) continue;

    visible.add(square);
    for (const target of attackSquares(game, square, piece.type, piece.color)) {
      visible.add(target);
    }

    // chess.js returns legal moves only for the current side. That is exactly
    // what we want: when it is this viewer's turn, all legal destinations are
    // part of their vision. During the opponent's turn, attack vision remains.
    if (game.turn() === side) {
      for (const move of game.moves({ square, verbose: true })) {
        visible.add(move.to as Square);
      }
    }
  }

  return [...visible];
}

function maskedBoard(game: Chess, side: FogSide) {
  const visible = new Set(visibleSquares(game, side));
  return game.board().map((rank, row) =>
    rank.map((piece, column) => {
      if (!piece) return null;
      const square = squareFromBoard(row, column);
      if (piece.color !== side && !visible.has(square)) return null;
      return { type: piece.type, color: piece.color };
    }),
  );
}

function fogSquaresFor(game: Chess, side: FogSide): Square[] {
  const visible = new Set(visibleSquares(game, side));
  return allBoardSquares().filter((square) => !visible.has(square));
}

function legalMoveMap(game: Chess, side: FogSide): Record<string, Square[]> {
  if (game.turn() !== side) return {};

  const result: Record<string, Square[]> = {};
  for (const square of allBoardSquares()) {
    const piece = game.get(square);
    if (!piece || piece.color !== side) continue;

    const destinations = new Set<Square>();
    for (const move of game.moves({ square, verbose: true })) {
      destinations.add(move.to as Square);
    }
    if (destinations.size > 0) result[square] = [...destinations];
  }
  return result;
}

function checkedKingSquare(game: Chess, side: FogSide): Square | null {
  if (!game.isCheck() || game.turn() !== side) return null;

  for (const square of allBoardSquares()) {
    const piece = game.get(square);
    if (piece?.type === "k" && piece.color === side) return square;
  }
  return null;
}

function positionKey(fen: string) {
  return fen.split(" ").slice(0, 4).join(" ");
}

function isThreefold(
  moves: PrivateMoveRecord[],
  initialFen: string,
  currentFen: string,
) {
  const current = positionKey(currentFen);
  const keys = [
    positionKey(initialFen),
    ...moves.map((record) => positionKey(record.fenAfter)),
  ];
  return keys.filter((candidate) => candidate === current).length >= 3;
}

function getOutcome(
  game: Chess,
  moves: PrivateMoveRecord[],
  initialFen: string,
) {
  if (game.isCheckmate()) {
    return {
      finished: true,
      winner: game.turn() === "w" ? ("black" as const) : ("white" as const),
      reason: "checkmate",
    };
  }
  if (game.isStalemate()) {
    return { finished: true, winner: "draw" as const, reason: "stalemate" };
  }
  if (game.isInsufficientMaterial()) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "insufficient material",
    };
  }
  if (game.isDrawByFiftyMoves()) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "50-move rule",
    };
  }
  if (isThreefold(moves, initialFen, game.fen())) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "threefold repetition",
    };
  }
  return { finished: false, winner: null, reason: null };
}

function toSide(color: TwoPlayerColor): FogSide {
  return color === "white" ? "w" : "b";
}

function oppositeColor(color: TwoPlayerColor): TwoPlayerColor {
  return color === "white" ? "black" : "white";
}

function sanitizeLastMove(
  record: PrivateMoveRecord | null,
  game: Chess,
  side: FogSide,
) {
  if (!record) return null;
  if (record.color === side) return { from: record.from, to: record.to };

  const visible = new Set(visibleSquares(game, side));
  return visible.has(record.from) && visible.has(record.to)
    ? { from: record.from, to: record.to }
    : null;
}

function historyView(
  records: PrivateMoveRecord[],
  initialFen: string,
  side: FogSide,
) {
  return records.map((record) => {
    const game = new Chess(record.fenAfter);
    const ownMove = record.color === side;
    return {
      ply: record.ply,
      moveNumber: record.moveNumber,
      color: record.color,
      label: ownMove ? record.san : "Hidden move",
      captured: record.captured ?? null,
      promotion: ownMove ? (record.promotion ?? null) : null,
      gaveCheck: record.san.endsWith("+") || record.san.endsWith("#"),
      board: maskedBoard(game, side),
      fogSquares: fogSquaresFor(game, side),
      visibleSquares: visibleSquares(game, side),
      checkedKingSquare: checkedKingSquare(game, side),
      lastMove: sanitizeLastMove(record, game, side),
    };
  });
}

async function getUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Authentication required");
  return data.user;
}

function adminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey)
    throw new Error("Server configuration is missing");
  return createClient(supabaseUrl, serviceKey);
}

async function roomContext(
  admin: ReturnType<typeof adminClient>,
  roomCode: string,
  userId: string,
) {
  const normalized = roomCode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);

  const { data: roomData, error: roomError } = await admin
    .from("variant_rooms")
    .select("id, code, host_id, variant, max_players, status")
    .eq("code", normalized)
    .eq("variant", "fog-of-war")
    .maybeSingle();

  if (roomError || !roomData) throw new Error("Fog of War room not found");
  const room = roomData as RoomRow;

  const { data: playerData, error: playerError } = await admin
    .from("variant_room_players")
    .select("room_id, user_id, seat, display_name, chosen_color")
    .eq("room_id", room.id)
    .order("seat", { ascending: true });

  if (playerError) throw new Error("Players could not be loaded");
  const players = (playerData ?? []) as PlayerRow[];
  const me = players.find((player) => player.user_id === userId);
  // Colors may still be open while the room is being set up.
  if (!me) throw new Error("You are not a player in this room");

  const { data: gameData, error: gameError } = await admin
    .from("fog_multiplayer_games")
    .select("*")
    .eq("room_id", room.id)
    .maybeSingle();

  if (gameError || !gameData) throw new Error("Fog game could not be loaded");

  return {
    room,
    players,
    me,
    game: gameData as PrivateGameRow,
  };
}

function buildSnapshot(
  room: RoomRow,
  players: PlayerRow[],
  me: PlayerRow,
  gameRow: PrivateGameRow,
) {
  const color: TwoPlayerColor = me.chosen_color === "black" ? "black" : "white";
  const side = toSide(color);
  const game = new Chess(gameRow.fen);
  const records = Array.isArray(gameRow.moves) ? gameRow.moves : [];
  const initialGame = new Chess(gameRow.initial_fen);
  const latest = records.at(-1) ?? null;

  const undoPending = Boolean(gameRow.undo_requested_by);
  const legalMoves =
    gameRow.status === "playing" && !undoPending
      ? legalMoveMap(game, side)
      : {};

  const latestMoverUser = latest
    ? (players.find(
        (player) =>
          player.chosen_color === (latest.color === "w" ? "white" : "black"),
      )?.user_id ?? null)
    : null;

  const canRequestUndo = Boolean(
    latest &&
    gameRow.status === "playing" &&
    !undoPending &&
    latestMoverUser === me.user_id &&
    !(
      gameRow.undo_last_requested_by === me.user_id &&
      gameRow.undo_last_requested_version === gameRow.version
    ),
  );

  return {
    ok: true,
    snapshot: {
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
      },
      players: players.map((player) => ({
        room_id: player.room_id,
        user_id: player.user_id,
        seat: player.seat,
        display_name: player.display_name,
        chosen_color: player.chosen_color,
      })),
      myColor: color,
      seed: Number(gameRow.seed),
      version: gameRow.version,
      status: gameRow.status,
      winner: gameRow.winner,
      endReason: gameRow.end_reason,
      turn: game.turn(),
      board: maskedBoard(game, side),
      fogSquares: fogSquaresFor(game, side),
      visibleSquares: visibleSquares(game, side),
      legalMoves,
      checkedKingSquare: checkedKingSquare(game, side),
      lastMove: sanitizeLastMove(latest, game, side),
      history: historyView(records, gameRow.initial_fen, side),
      initialView: {
        board: maskedBoard(initialGame, side),
        fogSquares: fogSquaresFor(initialGame, side),
        visibleSquares: visibleSquares(initialGame, side),
        checkedKingSquare: checkedKingSquare(initialGame, side),
        lastMove: null,
      },
      undo: {
        requestedBy: gameRow.undo_requested_by,
        requestedVersion: gameRow.undo_requested_version,
        canRequest: canRequestUndo,
        mine: gameRow.undo_requested_by === me.user_id,
        opponent: Boolean(
          gameRow.undo_requested_by && gameRow.undo_requested_by !== me.user_id,
        ),
      },
      rematch: {
        whiteReady: gameRow.white_rematch_ready,
        blackReady: gameRow.black_rematch_ready,
      },
    },
  };
}

async function createRoom(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  body: any,
) {
  const hostColor: TwoPlayerColor =
    body.hostColor === "white" ? "white" : "black";
  const displayName = String(body.displayName ?? "Player").trim() || "Player";
  const seed = randomSeed();
  const initialFen = createRandomFogStartFen(seed);

  const { data: codeData, error: codeError } = await admin.rpc(
    "make_variant_room_code",
  );
  if (codeError || !codeData) throw new Error("Could not create room code");
  const code = String(codeData);

  const { data: roomData, error: roomError } = await admin
    .from("variant_rooms")
    .insert({
      code,
      host_id: userId,
      variant: "fog-of-war",
      max_players: 2,
      status: "waiting",
    })
    .select("id, code, host_id, variant, max_players, status")
    .single();

  if (roomError || !roomData)
    throw new Error(roomError?.message ?? "Could not create room");

  const room = roomData as RoomRow;

  const { error: playerError } = await admin
    .from("variant_room_players")
    .insert({
      room_id: room.id,
      user_id: userId,
      seat: 0,
      display_name: displayName,
      chosen_color: hostColor,
    });
  if (playerError) throw new Error(playerError.message);

  const { error: gameError } = await admin
    .from("fog_multiplayer_games")
    .insert({
      room_id: room.id,
      seed,
      initial_fen: initialFen,
      fen: initialFen,
      moves: [],
      status: "waiting",
      winner: null,
      end_reason: null,
      version: 0,
    });
  if (gameError) throw new Error(gameError.message);

  return { ok: true, code };
}

async function joinRoom(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  body: any,
) {
  const code = String(body.roomCode ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const displayName = String(body.displayName ?? "Player").trim() || "Player";

  const { data: roomData, error: roomError } = await admin
    .from("variant_rooms")
    .select("id, code, host_id, variant, max_players, status")
    .eq("code", code)
    .eq("variant", "fog-of-war")
    .maybeSingle();

  if (roomError || !roomData) throw new Error("Fog of War room not found");
  const room = roomData as RoomRow;

  const { data: playersData, error: playersError } = await admin
    .from("variant_room_players")
    .select("room_id, user_id, seat, display_name, chosen_color")
    .eq("room_id", room.id)
    .order("seat", { ascending: true });

  if (playersError) throw new Error(playersError.message);
  const players = (playersData ?? []) as PlayerRow[];

  if (players.some((player) => player.user_id === userId)) {
    return { ok: true, code: room.code };
  }
  if (players.length >= 2) throw new Error("Room is full");

  if (room.status !== "waiting") throw new Error("Room is no longer accepting players");

  // The guest takes the color the host left free; both confirm it in the room.
  const guestColor: TwoPlayerColor = players[0]?.chosen_color === "white" ? "black" : "white";

  const { error: insertError } = await admin
    .from("variant_room_players")
    .insert({
      room_id: room.id,
      user_id: userId,
      seat: 1,
      display_name: displayName,
      chosen_color: guestColor,
    });
  if (insertError) throw new Error(insertError.message);

  // The host starts the game with start_variant_room once both players are ready.
  return { ok: true, code: room.code };
}

async function submitMove(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  body: any,
) {
  const context = await roomContext(admin, String(body.roomCode ?? ""), userId);
  const { room, players, me, game: gameRow } = context;

  if (gameRow.status !== "playing") throw new Error("Game is not active");
  if (gameRow.undo_requested_by)
    throw new Error("Resolve the pending undo request first");

  const expectedVersion = Number(body.expectedVersion);
  if (
    !Number.isInteger(expectedVersion) ||
    expectedVersion !== gameRow.version
  ) {
    throw new Error("Position changed. Please retry.");
  }

  const game = new Chess(gameRow.fen);
  const side = toSide(me.chosen_color as TwoPlayerColor);
  if (game.turn() !== side) throw new Error("It is not your turn");

  const from = String(body.from ?? "") as Square;
  const to = String(body.to ?? "") as Square;
  const promotion = body.promotion as PromotionPiece | undefined;

  let move;
  try {
    move = game.move({ from, to, promotion });
  } catch {
    throw new Error("Illegal move");
  }
  if (!move) throw new Error("Illegal move");

  const records = Array.isArray(gameRow.moves) ? gameRow.moves : [];
  const captured =
    move.captured === "p" ||
    move.captured === "n" ||
    move.captured === "b" ||
    move.captured === "r" ||
    move.captured === "q"
      ? move.captured
      : undefined;
  const promoted =
    move.promotion === "q" ||
    move.promotion === "r" ||
    move.promotion === "b" ||
    move.promotion === "n"
      ? move.promotion
      : undefined;

  const nextRecord: PrivateMoveRecord = {
    ply: records.length + 1,
    moveNumber: Math.ceil((records.length + 1) / 2),
    color: move.color,
    san: move.san,
    from: move.from,
    to: move.to,
    piece: move.piece,
    captured,
    promotion: promoted,
    fenAfter: game.fen(),
  };
  const nextRecords = [...records, nextRecord];
  const outcome = getOutcome(game, nextRecords, gameRow.initial_fen);

  const { data: updated, error: updateError } = await admin
    .from("fog_multiplayer_games")
    .update({
      fen: game.fen(),
      moves: nextRecords,
      status: outcome.finished ? "finished" : "playing",
      winner: outcome.finished ? outcome.winner : null,
      end_reason: outcome.finished ? outcome.reason : null,
      version: gameRow.version + 1,
      last_move_from: move.from,
      last_move_to: move.to,
      undo_requested_by: null,
      undo_requested_version: null,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", room.id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new Error("Position changed. Please retry.");

  if (outcome.finished) {
    await admin
      .from("variant_rooms")
      .update({ status: "finished" })
      .eq("id", room.id);
    room.status = "finished";
  }

  return buildSnapshot(room, players, me, updated as PrivateGameRow);
}

async function requestUndo(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  body: any,
) {
  const context = await roomContext(admin, String(body.roomCode ?? ""), userId);
  const { room, players, me, game: gameRow } = context;
  const records = Array.isArray(gameRow.moves) ? gameRow.moves : [];
  const latest = records.at(-1);

  if (gameRow.status !== "playing") throw new Error("Game is not active");
  if (!latest) throw new Error("No move to undo");
  if (gameRow.undo_requested_by)
    throw new Error("Undo request already pending");

  const mySide = toSide(me.chosen_color as TwoPlayerColor);
  if (latest.color !== mySide) {
    throw new Error("Only the player who made the last move can request undo");
  }

  if (
    gameRow.undo_last_requested_by === userId &&
    gameRow.undo_last_requested_version === gameRow.version
  ) {
    throw new Error("You already requested undo for this move");
  }

  const { data: updated, error } = await admin
    .from("fog_multiplayer_games")
    .update({
      undo_requested_by: userId,
      undo_requested_version: gameRow.version,
      undo_last_requested_by: userId,
      undo_last_requested_version: gameRow.version,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", room.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return buildSnapshot(room, players, me, updated as PrivateGameRow);
}

async function respondUndo(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  body: any,
) {
  const context = await roomContext(admin, String(body.roomCode ?? ""), userId);
  const { room, players, me, game: gameRow } = context;
  const accept = Boolean(body.accept);

  if (gameRow.status !== "playing") throw new Error("Game is not active");
  if (!gameRow.undo_requested_by) throw new Error("No undo request");
  if (gameRow.undo_requested_by === userId) {
    throw new Error("Requester cannot answer their own undo request");
  }

  if (!accept) {
    const { data: updated, error } = await admin
      .from("fog_multiplayer_games")
      .update({
        undo_requested_by: null,
        undo_requested_version: null,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", room.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return buildSnapshot(room, players, me, updated as PrivateGameRow);
  }

  const records = Array.isArray(gameRow.moves) ? gameRow.moves : [];
  if (records.length === 0) throw new Error("No move to undo");
  const nextRecords = records.slice(0, -1);
  const previous = nextRecords.at(-1) ?? null;
  const nextFen = previous?.fenAfter ?? gameRow.initial_fen;

  const { data: updated, error } = await admin
    .from("fog_multiplayer_games")
    .update({
      fen: nextFen,
      moves: nextRecords,
      status: "playing",
      winner: null,
      end_reason: null,
      version: gameRow.version + 1,
      last_move_from: previous?.from ?? null,
      last_move_to: previous?.to ?? null,
      undo_requested_by: null,
      undo_requested_version: null,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", room.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await admin
    .from("variant_rooms")
    .update({ status: "playing" })
    .eq("id", room.id);
  room.status = "playing";
  return buildSnapshot(room, players, me, updated as PrivateGameRow);
}

async function resign(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  body: any,
) {
  const context = await roomContext(admin, String(body.roomCode ?? ""), userId);
  const { room, players, me, game: gameRow } = context;

  if (gameRow.status !== "playing") throw new Error("Game is not active");
  if (gameRow.undo_requested_by)
    throw new Error("Resolve the pending undo request first");

  const myColor = me.chosen_color as TwoPlayerColor;
  const winner = oppositeColor(myColor);

  const { data: updated, error } = await admin
    .from("fog_multiplayer_games")
    .update({
      status: "finished",
      winner,
      end_reason: "resignation",
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", room.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await admin
    .from("variant_rooms")
    .update({ status: "finished" })
    .eq("id", room.id);
  room.status = "finished";
  return buildSnapshot(room, players, me, updated as PrivateGameRow);
}

async function requestRematch(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  body: any,
) {
  const context = await roomContext(admin, String(body.roomCode ?? ""), userId);
  let { room, players, me, game: gameRow } = context;

  if (gameRow.status !== "finished") throw new Error("Game is not finished");
  const myColor = me.chosen_color as TwoPlayerColor;
  const mine =
    myColor === "white"
      ? gameRow.white_rematch_ready
      : gameRow.black_rematch_ready;
  if (mine) throw new Error("You already requested a rematch");

  let nextSeed = gameRow.next_seed ?? randomSeed();
  let whiteReady = gameRow.white_rematch_ready;
  let blackReady = gameRow.black_rematch_ready;
  if (myColor === "white") whiteReady = true;
  else blackReady = true;

  if (!(whiteReady && blackReady)) {
    const { data: updated, error } = await admin
      .from("fog_multiplayer_games")
      .update({
        white_rematch_ready: whiteReady,
        black_rematch_ready: blackReady,
        next_seed: nextSeed,
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", room.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return buildSnapshot(room, players, me, updated as PrivateGameRow);
  }

  const nextFen = createRandomFogStartFen(Number(nextSeed));

  // Swap colors for the rematch. The true board remains private.
  for (const player of players) {
    if (!player.chosen_color) continue;
    const { error } = await admin
      .from("variant_room_players")
      .update({ chosen_color: oppositeColor(player.chosen_color) })
      .eq("room_id", room.id)
      .eq("user_id", player.user_id);
    if (error) throw new Error(error.message);
  }

  const { data: refreshedPlayersData, error: playerRefreshError } = await admin
    .from("variant_room_players")
    .select("room_id, user_id, seat, display_name, chosen_color")
    .eq("room_id", room.id)
    .order("seat", { ascending: true });
  if (playerRefreshError) throw new Error(playerRefreshError.message);
  players = (refreshedPlayersData ?? []) as PlayerRow[];
  me = players.find((player) => player.user_id === userId) as PlayerRow;

  const { data: updated, error: gameError } = await admin
    .from("fog_multiplayer_games")
    .update({
      seed: nextSeed,
      initial_fen: nextFen,
      fen: nextFen,
      moves: [],
      status: "playing",
      winner: null,
      end_reason: null,
      version: gameRow.version + 1,
      last_move_from: null,
      last_move_to: null,
      white_rematch_ready: false,
      black_rematch_ready: false,
      next_seed: null,
      undo_requested_by: null,
      undo_requested_version: null,
      undo_last_requested_by: null,
      undo_last_requested_version: null,
      updated_at: new Date().toISOString(),
    })
    .eq("room_id", room.id)
    .select("*")
    .single();
  if (gameError) throw new Error(gameError.message);

  await admin
    .from("variant_rooms")
    .update({ status: "playing" })
    .eq("id", room.id);
  room.status = "playing";
  return buildSnapshot(room, players, me, updated as PrivateGameRow);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUser(req);
    const admin = adminClient();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "create") {
      return response(await createRoom(admin, user.id, body));
    }
    if (action === "join") {
      return response(await joinRoom(admin, user.id, body));
    }
    if (action === "snapshot") {
      const context = await roomContext(
        admin,
        String(body.roomCode ?? ""),
        user.id,
      );
      return response(
        buildSnapshot(context.room, context.players, context.me, context.game),
      );
    }
    if (action === "move") {
      return response(await submitMove(admin, user.id, body));
    }
    if (action === "undo-request") {
      return response(await requestUndo(admin, user.id, body));
    }
    if (action === "undo-respond") {
      return response(await respondUndo(admin, user.id, body));
    }
    if (action === "resign") {
      return response(await resign(admin, user.id, body));
    }
    if (action === "rematch") {
      return response(await requestRematch(admin, user.id, body));
    }

    return appError("Unknown action");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return appError(message);
  }
});
