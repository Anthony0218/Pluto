import { useAppLanguage } from "@/i18n/languageStore";
import "./wattenMenus.css";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WattenVariant, WattenPlayerInfo } from "../../../utils/types";
import { useAuth } from "@/context/AuthContext";
import { ProfileAvatar } from "@/components/social/ProfileAvatarPicker";
import { useFitWattenScreen } from "@/games/watten/useFitWattenScreen";
import {
  translateWatten,
} from "@/games/watten/i18n/wattenLanguage";

export default function WattenHotseat() {
  useFitWattenScreen();
  const { profile } = useAuth();
  const avatarId = (profile as { avatar_id?: string | null } | null)?.avatar_id ?? "m1";
  const navigate = useNavigate();
  const { language } = useAppLanguage();
  const t = useCallback(
    (key: string) => translateWatten(language, key),
    [language],
  );


  const [variant, setVariant] = useState<WattenVariant>("three-player");

  const playerCount = variant === "three-player" ? 3 : 4;

  const [playerNames, setPlayerNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);

  function updatePlayerName(index: number, value: string) {
    setPlayerNames((current) =>
      current.map((name, i) => (i === index ? value : name)),
    );
  }

  function startGame() {
    const players: WattenPlayerInfo[] = playerNames
      .slice(0, playerCount)
      .map((name, index) => ({
        id: String(index + 1),
        name: name.trim() || `Player ${index + 1}`,
      }));

    navigate("/games/watten/hotseat/game", {
      state: {
        variant,
        mode: "hotseat",
        players,
      },
    });
  }

  return (
    <main className="watten-menu watten-menu--screen px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="watten-menu__panel rounded-3xl border border-white/10 bg-zinc-950/90 p-8 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                {t("Bavarian Watten")}
              </p>

              <h1 className="mt-2 text-3xl font-black">Hotseat</h1>
            </div>

          </div>

          <p className="mt-2 text-sm text-zinc-400">
            {t("Choose the game variant first.")}
          </p>

          {/* VARIANT */}
          <div className="mt-8">
            <p className="mb-3 text-sm font-bold text-zinc-300">
              {t("Number of players")}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVariant("three-player")}
                className={`rounded-2xl border p-5 text-left transition ${
                  variant === "three-player"
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="text-xl font-black">{t("3 Players")}</div>

                <p className="mt-2 text-sm text-zinc-400">
                  {t("One solo player against a team of two.")}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setVariant("four-player")}
                className={`rounded-2xl border p-5 text-left transition ${
                  variant === "four-player"
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="text-xl font-black">{t("4 Players")}</div>

                <p className="mt-2 text-sm text-zinc-400">
                  {t(
                    "Two fixed teams with partners sitting opposite each other.",
                  )}
                </p>
              </button>
            </div>
          </div>

          {/* PLAYER NAMES */}
          <div className="mt-8">
            <p className="mb-3 text-sm font-bold text-zinc-300">
              {t("Player names")}
            </p>

            <div className="space-y-3">
              {Array.from({
                length: playerCount,
              }).map((_, index) => {
                const isTeamA = variant === "four-player" && index % 2 === 0;

                const isTeamB = variant === "four-player" && index % 2 === 1;

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                      isTeamA
                        ? "border-amber-400/30 bg-amber-400/5"
                        : isTeamB
                          ? "border-emerald-400/30 bg-emerald-400/5"
                          : "border-white/10 bg-white/5"
                    }`}
                  >
                    {/* PLAYER NUMBER */}
                    {index === 0 && <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-amber-300/40" title={t("Host")}><ProfileAvatar avatarId={avatarId} className="h-full w-full" /></div>}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        isTeamA
                          ? "bg-amber-400 text-amber-950"
                          : isTeamB
                            ? "bg-emerald-400 text-emerald-950"
                            : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {index + 1}
                    </div>

                    {/* PLAYER NAME */}
                    <input
                      type="text"
                      value={playerNames[index]}
                      onChange={(event) =>
                        updatePlayerName(index, event.target.value)
                      }
                      className={`min-w-0 flex-1 rounded-lg border bg-zinc-950/70 px-3 py-2 text-sm text-white outline-none transition ${
                        isTeamA
                          ? "border-amber-400/30 focus:border-amber-400"
                          : isTeamB
                            ? "border-emerald-400/30 focus:border-emerald-400"
                            : "border-white/10 focus:border-amber-400"
                      }`}
                    />

                    {/* TEAM RADIO */}
                    {variant === "four-player" && (
                      <label
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                          isTeamA
                            ? "border-amber-400/40 bg-amber-400/10"
                            : "border-emerald-400/40 bg-emerald-400/10"
                        }`}
                      >
                        <span
                          className={`text-[11px] font-black ${
                            isTeamA ? "text-amber-300" : "text-emerald-300"
                          }`}
                        >
                          {isTeamA ? "Team A" : "Team B"}
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={startGame}
            className="mt-8 w-full rounded-xl bg-amber-400 px-6 py-4 text-lg font-black text-amber-950 transition hover:bg-amber-300"
          >
            {t("Start game")}
          </button>
        </div>
      </div>
    </main>
  );
}
