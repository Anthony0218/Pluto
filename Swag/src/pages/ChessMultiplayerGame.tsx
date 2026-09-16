import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import { Chess, type Square } from "chess.js";

import Board from "../components/Board";
import PromotionBar from "../components/PromotionBar";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type ChessRoom = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "ready" | "playing" | "finished";
};

type RoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
};

type MultiplayerGame = {
  room_id: string;

  fen: string;

  moves: string[];

  status: "waiting" | "playing" | "finished";

  winner: "white" | "black" | "draw" | null;

  end_reason: string | null;

  version: number;

  last_move_from: string | null;

  last_move_to: string | null;

  white_rematch_ready: boolean;
  black_rematch_ready: boolean;
};

type GameOutcome = {
  finished: boolean;

  winner: "white" | "black" | "draw" | null;

  reason: string | null;
};

function getGameOutcome(game: Chess): GameOutcome {
  if (game.isCheckmate()) {
    return {
      finished: true,

      /*
       * game.turn() is the player
       * who has been checkmated.
       */
      winner: game.turn() === "w" ? "black" : "white",

      reason: "checkmate",
    };
  }

  if (game.isStalemate()) {
    return {
      finished: true,
      winner: "draw",
      reason: "stalemate",
    };
  }

  if (game.isThreefoldRepetition()) {
    return {
      finished: true,
      winner: "draw",
      reason: "threefold repetition",
    };
  }

  if (game.isInsufficientMaterial()) {
    return {
      finished: true,
      winner: "draw",
      reason: "insufficient material",
    };
  }

  if (game.isDrawByFiftyMoves()) {
    return {
      finished: true,
      winner: "draw",
      reason: "50-move rule",
    };
  }

  if (game.isDraw()) {
    return {
      finished: true,
      winner: "draw",
      reason: "draw",
    };
  }

  return {
    finished: false,
    winner: null,
    reason: null,
  };
}

