import { Link } from "react-router-dom";
import { Gamepad2, Users } from "lucide-react";

export default function Watten() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
            Watten
          </h1>

          <p className="mt-3 text-lg text-zinc-500">
            Choose how you want to play
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            to="/watten/hotseat"
            className="group rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <Gamepad2 size={28} />
            </div>

            <h2 className="text-xl font-semibold text-zinc-900">Hotseat</h2>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Play Watten with your friends on one device. Pass the device
              between players when necessary.
            </p>

            <div className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-indigo-500">
              Play Hotseat
            </div>
          </Link>

          <Link
            to="/watten/multiplayer"
            className="group rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <Users size={28} />
            </div>

            <h2 className="text-xl font-semibold text-zinc-900">Multiplayer</h2>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Create a private game and invite your friends using a game code.
            </p>

            <div className="mt-6 inline-flex rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-emerald-500">
              Play Multiplayer
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
