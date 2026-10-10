import GameXpReward from "@/components/games/GameXpReward";
import { useEffect, useRef, useState } from "react";

type Platform = {
  x: number;
  y: number;
  width: number;
};

const PLATFORMS: Platform[] = [
  {
    x: 40,
    y: 90,
    width: 24,
  },
  {
    x: 10,
    y: 78,
    width: 24,
  },
  {
    x: 55,
    y: 66,
    width: 24,
  },
  {
    x: 14,
    y: 54,
    width: 23,
  },
  {
    x: 54,
    y: 42,
    width: 22,
  },
  {
    x: 20,
    y: 30,
    width: 23,
  },
  {
    x: 55,
    y: 17,
    width: 24,
  },
];

const PLAYER_WIDTH = 7;
const PLAYER_HEIGHT = 6;

const JUMP_POWER = -1.35;
const GRAVITY = 0.03;

const HORIZONTAL_SPEED = 0.52;

const LANDING_TOLERANCE = 2;

export default function DoodleJumpTowerGame({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [player, setPlayer] = useState({
    x: 48,
    y: 82,
  });

  const velocityRef = useRef({
    x: 0,
    y: JUMP_POWER,
  });

  const keysRef = useRef({
    left: false,
    right: false,
  });

  const [reachedTop, setReachedTop] = useState(false);

  const [landedPlatform, setLandedPlatform] = useState<number | null>(null);

  useEffect(() => {
    function down(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (event.key === "ArrowLeft" || key === "a") {
        keysRef.current.left = true;
      }

      if (event.key === "ArrowRight" || key === "d") {
        keysRef.current.right = true;
      }
    }

    function up(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (event.key === "ArrowLeft" || key === "a") {
        keysRef.current.left = false;
      }

      if (event.key === "ArrowRight" || key === "d") {
        keysRef.current.right = false;
      }
    }

    window.addEventListener("keydown", down);

    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);

      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    function tick() {
      setPlayer((current) => {
        const velocity = velocityRef.current;

        /*
         * Horizontal movement
         */
        if (keysRef.current.left && !keysRef.current.right) {
          velocity.x = -HORIZONTAL_SPEED;
        } else if (keysRef.current.right && !keysRef.current.left) {
          velocity.x = HORIZONTAL_SPEED;
        } else {
          velocity.x *= 0.82;
        }

        /*
         * Gravity
         */
        velocity.y += GRAVITY;

        /*
         * Proposed next position
         */
        let nextX = current.x + velocity.x;

        let nextY = current.y + velocity.y;

        /*
         * Keep player inside
         * the horizontal bounds.
         */
        nextX = Math.max(0, Math.min(100 - PLAYER_WIDTH, nextX));

        /*
         * Only land on platforms
         * while falling.
         */
        if (velocity.y > 0) {
          const previousLeft = current.x;

          const previousRight = current.x + PLAYER_WIDTH;

          const nextLeft = nextX;

          const nextRight = nextX + PLAYER_WIDTH;

          /*
           * Horizontal area covered
           * during this frame.
           */
          const sweptLeft = Math.min(previousLeft, nextLeft);

          const sweptRight = Math.max(previousRight, nextRight);

          const previousBottom = current.y + PLAYER_HEIGHT;

          const nextBottom = nextY + PLAYER_HEIGHT;

          for (let index = 0; index < PLATFORMS.length; index++) {
            const platform = PLATFORMS[index];

            const platformLeft = platform.x;

            const platformRight = platform.x + platform.width;

            /*
             * Check whether player's
             * swept horizontal box
             * overlaps platform.
             */
            const horizontalOverlap =
              sweptRight > platformLeft && sweptLeft < platformRight;

            /*
             * Check whether the player's
             * feet crossed the platform top
             * between the previous frame
             * and this frame.
             */
            const crossedPlatformTop =
              previousBottom <= platform.y + LANDING_TOLERANCE &&
              nextBottom >= platform.y - LANDING_TOLERANCE;

            if (horizontalOverlap && crossedPlatformTop) {
              /*
               * Snap player exactly
               * on top of platform.
               */
              nextY = platform.y - PLAYER_HEIGHT;

              /*
               * Bounce immediately.
               */
              velocity.y = JUMP_POWER;

              setLandedPlatform(index);

              break;
            }
          }
        }

        /*
         * Fell below tower:
         * reset.
         */
        if (nextY > 100) {
          velocity.x = 0;

          velocity.y = JUMP_POWER;

          nextX = 48;

          nextY = 82;

          setLandedPlatform(null);
        }

        /*
         * Reached the final
         * upper platform / roof.
         */
        if (nextY < 14 && nextX > 50) {
          setReachedTop(true);
        }

        return {
          x: nextX,
          y: nextY,
        };
      });

      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (reachedTop) {
      const timer = window.setTimeout(onComplete, 800);

      return () => window.clearTimeout(timer);
    }
  }, [reachedTop, onComplete]);

  return (
    <div className="rounded-3xl border-2 border-[#84613b] bg-[#241a18] p-5 shadow-2xl">
      {(reachedTop) && <GameXpReward />}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#ffe6aa]">
            Moon Tower Climb
          </h2>

          <p className="mt-1 text-xs text-[#baa17c]">
            Use A/D or ←/→. Your hero jumps automatically.
          </p>
        </div>

        <div className="rounded-lg border border-[#6a533b] bg-[#31251b] px-3 py-2 text-xs font-black text-[#d8c08f]">
          Reach the glowing roof
        </div>
      </div>

      <div className="relative mx-auto aspect-[4/5] max-h-[650px] overflow-hidden rounded-2xl border-2 border-[#64523f] bg-gradient-to-b from-[#182039] via-[#34263b] to-[#241610]">
        {/* Moon */}
        <div className="absolute right-[10%] top-[2%] h-20 w-20 rounded-full bg-[#fff0b3] shadow-[0_0_35px_rgba(255,240,180,.75)]" />

        {/* Platforms */}
        {PLATFORMS.map((platform, index) => {
          const isLast = index === PLATFORMS.length - 1;

          const isLanded = landedPlatform === index;

          return (
            <div
              key={index}
              className={`absolute rounded-full border transition-colors ${
                isLanded
                  ? "border-red-200 bg-red-500"
                  : isLast
                    ? "border-yellow-200 bg-yellow-300 shadow-[0_0_18px_rgba(253,224,71,.9)]"
                    : "border-stone-500 bg-stone-700"
              }`}
              style={{
                left: `${platform.x}%`,

                top: `${platform.y}%`,

                width: `${platform.width}%`,

                height: "1.8%",
              }}
            />
          );
        })}

        {/* Player */}
        <div
          className="absolute z-20 flex items-center justify-center rounded-full border-2 border-[#f8d77e] bg-[#6b3f25] text-xl shadow-xl"
          style={{
            left: `${player.x}%`,

            top: `${player.y}%`,

            width: `${PLAYER_WIDTH}%`,

            height: `${PLAYER_HEIGHT}%`,
          }}
        >
          🧙
        </div>

        {/* Small debug info */}
        <div className="pointer-events-none absolute left-2 top-2 z-40 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-white">
          <div>x: {player.x.toFixed(1)}</div>

          <div>y: {player.y.toFixed(1)}</div>

          <div>vy: {velocityRef.current.y.toFixed(2)}</div>

          <div>platform: {landedPlatform ?? "-"}</div>
        </div>

        {/* Victory */}
        {reachedTop && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55">
            <div className="rounded-2xl border-2 border-yellow-300 bg-[#49351d] p-6 text-center">
              <div className="text-4xl">🌙</div>

              <div className="mt-2 text-xl font-black text-[#ffe7a4]">
                Tower conquered!
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
