import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameResult, PlayMode } from "../../games/natura/naturaData";
import {
  FLYING_FISH_FACTS,
  FLYING_FISH_H,
  FLYING_FISH_PHASE_SECONDS,
  FLYING_FISH_ROUND_SECONDS,
  FLYING_FISH_W,
} from "../../games/natura/flyingFishData";
import {
  drawFlyingFishScene,
  flyingFishWinnerLabel,
  initialFlyingFishGame,
  startFlyingFishGame,
  updateFlyingFishGame,
} from "../../games/natura/flyingFishFunctions";

type Props = {
  mode: PlayMode;
  onComplete: (result: GameResult) => void;
  rulesOpen?: boolean;
};

const hearts = (lives: number) => `${"♥".repeat(lives)}${"♡".repeat(3 - lives)}`;

export default function FlyingFishGame({ mode, onComplete, rulesOpen = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef(initialFlyingFishGame(mode));
  const keysRef = useRef(new Set<string>());
  const touchRef = useRef(new Set<string>());
  const audioRef = useRef<AudioContext | null>(null);
  const lastPhaseRef = useRef(gameRef.current.phase);

  const [snap, setSnap] = useState(() => initialFlyingFishGame(mode));
  const [muted, setMuted] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const fact = FLYING_FISH_FACTS[factIndex % FLYING_FISH_FACTS.length];
  const isDuo = mode === "hotseat";

  const playSound = useCallback(
    (frequency: number, duration: number) => {
      if (muted) return;
      try {
        const context = audioRef.current ?? new AudioContext();
        audioRef.current = context;
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(70, frequency / 2),
          context.currentTime + duration,
        );
        gain.gain.setValueAtTime(0.055, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
        osc.connect(gain).connect(context.destination);
        osc.start();
        osc.stop(context.currentTime + duration);
      } catch {
        /* Sound is optional. */
      }
    },
    [muted],
  );

  useEffect(() => {
    gameRef.current = initialFlyingFishGame(mode);
    lastPhaseRef.current = "ready";
    setPaused(false);
    setSnap({ ...gameRef.current, players: [...gameRef.current.players] as typeof gameRef.current.players });
  }, [mode]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (["KeyA", "KeyD", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
          event.preventDefault();
        }
      }
      if (event.code === "Space") {
        if (gameRef.current.phase !== "ready" && gameRef.current.phase !== "end") {
          setPaused((value) => !value);
        }
        return;
      }
      keysRef.current.add(event.code);
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.code);
    const blur = () => {
      keysRef.current.clear();
      touchRef.current.clear();
      if (gameRef.current.phase !== "ready" && gameRef.current.phase !== "end") setPaused(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let last = performance.now();
    let ui = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.035);
      last = now;
      const game = gameRef.current;

      if (!paused && !rulesOpen) {
        const controls = new Set([...keysRef.current, ...touchRef.current]);
        updateFlyingFishGame(game, controls, dt, mode);
      }

      if (game.phase !== lastPhaseRef.current) {
        if (game.phase === "water") {
          setFactIndex((index) => (index + 1) % FLYING_FISH_FACTS.length);
          playSound(250, 0.18);
        } else if (game.phase === "sky") {
          setFactIndex((index) => (index + 1) % FLYING_FISH_FACTS.length);
          playSound(620, 0.15);
        } else if (game.phase === "end") {
          playSound(game.winner === 0 ? 720 : 190, 0.32);
        }
        lastPhaseRef.current = game.phase;
        setSnap({ ...game, players: [...game.players] as typeof game.players });
      }

      drawFlyingFishScene(ctx, game);
      if (now - ui > 90) {
        setSnap({ ...game, players: [...game.players] as typeof game.players });
        ui = now;
      }
      frame = requestAnimationFrame(tick);
    };

    drawFlyingFishScene(ctx, gameRef.current);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, paused, playSound, rulesOpen]);

  const start = () => {
    keysRef.current.clear();
    touchRef.current.clear();
    startFlyingFishGame(gameRef.current, mode);
    lastPhaseRef.current = "sky";
    setPaused(false);
    setSnap({ ...gameRef.current, players: [...gameRef.current.players] as typeof gameRef.current.players });
    playSound(620, 0.12);
    canvasRef.current?.focus();
  };

  const hold = (code: string, pressed: boolean) => {
    if (pressed) touchRef.current.add(code);
    else touchRef.current.delete(code);
  };

  const continueResult = () => {
    onComplete({ winner: snap.winner, detail: snap.reason });
  };

  const phaseLabel = snap.phase === "water" ? "02 / BELOW THE SURFACE" : "01 / ABOVE THE WAVES";
  const remaining = Math.max(0, Math.ceil(snap.roundTimer));
  const progress = Math.max(0, Math.min(100, (snap.phaseTimer / FLYING_FISH_PHASE_SECONDS) * 100));

  const controlRows = useMemo(
    () => isDuo
      ? [
          ["Player 1", "A / D", "coral fish"],
          ["Player 2", "← / →", "gold fish"],
        ]
      : [["You", "A / D", "coral fish"]],
    [isDuo],
  );

  return (
    <div className="min-h-screen bg-[#e9e5da] text-[#19383b]">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <header className="flex min-h-16 items-center justify-between border-b border-[#26434633] py-3 text-[10px] font-extrabold tracking-[0.16em]">
          <div className="flex items-center gap-3">
            <span className="text-xl text-[#d26a3f]">◈</span>
            <span>WILD / PLAY</span>
            <span className="hidden border-l border-[#19383b44] pl-5 text-[#698080] sm:inline">FIELD NOTES 006</span>
          </div>
          <span className="hidden text-[#788b88] md:inline">FLYING FISH / AIR + WATER ARCADE</span>
        </header>

        <div className="flex items-end justify-between gap-6 py-8 sm:py-10">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.19em] text-[#c26138]">THE OPEN OCEAN</p>
            <h1 className="mt-1 font-serif text-5xl font-normal tracking-[-0.055em] sm:text-7xl">
              Surface &amp; Sprint<span className="text-[#d27042]">.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#5c7371]">
              Glide above the waves, dive below them, and survive predators on both sides of the surface.
            </p>
          </div>
          <div className="hidden text-6xl text-[#d4966e] md:block" aria-hidden="true">≈</div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0 overflow-hidden bg-[#18393a] shadow-[0_18px_55px_#1537351b]" aria-label="Flying Fish Escape game">
            <div className="grid min-h-20 grid-cols-3 items-center px-4 text-[#f8eeda] sm:px-6">
              <div>
                <small className="block text-[9px] font-bold tracking-[0.15em] text-[#a5bbb4]">PLAYER 1 / DODGES</small>
                <b className="text-xl font-semibold sm:text-2xl">{snap.players[0].score}</b>
                <span className="ml-2 text-sm text-[#e8c785]">{hearts(snap.players[0].lives)}</span>
              </div>
              <div className="text-center">
                <small className="block text-[9px] font-bold tracking-[0.15em] text-[#a5bbb4]">ROUND LEFT</small>
                <b className="text-xl font-semibold sm:text-2xl">{remaining}<span className="text-sm text-[#9ab1a9]">s</span></b>
              </div>
              <div className="text-right">
                <small className="block text-[9px] font-bold tracking-[0.15em] text-[#a5bbb4]">{isDuo ? "PLAYER 2 / DODGES" : "CURRENT PHASE"}</small>
                {isDuo ? (
                  <><b className="text-xl font-semibold sm:text-2xl">{snap.players[1].score}</b><span className="ml-2 text-sm text-[#e8c785]">{hearts(snap.players[1].lives)}</span></>
                ) : (
                  <b className="text-sm font-semibold tracking-[0.12em]">{snap.phase === "water" ? "WATER" : "SKY"}</b>
                )}
              </div>
            </div>

            <div className="relative leading-none">
              <canvas
                ref={canvasRef}
                width={FLYING_FISH_W}
                height={FLYING_FISH_H}
                tabIndex={0}
                className="block aspect-video h-auto w-full outline-none"
                aria-label="Flying fish dodge predators above the waves and underwater"
              />

              {snap.phase === "ready" && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a292b91] p-4">
                  <div className="w-full max-w-md bg-[#f1ebdbf5] p-5 text-center leading-normal shadow-[0_24px_70px_#06222388] sm:p-7">
                    <span className="text-[10px] font-extrabold tracking-[0.19em] text-[#c26138]">THE MIGRATION STARTS HERE</span>
                    <h2 className="mt-1 font-serif text-3xl tracking-[-0.04em]">Two worlds. One escape.</h2>
                    <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#55716e]">
                      Every {FLYING_FISH_PHASE_SECONDS} seconds you switch between sky and water. Dodge seabirds above, tuna below, and keep your three hearts alive for {FLYING_FISH_ROUND_SECONDS} seconds.
                    </p>
                    <button className="mt-4 flex w-full items-center justify-between bg-[#cb7146] px-4 py-3 text-left text-[11px] font-extrabold tracking-[0.12em] text-white hover:bg-[#a95030]" onClick={start}>
                      ENTER THE OPEN OCEAN <span>→</span>
                    </button>
                  </div>
                </div>
              )}

              {paused && snap.phase !== "ready" && snap.phase !== "end" && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a292b9e] p-4">
                  <div className="bg-[#f1ebdbf5] px-8 py-6 text-center leading-normal">
                    <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#c26138]">PAUSED</p>
                    <h2 className="mt-1 font-serif text-3xl">Hold position.</h2>
                    <button className="mt-4 bg-[#19383b] px-5 py-3 text-xs font-bold tracking-[0.12em] text-[#f8eeda]" onClick={() => setPaused(false)}>RESUME</button>
                  </div>
                </div>
              )}

              {snap.phase === "end" && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a292b99] p-4">
                  <div className="w-full max-w-md bg-[#f1ebdbf5] p-6 text-center leading-normal shadow-[0_24px_70px_#06222388]">
                    <span className="text-[10px] font-extrabold tracking-[0.19em] text-[#c26138]">ROUND COMPLETE</span>
                    <h2 className="mt-1 font-serif text-3xl tracking-[-0.04em]">{flyingFishWinnerLabel(snap.winner, mode)}.</h2>
                    <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#55716e]">{snap.reason}</p>
                    <button className="mt-4 flex w-full items-center justify-between bg-[#cb7146] px-4 py-3 text-left text-[11px] font-extrabold tracking-[0.12em] text-white hover:bg-[#a95030]" onClick={continueResult}>
                      CONTINUE TO ANIMAL QUIZ <span>→</span>
                    </button>
                    <button className="mt-3 text-xs text-[#416361] underline" onClick={start}>Play this mode again</button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-1 bg-[#2b5150]">
              <div className="h-full bg-[#d1774d] transition-[width] duration-100" style={{ width: `${progress}%` }} />
            </div>

            <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2 text-[9px] font-extrabold tracking-[0.11em] text-[#aec6b8] sm:px-6">
              <span>{phaseLabel} · {snap.phase === "water" ? "TUNA RISING FROM BELOW" : "SEABIRDS SWOOPING FROM ABOVE"}</span>
              <div className="flex gap-3">
                {snap.phase !== "ready" && snap.phase !== "end" && (
                  <button className="border-0 bg-transparent text-[#d8e4d6]" onClick={() => setPaused((value) => !value)}>{paused ? "RESUME" : "PAUSE"}</button>
                )}
                <button className="border-0 bg-transparent text-[#d8e4d6]" onClick={() => setMuted((value) => !value)}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
              </div>
            </div>
          </section>

          <aside className="border border-[#bbc6b5] bg-[#e3e4d7] p-5">
            <div className="flex justify-between border-b border-[#b6c3b5] pb-4 text-[10px] font-extrabold tracking-[0.17em]">
              <span>FIELD GUIDE</span><span>↗</span>
            </div>
            <h3 className="mt-5 font-serif text-3xl font-normal tracking-[-0.04em]">How to play</h3>

            <div className="mt-4 space-y-0">
              <Rule n="01" title="Sky phase">Move left and right to avoid the gull-like seabirds diving through your glide path.</Rule>
              <Rule n="02" title="Water phase">The fish dives beneath the surface automatically. Tuna rush upward from the deep.</Rule>
              <Rule n="03" title="Caught">A hit costs one heart and triggers a short invulnerability flash so you can recover.</Rule>
              <Rule n="04" title="Scoring">Every predator that cleanly passes you counts as one dodge. In two-player mode, score breaks ties before remaining hearts.</Rule>
            </div>

            <div className="mt-4 bg-[#d3ddce] p-4">
              <div className="mb-3 flex justify-between text-[10px] font-extrabold tracking-[0.16em]"><span>CONTROLS</span><span>⌨</span></div>
              {controlRows.map(([label, keys, fish]) => (
                <div key={label} className="mb-2 grid grid-cols-[62px_auto_1fr] items-center gap-2 text-[10px]">
                  <b>{label}</b><span className="rounded border border-[#b6c6b5] bg-[#f4f0e2] px-2 py-1 font-extrabold">{keys}</span><span className="text-[#627872]">{fish}</span>
                </div>
              ))}
              <p className="mt-3 text-[10px] leading-4 text-[#6b8079]">Space pauses the round. Touch controls are below the game on phones and tablets.</p>
            </div>

            {rulesOpen && (
              <p className="mt-4 border-t border-[#b6c3b5] pt-4 text-[10px] leading-4 text-[#6b8079]">Rules panel is open, so the ocean is paused. Sky and water controls stay identical; only the predator direction changes.</p>
            )}

            <div className="mt-4 border-t border-[#b6c3b5] pt-4">
                <div className="text-[10px] font-extrabold tracking-[0.16em] text-[#c26138]">DID YOU KNOW?</div>
                <div className="mt-2 text-[9px] font-extrabold tracking-[0.13em] text-[#768a84]">{fact.animal}</div>
                <h4 className="mt-1 font-serif text-xl tracking-[-0.03em]">{fact.title}</h4>
                <p className="mt-2 text-xs leading-5 text-[#617773]">{fact.text}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <a className="text-[10px] font-extrabold tracking-[0.08em] text-[#2f6462] hover:underline" href={fact.url} target="_blank" rel="noreferrer">{fact.label} ↗</a>
                  <button className="text-[10px] font-bold text-[#416361] underline" onClick={() => setFactIndex((index) => (index + 1) % FLYING_FISH_FACTS.length)}>Next fact</button>
                </div>
              </div>
          </aside>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TouchCard title="PLAYER 1 / CORAL FISH" score={snap.players[0].score} lives={snap.players[0].lives} onLeft={(pressed) => hold("KeyA", pressed)} onRight={(pressed) => hold("KeyD", pressed)} />
          {isDuo && <TouchCard title="PLAYER 2 / GOLD FISH" score={snap.players[1].score} lives={snap.players[1].lives} onLeft={(pressed) => hold("ArrowLeft", pressed)} onRight={(pressed) => hold("ArrowRight", pressed)} />}
        </div>

        <section className="py-12">
          <div className="mb-5 flex items-end justify-between border-b border-[#b9c3b7] pb-5">
            <div>
              <span className="text-[11px] font-extrabold tracking-[0.19em] text-[#c26138]">BEYOND THE GAME</span>
              <h2 className="mt-1 font-serif text-4xl font-normal tracking-[-0.04em]">Real animals. Wild escapes.</h2>
            </div>
            <span className="hidden text-[10px] tracking-[0.17em] text-[#82928d] sm:block">01 — 03</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {FLYING_FISH_FACTS.slice(0, 3).map((item, index) => (
              <article key={item.title} className="flex min-h-48 flex-col border-t-2 border-[#275052] bg-[#f0ede2] p-5">
                <span className="text-[10px] font-extrabold tracking-[0.15em] text-[#bb6a46]">0{index + 1} / {item.animal}</span>
                <h3 className="mt-4 font-serif text-2xl font-normal">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[#637773]">{item.text}</p>
                <a className="mt-auto pt-4 text-[10px] font-extrabold tracking-[0.08em] text-[#2f6462] hover:underline" href={item.url} target="_blank" rel="noreferrer">{item.label} ↗</a>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Rule({ n, title, children }: { n: string; title: string; children: string }) {
  return (
    <div className="flex gap-3 border-t border-[#c0cabe] py-3">
      <span className="text-[11px] font-extrabold text-[#c06b43]">{n}</span>
      <p className="m-0 text-xs leading-5 text-[#617773]"><strong className="mb-0.5 block text-[#193c3d]">{title}</strong>{children}</p>
    </div>
  );
}

function TouchCard({
  title,
  score,
  lives,
  onLeft,
  onRight,
}: {
  title: string;
  score: number;
  lives: number;
  onLeft: (pressed: boolean) => void;
  onRight: (pressed: boolean) => void;
}) {
  const bind = (callback: (pressed: boolean) => void) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      callback(true);
    },
    onPointerUp: () => callback(false),
    onPointerCancel: () => callback(false),
    onPointerLeave: () => callback(false),
  });

  return (
    <div className="border border-[#bbc6b5] bg-[#f0ede2] p-3">
      <div className="flex items-center justify-between gap-3 text-[10px] font-extrabold tracking-[0.11em]">
        <span>{title}</span><span>{score} DODGES · {hearts(lives)}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="min-h-12 border border-[#b6c6b5] bg-[#e3e4d7] text-sm font-bold active:bg-[#d3ddce]" type="button" {...bind(onLeft)}>◀ LEFT</button>
        <button className="min-h-12 border border-[#b6c6b5] bg-[#e3e4d7] text-sm font-bold active:bg-[#d3ddce]" type="button" {...bind(onRight)}>RIGHT ▶</button>
      </div>
    </div>
  );
}
