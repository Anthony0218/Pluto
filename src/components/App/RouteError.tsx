import { useEffect, useState } from "react";
import { useRouteError } from "react-router-dom";
import { canReloadForNewVersion, isChunkLoadError, reloadForNewVersion } from "@/lib/chunkReload";

/** Shown when a page fails to render. A page chunk missing after a new release reloads the app by itself. */
export default function RouteError() {
  const error = useRouteError();
  const stale = isChunkLoadError(error);
  const [reloading] = useState(() => stale && canReloadForNewVersion());
  useEffect(() => { if (reloading) reloadForNewVersion(); }, [reloading]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b14] px-5 py-8 text-zinc-100">
      <div className="w-full max-w-xl rounded-[32px] border border-zinc-800 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/30 sm:p-12">
        <h1 className="text-3xl font-black">{reloading ? "Updating Pluto…" : stale ? "A new version of Pluto is available" : "Something went wrong"}</h1>
        <p className="mt-3 text-zinc-400">{reloading ? "Loading the latest version." : stale ? "Reload to get the latest version and continue." : "This page hit an unexpected error. Reloading usually fixes it."}</p>
        {!reloading && <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-bold hover:bg-indigo-400" onClick={() => window.location.reload()}>Reload</button>
          <a className="rounded-xl border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/10" href="/home">Back to home</a>
        </div>}
      </div>
    </main>
  );
}
