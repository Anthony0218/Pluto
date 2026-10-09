import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import {
  useEffect,
  useRef,
  useState,
} from "react";

export default function BlacksmithTimingGame({
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
    goodHits,
    setGoodHits,
  ] =
    useState(0);

  const [
    attempts,
    setAttempts,
  ] =
    useState(0);

  const [
    feedback,
    setFeedback,
  ] =
    useState(
      "Strike when the hammer marker is in the golden center.",
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
                  2.1;

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

  function strike() {
    const distance =
      Math.abs(
        marker -
          50,
      );

    const perfect =
      distance <=
      6;

    const good =
      distance <=
      14;

    const nextAttempts =
      attempts + 1;

    const nextGood =
      goodHits +
      (good
        ? 1
        : 0);

    setAttempts(
      nextAttempts,
    );

    setGoodHits(
      nextGood,
    );

    setFeedback(
      perfect
        ? "PERFECT! Sparks fly from the anvil."
        : good
          ? "Good strike."
          : "Missed the hot center.",
    );

    if (
      nextGood >=
      5
    ) {
      window.setTimeout(
        onComplete,
        650,
      );
    }
  }

  return (
    <div className="rounded-3xl border-2 border-[#8b6334] bg-[#342215] p-6 shadow-2xl">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-6xl">
          ⚒️
        </div>

        <h2 className="mt-3 text-2xl font-black text-[#ffe3a0]">{gameUi(" Forge the Moonblade ")}</h2>

        <p className="mt-2 text-sm text-[#bfa67d]">{gameUi(" Land 5 good hammer strikes. The bright center gives the best hit. ")}</p>

        <div className="mt-8">
          <div className="relative h-16 overflow-hidden rounded-xl border-2 border-[#7c5831] bg-[#20150e]">
            <div className="absolute inset-y-0 left-[36%] w-[28%] bg-[#74481f]" />
            <div className="absolute inset-y-0 left-[44%] w-[12%] bg-[#e1a63f]" />
            <div className="absolute inset-y-0 left-[48%] w-[4%] bg-[#ffe29a] shadow-[0_0_18px_rgba(255,215,110,1)]" />

            <div
              className="absolute top-0 h-full w-1.5 -translate-x-1/2 bg-white shadow-[0_0_10px_white]"
              style={{
                left:
                  `${marker}%`,
              }}
            />
          </div>

          <button
            type="button"
            onClick={
              strike
            }
            className="mt-5 rounded-2xl border-2 border-[#d39c45] bg-[#8c431f] px-8 py-4 text-lg font-black text-[#fff0c5] shadow-xl hover:bg-[#a65328]"
          >{gameUi(" STRIKE ")}</button>
        </div>

        <div className="mt-5 text-sm font-black text-[#f4d188]">
          {
            gameUi(feedback)
          }
        </div>

        <div className="mt-3 flex justify-center gap-6 text-xs text-[#bda77f]">
          <span>{gameUi(" Good hits:")}{gameUi(" ")}
            <b className="text-[#ffe3a0]">
              {gameUi(goodHits)}/5
            </b>
          </span>

          <span>{gameUi(" Attempts:")}{gameUi(" ")}
            <b className="text-[#ffe3a0]">
              {
                gameUi(attempts)
              }
            </b>
          </span>
        </div>
      </div>
    </div>
  );
}
