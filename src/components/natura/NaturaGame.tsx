import ToolAnimalsGame from "./ToolAnimalsGame";
import ArcherfishGame from "./ArcherfishGame";
import WildModesGame from "./WildModesGame";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  W,
  H,
  HUNT_SECONDS,
  BOSS_SECONDS,
  FACTS,
} from "../../games/natura/naturaData";
import type {
  Role,
  Mode,
  Game,
  Phase,
  PlayMode,
  ScenarioId,
  GameResult,
} from "../../games/natura/naturaData";
import {
  initialGame,
  update,
  drawScene,
} from "../../games/natura/naturafunctions";
import FlyingFishGame from "./FlyingFishGame";

function MeadowGame({
  onComplete,
  lockedMode,
  initialRole = "falcon",
}: {
  onComplete?: (winner: Role) => void;
  lockedMode?: Mode;
  initialRole?: Role;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(initialGame(lockedMode ?? "solo", initialRole));
  const keysRef = useRef(new Set<string>());
  const [mode, setMode] = useState<Mode>(lockedMode ?? "solo");
  const [role, setRole] = useState<Role>(initialRole);
  const [snap, setSnap] = useState(() =>
    initialGame(lockedMode ?? "solo", initialRole),
  );
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const lastPhaseRef = useRef<Phase>("ready");
  const completedRef = useRef(false);
  const playSound = useCallback(
    (frequency: number, duration: number) => {
      if (muted) return;
      try {
        const context = audioRef.current ?? new AudioContext();
        audioRef.current = context;
        const osc = context.createOscillator(),
          gain = context.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(70, frequency / 2),
          context.currentTime + duration,
        );
        gain.gain.setValueAtTime(0.07, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          context.currentTime + duration,
        );
        osc.connect(gain).connect(context.destination);
        osc.start();
        osc.stop(context.currentTime + duration);
      } catch {
        /* Audio is optional. */
      }
    },
    [muted],
  );
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        ) &&
        !(e.target instanceof HTMLInputElement)
      )
        e.preventDefault();
      keysRef.current.add(e.code);
      if (e.code === "Escape" && gameRef.current.phase === "end" && !onComplete)
        gameRef.current = initialGame(mode, role);
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    const blur = () => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [mode, role, onComplete]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0,
      last = performance.now(),
      ui = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.035);
      last = now;
      const g = gameRef.current;
      update(g, keysRef.current, dt);
      if (g.phase === "end" && g.winner && !completedRef.current) {
        completedRef.current = true;
        onComplete?.(g.winner);
      }
      if (g.phase !== lastPhaseRef.current) {
        if (["capture", "boss", "end"].includes(g.phase))
          playSound(g.phase === "boss" ? 180 : 570, 0.25);
        lastPhaseRef.current = g.phase;
        setSnap({ ...g });
      }
      drawScene(ctx, g);
      if (now - ui > 100) {
        setSnap({ ...g });
        ui = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playSound, onComplete]);
  const reset = (m = mode, r = role) => {
    keysRef.current.clear();
    completedRef.current = false;
    gameRef.current = initialGame(lockedMode ?? m, r);
    lastPhaseRef.current = "ready";
    setSnap({ ...gameRef.current });
  };
  const start = () => {
    keysRef.current.clear();
    completedRef.current = false;
    gameRef.current = initialGame(lockedMode ?? mode, role);
    gameRef.current.phase = "hunt";
    setSnap({ ...gameRef.current });
    playSound(600, 0.12);
  };
  return (
    <div className="nd-page">
      <style>{CSS}</style>
      <div className="nd-shell">
        <header className="nd-top">
          <div className="nd-brand">
            <span className="nd-mark">◈</span> WILD / PLAY{" "}
            <span className="nd-issue">FIELD NOTES 001</span>
          </div>
          <span className="nd-topright">A TWO-PLAYER NATURE ARCADE</span>
        </header>
        <div className="nd-hero">
          <div>
            <div className="nd-eyebrow">01 / THE MEADOW</div>
            <h1>
              Wings &amp; Whiskers<span>.</span>
            </h1>
            <p>
              A hunt in the golden hour. Become the kestrel or outlast it as the
              meadow vole.
            </p>
          </div>
          <div className="nd-heroIcon" aria-hidden="true">
            ✺
          </div>
        </div>
        <div className="nd-grid">
          <section className="nd-game" aria-label="Wings and Whiskers game">
            <div className="nd-hud">
              <div>
                <small>KESTREL / CATCHES</small>
                <b>
                  {snap.catches} <em>/ 3</em>
                </b>
              </div>
              <div className="nd-hudCenter">
                <small>
                  {snap.phase === "boss" ? "FINAL SHOWDOWN" : "TIME LEFT"}
                </small>
                <b>
                  {Math.ceil(
                    snap.phase === "boss" ? snap.bossTimer : snap.timer,
                  )}
                  <em>s</em>
                </b>
              </div>
              <div className="nd-right">
                <small>
                  {snap.phase === "boss" ? "BOSS / DIVE HITS" : "VOLE / LIVES"}
                </small>
                <b>
                  {snap.phase === "boss"
                    ? `${snap.bossHits} / 3`
                    : "● ".repeat(snap.lives).trim() || "0"}
                </b>
              </div>
            </div>
            <div className="nd-stage">
              <canvas
                width={W}
                height={H}
                ref={canvasRef}
                aria-label="Side view of an American kestrel hunting a meadow vole among grass, a perch and a two-exit burrow"
              />
              {snap.phase === "ready" && (
                <div className="nd-overlay">
                  <div className="nd-overlayPanel">
                    <span className="nd-kicker">THE CHASE BEGINS</span>
                    <h2>Choose your side.</h2>
                    <p>
                      Catch three voles before time runs out, or survive to
                      summon the giant vole.
                    </p>
                    {!lockedMode && (
                      <div className="nd-tabs">
                        <button
                          className={mode === "solo" ? "active" : ""}
                          onClick={() => {
                            setMode("solo");
                            reset("solo", role);
                          }}
                        >
                          Solo vs. AI
                        </button>
                        <button
                          className={mode === "duo" ? "active" : ""}
                          onClick={() => {
                            setMode("duo");
                            reset("duo", role);
                          }}
                        >
                          Two players
                        </button>
                      </div>
                    )}
                    {!lockedMode && mode === "solo" && (
                      <div className="nd-roles">
                        <button
                          className={role === "falcon" ? "selected" : ""}
                          onClick={() => {
                            setRole("falcon");
                            reset(mode, "falcon");
                          }}
                        >
                          🪶 &nbsp;Play kestrel
                        </button>
                        <button
                          className={role === "mouse" ? "selected" : ""}
                          onClick={() => {
                            setRole("mouse");
                            reset(mode, "mouse");
                          }}
                        >
                          🐭 &nbsp;Play vole
                        </button>
                      </div>
                    )}
                    <button className="nd-primary" onClick={start}>
                      ENTER THE MEADOW <span>→</span>
                    </button>
                  </div>
                </div>
              )}
              {snap.phase === "end" && !onComplete && (
                <div className="nd-overlay">
                  <div className="nd-overlayPanel">
                    <span className="nd-kicker">ROUND COMPLETE</span>
                    <h2>
                      {snap.winner === "falcon"
                        ? "The kestrel wins."
                        : "The vole wins."}
                    </h2>
                    <p>{snap.reason}</p>
                    <div className="nd-summary">
                      {snap.catches} catches <span>·</span>{" "}
                      {Math.ceil(HUNT_SECONDS - snap.timer)} seconds in the
                      meadow
                    </div>
                    <button className="nd-primary" onClick={start}>
                      PLAY AGAIN <span>↗</span>
                    </button>
                    <button className="nd-subtle" onClick={() => reset()}>
                      Change mode
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="nd-bar">
              <span>
                {snap.phase === "boss"
                  ? "BOSS PHASE: vertical strike vs. three dives"
                  : snap.phase === "capture"
                    ? "A new vole arrives shortly…"
                    : snap.phase === "hunt"
                      ? snap.burrowTravel > 0
                        ? "VOLE CROSSING UNDERGROUND"
                        : snap.perchFocus >= 1
                          ? "PERCH FOCUS READY: LONGER DIVE"
                          : "HUNT: GRASS, PERCH & TWO BURROW EXITS"
                      : "READY WHEN YOU ARE"}
              </span>
              <button
                onClick={() => setMuted(!muted)}
                aria-label={muted ? "Enable sound" : "Mute sound"}
              >
                {muted ? "SOUND OFF" : "SOUND ON"} ◖
              </button>
            </div>
          </section>
          <aside className="nd-aside">
            <div className="nd-asideHead">
              <span>FIELD GUIDE</span>
              <span>↗</span>
            </div>
            <h3>How to play</h3>
            <div className="nd-rule">
              <span>01</span>
              <p>
                <strong>The hunt</strong> The kestrel needs 3 catches. The vole
                has 3 lives and {HUNT_SECONDS} seconds to survive.
              </p>
            </div>
            <div className="nd-rule">
              <span>02</span>
              <p>
                <strong>Grass &amp; burrow</strong> Tall grass protects the vole
                for 2.4 seconds; then rustling gives it away. Near either
                labeled burrow opening, press the vole's action key to emerge at
                the other exit. The tunnel recharges in 7 seconds.
              </p>
            </div>
            <div className="nd-rule">
              <span>03</span>
              <p>
                <strong>Perch &amp; dive</strong> Stop the kestrel on the fence
                for 1 second to prepare a longer dive and refresh its cooldown.
                Press Space to dive and touch the vole.
              </p>
            </div>
            <div className="nd-rule">
              <span>04</span>
              <p>
                <strong>Fantasy boss</strong> When the timer ends, a giant vole
                appears. Its vertical strike catches the kestrel. The kestrel
                wins with 3 dives; the vole wins with a strike or by surviving{" "}
                {BOSS_SECONDS} more seconds.
              </p>
            </div>
            <div className="nd-controlBox">
              <div className="nd-controlTitle">
                CONTROLS <span>⌨</span>
              </div>
              {mode === "solo" ? (
                <>
                  <p>
                    <b>You</b>
                    <span>W A S D</span>
                    <span>move</span>
                  </p>
                  <p>
                    <b>Action</b>
                    <span>SPACE</span>
                    <span>
                      {role === "falcon" ? "dive" : "burrow / boss strike"}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <b>Kestrel</b>
                    <span>W A S D</span>
                    <span>SPACE dive</span>
                  </p>
                  <p>
                    <b>Vole</b>
                    <span>ARROWS</span>
                    <span>ENTER burrow / strike</span>
                  </p>
                </>
              )}
              <small>
                The vole travels between the two exits while underground. During
                the boss phase, it can climb much higher.
              </small>
            </div>
          </aside>
        </div>
        <section className="nd-facts">
          <div className="nd-factsHead">
            <div>
              <span className="nd-eyebrow">BEYOND THE GAME</span>
              <h2>Real animals. Wild ideas.</h2>
            </div>
            <span className="nd-factsCount">01 — 04</span>
          </div>
          <div className="nd-factGrid">
            {FACTS.map((fact, i) => (
              <article key={fact.title} className="nd-fact">
                <span className="nd-number">0{i + 1} / FIELD NOTE</span>
                <h3>{fact.title}</h3>
                <p>{fact.text}</p>
                {fact.url ? (
                  <a href={fact.url} target="_blank" rel="noreferrer">
                    {fact.label} ↗
                  </a>
                ) : (
                  <span className="nd-fantasy">FICTIONAL GAME ELEMENT</span>
                )}
              </article>
            ))}
          </div>
        </section>
        <footer className="nd-footer">
          <span>WINGS &amp; WHISKERS © FIELD NOTES</span>
          <span>BUILT FOR THE CURIOUS</span>
        </footer>
      </div>
    </div>
  );
}
const CSS = `
.nd-page{min-height:100vh;background:#e9e5da;color:#19383b;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.nd-page *{box-sizing:border-box}.nd-page button{font:inherit;cursor:pointer}.nd-shell{max-width:1440px;margin:auto;padding:0 32px}.nd-top{height:67px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #26434633;letter-spacing:.15em;font-size:10px;font-weight:800}.nd-brand{display:flex;align-items:center;gap:12px}.nd-mark{font-size:22px;color:#d26a3f}.nd-issue{margin-left:18px;padding-left:24px;border-left:1px solid #19383b44;color:#698080}.nd-topright{color:#788b88}.nd-hero{padding:39px 0 36px;display:flex;justify-content:space-between;align-items:end}.nd-eyebrow,.nd-kicker{font-size:11px;font-weight:800;letter-spacing:.19em;color:#c26138}.nd-hero h1{font-family:Georgia,serif;font-size:clamp(44px,6vw,80px);font-weight:400;letter-spacing:-.062em;margin:6px 0 6px;line-height:1.09}.nd-hero h1 span{color:#d27042}.nd-hero p{font-size:14px;color:#5c7371;margin:0}.nd-heroIcon{font-size:68px;color:#d4966e;line-height:1;transform:rotate(-15deg)}.nd-grid{display:grid;grid-template-columns:minmax(0,1fr) 292px;gap:18px}.nd-game{min-width:0;background:#18393a;box-shadow:0 18px 55px #1537351b}.nd-hud{height:80px;color:#f8eeda;display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;padding:0 24px}.nd-hud>div{display:flex;flex-direction:column;gap:3px}.nd-hudCenter{text-align:center}.nd-hud .nd-right{text-align:right}.nd-hud small{font-size:10px;color:#a5bbb4;letter-spacing:.15em;font-weight:700}.nd-hud b{font-size:25px;line-height:1;font-weight:600;letter-spacing:.04em}.nd-hud em{font-size:15px;font-style:normal;color:#9ab1a9}.nd-stage{position:relative;line-height:0}.nd-stage canvas{display:block;width:100%;height:auto;aspect-ratio:16/9}.nd-overlay{position:absolute;inset:0;background:#0a292b91;display:flex;align-items:center;justify-content:center;line-height:1.4;padding:14px}.nd-overlayPanel{max-width:470px;width:100%;text-align:center;background:#f1ebdbf5;padding:24px 28px;box-shadow:0 24px 70px #06222388}.nd-overlayPanel h2{font-family:Georgia,serif;font-size:35px;font-weight:400;letter-spacing:-.045em;margin:5px 0 7px}.nd-overlayPanel p{font-size:13px;color:#55716e;line-height:1.55;margin:0 auto 15px;max-width:330px}.nd-tabs,.nd-roles{display:flex;gap:5px;background:#d8dfd3;padding:4px;margin:8px 0}.nd-tabs button,.nd-roles button{flex:1;background:transparent;border:0;color:#57716e;padding:9px 4px;font-size:12px;font-weight:700}.nd-tabs button.active,.nd-roles button.selected{background:#f8f3e8;color:#183c3d;box-shadow:0 1px 4px #092e291a}.nd-primary{margin-top:10px;background:#cb7146;color:white;border:0;width:100%;padding:14px 17px;text-align:left;font-size:11px!important;font-weight:800!important;letter-spacing:.12em;display:flex;justify-content:space-between}.nd-primary:hover{background:#a95030}.nd-subtle{border:0;background:none;color:#416361;margin-top:11px;font-size:12px!important;text-decoration:underline}.nd-summary{font-size:12px;color:#6c807a;margin-bottom:8px}.nd-summary span{margin:0 8px}.nd-bar{height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;color:#aec6b8;font-size:10px;font-weight:800;letter-spacing:.1em}.nd-bar button{background:none;border:0;color:#d8e4d6;font-size:10px;letter-spacing:.1em}.nd-aside{border:1px solid #bbc6b5;padding:22px;background:#e3e4d7}.nd-asideHead{display:flex;justify-content:space-between;border-bottom:1px solid #b6c3b5;padding-bottom:18px;font-size:10px;letter-spacing:.17em;font-weight:800}.nd-aside h3{font-family:Georgia,serif;font-size:31px;font-weight:400;margin:24px 0 21px;letter-spacing:-.04em}.nd-rule{display:flex;gap:14px;border-top:1px solid #c0cabe;padding:14px 0}.nd-rule>span{font-size:11px;color:#c06b43;font-weight:800}.nd-rule p{font-size:12px;line-height:1.55;color:#617773;margin:0}.nd-rule strong{color:#193c3d;display:block;font-size:12px;margin-bottom:4px}.nd-controlBox{margin-top:17px;background:#d3ddce;padding:15px}.nd-controlTitle{font-size:10px;letter-spacing:.16em;font-weight:800;display:flex;justify-content:space-between;margin-bottom:11px}.nd-controlBox p{display:flex;align-items:center;gap:5px;margin:6px 0;font-size:10px}.nd-controlBox p b{width:53px}.nd-controlBox p span:nth-child(2){background:#f4f0e2;border:1px solid #b6c6b5;border-radius:3px;padding:4px 5px;font-size:10px;font-weight:800}.nd-controlBox p span:last-child{color:#627872}.nd-controlBox small{display:block;font-size:10px;line-height:1.4;color:#6b8079;margin-top:12px}.nd-facts{padding:55px 0 51px}.nd-factsHead{display:flex;align-items:end;justify-content:space-between;margin-bottom:23px}.nd-factsHead h2{font-family:Georgia,serif;font-size:39px;font-weight:400;letter-spacing:-.04em;margin:6px 0 0}.nd-factsCount{font-size:11px;letter-spacing:.17em;color:#82928d}.nd-factGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}.nd-fact{border-top:2px solid #275052;background:#f0ede2;min-height:211px;padding:20px 22px;display:flex;flex-direction:column}.nd-number{font-size:10px;letter-spacing:.15em;color:#bb6a46;font-weight:800}.nd-fact h3{font-family:Georgia,serif;font-weight:400;font-size:22px;margin:19px 0 6px}.nd-fact p{color:#637773;line-height:1.55;font-size:12px;margin:0 0 15px}.nd-fact a,.nd-fantasy{margin-top:auto;color:#2f6462;font-size:10px;letter-spacing:.08em;font-weight:800;text-decoration:none}.nd-fact a:hover{text-decoration:underline}.nd-footer{border-top:1px solid #b9c3b7;padding:25px 0 35px;display:flex;justify-content:space-between;font-size:10px;color:#77908a;letter-spacing:.13em;font-weight:800}@media(max-width:940px){.nd-grid{grid-template-columns:1fr}.nd-aside{display:grid;grid-template-columns:repeat(2,1fr);gap:0 14px}.nd-asideHead,.nd-aside h3,.nd-controlBox{grid-column:1/-1}.nd-rule{border-top:1px solid #c0cabe}.nd-factGrid{grid-template-columns:repeat(2,1fr);gap:8px}}@media(max-width:620px){.nd-shell{padding:0 14px}.nd-topright,.nd-issue,.nd-heroIcon{display:none}.nd-top{height:55px}.nd-hero{padding:30px 0 27px}.nd-hero h1{font-size:47px}.nd-hero p{font-size:12px}.nd-hud{height:65px;padding:0 9px}.nd-hud small{font-size:8px}.nd-hud b{font-size:17px}.nd-hud em{font-size:11px}.nd-overlayPanel{padding:13px 12px}.nd-overlayPanel h2{font-size:23px}.nd-overlayPanel p{font-size:10px;margin-bottom:5px}.nd-tabs,.nd-roles{margin:3px 0}.nd-tabs button,.nd-roles button{font-size:10px;padding:5px 2px}.nd-primary{padding:8px 10px;margin-top:5px;font-size:9px!important}.nd-kicker{font-size:8px}.nd-bar{padding:0 10px;font-size:8px}.nd-bar button{font-size:8px}.nd-aside{display:block}.nd-aside h3{margin:17px 0 9px}.nd-rule{padding:9px 0}.nd-factGrid{grid-template-columns:1fr}.nd-fact{min-height:0}.nd-facts{padding-top:37px}.nd-factsHead h2{font-size:31px}.nd-factsCount{display:none}.nd-footer{font-size:8px}}
`;

type ScenarioProps = {
  mode: PlayMode;
  onComplete: (result: GameResult) => void;
};
export default function NaturaGame({
  scenario,
  mode,
  round,
  onComplete,
  rulesOpen,
}: ScenarioProps & {
  scenario: ScenarioId;
  round: number;
  rulesOpen?: boolean;
}) {
  const role: Role = round % 2 === 1 ? "falcon" : "mouse";
  const finishMeadow = useCallback(
    (winner: Role) =>
      onComplete({
        winner: winner === role ? 0 : 1,
        detail: `${winner === "falcon" ? "Kestrel" : "Vole"} won the meadow duel.`,
      }),
    [onComplete, role],
  );
  return (
    <>
      <style>{SCENARIO_CSS}</style>
      {scenario === "meadow" && (
        <MeadowGame
          lockedMode={mode === "hotseat" ? "duo" : "solo"}
          initialRole={role}
          onComplete={finishMeadow}
        />
      )}
      {(scenario === "bolas" || scenario === "coconut") && (
        <ToolAnimalsGame
          kind={scenario}
          mode={mode}
          rulesOpen={rulesOpen}
          onComplete={onComplete}
        />
      )}
      {(scenario === "trapjaw" || scenario === "cuttlefish") && (
        <WildModesGame
          kind={scenario}
          mode={mode}
          round={round}
          rulesOpen={rulesOpen}
          onComplete={onComplete}
        />
      )}
      {scenario === "archerfish" && (
        <ArcherfishGame
          mode={mode}
          rulesOpen={rulesOpen}
          onComplete={onComplete}
        />
      )}
      {scenario === "flyingfish" && (
        <FlyingFishGame
          mode={mode}
          rulesOpen={rulesOpen}
          onComplete={onComplete}
        />
      )}
    </>
  );
}
const SCENARIO_CSS = `
.ng-board{max-width:800px;margin:24px auto;padding:clamp(18px,4vw,40px);background:#f8f3e6;border:1px solid #c8d2c3;border-radius:16px;box-shadow:0 14px 40px #284b3912}
.ng-board p{line-height:1.6}.ng-board h2{margin-top:20px}.ng-handoff{text-align:center;padding:28px 12px}.ng-handoff .natura-primary{margin:20px auto}.ng-symbol{font-size:44px;color:#b65e37}.ng-secret{padding:18px;background:#e6eddc;border-radius:8px}.ng-landscape{padding:28px 12px;text-align:center;font-size:clamp(28px,7vw,48px);background:linear-gradient(#e8edd4,#d7e1ba);border-radius:12px}.ng-landscape span{margin:0 12px}.ng-tally{font-weight:700}.ng-stats{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;background:#e6edde;padding:15px;border-radius:8px;font-size:13px}.ng-stats p{margin:0}.natura button:focus-visible,.natura input:focus-visible{outline:3px solid #ac5937;outline-offset:4px}@media(max-width:500px){.ng-landscape span{margin:0 3px}}
`;