export default function ChessMultiplayerGame() {
  const { roomCode } = useParams();

  const { user } = useAuth();

  const [room, setRoom] = useState<ChessRoom | null>(null);

  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  const [gameState, setGameState] = useState<MultiplayerGame | null>(null);

  const [mySeat, setMySeat] = useState<number | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);

  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);

  const [loading, setLoading] = useState(true);

  const [moving, setMoving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [showResignConfirm, setShowResignConfirm] = useState(false);

  const [actionLoading, setActionLoading] = useState<
    "resign" | "rematch" | null
  >(null);
  async function resignGame() {
    if (!room || gameState?.status !== "playing" || actionLoading) {
      return;
    }

    setActionLoading("resign");

    setError(null);

    const { error: resignError } = await supabase.rpc("resign_chess_game", {
      p_room_id: room.id,
    });

    setActionLoading(null);

    setShowResignConfirm(false);

    if (resignError) {
      console.error(resignError);

      setError(resignError.message);
    }
  }
  async function requestRematch() {
    if (!room || gameState?.status !== "finished" || actionLoading) {
      return;
    }

    setActionLoading("rematch");

    setError(null);

    const { error: rematchError } = await supabase.rpc(
      "request_chess_rematch",
      {
        p_room_id: room.id,
      },
    );

    setActionLoading(null);

    if (rematchError) {
      console.error(rematchError);

      setError(rematchError.message);
    }
  }

  /*
   * Build a fresh chess.js game whenever
   * the database FEN changes.
   *
   * This is cleaner for multiplayer than
   * maintaining one mutable Chess object.
   */
  const chess = useMemo(() => {
    if (!gameState) {
      return new Chess();
    }

    return new Chess(gameState.fen);
  }, [gameState]);

  const board = chess.board();

  const myColor: "w" | "b" | null =
    mySeat === 0 ? "w" : mySeat === 1 ? "b" : null;

  const orientation: "white" | "black" = mySeat === 1 ? "black" : "white";

  /*
   * Convert database last move into
   * Board's expected structure.
   */
  const lastMove =
    gameState?.last_move_from && gameState?.last_move_to
      ? {
          from: gameState.last_move_from as Square,

          to: gameState.last_move_to as Square,
        }
      : null;

  /*
   * Locate checked king.
   */
  const checkedKingSquare: Square | null = chess.isCheck()
    ? (() => {
        const kingColor = chess.turn();

        for (let row = 0; row < board.length; row++) {
          for (let column = 0; column < board[row].length; column++) {
            const piece = board[row][column];

            if (piece?.type === "k" && piece.color === kingColor) {
              const files = "abcdefgh";

              const rank = 8 - row;

              return `${files[column]}${rank}` as Square;
            }
          }
        }

        return null;
      })()
    : null;

  /*
   * ----------------------------------
   * LOAD ROOM
   * ----------------------------------
   */

  const loadGame = useCallback(async () => {
    if (!roomCode || !user) {
      return;
    }

    setLoading(true);
    setError(null);

    const { data: roomData, error: roomError } = await supabase
      .from("chess_rooms")
      .select(
        `
            id,
            code,
            host_id,
            status
          `,
      )
      .eq("code", roomCode.toUpperCase())
      .single();

    if (roomError || !roomData) {
      console.error(roomError);

      setError("Room not found.");

      setLoading(false);

      return;
    }

    const loadedRoom = roomData as ChessRoom;

    setRoom(loadedRoom);

    /*
     * Players
     */

    const { data: playerData, error: playerError } = await supabase
      .from("chess_room_players")
      .select(
        `
            room_id,
            user_id,
            seat,
            display_name
          `,
      )
      .eq("room_id", loadedRoom.id)
      .order("seat", {
        ascending: true,
      });

    if (playerError) {
      console.error(playerError);

      setError("Players could not be loaded.");

      setLoading(false);

      return;
    }

    const loadedPlayers = (playerData ?? []) as RoomPlayer[];

    setPlayers(loadedPlayers);

    const me = loadedPlayers.find((player) => player.user_id === user.id);

    if (!me) {
      setError("You are not a player in this room.");

      setLoading(false);

      return;
    }

    setMySeat(me.seat);

    /*
     * Chess game
     */

    const { data: gameData, error: gameError } = await supabase
      .from("chess_games")
      .select(
        `
  room_id,
  fen,
  moves,
  status,
  winner,
  end_reason,
  version,
  last_move_from,
  last_move_to,
  white_rematch_ready,
  black_rematch_ready
`,
      )
      .eq("room_id", loadedRoom.id)
      .single();

    if (gameError || !gameData) {
      console.error(gameError);

      setError("Game could not be loaded.");

      setLoading(false);

      return;
    }

    setGameState(gameData as MultiplayerGame);

    setLoading(false);
  }, [roomCode, user]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  /*
   * ----------------------------------
   * REALTIME
   * ----------------------------------
   */

  useEffect(() => {
    if (!room) {
      return;
    }

    const channel = supabase
      .channel(`chess-game-${room.id}`)

      .on(
        "postgres_changes",
        {
          event: "UPDATE",

          schema: "public",

          table: "chess_games",

          filter: `room_id=eq.${room.id}`,
        },

        (payload) => {
          const updated = payload.new as MultiplayerGame;

          setGameState(updated);

          /*
           * Clear selection after
           * either player moves.
           */
          setSelectedSquare(null);

          setLegalMoves([]);
        },
      )

      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Chess Realtime:", status, err);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room]);

  /*
   * ----------------------------------
   * SEND MOVE
   * ----------------------------------
   */

  async function submitMove(
    from: Square,
    to: Square,
    promotion?: "q" | "r" | "b" | "n",
  ) {
    if (!room || !gameState || moving) {
      return;
    }

    /*
     * Use a local chess.js copy.
     */
    const localGame = new Chess(gameState.fen);

    let move;

    try {
      move = localGame.move({
        from,
        to,
        promotion,
      });
    } catch {
      setError("Illegal move.");

      return;
    }

    if (!move) {
      return;
    }
    const outcome = getGameOutcome(localGame);
    setMoving(true);
    setError(null);

    const { error: moveError } = await supabase.rpc("play_chess_move", {
      p_room_id: room.id,

      p_from: move.from,

      p_to: move.to,

      p_move_san: move.san,

      p_new_fen: localGame.fen(),

      p_expected_version: gameState.version,

      p_is_finished: outcome.finished,

      p_winner: outcome.winner,

      p_end_reason: outcome.reason,
    });

    setMoving(false);

    if (moveError) {
      console.error(moveError);

      /*
       * Most commonly caused by another
       * tab / stale position.
       */
      setError(moveError.message);

      await loadGame();

      return;
    }

    /*
     * Update immediately instead of
     * waiting a few milliseconds for
     * Realtime.
     *
     * Realtime will shortly send the
     * authoritative row too.
     */
    setGameState((current) =>
      current
        ? {
            ...current,

            fen: localGame.fen(),

            moves: [...current.moves, move.san],

            version: current.version + 1,

            last_move_from: move.from,

            last_move_to: move.to,

            status: outcome.finished ? "finished" : "playing",

            winner: outcome.winner,

            end_reason: outcome.reason,
          }
        : current,
    );

    setSelectedSquare(null);

    setLegalMoves([]);
  }

  /*
   * ----------------------------------
   * BOARD CLICK
   * ----------------------------------
   */

  function handleSquareClick(row: number, column: number) {
    if (!gameState || !myColor || moving) {
      return;
    }

    if (gameState.status !== "playing") {
      return;
    }

    /*
     * Only allow moves on our turn.
     */
    if (chess.turn() !== myColor) {
      return;
    }

    const files = "abcdefgh";

    const square = `${files[column]}${8 - row}` as Square;

    const clickedPiece = chess.get(square);

    /*
     * Nothing selected yet.
     */
    if (selectedSquare === null) {
      if (!clickedPiece || clickedPiece.color !== myColor) {
        return;
      }

      setSelectedSquare(square);

      const moves = chess.moves({
        square,
        verbose: true,
      });

      setLegalMoves(moves.map((move) => move.to));

      return;
    }

    /*
     * Click another own piece:
     * change selection.
     */
    if (clickedPiece && clickedPiece.color === myColor) {
      setSelectedSquare(square);

      const moves = chess.moves({
        square,
        verbose: true,
      });

      setLegalMoves(moves.map((move) => move.to));

      return;
    }

    /*
     * Illegal destination.
     */
    if (!legalMoves.includes(square)) {
      setSelectedSquare(null);

      setLegalMoves([]);

      return;
    }

    /*
     * Promotion?
     */
    const selectedPiece = chess.get(selectedSquare);

    if (
      selectedPiece?.type === "p" &&
      (square[1] === "8" || square[1] === "1")
    ) {
      setPromotionFrom(selectedSquare);

      setPromotionSquare(square);

      setSelectedSquare(null);

      setLegalMoves([]);

      return;
    }

    void submitMove(selectedSquare, square);
  }

  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare) {
      return;
    }

    const from = promotionFrom;

    const to = promotionSquare;

    setPromotionFrom(null);

    setPromotionSquare(null);

    void submitMove(from, to, piece);
  }

  /*
   * ----------------------------------
   * LOADING / ERROR
   * ----------------------------------
   */

  if (loading || !room || !gameState || mySeat === null) {
    return (
      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-zinc-950
          text-zinc-400
        "
      >
        Loading multiplayer game...
      </main>
    );
  }

  const white = players.find((player) => player.seat === 0);

  const black = players.find((player) => player.seat === 1);

  const isMyTurn = chess.turn() === myColor;
  const myRematchReady =
    mySeat === 0
      ? gameState.white_rematch_ready
      : gameState.black_rematch_ready;

  const opponentRematchReady =
    mySeat === 0
      ? gameState.black_rematch_ready
      : gameState.white_rematch_ready;

  return (
    <main
      className="
        min-h-screen
        bg-[radial-gradient(circle_at_top,#21170f_0%,#111111_38%,#090909_100%)]
        px-4
        py-6
        text-white
        sm:px-6
      "
    >
      <div
        className="
          mx-auto
          max-w-[1050px]
        "
      >
        {/* HEADER */}

        <div
          className="
            mb-5
            flex
            items-center
            justify-between
            gap-4
          "
        >
          <div>
            <p
              className="
                text-[10px]
                font-black
                uppercase
                tracking-[0.25em]
                text-amber-400
              "
            >
              Multiplayer
            </p>

            <h1
              className="
                mt-1
                text-2xl
                font-black
              "
            >
              Room {room.code}
            </h1>
          </div>

          <Link
            to="/chess/classic/multiplayer"
            className="
              rounded-xl
              bg-white/5
              px-4
              py-2
              text-sm
              font-semibold
              text-zinc-400
              transition
              hover:bg-white/10
              hover:text-white
            "
          >
            Leave
          </Link>
        </div>

        {/* BOARD AREA */}

        <div
          className="
            mx-auto
            max-w-[820px]
          "
        >
          {/* OPPONENT */}

          <PlayerBar
            name={
              mySeat === 0
                ? (black?.display_name ?? "Black")
                : (white?.display_name ?? "White")
            }
            color={mySeat === 0 ? "black" : "white"}
            active={!isMyTurn}
          />

          {/* STATUS */}

          <div
            className={`
              my-3
              rounded-2xl
              border
              px-4
              py-3
              text-center
              text-sm
              font-bold

              ${
                isMyTurn
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-white/5 bg-white/5 text-zinc-500"
              }
            `}
          >
            {isMyTurn ? "Your turn" : "Opponent's turn"}
          </div>

          {error && (
            <div
              className="
                mb-3
                rounded-xl
                border
                border-red-500/20
                bg-red-500/10
                px-4
                py-2
                text-center
                text-sm
                text-red-300
              "
            >
              {error}
            </div>
          )}

          {promotionFrom && promotionSquare && (
            <div
              className="
                  mb-3
                  rounded-2xl
                  border
                  border-amber-500/20
                  bg-zinc-900
                  p-3
                "
            >
              <PromotionBar onPromote={promotePawn} />
            </div>
          )}

          {/* SHARED BOARD */}

          <div className="relative">
            <Board
              board={board}
              selectedSquare={selectedSquare}
              legalMoves={legalMoves}
              lastMove={lastMove}
              checkedKingSquare={checkedKingSquare}
              onSquareClick={handleSquareClick}
              orientation={orientation}
            />

            {gameState.status === "finished" && (
              <div
                className="
        absolute
        inset-0
        z-30
        flex
        items-center
        justify-center
        rounded-[28px]
        bg-black/75
        p-6
        backdrop-blur-sm
      "
              >
                <div
                  className="
          w-full
          max-w-sm
          rounded-3xl
          border
          border-white/10
          bg-zinc-900/95
          p-7
          text-center
          shadow-2xl
        "
                >
                  <div className="text-5xl">
                    {gameState.winner === "draw"
                      ? "½"
                      : gameState.winner === "white"
                        ? "♔"
                        : "♚"}
                  </div>

                  <p
                    className="
            mt-4
            text-xs
            font-black
            uppercase
            tracking-[0.25em]
            text-amber-400
          "
                  >
                    Game Over
                  </p>

                  <h2
                    className="
            mt-2
            text-3xl
            font-black
          "
                  >
                    {gameState.winner === "draw"
                      ? "Draw"
                      : (gameState.winner === "white" && mySeat === 0) ||
                          (gameState.winner === "black" && mySeat === 1)
                        ? "You win"
                        : "You lose"}
                  </h2>

                  <p
                    className="
            mt-3
            capitalize
            text-zinc-400
          "
                  >
                    {gameState.end_reason}
                  </p>

                  <button
                    type="button"
                    disabled={myRematchReady || actionLoading === "rematch"}
                    onClick={requestRematch}
                    className="
            mt-7
            w-full
            rounded-xl
            bg-amber-400
            px-5
            py-3
            font-black
            text-zinc-950
            transition
            hover:bg-amber-300
            disabled:opacity-50
          "
                  >
                    {myRematchReady ? "Rematch Requested" : "Rematch"}
                  </button>

                  {myRematchReady && !opponentRematchReady && (
                    <p
                      className="
                mt-3
                text-xs
                text-zinc-500
              "
                    >
                      Waiting for your opponent...
                    </p>
                  )}

                  {opponentRematchReady && !myRematchReady && (
                    <p
                      className="
                mt-3
                text-xs
                font-semibold
                text-emerald-300
              "
                    >
                      Your opponent wants a rematch.
                    </p>
                  )}

                  <Link
                    to="/chess/classic/multiplayer"
                    className="
            mt-3
            block
            w-full
            rounded-xl
            bg-white/10
            px-5
            py-3
            font-semibold
            text-white
            transition
            hover:bg-white/20
          "
                  >
                    Leave
                  </Link>
                </div>
              </div>
            )}
          </div>
          {gameState.status === "playing" && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowResignConfirm(true)}
                className="
        rounded-xl
        border
        border-red-500/20
        bg-red-500/10
        px-5
        py-2.5
        text-sm
        font-bold
        text-red-300
        transition
        hover:bg-red-500/20
      "
              >
                Resign
              </button>
            </div>
          )}

          {/* ME */}

          <div className="mt-4">
            <PlayerBar
              name={
                mySeat === 0
                  ? (white?.display_name ?? "White")
                  : (black?.display_name ?? "Black")
              }
              color={mySeat === 0 ? "white" : "black"}
              active={isMyTurn}
              me
            />
          </div>

          {showResignConfirm && gameState.status === "playing" && (
            <div
              className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-black/75
        px-6
        backdrop-blur-sm
      "
            >
              <div
                className="
          w-full
          max-w-sm
          rounded-3xl
          border
          border-white/10
          bg-zinc-900
          p-7
          text-center
          shadow-2xl
        "
              >
                <div className="text-4xl">⚑</div>

                <h2
                  className="
            mt-4
            text-2xl
            font-black
          "
                >
                  Resign game?
                </h2>

                <p
                  className="
            mt-2
            text-sm
            text-zinc-500
          "
                >
                  Your opponent will win the game.
                </p>

                <div
                  className="
            mt-7
            grid
            grid-cols-2
            gap-3
          "
                >
                  <button
                    type="button"
                    onClick={() => setShowResignConfirm(false)}
                    className="
              rounded-xl
              bg-white/10
              px-4
              py-3
              font-semibold
              hover:bg-white/20
            "
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading === "resign"}
                    onClick={resignGame}
                    className="
              rounded-xl
              bg-red-500
              px-4
              py-3
              font-bold
              text-white
              hover:bg-red-400
              disabled:opacity-40
            "
                  >
                    Resign
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MOVE HISTORY */}

          <section
            className="
              mt-5
              rounded-3xl
              border
              border-white/10
              bg-zinc-900/70
              p-5
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
              "
            >
              <h2
                className="
                  font-bold
                  text-zinc-200
                "
              >
                Moves
              </h2>

              <span
                className="
                  text-xs
                  text-zinc-600
                "
              >
                {gameState.moves.length} moves
              </span>
            </div>

            <div
              className="
                mt-4
                flex
                flex-wrap
                gap-2
              "
            >
              {gameState.moves.length === 0 ? (
                <span
                  className="
                    text-sm
                    text-zinc-600
                  "
                >
                  No moves yet
                </span>
              ) : (
                gameState.moves.map((move, index) => (
                  <span
                    key={`${move}-${index}`}
                    className="
                        rounded-lg
                        bg-black/20
                        px-2.5
                        py-1
                        text-sm
                        text-zinc-300
                      "
                  >
                    {index + 1}. {move}
                  </span>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function PlayerBar({
  name,
  color,
  active,
  me = false,
}: {
  name: string;
  color: "white" | "black";
  active: boolean;
  me?: boolean;
}) {
  return (
    <div
      className={`
        flex
        items-center
        justify-between
        rounded-2xl
        border
        px-4
        py-3
        transition

        ${
          active
            ? "border-amber-400/20 bg-amber-400/[0.07]"
            : "border-white/5 bg-zinc-900/60"
        }
      `}
    >
      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <div
          className={`
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            text-2xl

            ${
              color === "white"
                ? "bg-[#fff3d5] text-zinc-900"
                : "bg-zinc-800 text-zinc-100"
            }
          `}
        >
          {color === "white" ? "♔" : "♚"}
        </div>

        <div>
          <p
            className="
              font-bold
              text-zinc-100
            "
          >
            {name}
          </p>

          <p
            className="
              text-xs
              capitalize
              text-zinc-500
            "
          >
            {color}

            {me && " · You"}
          </p>
        </div>
      </div>

      {active && (
        <div
          className="
            flex
            items-center
            gap-2
            text-xs
            font-bold
            text-amber-300
          "
        >
          <span
            className="
              h-2
              w-2
              animate-pulse
              rounded-full
              bg-amber-400
            "
          />
          Turn
        </div>
      )}
    </div>
  );
}
