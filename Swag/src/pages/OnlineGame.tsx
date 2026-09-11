import { useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function OnlineGame() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function createGame() {
    if (!user) {
      setError("You must be logged in.");
      return;
    }

    setCreating(true);
    setError("");

    const { data, error } = await supabase
      .from("online_games")
      .insert({
        white_player: user.id,
        status: "waiting",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating game:", error);
      setError(error.message);
      setCreating(false);
      return;
    }

    console.log("Created game:", data);

    navigate(`/onlineGame/${data.id}`);
  }

  if (!user) {
    return (
      <main>
        <h1>Online Chess</h1>
        <p>You must be logged in to play online.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Online Chess</h1>

      <p>
        Playing as <strong>{profile?.username ?? user.email}</strong>
      </p>

      <button onClick={createGame} disabled={creating}>
        {creating ? "Creating..." : "Create Game"}
      </button>

      {error && <p>{error}</p>}
    </main>
  );
}
