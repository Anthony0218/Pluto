import { gameUi } from "../../i18n/gameUi.ts";
import type { PlayMode, Player } from "./naturaData";
import {
  FLYING_FISH_H,
  FLYING_FISH_MAX_LIVES,
  FLYING_FISH_PHASE_SECONDS,
  FLYING_FISH_ROUND_SECONDS,
  FLYING_FISH_W,
  type FlyingFishObstacle,
  type FlyingFishParticleKind,
  type FlyingFishPlayerState,
  type FlyingFishState,
} from "./flyingFishData";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const makePlayer = (index: 0 | 1, active: boolean): FlyingFishPlayerState => ({
  x: FLYING_FISH_W * (index === 0 ? 0.42 : 0.58),
  y: FLYING_FISH_H * (index === 0 ? 0.56 : 0.67),
  vx: 0,
  score: 0,
  lives: FLYING_FISH_MAX_LIVES,
  invulnerable: 0,
  caught: 0,
  active,
});

export function initialFlyingFishGame(mode: PlayMode): FlyingFishState {
  return {
    phase: "ready",
    phaseTimer: FLYING_FISH_PHASE_SECONDS,
    roundTimer: FLYING_FISH_ROUND_SECONDS,
    elapsed: 0,
    spawnTimer: 0.55,
    transition: 0,
    obstacleId: 1,
    players: [makePlayer(0, true), makePlayer(1, mode === "hotseat")],
    obstacles: [],
    particles: [],
    winner: null,
    reason: "",
  };
}

export function startFlyingFishGame(game: FlyingFishState, mode: PlayMode) {
  const fresh = initialFlyingFishGame(mode);
  Object.assign(game, fresh, { phase: "sky" as const });
}

function spawnParticles(
  game: FlyingFishState,
  x: number,
  y: number,
  kind: FlyingFishParticleKind,
  count = 18,
) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 170;
    const maxLife = 0.55 + Math.random() * 0.55;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      kind,
    });
  }
}

function spawnObstacle(game: FlyingFishState) {
  const sky = game.phase === "sky";
  const topScore = Math.max(game.players[0].score, game.players[1].score);
  const speed = 170 + Math.random() * 90 + Math.min(155, topScore * 2.3);
  const obstacle: FlyingFishObstacle = {
    id: game.obstacleId++,
    kind: sky ? "seabird" : "tuna",
    x: 70 + Math.random() * (FLYING_FISH_W - 140),
    y: sky ? -55 : FLYING_FISH_H + 65,
    vy: sky ? speed : -speed * 0.94,
    radius: sky ? 27 : 31,
    wobble: Math.random() * Math.PI * 2,
    passed: [false, false],
  };
  game.obstacles.push(obstacle);
}

function playerHit(
  obstacle: FlyingFishObstacle,
  player: FlyingFishPlayerState,
) {
  const dx = obstacle.x - player.x;
  const dy = obstacle.y - player.y;
  const radius = obstacle.radius + 25;
  return dx * dx + dy * dy < radius * radius;
}

function finishGame(game: FlyingFishState, mode: PlayMode) {
  game.phase = "end";
  game.obstacles.length = 0;

  if (mode === "ai") {
    if (game.players[0].lives > 0) {
      game.winner = 0;
      game.reason = `You survived the full migration with ${game.players[0].score} clean dodges and ${game.players[0].lives} ${game.players[0].lives === 1 ? "heart" : "hearts"} left.`;
    } else {
      game.winner = 1;
      game.reason = `The ocean predators caught all three lives after ${game.players[0].score} clean dodges.`;
    }
    return;
  }

  const [a, b] = game.players;
  if (a.score !== b.score) {
    game.winner = a.score > b.score ? 0 : 1;
  } else if (a.lives !== b.lives) {
    game.winner = a.lives > b.lives ? 0 : 1;
  } else {
    game.winner = null;
  }
  game.reason =
    game.winner === null
      ? `Both flying fish finished level on ${a.score} dodges with ${a.lives} hearts left.`
      : `Player ${game.winner + 1} wins with ${game.players[game.winner].score} dodges and ${game.players[game.winner].lives} hearts left.`;
}

