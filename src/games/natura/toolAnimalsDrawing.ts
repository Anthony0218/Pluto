import { gameUi } from "../../i18n/gameUi.ts";
import { bolasTip, coconutFood, raidPredators, shellProtects, type ToolGame } from './toolAnimals';
export function drawToolGame(ctx: CanvasRenderingContext2D, game: ToolGame, ai: boolean) {
  const colors = ['#f28d79', '#edcb79'];
  const text = (label: string, x: number, y: number, color = '#eee6cf', size = 14) => {
    ctx.fillStyle = color; ctx.font = `600 ${size}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(gameUi(label), x, y);
  };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  };
  const line = (points: number[], color: string, width = 2) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]); ctx.stroke();
  };
  ctx.clearRect(0, 0, 960, 540);
  const gradient = ctx.createLinearGradient(0, 0, 0, 540);
  gradient.addColorStop(0, game.kind === 'bolas' ? '#101e2a' : '#143d46');
  gradient.addColorStop(1, game.kind === 'bolas' ? '#294037' : '#6c8e7a'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, 540);
  if (game.kind === 'bolas') {
    for (let i = 0; i < 45; i++) oval((i * 137) % 960, (i * 71) % 470, 1.3, 1.3, '#9fae92');
    oval(860, 60, 26, 26, '#d9dec2'); line([0, 85, 280, 80, 620, 91, 960, 78], '#645341', 15);
    game.moths.forEach(moth => {
      const wing = 8 + Math.sin(game.elapsed * 22 + moth.id) * 3;
      oval(moth.x - 6, moth.y, wing, 6, '#dcd8b8'); oval(moth.x + 6, moth.y, wing, 6, '#b6b69c'); oval(moth.x, moth.y, 3, 8, '#625d4f');
    });
    game.players.forEach((p, i) => {
      if (p.lure > 0) { ctx.save(); ctx.globalAlpha = .13; oval(p.x, p.y + 140, 190, 145, colors[i]); ctx.restore(); text('SCENT LURE', p.x, p.y + 325, colors[i], 12); }
      line([p.x, 85, p.x, p.y], '#d3d3b5');
      for (let leg = 0; leg < 4; leg++) for (const side of [-1, 1]) line([p.x, p.y + leg * 3, p.x + side * 22, p.y - 14 + leg * 10, p.x + side * 32, p.y - 9 + leg * 12], colors[i]);
      oval(p.x, p.y, 12, 16, colors[i]);
      const tip = bolasTip(p); line([p.x, p.y + 10, tip.x, tip.y], '#e6e4c8', p.swing > 0 ? 3 : 1);
      oval(tip.x, tip.y, p.swing > 0 ? 9 : 6, p.swing > 0 ? 9 : 6, '#f5e9ab');
      text(i === 1 && ai ? 'AI' : `P${i + 1}`, p.x, 55, colors[i]);
      text(p.cooldown > 0 ? 'Resetting thread' : 'Ready to swing', p.x, 400, colors[i], 12);
    });
    text('Move along the branch · aim the sticky thread · lure, then swing', 480, 505);
  } else {
    for (let i = 0; i < 60; i++) oval((i * 163) % 960, 80 + (i * 79) % 450, 4 + i % 6, 2, '#829b7c');
    if (game.raid.stage !== 'calm') {
      game.raid.lanes.forEach(y => { ctx.fillStyle = '#f3977030'; ctx.fillRect(0, y - 46, 960, 92); });
      text(game.raid.stage === 'warning' ? 'PREDATORS APPROACHING — ASSEMBLE COVER OR LEAVE THE LANES' : 'PATROL CROSSING', 480, 33, '#ffce9c');
    } else text(`Next patrol warning in ${Math.ceil(game.raid.time)}s`, 480, 33);
    game.players.forEach((p, i) => {
      const food = coconutFood(i as 0 | 1, p.food);
      if (food) { ctx.strokeStyle = colors[i]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(food.x, food.y, 22, 0, Math.PI * 2); ctx.stroke(); text(`${i + 1}`, food.x, food.y + 5, colors[i]); text('FOOD', food.x, food.y + 39, colors[i], 11); }
      const shell = p.shell;
      oval(shell.x, shell.y + 5, 28, 14, '#4c392b'); oval(shell.x, shell.y, 26, 15, '#9b7150');
      if (!shellProtects(p)) {
        ctx.save(); if (p.flash > 0) ctx.globalAlpha = .5 + .5 * Math.sin(game.elapsed * 30) ** 2;
        for (let leg = 0; leg < 8; leg++) { const angle = leg * Math.PI / 4; line([p.x, p.y, p.x + Math.cos(angle) * 23, p.y + Math.sin(angle) * 23, p.x + Math.cos(angle + .3) * 31, p.y + Math.sin(angle + .3) * 31], colors[i], 4); }
        oval(p.x, p.y - 6, 16, 20, colors[i]); oval(p.x - 6, p.y - 10, 3, 4, '#192f34'); oval(p.x + 6, p.y - 10, 3, 4, '#192f34'); ctx.restore();
      }
      text(`${i === 1 && ai ? 'AI' : `P${i + 1}`} · ${shellProtects(p) ? 'COVERED' : p.hidden ? 'ASSEMBLING' : p.carrying ? 'CARRYING' : 'FREE'}`, p.x, p.y - 44, colors[i], 12);
      if (!p.carrying && !p.hidden) text(`SHELL ${i + 1}`, shell.x, shell.y + 33, colors[i], 11);
    });
    raidPredators(game).forEach((p, i) => {
      oval(p.x, p.y, 42, 17, '#283c43'); const direction = i === 0 ? 1 : -1;
      ctx.fillStyle = '#283c43'; ctx.beginPath(); ctx.moveTo(p.x - direction * 30, p.y); ctx.lineTo(p.x - direction * 60, p.y - 24); ctx.lineTo(p.x - direction * 60, p.y + 24); ctx.fill(); oval(p.x + direction * 26, p.y - 5, 3, 3, '#efca96');
    });
  }
}
