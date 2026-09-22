import {
  useEffect,
  useRef,
  useState,
} from "react";

type Arrow = {
  id: number;
  x: number;
  y: number;
  speed: number;
};

export default function ArrowDodgeGame({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [
    playerX,
    setPlayerX,
  ] =
    useState(48);

  const playerXRef =
    useRef(48);

  const [
    arrows,
    setArrows,
  ] =
    useState<Arrow[]>(
      [],
    );

  const [
    lives,
    setLives,
  ] =
    useState(3);

  const livesRef =
    useRef(3);

  const [
    timeLeft,
    setTimeLeft,
  ] =
    useState(20);

  const idRef =
    useRef(1);

  const keysRef =
    useRef({
      left: false,
      right: false,
    });

  useEffect(() => {
    function down(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          "ArrowLeft" ||
        event.key.toLowerCase() ===
          "a"
      ) {
        keysRef.current.left =
          true;
      }

      if (
        event.key ===
          "ArrowRight" ||
        event.key.toLowerCase() ===
          "d"
      ) {
        keysRef.current.right =
          true;
      }
    }

    function up(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          "ArrowLeft" ||
        event.key.toLowerCase() ===
          "a"
      ) {
        keysRef.current.left =
          false;
      }

      if (
        event.key ===
          "ArrowRight" ||
        event.key.toLowerCase() ===
          "d"
      ) {
        keysRef.current.right =
          false;
      }
    }

    window.addEventListener(
      "keydown",
      down,
    );

    window.addEventListener(
      "keyup",
      up,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        down,
      );

      window.removeEventListener(
        "keyup",
        up,
      );
    };
  }, []);

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setTimeLeft(
            (value) => {
              if (
                value <=
                1
              ) {
                return 0;
              }

              return value -
                1;
            },
          );
        },
        1000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, []);

  useEffect(() => {
    if (
      timeLeft ===
        0 &&
      lives >
        0
    ) {
      const timer =
        window.setTimeout(
          onComplete,
          500,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    }
  }, [
    timeLeft,
    lives,
    onComplete,
  ]);

  useEffect(() => {
    let frame =
      0;

    let lastSpawn =
      performance.now();

    function tick(
      now: number,
    ) {
      let nextX =
        playerXRef.current;

      if (
        keysRef.current.left
      ) {
        nextX -=
          0.55;
      }

      if (
        keysRef.current.right
      ) {
        nextX +=
          0.55;
      }

      nextX =
        Math.max(
          2,
          Math.min(
            94,
            nextX,
          ),
        );

      playerXRef.current =
        nextX;

      setPlayerX(
        nextX,
      );

      setArrows(
        (current) => {
          const moved =
            current
              .map(
                (
                  arrow,
                ) => ({
                  ...arrow,
                  y:
                    arrow.y +
                    arrow.speed,
                }),
              )
              .filter(
                (
                  arrow,
                ) =>
                  arrow.y <
                  105,
              );

          let hit =
            false;

          const safe =
            moved.filter(
              (
                arrow,
              ) => {
                const collision =
                  arrow.y >
                    80 &&
                  arrow.y <
                    94 &&
                  Math.abs(
                    arrow.x -
                      playerXRef.current,
                  ) <
                    5;

                if (
                  collision &&
                  !hit
                ) {
                  hit =
                    true;

                  return false;
                }

                return true;
              },
            );

          if (
            hit
          ) {
            const newLives =
              Math.max(
                0,
                livesRef.current -
                  1,
              );

            livesRef.current =
              newLives;

            setLives(
              newLives,
            );
          }

          return safe;
        },
      );

      if (
        now -
          lastSpawn >
        430
      ) {
        lastSpawn =
          now;

        setArrows(
          (current) => [
            ...current,
            {
              id:
                idRef.current++,
              x:
                6 +
                Math.random() *
                  88,
              y:
                -5,
              speed:
                0.45 +
                Math.random() *
                  0.45,
            },
          ],
        );
      }

      frame =
        window.requestAnimationFrame(
          tick,
        );
    }

    frame =
      window.requestAnimationFrame(
        tick,
      );

    return () =>
      window.cancelAnimationFrame(
        frame,
      );
  }, []);

  return (
    <div className="rounded-3xl border-2 border-[#785838] bg-[#302219] p-5 shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#ffe7ae]">
            Arrow Dodge
          </h2>

          <p className="text-xs text-[#bba27d]">
            A/D or ←/→. Survive for 20 seconds.
          </p>
        </div>

        <div className="flex gap-2 text-sm font-black">
          <span className="rounded-lg border border-red-500/50 bg-red-950/40 px-3 py-2 text-red-200">
            ♥ {lives}
          </span>

          <span className="rounded-lg border border-[#8a673f] bg-[#21170f] px-3 py-2 text-[#ffe1a0]">
            {timeLeft}s
          </span>
        </div>
      </div>

      <div className="relative mx-auto aspect-[16/9] overflow-hidden rounded-2xl border-2 border-[#6f5437] bg-gradient-to-b from-[#393d49] to-[#665033]">
        <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[#473b29]" />

        {arrows.map(
          (arrow) => (
            <div
              key={
                arrow.id
              }
              className="absolute text-3xl text-[#e7d9b6]"
              style={{
                left:
                  `${arrow.x}%`,
                top:
                  `${arrow.y}%`,
                transform:
                  "translate(-50%,-50%) rotate(90deg)",
              }}
            >
              ➶
            </div>
          ),
        )}

        <div
          className="absolute bottom-[7%] z-20 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#f4cf79] bg-[#68452a] text-2xl shadow-xl"
          style={{
            left:
              `${playerX}%`,
            transform:
              "translateX(-50%)",
          }}
        >
          🛡️
        </div>

        {lives <=
          0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65">
            <div className="rounded-2xl border border-red-500 bg-red-950/80 p-5 text-center">
              <div className="text-xl font-black text-red-100">
                Training failed
              </div>

              <button
                type="button"
                onClick={() =>
                  window.location.reload()
                }
                className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-black text-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