export function updateFlyingFishGame(
  game: FlyingFishState,
  keys: Set<string>,
  dt: number,
  mode: PlayMode,
) {
  if (game.phase === "ready" || game.phase === "end") return;

  game.elapsed += dt;
  game.roundTimer -= dt;
  game.phaseTimer -= dt;
  game.transition = Math.max(0, game.transition - dt);

  if (game.phaseTimer <= 0) {
    game.phase = game.phase === "sky" ? "water" : "sky";
    game.phaseTimer += FLYING_FISH_PHASE_SECONDS;
    game.obstacles.length = 0;
    game.spawnTimer = 0.28;
    game.transition = 0.9;
    spawnParticles(game, FLYING_FISH_W / 2, FLYING_FISH_H / 2, "splash", 28);
  }

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    spawnObstacle(game);
    const topScore = Math.max(game.players[0].score, game.players[1].score);
    game.spawnTimer =
      Math.max(0.42, 1.03 - topScore * 0.012) + Math.random() * 0.42;
  }

  game.players.forEach((player, index) => {
    if (!player.active || player.lives <= 0) return;

    const left = index === 0 ? keys.has("KeyA") : keys.has("ArrowLeft");
    const right = index === 0 ? keys.has("KeyD") : keys.has("ArrowRight");
    const direction = Number(right) - Number(left);

    player.vx += direction * 1180 * dt;
    player.vx *= Math.pow(0.0018, dt);
    player.vx = clamp(player.vx, -370, 370);
    player.x = clamp(player.x + player.vx * dt, 40, FLYING_FISH_W - 40);

    const baseY =
      game.phase === "sky"
        ? FLYING_FISH_H * (index === 0 ? 0.56 : 0.68)
        : FLYING_FISH_H * (index === 0 ? 0.4 : 0.53);
    const targetY = baseY + Math.sin(game.elapsed * 4.2 + index * 1.8) * 7;
    player.y += (targetY - player.y) * Math.min(1, dt * 5.5);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.caught = Math.max(0, player.caught - dt);
  });

  game.obstacles.forEach((obstacle) => {
    obstacle.y += obstacle.vy * dt;
    obstacle.x += Math.sin(game.elapsed * 2.6 + obstacle.wobble) * 29 * dt;

    game.players.forEach((player, index) => {
      if (!player.active || player.lives <= 0 || player.invulnerable > 0)
        return;
      if (playerHit(obstacle, player)) {
        player.lives -= 1;
        player.invulnerable = 1.55;
        player.caught = 0.72;
        obstacle.dead = true;
        spawnParticles(
          game,
          player.x,
          player.y,
          game.phase === "sky" ? "feather" : "bubble",
          22,
        );
        return;
      }

      const passed =
        game.phase === "sky"
          ? obstacle.y > player.y + 45
          : obstacle.y < player.y - 45;
      if (passed && !obstacle.passed[index] && !obstacle.dead) {
        obstacle.passed[index] = true;
        player.score += 1;
      }
    });
  });

  game.obstacles = game.obstacles.filter(
    (obstacle) =>
      !obstacle.dead && obstacle.y > -120 && obstacle.y < FLYING_FISH_H + 120,
  );

  game.particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    particle.life -= dt;
  });
  game.particles = game.particles.filter((particle) => particle.life > 0);

  const activePlayers = game.players.filter((player) => player.active);
  const nobodyAlive = activePlayers.every((player) => player.lives <= 0);
  if (game.roundTimer <= 0 || nobodyAlive) finishGame(game, mode);
}

