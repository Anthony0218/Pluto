import { useAppLanguage } from "@/i18n/languageStore";
import { useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Gamepad2, Users } from "lucide-react";

import {
  setStoredWattenLanguage,
  translateWatten,
  WattenLanguageSelector,
  type WattenLanguage,
} from "@/games/watten/i18n/wattenLanguage";

export default function Watten() {
  const { language, setLanguage } = useAppLanguage();

  const t = useCallback(
    (key: string) => translateWatten(language, key),
    [language],
  );

  function changeLanguage(next: WattenLanguage) {
    setLanguage(next);
    setStoredWattenLanguage(next);
  }

  const heroImage = "/images/watten-game-icon.png";

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[30px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
                {t("Bavarian Watten")}
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                {t("How would you like to play?")}
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                {t(
                  "Choose between local Hotseat, online Multiplayer, or review the rules first.",
                )}
              </p>
            </div>

            <WattenLanguageSelector
              language={language}
              onChange={changeLanguage}
              label={t("Language")}
            />
          </div>

          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <Link
              to="/games/watten/hotseat"
              className="group rounded-3xl border border-amber-400/20 bg-black/20 p-6 shadow-xl transition hover:border-amber-400/40 hover:bg-amber-400/[0.04] sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                  <Gamepad2 size={24} />
                </div>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  {t("Local")}
                </span>
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                {t("One device · Multiple players")}
              </p>

              <h2 className="mt-1 text-2xl font-black">Hotseat</h2>

              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {t(
                  "Play together on one device. After each turn, simply pass the device to the next player.",
                )}
              </p>

              <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-zinc-300">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">{t("Players")}</span>
                  <strong>{t("3 or 4 players")}</strong>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">{t("Device")}</span>
                  <strong>{t("One device")}</strong>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">{t("Mode")}</span>
                  <strong>{t("Pass-and-play")}</strong>
                </div>
              </div>

              <div className="mt-7 flex items-center justify-between rounded-xl bg-amber-400 px-5 py-3.5 font-black text-amber-950 transition group-hover:bg-amber-300">
                <span>{t("Play Hotseat")}</span>
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </div>
            </Link>

            <Link
              to="/games/watten/multiplayer"
              className="group rounded-3xl border border-emerald-400/20 bg-black/20 p-6 shadow-xl transition hover:border-emerald-400/40 hover:bg-emerald-400/[0.04] sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <Users size={24} />
                </div>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  {t("Online")}
                </span>
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                {t("Multiple devices · Online")}
              </p>

              <h2 className="mt-1 text-2xl font-black">{t("Multiplayer")}</h2>

              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {t(
                  "Create a private game and invite your friends with a game code.",
                )}
              </p>

              <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-zinc-300">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">{t("Players")}</span>
                  <strong>{t("3 or 4 players")}</strong>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">{t("Room")}</span>
                  <strong>{t("Private")}</strong>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">{t("Connection")}</span>
                  <strong>{t("Online room code")}</strong>
                </div>
              </div>

              <div className="mt-7 flex items-center justify-between rounded-xl bg-emerald-500 px-5 py-3.5 font-black text-emerald-950 transition group-hover:bg-emerald-400">
                <span>{t("Play Multiplayer")}</span>
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </div>
            </Link>
          </section>

          <Link
            to="/games/watten/rules"
            className="group mt-6 grid overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] transition hover:border-sky-400/30 hover:bg-white/[0.055] md:grid-cols-[180px_minmax(0,1fr)]"
          >
            <div className="relative min-h-40 overflow-hidden md:min-h-full">
              <img
                src={heroImage}
                alt={t("Rules")}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/35" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-black/45 text-white backdrop-blur">
                  <BookOpen size={26} />
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-center p-6 sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
                {t("Rules & examples")}
              </p>

              <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl font-black">
                    {t("Learn the rules")}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                    {t(
                      "Card ranking, Abheben, Gehen, Trumpf oder Kritisch and concrete trick situations.",
                    )}
                  </p>
                </div>

                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sky-300 transition group-hover:translate-x-1 group-hover:bg-sky-400/10">
                  <ArrowRight size={19} />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
