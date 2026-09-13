import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import ChessBoard from "../components/ChessBoard";

type OnlineGame = {
  id: string;
  white_player: string | null;
  black_player: string | null;
  status: string;
  fen: string;
  moves: string[];
  winner: string | null;
};

export default function OnlineGameRoom() {
  const { gameId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<OnlineGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !gameId) {
      return;
    }

    loadGame();

    const channel = supabase
      .channel(`online-game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "online_games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          console.log("Game updated:", payload.new);

          setGame(payload.new as OnlineGame);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, gameId]);

  async function loadGame() {
    if (!gameId) {
      return;
    }

    const { data, error } = await supabase
      .from("online_games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (error) {
      console.error("Error loading game:", error);
      setError(error.message);
      setLoading(false);
      return;
    }

    setGame(data);
    setLoading(false);
  }

  async function joinGame() {
    if (!user || !game) {
      return;
    }

    if (game.white_player === user.id) {
      return;
    }

    if (game.black_player) {
      setError("This game already has two players.");
      return;
    }

    setJoining(true);
    setError("");

    const { data, error } = await supabase
      .from("online_games")
      .update({
        black_player: user.id,
        status: "playing",
      })
      .eq("id", game.id)
      .is("black_player", null)
      .select()
      .single();

    if (error) {
      console.error("Error joining game:", error);
      setError(error.message);
      setJoining(false);
      return;
    }

    setGame(data);
    setJoining(false);
  }

  if (!user) {
    return (
      <main>
        <h1>Online Game</h1>
        <p>You must be logged in.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main>
        <p>Loading game...</p>
      </main>
    );
  }

  if (!game) {
    return (
      <main>
        <h1>Game not found</h1>
        <button onClick={() => navigate("/onlineGame")}>Back</button>
      </main>
    );
  }

  const isWhite = game.white_player === user.id;
  const isBlack = game.black_player === user.id;

  return (
    <main>
      <h1>Online Chess</h1>

      <p>
        Room ID:
        <strong> {game.id}</strong>
      </p>

      <p>
        You are:
        <strong> {isWhite ? "White" : isBlack ? "Black" : "Spectator"}</strong>
      </p>

      <p>
        Playing as:
        <strong> {profile?.username ?? user.email}</strong>
      </p>

      <hr />

      <p>
        White:{" "}
        {game.white_player
          ? game.white_player === user.id
            ? "You"
            : "Opponent"
          : "Waiting..."}
      </p>

      <p>
        Black:{" "}
        {game.black_player
          ? game.black_player === user.id
            ? "You"
            : "Opponent"
          : "Waiting..."}
      </p>

      {game.status === "waiting" && !isWhite && !isBlack && (
        <button onClick={joinGame} disabled={joining}>
          {joining ? "Joining..." : "Join Game"}
        </button>
      )}

      {game.status === "waiting" && isWhite && (
        <p>Waiting for an opponent...</p>
      )}

      {game.status === "playing" && <h2>Game ready!</h2>}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={() => navigate("/onlineGame")}>Back</button>
      {game.status === "playing" && <ChessBoard onlineGameId={game.id} />}
    </main>
  );
}