function wavePath(
  ctx: CanvasRenderingContext2D,
  y: number,
  amplitude: number,
  offset: number,
  color: string,
) {
  ctx.beginPath();
  ctx.moveTo(0, FLYING_FISH_H);
  for (let x = 0; x <= FLYING_FISH_W; x += 12) {
    const waveY =
      y +
      Math.sin(x * 0.018 + offset) * amplitude +
      Math.sin(x * 0.007 - offset * 1.6) * amplitude * 0.45;
    ctx.lineTo(x, waveY);
  }
  ctx.lineTo(FLYING_FISH_W, FLYING_FISH_H);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSky(ctx: CanvasRenderingContext2D, game: FlyingFishState) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FLYING_FISH_H);
  gradient.addColorStop(0, "#7fc5e8");
  gradient.addColorStop(0.7, "#dceff2");
  gradient.addColorStop(1, "#e8e5d8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FLYING_FISH_W, FLYING_FISH_H);

  ctx.fillStyle = "rgba(255,255,255,.58)";
  for (let i = 0; i < 5; i += 1) {
    const x = ((i * 230 + game.elapsed * 13) % (FLYING_FISH_W + 260)) - 130;
    const y = 65 + (i % 3) * 55;
    ctx.beginPath();
    ctx.ellipse(x, y, 66, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 45, y + 5, 48, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  wavePath(ctx, FLYING_FISH_H * 0.78, 10, game.elapsed * 2.8, "#4ba6c8");
  wavePath(ctx, FLYING_FISH_H * 0.82, 15, game.elapsed * 2.1 + 1.2, "#2a82aa");
  wavePath(ctx, FLYING_FISH_H * 0.88, 18, game.elapsed * 1.4 + 2.4, "#17678f");
}

function drawWater(ctx: CanvasRenderingContext2D, game: FlyingFishState) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FLYING_FISH_H);
  gradient.addColorStop(0, "#3aa4c2");
  gradient.addColorStop(0.18, "#146b8f");
  gradient.addColorStop(1, "#082f4c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FLYING_FISH_W, FLYING_FISH_H);

  ctx.strokeStyle = "rgba(255,255,255,.38)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= FLYING_FISH_W; x += 12) {
    const y = 18 + Math.sin(x * 0.025 + game.elapsed * 3) * 7;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,.08)";
  for (let i = 0; i < 7; i += 1) {
    const x = (i * 160 + 70) % FLYING_FISH_W;
    const y = 65 + i * 50;
    ctx.beginPath();
    ctx.moveTo(x, 15);
    ctx.lineTo(x + 90, y + 160);
    ctx.lineTo(x + 130, y + 160);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(18,77,82,.72)";
  for (let i = 0; i < 9; i += 1) {
    const x = i * 120 + 20;
    ctx.fillRect(x, FLYING_FISH_H - 70, 8, 70);
    ctx.beginPath();
    ctx.ellipse(x + 10, FLYING_FISH_H - 80, 12, 30, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFlyingFish(
  ctx: CanvasRenderingContext2D,
  player: FlyingFishPlayerState,
  index: number,
  phase: FlyingFishState["phase"],
) {
  if (!player.active) return;
  ctx.save();

  if (player.lives <= 0) {
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = "#9aa6ad";
    ctx.beginPath();
    ctx.ellipse(player.x, player.y, 30, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (
    player.invulnerable > 0 &&
    Math.floor(player.invulnerable * 12) % 2 === 0
  ) {
    ctx.globalAlpha = 0.32;
  }

  ctx.translate(player.x, player.y);
  if (player.caught > 0) {
    const scale = 1 + Math.sin(player.caught * 38) * 0.15;
    ctx.scale(scale, scale);
    ctx.rotate(Math.sin(player.caught * 28) * 0.18);
  }

  const body = index === 0 ? "#d66d49" : "#e5bd4b";
  const fin = index === 0 ? "#f7c3ac" : "#fff0a8";

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 31, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.lineTo(-48, -18);
  ctx.lineTo(-43, 0);
  ctx.lineTo(-48, 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = fin;
  if (phase === "sky") {
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.quadraticCurveTo(12, -40, 30, -34);
    ctx.quadraticCurveTo(17, -9, 2, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-7, 5);
    ctx.quadraticCurveTo(10, 36, 27, 30);
    ctx.quadraticCurveTo(15, 9, 0, -1);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.lineTo(15, -27);
    ctx.lineTo(22, -5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 6);
    ctx.lineTo(15, 25);
    ctx.lineTo(22, 5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#13232a";
  ctx.beginPath();
  ctx.arc(17, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (player.caught > 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 22px Inter, system-ui, sans-serif";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,.42)";
    ctx.fillStyle = "#fff6e6";
    ctx.strokeText(gameUi("CAUGHT!"), player.x, player.y - 48);
    ctx.fillText(gameUi("CAUGHT!"), player.x, player.y - 48);
    ctx.restore();
  }
}

function drawSeabird(
  ctx: CanvasRenderingContext2D,
  obstacle: FlyingFishObstacle,
  time: number,
) {
  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  ctx.rotate(Math.sin(time * 5 + obstacle.wobble) * 0.08);
  ctx.strokeStyle = "#34434b";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.quadraticCurveTo(-10, -24, 0, -5);
  ctx.quadraticCurveTo(12, -24, 34, 0);
  ctx.stroke();
  ctx.fillStyle = "#f7f1e4";
  ctx.beginPath();
  ctx.ellipse(2, 4, 20, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d89a3c";
  ctx.beginPath();
  ctx.moveTo(18, 2);
  ctx.lineTo(30, 6);
  ctx.lineTo(18, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTuna(
  ctx: CanvasRenderingContext2D,
  obstacle: FlyingFishObstacle,
  time: number,
) {
  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  ctx.rotate(-Math.PI / 2 + Math.sin(time * 2 + obstacle.wobble) * 0.07);
  ctx.fillStyle = "#93b4c4";
  ctx.beginPath();
  ctx.ellipse(0, 0, 36, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#557e96";
  ctx.beginPath();
  ctx.moveTo(-31, 0);
  ctx.lineTo(-54, -22);
  ctx.lineTo(-47, 0);
  ctx.lineTo(-54, 22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-5, -12);
  ctx.lineTo(11, -30);
  ctx.lineTo(14, -9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#182833";
  ctx.beginPath();
  ctx.arc(21, -5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, game: FlyingFishState) {
  game.particles.forEach((particle) => {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (particle.kind === "bubble") {
      ctx.strokeStyle = "rgba(255,255,255,.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3 + (1 - alpha) * 7, 0, Math.PI * 2);
      ctx.stroke();
    } else if (particle.kind === "feather") {
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.beginPath();
      ctx.ellipse(
        particle.x,
        particle.y,
        7,
        2.3,
        Math.atan2(particle.vy, particle.vx),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

export function drawFlyingFishScene(
  ctx: CanvasRenderingContext2D,
  game: FlyingFishState,
) {
  ctx.clearRect(0, 0, FLYING_FISH_W, FLYING_FISH_H);
  if (game.phase === "water") drawWater(ctx, game);
  else drawSky(ctx, game);

  game.obstacles.forEach((obstacle) => {
    if (obstacle.kind === "seabird") drawSeabird(ctx, obstacle, game.elapsed);
    else drawTuna(ctx, obstacle, game.elapsed);
  });

  game.players.forEach((player, index) =>
    drawFlyingFish(ctx, player, index, game.phase),
  );
  drawParticles(ctx, game);

  if (game.transition > 0) {
    const alpha = Math.min(0.56, game.transition * 0.7);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(0, 0, FLYING_FISH_W, FLYING_FISH_H);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(0,40,70,.34)";
    ctx.fillStyle = "#fff8e9";
    const word = game.phase === "sky" ? "SURFACE!" : "DIVE!";
    ctx.strokeText(gameUi(word), FLYING_FISH_W / 2, FLYING_FISH_H / 2);
    ctx.fillText(gameUi(word), FLYING_FISH_W / 2, FLYING_FISH_H / 2);
    ctx.restore();
  }
}

export function flyingFishWinnerLabel(winner: Player | null, mode: PlayMode) {
  if (winner === null) return "A draw";
  if (mode === "ai") return winner === 0 ? "You survived" : "The ocean wins";
  return `Player ${winner + 1} wins`;
}
