import { gameUi } from "../../i18n/gameUi.ts";
import { HABITATS, PATTERN_NAMES, SNAP_LEVELS, snapPlatforms, SNAP_GRAVITY, SNAP_SPEED, WILD_H as H, WILD_W as W,
  camouflageMatches, foodTarget, inPredatorView, predatorsAt } from "./wildModes";
import type { CuttleGame, SnapGame, WildGame } from "./wildModes";

const INK = ["#f3a482", "#f0d17a"];
function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = "#f4edcf", size = 12) {
  ctx.font = `600 ${size}px system-ui`; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(gameUi(text), x, y);
}

function drawSnap(ctx: CanvasRenderingContext2D, game: SnapGame, ai: boolean) {
  const platforms = snapPlatforms(game);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#1c3a34"); sky.addColorStop(1, "#748466");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  oval(ctx, 760, 65, 43, 43, "#d8c59b");
  for (let i = 0; i < 12; i++) {
    const x = i * 93;
    ctx.strokeStyle = "#153b314d"; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x - 25, 230, x + 30, 10); ctx.stroke();
    oval(ctx, x, 170 + i % 4 * 25, 55, 12, "#234b3545");
  }
  ctx.fillStyle = "#2c3429"; ctx.fillRect(0, H - 15, W, 15);
  for (let i = 0; i < 4; i++) {
    const x = 240 + i * 190;
    ctx.fillStyle = "#334232"; ctx.beginPath(); ctx.moveTo(x - 34, H - 15); ctx.lineTo(x, H + 12); ctx.lineTo(x + 34, H - 15); ctx.fill();
  }
  platforms.forEach((platform, index) => {
    const earth = ctx.createLinearGradient(0, platform.y, 0, H);
    earth.addColorStop(0, "#81674a"); earth.addColorStop(1, "#3d4535");
    ctx.fillStyle = earth; ctx.fillRect(platform.x, platform.y, platform.width, H - platform.y);
    ctx.fillStyle = "#a9b77c"; ctx.fillRect(platform.x - 3, platform.y, platform.width + 6, 7);
    for (let k = 0; k < platform.width; k += 15) {
      ctx.strokeStyle = "#a7b773"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(platform.x + k, platform.y);
      ctx.lineTo(platform.x + k + 4, platform.y - 7 - k % 9); ctx.stroke();
    }
    label(ctx, index === platforms.length - 1 ? "THE NEST" : `LEDGE ${index + 1}`, platform.x + platform.width / 2, platform.y + 30, "#eee6c6b3", 10);
  });
  const nest = platforms[platforms.length - 1];
  oval(ctx, nest.x + nest.width / 2, nest.y - 15, 32, 18, "#456044");
  oval(ctx, nest.x + nest.width / 2, nest.y - 8, 18, 12, "#142e2a");
  label(ctx, "FINISH", nest.x + nest.width / 2, nest.y - 46, "#e8ddb2", 12);

  game.players.forEach((ant, index) => {
    if (ant.lives <= 0) return;
    if (ant.grounded && (!ai || index === 0)) {
      const radians = ant.angle * Math.PI / 180;
      let previousY = ant.y;
      for (let i = 1; i < 29; i++) {
        const time = i * 0.045;
        const x = ant.x + ant.facing * Math.cos(radians) * SNAP_SPEED * time;
        const y = ant.y - Math.sin(radians) * SNAP_SPEED * time + SNAP_GRAVITY * time * time / 2;
        if (x < 0 || x > W || y > H) break;
        oval(ctx, x, y - 6, 3, 3, "#102a30");
        if (y > previousY && platforms.some(p => previousY <= p.y && y >= p.y && x >= p.x && x <= p.x + p.width)) break;
        previousY = y;
      }
    }
    ctx.save();
    ctx.globalAlpha = ant.flash > 0 && Math.sin(game.elapsed * 24) > 0 ? 0.4 : 1;
    ctx.translate(ant.x, ant.y - 13); ctx.scale(ant.facing, 1);
    ctx.rotate(ant.grounded ? 0 : Math.atan2(ant.vy, Math.abs(ant.vx)) * 0.3);
    ctx.strokeStyle = INK[index]; ctx.lineWidth = 2;
    for (const x of [-8, 0, 8]) {
      ctx.beginPath(); ctx.moveTo(x, 1); ctx.lineTo(x - 6, 8); ctx.lineTo(x - 10, 14);
      ctx.moveTo(x, -1); ctx.lineTo(x + 5, -8); ctx.lineTo(x + 10, -12); ctx.stroke();
    }
    oval(ctx, -15, 0, 11, 8, INK[index]); oval(ctx, 0, 0, 8, 5, "#754838"); oval(ctx, 13, -1, 9, 8, INK[index]);
    oval(ctx, 15, -4, 2, 2, "#18372f");
    ctx.strokeStyle = "#fbefd0"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(20, -5); ctx.lineTo(30, ant.grounded ? -12 : -3);
    ctx.moveTo(20, 4); ctx.lineTo(30, ant.grounded ? 10 : 0); ctx.stroke();
    ctx.restore();
    label(ctx, `${index + 1} · ${Math.round(ant.angle)}°`, ant.x, ant.y - 40, INK[index], 11);
    if (ant.cooldown > 0) { ctx.fillStyle = INK[index]; ctx.fillRect(ant.x - 15, ant.y - 33, 30 * (1 - ant.cooldown / 0.7), 2); }
  });
  label(ctx, `COURSE ${game.level + 1}: ${SNAP_LEVELS[game.level].name.toUpperCase()} · STEEPER = HIGHER, SHORTER`, W / 2, 30, "#dce5caaa", 11);
}


