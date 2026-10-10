import { gameUi } from "../../i18n/gameUi.ts";
import { W, H, GROUND, HUNT_SECONDS, BOSS_SECONDS, CAPTURE_SECONDS, GRASS, PERCH, BURROW_EXITS, QUESTIONS } from "./naturaData.ts";
import type { Role, Mode, Vec, Game, Player, PlayMode } from "./naturaData.ts";
import { randomStep, worldRandom } from './random.ts';

const coverAt = (x: number) =>
  GRASS.findIndex((p) => x > p.x + 12 && x < p.x + p.width - 12);
const nearExit = (x: number) =>
  BURROW_EXITS.findIndex((exit) => Math.abs(x - exit) < 39);
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const initialGame = (mode: Mode = "solo", role: Role = "falcon", seed = 1): Game => ({
  randomState: seed >>> 0,
  visualRandomState: (seed^0x9e3779b9)>>>0,
  phase: "ready",
  winner: null,
  reason: "",
  mode,
  role,
  falcon: { x: 250, y: 105 },
  mouse: { x: 680, y: GROUND - 12 },
  boss: { x: 680, y: GROUND - 45 },
  falconFacing: 1,
  mouseFacing: -1,
  catches: 0,
  lives: 3,
  timer: HUNT_SECONDS,
  bossTimer: BOSS_SECONDS,
  bossHits: 0,
  dive: 0,
  diveWindup: 0,
  lastSeenPrey: { x: 480, y: GROUND - 12 },
  attacks: 5,
  recovering: false,
  actionHeld: false,
  diveCooldown: 0,
  bossAttack: 0,
  bossCooldown: 0,
  invincible: 0,
  captureTime: 0,
  burrowTravel: 0,
  burrowExit: 1,
  burrowCooldown: 0,
  coverTime: 0,
  coverPatch: -1,
  coverReset: 1,
  perchFocus: 0,
  captureMouse: { x: 680, y: GROUND - 12 },
  flightTrail: [],
  particles: [],
  t: 0,
});
const key = (keys: Set<string>, ...codes: string[]) =>
  codes.some((code) => keys.has(code));
