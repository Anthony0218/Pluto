import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100 sm:px-8">
      <div className="flex min-h-[80vh] items-center justify-center">
        <div
          className="
            w-full
            max-w-2xl
            rounded-[32px]
            border
            border-zinc-800
            bg-zinc-900/80
            p-8
            text-center
            shadow-2xl
            shadow-black/30
            sm:p-12
          "
        >
          <div
            className="
              mx-auto
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-2xl
              bg-sky-500/10
              text-3xl
              text-sky-400
            "
          >
            ♞
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-sky-400">
            Error 404
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Page not found
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-zinc-500">
            The page you are looking for does not exist or may have been moved.
          </p>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="
              mt-8
              inline-flex
              items-center
              gap-2
              rounded-xl
              bg-sky-500
              px-6
              py-3
              text-sm
              font-bold
              text-white
              shadow-lg
              shadow-sky-500/20
              transition
              hover:bg-sky-400
              active:scale-[0.98]
            "
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}