function drawPattern(ctx: CanvasRenderingContext2D, pattern: number, x: number, y: number, width: number, height: number, small = false) {
  const step = small ? 9 : 27;
  ctx.strokeStyle = "#183e4440"; ctx.fillStyle = "#163f4645"; ctx.lineWidth = small ? 2 : 3;
  for (let px = x; px < x + width; px += step) for (let py = y; py < y + height; py += step) {
    const jitter = Math.sin(px * 3.2 + py) * step * 0.2;
    if (pattern === 0) { ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 5, py - 3, px + step * 0.5, py); ctx.stroke(); }
    else if (pattern === 1) oval(ctx, px + jitter, py, step * 0.27, step * 0.2, "#20483c55");
    else if (pattern === 2) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + step, py + step); ctx.stroke(); }
    else if (pattern === 3) { ctx.beginPath(); ctx.moveTo(px, py + step); ctx.lineTo(px + 4, py); ctx.moveTo(px + 2, py + 8); ctx.lineTo(px - 4, py + 3); ctx.stroke(); }
    else if (pattern === 4) { ctx.beginPath(); ctx.arc(px + jitter, py, step * 0.23, 0, Math.PI * 2); ctx.stroke(); }
    else { oval(ctx, px + jitter, py, small ? 1 : 2, small ? 1 : 2, "#e4dccda0"); oval(ctx, px + step * 0.5, py + step * 0.3, small ? 1 : 3, small ? 1 : 2, "#183d4b70"); }
  }
}

