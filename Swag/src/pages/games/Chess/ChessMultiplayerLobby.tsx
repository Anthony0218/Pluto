import { ui, useUiLanguage } from "@/i18n/ui";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";

function ChessPageShell({ children }: { children: React.ReactNode }) {
  useUiLanguage();
  return (
    <main className="chess-menu-page relative left-1/2 min-h-[calc(100dvh-4rem)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_13%_68%,rgba(245,158,11,.09),transparent_28%),radial-gradient(circle_at_76%_23%,rgba(255,255,255,.045),transparent_30%),linear-gradient(to_bottom,#0a0d10,#07090b_58%,#040506)]" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 text-[390px] leading-none text-amber-100/[0.035]">
        ♚
      </div>
      <div className="pointer-events-none absolute bottom-[-72px] left-[25%] text-[250px] leading-none text-white/[0.018]">
        ♞
      </div>
      <div className="pointer-events-none absolute right-[-50px] top-[15%] text-[290px] leading-none text-white/[0.014]">
        ♝
      </div>

      <div className="relative flex min-h-[calc(100dvh-4rem)] w-full flex-col">
        <nav className="flex min-h-20 w-full items-center justify-between border-b border-white/[0.07] px-6 sm:px-10 lg:px-14 xl:px-20">
          <Link to="/games/chess" className="inline-flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-lg text-amber-300">
              ♛
            </span>
            <span className="font-serif text-sm tracking-[0.28em] text-zinc-200">{ui("CHESS")}</span>
          </Link>

          <Link
            to="/games/chess/rules"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <span className="text-base">♔</span>
            <span className="hidden sm:inline">{ui("Rules & Tips")}</span>
          </Link>
        </nav>

        {children}
      </div>
    </main>
  );
}

