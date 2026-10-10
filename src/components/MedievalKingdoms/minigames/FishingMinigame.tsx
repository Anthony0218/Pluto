import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import GameXpReward from "@/components/games/GameXpReward";
import {
  useEffect,
  useRef,
  useState,
} from "react";

export default function FishingMinigame({
  onComplete,
}: {
  onComplete: () => void;
}) {
  useGameLanguage();
  const [
    marker,
    setMarker,
  ] =
    useState(0);

  const directionRef =
    useRef(1);

  const [
    catchZone,
    setCatchZone,
  ] =
    useState(45);

  const [
    fish,
    setFish,
  ] =
    useState(0);

  const [
    message,
    setMessage,
  ] =
    useState(
      "Wait for the marker to enter the green water zone.",
    );

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setMarker(
            (current) => {
              let next =
                current +
                directionRef.current *
                  1.45;

              if (
                next >=
                100
              ) {
                next =
                  100;

                directionRef.current =
                  -1;
              }

              if (
                next <=
                0
              ) {
                next =
                  0;

                directionRef.current =
                  1;
              }

              return next;
            },
          );
        },
        20,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, []);

  function cast() {
    const hit =
      Math.abs(
        marker -
          catchZone,
      ) <=
      8;

    if (!hit) {
      setMessage(
        "The fish escaped!",
      );

      return;
    }

    const next =
      fish + 1;

    setFish(
      next,
    );

    setMessage(
      next >=
        3
        ? "A perfect catch!"
        : "Caught one! Cast again.",
    );

    setCatchZone(
      15 +
        Math.random() *
          70,
    );

    if (
      next >=
      3
    ) {
      window.setTimeout(
        onComplete,
        650,
      );
    }
  }

  return (
    <div className="rounded-3xl border-2 border-[#795e44] bg-[#2e241e] p-6 shadow-2xl">
      {(fish >= 3) && <GameXpReward />}
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-6xl">
          🎣
        </div>

        <h2 className="mt-3 text-2xl font-black text-[#ffe6ad]">{gameUi(" Moonriver Fishing ")}</h2>

        <p className="mt-2 text-sm text-[#bba381]">{gameUi(" Catch 3 fish by stopping the hook inside the moving green catch zone. ")}</p>

        <div className="mt-7 rounded-2xl border-2 border-[#496a74] bg-gradient-to-b from-[#24485d] to-[#102a3d] p-5">
          <div className="relative h-14 overflow-hidden rounded-full border border-[#88a7ac] bg-[#0e2634]">
            <div
              className="absolute inset-y-0 w-[16%] rounded-full bg-emerald-400/60 shadow-[0_0_18px_rgba(52,211,153,.8)]"
              style={{
                left:
                  `calc(${catchZone}% - 8%)`,
              }}
            />

            <div
              className="absolute top-0 h-full w-1.5 -translate-x-1/2 bg-white shadow-[0_0_9px_white]"
              style={{
                left:
                  `${marker}%`,
              }}
            />
          </div>

          <button
            type="button"
            onClick={
              cast
            }
            className="mt-5 rounded-xl border-2 border-[#d4b372] bg-[#76522c] px-8 py-3 font-black text-[#fff0c6] hover:bg-[#8c6535]"
          >{gameUi(" Reel In! ")}</button>
        </div>

        <div className="mt-5 text-sm font-black text-[#dfc282]">
          {
            gameUi(message)
          }
        </div>

        <div className="mt-3 text-xl">
          {Array.from({
            length:
              3,
          }).map(
            (
              _,
              index,
            ) => (
              <span
                key={
                  index
                }
                className={
                  index <
                  fish
                    ? ""
                    : "opacity-20 grayscale"
                }
              >
                🐟
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