function move(
  v: Vec,
  dx: number,
  dy: number,
  speed: number,
  dt: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
) {
  const norm = Math.hypot(dx, dy) || 1;
  v.x = clamp(v.x + (dx / norm) * speed * dt, xMin, xMax);
  v.y = clamp(v.y + (dy / norm) * speed * dt, yMin, yMax);
}
function burst(g: Game, x: number, y: number, colors: string[]) {
  const random=()=>{const [state,value]=randomStep(g.visualRandomState);g.visualRandomState=state;return value;};
  for (let i = 0; i < 17; i++) {
    const a = (i / 17) * Math.PI * 2,
      s = 35 + random() * 100;
    g.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 30,
      life: 0.5 + random() * 0.5,
      color: colors[i % colors.length],
    });
  }
}
/** Concealment is a simulation contract, shared by renderer and predator AI. */
export const voleConcealed = (g: Game) => g.phase === "hunt" && (g.burrowTravel > 0 || coverAt(g.mouse.x) >= 0 && g.coverTime > 0);
export function update(g: Game, keys: Set<string>, seconds: number, botDifficulty: "easy" | "normal" | "hard" = "normal") {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 0.1);
  while (remaining > 0.000001 && g.phase !== "ready" && g.phase !== "end") {
    const dt = Math.min(remaining, 1 / 120); remaining -= dt;
    stepMeadow(g, keys, dt, botDifficulty);
  }
}
function stepMeadow(g: Game, keys: Set<string>, dt: number, botDifficulty: "easy" | "normal" | "hard" = "normal") {
  if (g.phase === "ready" || g.phase === "end") return;
  g.t += dt;
  g.particles = g.particles.filter((p) => p.life > 0);
  g.particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 130 * dt;
    p.life -= dt;
  });
  if (g.phase === "capture") {
    g.captureTime -= dt;
    g.falcon.x = clamp(g.falcon.x + 112 * dt, 40, W - 40);
    g.falcon.y = clamp(g.falcon.y - 85 * dt, 55, GROUND - 25);
    g.flightTrail.push({ ...g.falcon });
    if (g.flightTrail.length > 24) g.flightTrail.shift();
    if (g.captureTime <= 0) {
      if (g.catches >= 3) {
        g.phase = "end";
        g.winner = "falcon";
        g.reason = "Three successful hunts!";
      } else {
        g.phase = "hunt";
        g.mouse = { x: 115 + worldRandom(g) * 730, y: GROUND - 12 };
        g.falcon.y = 105;
        g.recovering = false;
        g.invincible = 1.6;
        g.flightTrail = [];
        g.coverPatch = -1;
        g.coverReset = 1;
        g.burrowTravel = 0;
      }
    }
    return;
  }
  g.invincible = Math.max(0, g.invincible - dt);
  g.diveCooldown = Math.max(0, g.diveCooldown - dt);
  g.bossCooldown = Math.max(0, g.bossCooldown - dt);
  g.burrowCooldown = Math.max(0, g.burrowCooldown - dt);
  const falconKeys = g.mode === "duo" || g.role === "falcon";
  const fx = falconKeys
    ? Number(key(keys, "KeyD")) - Number(key(keys, "KeyA"))
    : 0;
  const fy = falconKeys
    ? Number(key(keys, "KeyS")) - Number(key(keys, "KeyW"))
    : 0;
  const mx =
    g.mode === "duo"
      ? Number(key(keys, "ArrowRight")) - Number(key(keys, "ArrowLeft"))
      : Number(key(keys, "KeyD")) - Number(key(keys, "KeyA"));
  const my =
    g.mode === "duo"
      ? Number(key(keys, "ArrowDown")) - Number(key(keys, "ArrowUp"))
      : Number(key(keys, "KeyS")) - Number(key(keys, "KeyW"));
  const falconAction =
    g.mode === "duo"
      ? key(keys, "Space")
      : g.role === "falcon" && key(keys, "Space");
  const mouseAction =
    g.mode === "duo"
      ? key(keys, "Enter")
      : g.role === "mouse" && key(keys, "Space");
  if (!voleConcealed(g)) g.lastSeenPrey = { ...g.mouse };
  const target = g.phase === "hunt" ? g.lastSeenPrey : g.boss;
  let requestDive = falconAction && !g.actionHeld;
  g.actionHeld = falconAction;
  if (g.mode === "solo" && g.role === "mouse") {
    const recharge = g.attacks === 0;
    const targetX = recharge ? PERCH.x + PERCH.width / 2 : target.x;
    const targetY = recharge ? PERCH.y - 16 : 110;
    if (!g.recovering && g.dive <= 0) {
      const dx = targetX - g.falcon.x, dy = targetY - g.falcon.y;
      const length = Math.hypot(dx, dy);
      if (length > 2) move(g.falcon, dx, dy, Math.min(botDifficulty === "easy" ? 115 : botDifficulty === "hard" ? 205 : 140, length / dt), dt, 22, W - 22, 38, GROUND - 28);
      requestDive = !recharge && Math.abs(target.x - g.falcon.x) < (botDifficulty === "easy" ? 34 : botDifficulty === "hard" ? 75 : 45) && (g.phase === "boss" || !voleConcealed(g));
    }
    g.falconFacing = Math.sign(targetX - g.falcon.x) || g.falconFacing;
  } else if (!g.recovering && g.dive <= 0) {
    move(g.falcon, fx, fy, 210, dt, 22, W - 22, 38, GROUND - 31);
    if (fx) g.falconFacing = Math.sign(fx);
  } else if (g.dive > 0) {
    g.falcon.x = clamp(g.falcon.x + fx * 180 * dt, 22, W - 22);
  }
  const onPerch = Math.abs(g.falcon.x - PERCH.x - PERCH.width / 2) < 32 && Math.abs(g.falcon.y - PERCH.y + 16) < 20;
  const resting = onPerch && !g.recovering && g.dive <= 0 && (g.mode === "solo" && g.role === "mouse" || fx === 0 && fy === 0);
  if (resting && g.attacks < 5) {
    g.falcon.y = PERCH.y - 16;
    g.perchFocus = Math.min(2, g.perchFocus + dt);
    if (g.perchFocus >= 2) { g.attacks = 5; g.perchFocus = 0; }
  } else g.perchFocus = 0;
  if (requestDive && g.diveWindup === 0 && !g.recovering && g.dive <= 0 && g.diveCooldown <= 0 && g.attacks > 0) {
    g.attacks--;
    g.diveWindup = 0.14;
    g.diveCooldown = 1.4;
    burst(g, g.falcon.x, g.falcon.y, ["#ffe5a8", "#fff9d8"]);
  }
  if (g.diveWindup > 0) {
    g.diveWindup = Math.max(0, g.diveWindup - dt);
    if (g.diveWindup === 0) g.dive = 0.58;
  }
  if (g.dive > 0) {
    g.dive = Math.max(0, g.dive - dt);
    g.falcon.y = clamp(g.falcon.y + 680 * dt, 38, GROUND - 28);
    g.flightTrail.push({ ...g.falcon });
    if (g.flightTrail.length > 17) g.flightTrail.shift();
    if (g.dive === 0) g.recovering = true;
  } else if (g.recovering) {
    g.falcon.y = Math.max(105, g.falcon.y - 260 * dt);
    if (g.falcon.y <= 105) g.recovering = false;
  } else if (g.flightTrail.length) g.flightTrail.shift();
  if (g.phase === "hunt") {
    g.timer = Math.max(0, g.timer - dt);
    if (g.burrowTravel > 0) {
      g.burrowTravel = Math.max(0, g.burrowTravel - dt);
      if (g.burrowTravel === 0) {
        g.mouse = { x: BURROW_EXITS[g.burrowExit], y: GROUND - 12 };
        g.invincible = Math.max(g.invincible, 0.55);
        burst(g, g.mouse.x, g.mouse.y, ["#bca775", "#e6cba2"]);
      }
    } else {
      if (g.mode === "solo" && g.role === "falcon") {
        // The computer seeks cover and uses the tunnel when it is threatened.
        const threat = g.falcon.x - g.mouse.x;
        const exit = nearExit(g.mouse.x);
        if (
          exit >= 0 &&
          g.burrowCooldown <= 0 &&
          Math.abs(threat) < (botDifficulty === "easy" ? 100 : botDifficulty === "hard" ? 230 : 140) &&
          g.falcon.y < 255
        ) {
          g.burrowTravel = 1.35;
          g.burrowExit = 1 - exit;
          g.burrowCooldown = 7;
        } else {
          const nearestGrass = GRASS.reduce(
            (best, patch) =>
              Math.abs(patch.x + patch.width / 2 - g.mouse.x) <
              Math.abs(best - g.mouse.x)
                ? patch.x + patch.width / 2
                : best,
            GRASS[0].x + GRASS[0].width / 2,
          );
          const seekCover =
            coverAt(g.mouse.x) < 0 &&
            Math.abs(threat) < 270 &&
            Math.abs(nearestGrass - g.mouse.x) < 160;
          const flee = seekCover
            ? Math.sign(nearestGrass - g.mouse.x)
            : Math.abs(threat) < 270
              ? -Math.sign(threat || 1)
              : Math.sin(g.t * 1.3);
          move(
            g.mouse,
            flee,
            Math.sin(g.t * 2) * 0.22,
            botDifficulty === "easy" ? 88 : botDifficulty === "hard" ? 152 : 108,
            dt,
            24,
            W - 24,
            GROUND - 46,
            GROUND - 10,
          );
        }
      } else {
        if (mouseAction && nearExit(g.mouse.x) >= 0 && g.burrowCooldown <= 0) {
          g.burrowExit = 1 - nearExit(g.mouse.x);
          g.burrowTravel = 1.35;
          g.burrowCooldown = 7;
        } else {
          move(g.mouse, mx, my, 175, dt, 22, W - 22, GROUND - 55, GROUND - 10);
          if (mx) g.mouseFacing = Math.sign(mx);
        }
      }
    }
    const patch = g.burrowTravel > 0 ? -1 : coverAt(g.mouse.x);
    if (patch < 0) {
      g.coverReset += dt;
      if (g.coverReset >= 0.8) {
        g.coverPatch = -1;
        g.coverTime = 0;
      }
    } else if (patch !== g.coverPatch) {
      g.coverPatch = patch;
      g.coverTime = 2.4;
      g.coverReset = 0;
    } else g.coverTime = Math.max(0, g.coverTime - dt);
    if (
      g.burrowTravel <= 0 &&
      (patch < 0 || g.coverTime <= 0) &&
      g.invincible <= 0 &&
      g.dive > 0 &&
      distance(g.falcon, g.mouse) < 37
    ) {
      g.catches++;
      g.lives--;
      g.captureMouse = { ...g.mouse };
      g.captureTime = CAPTURE_SECONDS;
      g.phase = "capture";
      g.flightTrail = [];
      g.dive = 0;
      burst(g, g.mouse.x, g.mouse.y, ["#fff5d4", "#ffd397", "#eac3a6"]);
      return;
    }
    if (g.timer === 0) {
      g.phase = "boss";
      g.boss = { x: g.mouse.x, y: GROUND - 49 };
      g.falcon.y = Math.min(g.falcon.y, 150);
      g.dive = 0;
      g.diveCooldown = 0.8;
      g.invincible = 1.5;
      burst(g, g.boss.x, g.boss.y, ["#f8e6b5", "#ffc86c", "#fff"]);
    }
  } else if (g.phase === "boss") {
    g.bossTimer = Math.max(0, g.bossTimer - dt);
    if (g.mode === "solo" && g.role === "falcon") {
      move(
        g.boss,
        Math.sign(g.falcon.x - g.boss.x),
        0,
        125,
        dt,
        45,
        W - 45,
        GROUND - 170,
        GROUND - 43,
      );
      if (g.bossCooldown <= 0 && Math.abs(g.falcon.x - g.boss.x) < 190) {
        g.bossAttack = 0.57;
        g.bossCooldown = 2.5;
      }
    } else {
      move(g.boss, mx, my, 140, dt, 45, W - 45, GROUND - 173, GROUND - 42);
      if (mouseAction && g.bossCooldown <= 0) {
        g.bossAttack = 0.65;
        g.bossCooldown = 1.7;
        burst(g, g.boss.x, g.boss.y, ["#ffe8a8", "#ffba61"]);
      }
    }
    if (g.bossAttack > 0) {
      g.bossAttack = Math.max(0, g.bossAttack - dt);
      // A clearly telegraphed vertical column above the boss.
      if (
        g.invincible <= 0 && g.bossAttack <= 0.4 &&
        Math.abs(g.falcon.x - g.boss.x) < 46 &&
        g.falcon.y < g.boss.y + 26 &&
        g.falcon.y > g.boss.y - 205
      ) {
        g.phase = "end";
        g.winner = "mouse";
        g.reason = "The giant vole caught the kestrel!";
        burst(g, g.falcon.x, g.falcon.y, ["#ffe5ab", "#fff5d6"]);
        return;
      }
    }
    if (g.invincible <= 0 && g.dive > 0 && distance(g.falcon, g.boss) < 61) {
      g.bossHits++;
      g.dive = 0;
      g.recovering = true;
      g.invincible = 1.15;
      burst(g, g.boss.x, g.boss.y, ["#fff5ca", "#ffc56a"]);
      if (g.bossHits >= 3) {
        g.phase = "end";
        g.winner = "falcon";
        g.reason = "Three dives defeated the fantasy boss!";
        return;
      }
    }
    if (g.bossTimer === 0) {
      g.phase = "end";
      g.winner = "mouse";
      g.reason = "The vole survived the hunt and the final showdown!";
    }
  }
}
function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function drawVole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
  facing = 1,
  boss = false,
  t = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);
  const fur = boss ? "#bc7b51" : "#a78d78",
    light = boss ? "#f2c68b" : "#e1cab0";
  ctx.strokeStyle = boss ? "#eeb585" : "#b59485";
  ctx.lineWidth = 3 / scale;
  ctx.beginPath();
  ctx.moveTo(-14, 7);
  ctx.quadraticCurveTo(-27, 13 + Math.sin(t * 5) * 2, -32, 6);
  ctx.stroke();
  ellipse(ctx, -1, 5, 21, 14, fur);
  ellipse(ctx, 14, -2, 13, 11, fur);
  ellipse(ctx, 7, -11, 4.4, 5, fur);
  ellipse(ctx, 7, -11, 2.2, 3, "#eaa9a4");
  ellipse(ctx, 18, 1, 4, 3, light);
  ellipse(ctx, 21, -6, 2, 2, "#20231e");
  ellipse(ctx, 24, 0, 2.7, 2.4, "#e6949a");
  ctx.strokeStyle = "#f6e2c9";
  ctx.lineWidth = 1;
  for (const d of [-3, 0, 3]) {
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(35, d * 2);
    ctx.stroke();
  }
  if (boss) {
    ctx.fillStyle = "#f6d397";
    ctx.beginPath();
    ctx.moveTo(-10, -13);
    ctx.lineTo(-15, -30);
    ctx.lineTo(-5, -20);
    ctx.lineTo(0, -35);
    ctx.lineTo(9, -18);
    ctx.lineTo(16, -29);
    ctx.lineTo(15, -10);
    ctx.fill();
    ellipse(ctx, -8, 6, 4, 3, "#f5d6a7");
  }
  ctx.restore();
}
function drawFalcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  t: number,
  diving: boolean,
  carrying = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.rotate(diving ? 0.33 : Math.sin(t * 4) * 0.06);
  const flap = Math.sin(t * 12) * 10;
  ctx.fillStyle = "#684d38";
  ctx.beginPath();
  ctx.moveTo(-15, 2);
  ctx.lineTo(-39, 13);
  ctx.lineTo(-20, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, -7);
  ctx.quadraticCurveTo(-29, -25 - flap, -57, -11 - flap);
  ctx.quadraticCurveTo(-28, -1, -9, 9);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, -8);
  ctx.quadraticCurveTo(-2, 25 + flap, -25, 34 + flap);
  ctx.quadraticCurveTo(5, 24, 17, 4);
  ctx.fill();
  ellipse(ctx, 0, 2, 19, 13, "#7b5740");
  ellipse(ctx, 4, 7, 11, 6, "#ead4a8");
  ellipse(ctx, 15, -5, 10, 9, "#745039");
  ctx.fillStyle = "#e9b358";
  ctx.beginPath();
  ctx.moveTo(23, -5);
  ctx.lineTo(33, -1);
  ctx.lineTo(23, 2);
  ctx.fill();
  ellipse(ctx, 20, -8, 2.4, 2.4, "#1b231f");
  ctx.strokeStyle = "#e8b461";
  ctx.lineWidth = 3;
  for (const k of [-2, 7]) {
    ctx.beginPath();
    ctx.moveTo(k, 12);
    ctx.lineTo(k + 3, 21);
    ctx.lineTo(k + 10, 20);
    ctx.stroke();
  }
  if (carrying) drawVole(ctx, 8, 29, 0.55, 1, false, t);
  ctx.restore();
}
export function drawScene(ctx: CanvasRenderingContext2D, g: Game) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#142f3b");
  sky.addColorStop(0.58, "#376978");
  sky.addColorStop(1, "#c69b69");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ellipse(ctx, 769, 94, 51, 51, "#ffdaa0");
  ellipse(ctx, 769, 94, 67, 67, "#ffdb9a18");
  for (let i = 0; i < 5; i++) {
    const x = (i * 271 + 120) % W;
    ellipse(ctx, x, 105 + i * 21, 58, 12, "#dde7d820");
    ellipse(ctx, x + 27, 99 + i * 21, 33, 12, "#dde7d820");
  }
  ctx.fillStyle = "#294c4d";
  ctx.beginPath();
  ctx.moveTo(0, 335);
  for (let x = 0; x <= W; x += 18)
    ctx.lineTo(x, 320 + Math.sin(x * 0.012) * 26 + Math.sin(x * 0.03) * 9);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  ctx.fillStyle = "#45654e";
  ctx.beginPath();
  ctx.moveTo(0, 366);
  for (let x = 0; x <= W; x += 16)
    ctx.lineTo(x, 358 + Math.sin(x * 0.018 + 2) * 16);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  const earth = ctx.createLinearGradient(0, GROUND, 0, H);
  earth.addColorStop(0, "#68804f");
  earth.addColorStop(0.15, "#3d583f");
  earth.addColorStop(1, "#253e35");
  ctx.fillStyle = earth;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = "#a6ba6c";
  ctx.lineWidth = 2;
  for (let i = 0; i < 78; i++) {
    const x = (i * 97.31) % W,
      y = GROUND + ((i * 37) % 142),
      h = 7 + (i % 15);
    ctx.globalAlpha = 0.27 + (i % 4) * 0.13;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y - h);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y - h * 0.76);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const [x, y] of [
    [95, 415],
    [333, 446],
    [522, 410],
    [822, 466],
  ]) {
    ellipse(ctx, x, y, 17, 5, "#a9b69366");
    ellipse(ctx, x + 5, y - 4, 12, 5, "#7f9863");
  }
  // A real perch gives the kestrel a lookout point and a quicker next dive.
  ctx.fillStyle = "#614936";
  ctx.fillRect(PERCH.x + 10, PERCH.y + 8, 9, GROUND - PERCH.y - 8);
  ctx.fillRect(
    PERCH.x + PERCH.width - 19,
    PERCH.y + 8,
    9,
    GROUND - PERCH.y - 8,
  );
  ctx.fillStyle = "#876448";
  ctx.fillRect(PERCH.x, PERCH.y, PERCH.width, 12);
  ctx.fillStyle = "#ab8060";
  ctx.fillRect(PERCH.x, PERCH.y, PERCH.width, 3);
  ctx.font = "700 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffebbb";
  ctx.fillText(gameUi("PERCH"), PERCH.x + PERCH.width / 2, PERCH.y - 36);
  if (g.perchFocus > 0 && g.phase === "hunt") {
    ctx.strokeStyle = "#ffdc90";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      g.falcon.x,
      g.falcon.y,
      35,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * (g.perchFocus / 1.1),
    );
    ctx.stroke();
  }
  // The two entrances belong to one protected underground crossing.
  ctx.strokeStyle = "#b2936577";
  ctx.lineWidth = 15;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(BURROW_EXITS[0], GROUND + 20);
  ctx.lineTo(BURROW_EXITS[0] + 35, GROUND + 65);
  ctx.lineTo(BURROW_EXITS[1] - 35, GROUND + 65);
  ctx.lineTo(BURROW_EXITS[1], GROUND + 20);
  ctx.stroke();
  BURROW_EXITS.forEach((x, i) => {
    ellipse(ctx, x, GROUND + 3, 27, 10, "#243b31");
    ctx.fillStyle = "#f9e4aa";
    ctx.font = "700 10px system-ui";
    ctx.fillText(gameUi(`BURROW ${i + 1}`), x, GROUND - 28);
    if (g.burrowTravel > 0 && g.burrowExit === i)
      ellipse(ctx, x, GROUND + 14, 4, 4, "#ffe9a8");
  });
  if (g.phase === "boss" || (g.phase === "end" && g.timer === 0)) {
    ellipse(ctx, g.boss.x, GROUND + 7, 63, 10, "#112d2d77");
    if (g.bossAttack > 0) {
      const beam = ctx.createLinearGradient(g.boss.x - 50, 0, g.boss.x + 50, 0);
      beam.addColorStop(0, "#ffdc8e00");
      beam.addColorStop(0.5, "#ffe39b99");
      beam.addColorStop(1, "#ffdc8e00");
      ctx.fillStyle = beam;
      ctx.fillRect(g.boss.x - 52, g.boss.y - 205, 104, 225);
      ctx.strokeStyle = "#fff0ae";
      ctx.lineWidth = 2;
      ctx.strokeRect(g.boss.x - 44, g.boss.y - 205, 88, 225);
    } else if (g.bossCooldown < 0.35) {
      ctx.strokeStyle = "#fbd69088";
      ctx.lineWidth = 2;
      ctx.strokeRect(g.boss.x - 44, g.boss.y - 205, 88, 225);
    }
    drawVole(ctx, g.boss.x, g.boss.y, 2.15, 1, true, g.t);
  } else if (g.phase !== "capture" && g.burrowTravel <= 0) {
    if (g.invincible <= 0 || Math.sin(g.t * 26) > 0)
      drawVole(ctx, g.mouse.x, g.mouse.y, 1.15, g.mouseFacing, false, g.t);
  }
  // Cover is drawn in front of the vole. The reveal at the end of the safe period is visible to both players.
  GRASS.forEach((patch, j) => {
    const active =
      coverAt(g.mouse.x) === j && g.burrowTravel <= 0 && g.phase === "hunt";
    for (let i = 0; i < 17; i++) {
      const x = patch.x + i * (patch.width / 16);
      const h = 34 + ((i * 13) % 22);
      ctx.strokeStyle = i % 3 ? "#81a467" : "#b3bb6d";
      ctx.lineWidth = 3.3;
      ctx.beginPath();
      ctx.moveTo(x, GROUND + 13);
      ctx.quadraticCurveTo(
        x + (i % 2 ? 8 : -8),
        GROUND - h / 2,
        x + (i % 2 ? 7 : -7),
        GROUND - h,
      );
      ctx.stroke();
    }
    if (active) {
      ctx.fillStyle = g.coverTime > 0 ? "#e8f6b0" : "#ffcf9a";
      ctx.font = "700 11px system-ui";
      ctx.fillText(
        gameUi(g.coverTime > 0 ? `HIDDEN ${g.coverTime.toFixed(1)}s` : "RUSTLING!"),
        patch.x + patch.width / 2,
        GROUND - 62,
      );
    }
  });
  g.flightTrail.forEach((p, i) =>
    ellipse(
      ctx,
      p.x,
      p.y,
      3 + i * 0.22,
      3 + i * 0.22,
      `rgba(255,230,172,${i / (g.flightTrail.length * 2)})`,
    ),
  );
  drawFalcon(
    ctx,
    g.falcon.x,
    g.falcon.y,
    g.falconFacing,
    g.t,
    g.dive > 0,
    g.phase === "capture",
  );
  g.particles.forEach((p) =>
    ellipse(
      ctx,
      p.x,
      p.y,
      2.8 * Math.max(0, p.life),
      2.8 * Math.max(0, p.life),
      p.color,
    ),
  );
  if (g.phase === "capture") {
    ctx.fillStyle = "#fff1ce";
    ctx.font = "bold 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(gameUi(`VOLE ${g.catches} CAUGHT`), W / 2, 105);
    ctx.font = "15px system-ui";
    ctx.fillText(
      gameUi(g.catches === 3
        ? "The kestrel takes its final flight…"
        : "A new vole is coming out…"),
      W / 2,
      132,
    );
  }
  if (g.phase === "boss") {
    ctx.textAlign = "center";
    ctx.font = "700 17px system-ui";
    ctx.fillStyle = "#ffe8b4";
    ctx.fillText(gameUi("THE GIANT VOLE AWAKENS"), W / 2, 35);
  }
}

/** Return a new score tuple; the caller's state is never mutated. */
export function awardPoints(scores: [number, number], player: Player, points: number): [number, number] {
  const next: [number, number] = [...scores];
  next[player] += points;
  return next;
}

export function getWinningPlayer(roles: [Role, Role], winner: Role): Player {
  return roles[0] === winner ? 0 : 1;
}

export function getQuizQuestion(index: number, turn: Player, mode: PlayMode) {
  return QUESTIONS[index + (mode === "hotseat" && turn === 1 ? 3 : 0)];
}

export function getAnswerPoints(answer: number, correct: number): 1 | -1 {
  return answer === correct ? 1 : -1;
}
