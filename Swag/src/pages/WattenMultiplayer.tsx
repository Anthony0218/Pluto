import { useNavigate } from "react-router";

export default function WattenMultiplayer() {
  const navigate = useNavigate();

  function createGame() {
    // later: create game in database
    const temporaryGameId = crypto.randomUUID();

    navigate(`/watten/multiplayer/${temporaryGameId}`);
  }

  return (
    <main className="min-h-screen bg-emerald-950 p-8 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="text-4xl font-black">Watten Multiplayer</h1>

        <p className="mt-3 text-emerald-200">
          Spiele Watten online mit anderen Spielern.
        </p>

        <button
          type="button"
          onClick={createGame}
          className="mt-8 w-full rounded-2xl bg-amber-400 px-6 py-4 font-black text-amber-950 transition hover:bg-amber-300"
        >
          Neues Spiel erstellen
        </button>

        <button
          type="button"
          className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 px-6 py-4 font-bold hover:bg-white/20"
        >
          Spiel beitreten
        </button>
      </div>
    </main>
  );
}
