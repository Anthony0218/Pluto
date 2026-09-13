import { useParams } from "react-router-dom";

export default function WattenMultiplayerGame() {
  const { gameId } = useParams();

  return (
    <main className="min-h-screen bg-emerald-950 p-8 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          Watten Multiplayer
        </p>

        <h1 className="mt-2 text-3xl font-black">Spielraum</h1>

        <p className="mt-3 text-zinc-400">Game ID: {gameId}</p>

        <div className="mt-8 space-y-3">
          <div className="rounded-xl bg-white/5 p-4">Spieler 1</div>

          <div className="rounded-xl bg-white/5 p-4 text-zinc-500">
            Warte auf Spieler 2...
          </div>

          <div className="rounded-xl bg-white/5 p-4 text-zinc-500">
            Warte auf Spieler 3...
          </div>
        </div>
      </div>
    </main>
  );
}