function drawCuttle(ctx: CanvasRenderingContext2D, game: CuttleGame) {
  for (const patch of game.patches) {
    const habitat = HABITATS[patch.pattern];
    ctx.save(); ctx.beginPath();
    patch.polygon.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
    ctx.closePath(); ctx.fillStyle = habitat.color; ctx.fill(); ctx.clip();
    const xs = patch.polygon.map(point => point.x), ys = patch.polygon.map(point => point.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    drawPattern(ctx, patch.pattern, minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY);
    ctx.fillStyle = "#173d491a"; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.beginPath(); patch.polygon.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); }); ctx.closePath();
    ctx.strokeStyle = "#e8e6ca55"; ctx.lineWidth = 1; ctx.stroke();
    label(ctx, habitat.name.toUpperCase(), patch.x, patch.y - 10, "#183a35bb", 10);
    label(ctx, `${PATTERN_NAMES[patch.pattern]} · ${habitat.bumpy ? "bumpy" : "smooth"}`, patch.x, patch.y + 5, "#183a35aa", 9);
  }
  for (const predator of predatorsAt(game.elapsed)) {
    ctx.save(); ctx.translate(predator.x, predator.y); ctx.scale(predator.facing, 1);
    ctx.fillStyle = "#fff4bc24"; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(240, -123); ctx.lineTo(240, 123); ctx.lineTo(0, 22); ctx.closePath(); ctx.fill();
    ctx.setLineDash([5, 6]); ctx.strokeStyle = "#f8e9b84d"; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#1d424e"; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-51, -24); ctx.lineTo(-46, 19); ctx.closePath(); ctx.fill();
    oval(ctx, 0, 0, 40, 15, "#244956");
    ctx.beginPath(); ctx.moveTo(-9, -10); ctx.lineTo(-10, -34); ctx.lineTo(13, -9); ctx.fill();
    oval(ctx, 28, -5, 2.5, 2.5, "#ebd38b"); ctx.restore();
  }
  game.players.forEach((animal, index) => {
    const food = foodTarget(index as 0 | 1, animal.food);
    if (food) {
      ctx.strokeStyle = INK[index]; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(food.x, food.y, 22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "#ffe7b9"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(food.x, food.y, 7, -2.4, 1.6); ctx.stroke();
      label(ctx, `${index + 1} · FOOD`, food.x, food.y - 29, "#fff5d5", 10);
    }
    if (animal.lives <= 0) return;
    ctx.save(); ctx.translate(animal.x, animal.y);
    ctx.globalAlpha = animal.flash > 0 && Math.sin(game.elapsed * 20) > 0 ? 0.45 : 1;
    const body = HABITATS[animal.pattern].color;
    oval(ctx, 0, 0, 26, 17, body);
    ctx.strokeStyle = INK[index]; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 28, 19 + Math.sin(game.elapsed * 6) * 1.5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2); ctx.clip();
    drawPattern(ctx, animal.pattern, -24, -15, 48, 30, true);
    ctx.restore();
    if (animal.bumpy) {
      ctx.fillStyle = body;
      for (let i = 0; i < 7; i++) {
        const x = -21 + i * 7;
        ctx.beginPath(); ctx.moveTo(x - 3, -12); ctx.lineTo(x, -23 - i % 2 * 3); ctx.lineTo(x + 3, -12); ctx.fill();
      }
    }
    ctx.strokeStyle = body; ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(22, i * 3); ctx.quadraticCurveTo(37, i * 6, 38 + Math.sin(game.elapsed * 5 + i) * 3, i * 5); ctx.stroke(); }
    oval(ctx, 19, -5, 4, 4, "#edf0d7");
    ctx.strokeStyle = "#1c3c39"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(16, -6); ctx.lineTo(18, -3); ctx.lineTo(20, -6); ctx.lineTo(22, -3); ctx.stroke();
    ctx.restore();
    const watched = predatorsAt(game.elapsed).some(predator => inPredatorView(animal, predator));
    const hidden = camouflageMatches(animal, game.patches) && !animal.moving;
    label(ctx, `${index + 1} · ${hidden ? "BLENDING" : watched ? "EXPOSED" : "FORAGING"}`, animal.x, animal.y - 34, "#fff8df", 10);
    ctx.fillStyle = "#123e4666"; ctx.fillRect(animal.x - 23, animal.y + 28, 46, 4);
    ctx.fillStyle = animal.exposure > 65 ? "#ef886e" : "#f6d386"; ctx.fillRect(animal.x - 23, animal.y + 28, 46 * animal.exposure / 100, 4);
  });
  ctx.fillStyle = "#123c4699"; ctx.fillRect(0, H - 30, W, 30);
  label(ctx, "MATCH PATTERN + TEXTURE · STOP MOVING TO BLEND IN · WATCH THE SEARCH CONES", W / 2, H - 11, "#e2ebd6", 11);
}

export function drawWildGame(ctx: CanvasRenderingContext2D, game: WildGame, ai: boolean) {
  ctx.save();
  if (game.kind === "trapjaw") drawSnap(ctx, game, ai); else drawCuttle(ctx, game);
  ctx.restore();
}
