import { gameUi } from "../../i18n/gameUi.ts";
import { ARCHER_BRANCHES, ARCHER_HEIGHT as H, ARCHER_WIDTH as W, SHOT_COOLDOWN, WATERLINE, archerTrajectory, insectLanding } from "./archerfish";
import type { ArcherFish, ArcherGame } from "./archerfish";

const COLORS = ["#ffab91", "#f7d87b"];
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFish(ctx: CanvasRenderingContext2D, fish: ArcherFish, index: number, time: number) {
  const color = COLORS[index];
  const y = WATERLINE + 32 + Math.sin(time * 5 + index) * 2;
  ctx.save();
  ctx.translate(fish.x, y);
  ctx.scale(fish.facing, 1);
  if (fish.dashTime > 0) {
    for (let i = 0; i < 4; i++) ellipse(ctx, -46 - i * 15, i % 2 ? 5 : -5, 9 - i, 2, "#c7fff56b");
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-26, 0); ctx.lineTo(-49, -16); ctx.lineTo(-44, 0); ctx.lineTo(-49, 16); ctx.closePath(); ctx.fill();
  ellipse(ctx, -2, 0, 34, 18, "#e4ecda");
  ellipse(ctx, 5, 8, 23, 9, color);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(-2, 0, 34, 18, 0, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = "#244b49"; ctx.lineWidth = 7;
  for (const x of [-22, -5, 12]) {
    ctx.beginPath(); ctx.moveTo(x - 6, -20); ctx.lineTo(x + 3, 1); ctx.stroke();
  }
  ctx.restore();
  // An upturned mouth reaches the surface to spit the water jet.
  ctx.fillStyle = "#e4ecda";
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(0, -35 - index * 13); ctx.lineTo(13, -9); ctx.fill();
  ellipse(ctx, 19, -5, 5, 5, "#122f32");
  ellipse(ctx, 20, -7, 1.5, 1.5, "#fff9de");
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(6, 19); ctx.lineTo(13, 9); ctx.stroke();
  ctx.restore();
  ctx.textAlign = "center"; ctx.font = "700 12px system-ui"; ctx.fillStyle = color;
  ctx.fillText(gameUi(index === 0 ? "1 · CORAL" : "2 · GOLD"), fish.x, WATERLINE + 79);
  ctx.fillStyle = "#0e3b40"; ctx.fillRect(fish.x - 20, WATERLINE + 87, 40, 3);
  ctx.fillStyle = color; ctx.fillRect(fish.x - 20, WATERLINE + 87, 40 * (1 - fish.shotCooldown / SHOT_COOLDOWN), 3);
}

export function drawArcherGame(ctx: CanvasRenderingContext2D, game: ArcherGame, ai: boolean) {
  const sky = ctx.createLinearGradient(0, 0, 0, WATERLINE);
  sky.addColorStop(0, "#123a3c"); sky.addColorStop(1, "#6e9984");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ellipse(ctx, 750, 70, 42, 42, "#e2dcae");
  ellipse(ctx, 750, 70, 61, 61, "#e2dcae0d");

  // Layered mangrove silhouettes and roots frame the playable water.
  for (let i = 0; i < 9; i++) {
    const x = i * 133 - 40;
    ctx.strokeStyle = "#204e493b"; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 20, 260);
    ctx.lineTo(x - 5, WATERLINE + 20); ctx.moveTo(x + 20, 260); ctx.lineTo(x + 57, WATERLINE + 15); ctx.stroke();
    ellipse(ctx, x, 24, 90, 35, "#163f3940");
  }
  ctx.strokeStyle = "#314f3e"; ctx.lineWidth = 12; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-20, 235); ctx.quadraticCurveTo(160, 90, 430, 117); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W + 20, 235); ctx.quadraticCurveTo(800, 90, 530, 117); ctx.stroke();
  for (const branch of ARCHER_BRANCHES) {
    ctx.strokeStyle = "#789064"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(branch.x - 38, branch.y + 9); ctx.lineTo(branch.x + 25, branch.y + 9); ctx.stroke();
    ctx.strokeStyle = "#456c4e";
    ctx.beginPath(); ctx.moveTo(branch.x - 33, branch.y + 9); ctx.lineTo(branch.x - 48, 139); ctx.stroke();
    ellipse(ctx, branch.x - 31, branch.y - 2, 14, 5, "#95ab6b");
    ellipse(ctx, branch.x + 23, branch.y + 4, 12, 4, "#658e58");
  }
  const water = ctx.createLinearGradient(0, WATERLINE, 0, H);
  water.addColorStop(0, "#236971"); water.addColorStop(1, "#0e3545");
  ctx.fillStyle = water; ctx.fillRect(0, WATERLINE, W, H - WATERLINE);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = "#a9dbc909";
    ctx.beginPath(); ctx.moveTo(120 + i * 190, WATERLINE); ctx.lineTo(165 + i * 190, WATERLINE);
    ctx.lineTo(100 + i * 190, H); ctx.lineTo(10 + i * 190, H); ctx.fill();
  }
  ctx.strokeStyle = "#b8e1c8"; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = WATERLINE + Math.sin(x * 0.035 + game.elapsed * 2) * 1.5;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let i = 0; i < 24; i++) {
    const x = (i * 173 + game.elapsed * 8) % W;
    ellipse(ctx, x, WATERLINE + 23 + (i * 41) % 177, 2, 2, "#d3edd123");
  }

  game.fish.forEach((fish, index) => {
    if (ai && index === 1) return;
    const path = archerTrajectory(fish);
    ctx.save(); ctx.globalAlpha = fish.shotCooldown > 0 ? 0.45 : 0.9;
    path.forEach((point, i) => { if (i % 2 === 0) ellipse(ctx, point.x, point.y, 3, 3, "#15303b"); });
    ctx.restore();
  });
  for (const insect of game.insects) {
    if (insect.state === "falling") {
      const landing = insectLanding(insect);
      ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = "#f8e8b34d"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(insect.x, insect.y + 12); ctx.lineTo(landing.x, landing.y - 10); ctx.stroke();
      ctx.setLineDash([]); ctx.strokeStyle = "#fff3bd"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(landing.x, WATERLINE, 20, 5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    const wing = insect.state === "perched" ? 1 : Math.sin(game.elapsed * 35) * 3;
    ellipse(ctx, insect.x - 7, insect.y - 4 - wing, 7, 4, "#f4edcfb3");
    ellipse(ctx, insect.x + 7, insect.y - 4 + wing, 7, 4, "#f4edcfb3");
    ellipse(ctx, insect.x, insect.y, 5, 8, "#302d27");
    ellipse(ctx, insect.x, insect.y - 6, 4, 4, "#efc875");
    ctx.strokeStyle = "#efc875"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(insect.x - 4, insect.y); ctx.lineTo(insect.x + 4, insect.y); ctx.stroke();
  }
  game.shots.forEach(shot => {
    ctx.strokeStyle = "#d0faffb3"; ctx.lineWidth = 3.5; ctx.beginPath();
    shot.tail.forEach((point, i) => { if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
    ctx.lineTo(shot.x, shot.y); ctx.stroke();
    ellipse(ctx, shot.x, shot.y, 4, 4, "#edffff");
  });
  // Draw the gold fish slightly lower so overlapping fish remain distinguishable.
  game.fish.forEach((fish, index) => {
    ctx.save(); ctx.translate(0, index * 13); drawFish(ctx, fish, index, game.elapsed); ctx.restore();
  });
  game.ripples.forEach(ripple => {
    ctx.save(); ctx.globalAlpha = 1 - ripple.age / 0.8;
    ctx.strokeStyle = ripple.owner === null ? "#d4f1dd" : COLORS[ripple.owner]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(ripple.x, WATERLINE, 10 + ripple.age * 55, 3 + ripple.age * 10, 0, 0, Math.PI * 2); ctx.stroke();
    if (ripple.owner !== null) {
      ctx.fillStyle = COLORS[ripple.owner]; ctx.font = "bold 23px system-ui"; ctx.textAlign = "center";
      ctx.fillText(gameUi("+1"), ripple.x, WATERLINE - 18 - ripple.age * 30);
    }
    ctx.restore();
  });
  ctx.textAlign = "left"; ctx.font = "600 11px system-ui"; ctx.fillStyle = "#c8e4cd80";
  ctx.fillText(gameUi("MANGROVE ESTUARY / TOXOTES"), 25, H - 23);
  ctx.textAlign = "right"; ctx.fillText(gameUi("SHOOT ABOVE · RACE BELOW"), W - 25, H - 23);
}