function ActionCard({
  active = false,
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  active?: boolean;
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  useUiLanguage();
  return (
    <section
      className={`relative overflow-hidden rounded-[22px] border bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md sm:p-6 xl:p-7 ${
        active
          ? "border-amber-300/45 bg-amber-300/[0.035]"
          : "border-white/[0.09]"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(245,158,11,.065),transparent_38%)] opacity-70" />

      <div className="relative">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-[30px] shadow-inner sm:h-[74px] sm:w-[74px] ${
            active
              ? "border-amber-300/35 bg-amber-300/10 text-amber-200"
              : "border-white/10 bg-white/[0.035] text-zinc-400"
          }`}
        >
          {icon}
        </div>

        <p
          className={`mt-5 text-[9px] font-black uppercase tracking-[0.26em] ${
            active ? "text-amber-300/70" : "text-zinc-600"
          }`}
        >
          {ui(eyebrow)}
        </p>

        <h2 className="mt-1.5 font-serif text-[27px] leading-tight text-white sm:text-[31px] xl:text-[34px]">
          {ui(title)}
        </h2>

        <p className="mt-2 max-w-[650px] text-sm leading-6 text-zinc-500 sm:text-[15px]">
          {ui(description)}
        </p>

        {children}
      </div>
    </section>
  );
}

export default function ChessMultiplayerLobby() {
  useUiLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();

  const [roomCode, setRoomCode] = useState(() =>
    (searchParams.get("code") ?? "").trim().toUpperCase(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(
    () =>
      profile?.display_name ||
      profile?.username ||
      user?.email?.split("@")[0] ||
      "Player",
    [profile?.display_name, profile?.username, user?.email],
  );

  async function createRoom() {
    if (!user || loading) return;

    setLoading(true);
    setError(null);

    const { data, error: createError } = await supabase.rpc(
      "create_chess_room",
      {
        p_display_name: displayName,
      },
    );

    setLoading(false);

    if (createError) {
      console.error(createError);
      setError(createError.message);
      return;
    }

    if (!data) {
      setError("Room could not be created.");
      return;
    }

    navigate(`/games/chess/classic/multiplayer/${data}`);
  }

  async function joinRoom() {
    if (!user || loading || roomCode.trim().length !== 6) return;

    setLoading(true);
    setError(null);

    const { data, error: joinError } = await supabase.rpc("join_chess_room", {
      p_code: roomCode.trim().toUpperCase(),
      p_display_name: displayName,
    });

    setLoading(false);

    if (joinError) {
      console.error(joinError);
      setError(joinError.message);
      return;
    }

    if (!data) {
      setError("Room could not be joined.");
      return;
    }

    navigate(`/games/chess/classic/multiplayer/${data}`);
  }

  if (!user) {
    return (
      <ChessPageShell>
        <section className="flex min-h-0 flex-1 items-center justify-center px-6 py-14">
          <div className="w-full max-w-[720px] rounded-[22px] border border-amber-300/35 bg-black/25 p-8 text-center shadow-[0_16px_40px_rgba(0,0,0,.24)] backdrop-blur-md sm:p-10">
            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-400">{ui("Multiplayer")}</p>
            <h1 className="mt-5 font-serif text-[48px] leading-none tracking-[-0.035em] text-white sm:text-[62px]">{ui("Sign in to play")}</h1>
            <p className="mx-auto mt-6 max-w-[520px] font-serif text-[18px] leading-8 text-zinc-400">{ui("Online rooms are tied to your account so your name, avatar, and game can stay synchronized.")}</p>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-8 rounded-xl border border-amber-300/45 bg-amber-300/10 px-7 py-3.5 text-sm font-black text-amber-200 transition hover:bg-amber-300/15"
            >{ui("Log in →")}</button>
          </div>
        </section>
      </ChessPageShell>
    );
  }

  return (
    <ChessPageShell>
      <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,.88fr)_minmax(600px,1.12fr)]">
        <header className="relative flex min-h-[430px] flex-col justify-center px-7 py-14 sm:px-10 lg:min-h-0 lg:px-14 lg:py-16 xl:px-20 2xl:px-24">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />

          <div className="max-w-[620px]">
            <Link
              to="/chess/classic"
              className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-600 transition hover:text-white"
            >
              <span>←</span>{ui("Classic Chess")}</Link>

            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-400">{ui("Play online")}</p>

            <h1 className="mt-5 font-serif text-[52px] leading-[.94] tracking-[-0.035em] text-white sm:text-[66px] xl:text-[82px]">{ui("Multiplayer")}</h1>

            <p className="mt-6 max-w-[500px] font-serif text-[18px] leading-8 text-zinc-400 sm:text-[20px]">{ui("Create a private room or enter a friend's code and meet them over the board.")}</p>
          </div>

          <div className="mt-12 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-700">
            <span className="h-px w-14 bg-amber-400/45" />{ui("Create · Share · Play")}</div>
        </header>

        <div className="relative flex min-h-[560px] items-center border-t border-white/[0.06] px-5 py-8 sm:px-8 lg:min-h-0 lg:border-t-0 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 xl:gap-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <ActionCard
                active
                icon="♔"
                eyebrow={ui("Host a private game")}
                title={ui("Create Room")}
                description={ui("Create a new room and share the generated code with one friend.")}
              >
                <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                  <span className="rounded-full border border-white/[0.07] px-2.5 py-1">{ui("2 players")}</span>
                  <span className="rounded-full border border-white/[0.07] px-2.5 py-1">{ui("Private")}</span>
                  <span className="rounded-full border border-white/[0.07] px-2.5 py-1">{ui("Room code")}</span>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={createRoom}
                  className="group mt-6 flex w-full items-center justify-between rounded-xl border border-amber-300/45 bg-amber-300/[0.06] px-4 py-3.5 text-sm font-black text-amber-200 transition hover:bg-amber-300/[0.10] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>{ui("Create Room")}</span>
                  <span className="text-xl transition group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </ActionCard>

              <ActionCard
                icon="♚"
                eyebrow={ui("Enter an existing room")}
                title={ui("Join Room")}
                description={ui("Use the six-character code from the host to enter their room.")}
              >
                <label className="mt-5 block">
                  <span className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-600">{ui("Room code")}</span>
                  <input
                    value={roomCode}
                    onChange={(event) =>
                      setRoomCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 6),
                      )
                    }
                    placeholder={ui("ABC123")}
                    className="mt-2 w-full rounded-xl border border-white/[0.09] bg-black/30 px-4 py-3.5 font-mono text-xl font-black uppercase tracking-[0.22em] text-white outline-none transition placeholder:text-zinc-700 focus:border-amber-300/40 focus:bg-amber-300/[0.025]"
                  />
                </label>

                <button
                  type="button"
                  disabled={loading || roomCode.length !== 6}
                  onClick={joinRoom}
                  className="group mt-4 flex w-full items-center justify-between rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 py-3.5 text-sm font-black text-zinc-300 transition hover:border-amber-300/30 hover:bg-amber-300/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>{ui("Join Room")}</span>
                  <span className="text-xl transition group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </ActionCard>
            </div>

            <div className="rounded-[22px] border border-white/[0.08] bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.18)] backdrop-blur-md sm:p-6">
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-amber-300/65">{ui("How it works")}</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/30 text-sm font-black text-amber-300">
                    1
                  </span>
                  <p className="text-sm leading-6 text-zinc-500">{ui("Create a room and send the code to your opponent.")}</p>
                </div>

                <div className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/30 text-sm font-black text-amber-300">
                    2
                  </span>
                  <p className="text-sm leading-6 text-zinc-500">{ui("Once both players are inside, the host starts the game.")}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-sm text-red-200">
                {ui(error)}
              </div>
            )}
          </div>
        </div>
      </section>
    </ChessPageShell>
  );
}
