import { EAT, FOOD, massToRadius, type FoodKind, type PowerKind } from './config.ts';
import { clamp, distance, obstaclesFor, zoneRadius } from './maps.ts';
import { angleDelta, foodFits, inMouth, mouthPosition } from './rules.ts';
import type { GameState, MapId, Player } from './types.ts';

const TAU = Math.PI * 2;
const POWER_COLOR: Record<PowerKind, string> = { speed: '#bceb56', shield: '#70cfff', magnet: '#e6a0ff', growth: '#ffc958' };
export const POWER_SYMBOL: Record<PowerKind, string> = { speed: '↯', shield: '◇', magnet: '∩', growth: '✦' };
function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); c.fill();
}
function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 0) {
  c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
}
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); c.fill();
}

/** Vector food stays crisp at every camera scale without sprite downloads. */
export function drawFood(c: CanvasRenderingContext2D, kind: FoodKind, x: number, y: number, scale = 1, rotation = 0) {
  c.save(); c.translate(x, y); c.rotate(rotation); c.scale(scale, scale);
  if (kind === 'berry') {
    circle(c, -3, 1, 4, '#8865ad'); circle(c, 3, 1, 4, '#675399'); circle(c, 0, -3, 4, '#9576c4'); ellipse(c, 2, -7, 4, 2, '#57865a');
  } else if (kind === 'apple') {
    ellipse(c, -4, 0, 8, 10, '#f15c59'); ellipse(c, 4, 0, 8, 10, '#e64e50'); ellipse(c, -6, -3, 2, 4, '#ff9d82');
    rect(c, -1, -14, 2.5, 6, '#75563e'); ellipse(c, 5, -12, 6, 2.7, '#6da85c');
  } else if (kind === 'burger') {
    rect(c, -19, 7, 38, 9, '#f3b85c', 5); rect(c, -20, 0, 40, 8, '#784a3b', 4);
    rect(c, -22, -3, 44, 4, '#71aa4d', 2); rect(c, -19, -7, 38, 4, '#e66f57', 2);
    c.fillStyle = '#f7c674'; c.beginPath(); c.ellipse(0, -7, 20, 13, 0, Math.PI, TAU); c.fill();
    for (const [sx, sy] of [[-10, -13], [0, -17], [10, -12], [-1, -10]]) ellipse(c, sx, sy, 2, 1, '#fff1c7');
  } else if (kind === 'pizza') {
    c.fillStyle = '#f4ca66'; c.beginPath(); c.moveTo(-20, -17); c.lineTo(20, -13); c.lineTo(0, 22); c.closePath(); c.fill();
    c.strokeStyle = '#d49c52'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-19, -17); c.lineTo(19, -13); c.stroke();
    circle(c, -7, -7, 4.4, '#d86b52'); circle(c, 7, -4, 4.4, '#d86b52'); circle(c, 0, 8, 3.5, '#d86b52');
    ellipse(c, 2, -9, 3, 1.2, '#7f9f58');
  } else if (kind === 'donut') {
    circle(c, 0, 0, 12, '#ce9454'); circle(c, 0, -1, 10.5, '#f393b3'); circle(c, 0, 0, 4, '#745344');
    for (let i = 0; i < 7; i++) rect(c, Math.cos(i) * 8, Math.sin(i) * 8, 3, 1.5, i % 2 ? '#fff1ab' : '#b8e9f0', 1);
  } else if (kind === 'soda') {
    rect(c, -8, -13, 16, 26, '#5fadd1', 4); rect(c, -8, -12, 16, 3, '#d2dce2', 2); rect(c, -8, 10, 16, 3, '#b6c5cd', 2);
    c.fillStyle = '#f8edd3'; c.beginPath(); c.moveTo(0, -7); c.lineTo(-5, 2); c.lineTo(2, 1); c.lineTo(-1, 8); c.lineTo(6, -2); c.lineTo(0, -1); c.fill();
  } else if (kind === 'fries') {
    for (let i = 0; i < 5; i++) rect(c, -11 + i * 4.6, -15 + (i % 2) * 3, 3.7, 23, '#f8cf64', 1);
    c.fillStyle = '#e77961'; c.beginPath(); c.moveTo(-14, -2); c.lineTo(14, -2); c.lineTo(10, 15); c.lineTo(-10, 15); c.fill(); circle(c, 0, 6, 4, '#ffdb87');
  } else if (kind === 'cupcake') {
    rect(c, -10, 0, 20, 13, '#a7a0d0', 4); circle(c, -7, -2, 7, '#fff3d5'); circle(c, 7, -2, 7, '#fff3d5'); circle(c, 0, -9, 8, '#fff3d5'); circle(c, 0, -16, 3, '#ec7471');
  } else if (kind === 'mushroom') {
    rect(c, -3, 0, 6, 10, '#efddbb', 2); c.fillStyle = '#c98368'; c.beginPath(); c.arc(0, 0, 10, Math.PI, TAU); c.fill(); circle(c, -4, -4, 2, '#ffe8b2'); circle(c, 4, -5, 1.5, '#ffe8b2');
  } else {
    c.fillStyle = '#6f9b59'; c.beginPath(); c.arc(0, -5, 23, 0, Math.PI); c.fill(); c.fillStyle = '#ee827b'; c.beginPath(); c.arc(0, -5, 19, 0, Math.PI); c.fill();
    for (const x of [-10, 0, 10]) ellipse(c, x, 4, 1.5, 3, '#654940');
  }
  c.restore();
}

function background(map: MapId): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = EAT.match.width; canvas.height = EAT.match.height;
  const c = canvas.getContext('2d')!;
  const nature = map === 'nature'; c.fillStyle = nature ? '#b3cd83' : '#e8deca'; c.fillRect(0, 0, canvas.width, canvas.height);
  if (nature) {
    for (let i = 0; i < 100; i++) {
      const x = (i * 373) % canvas.width, y = (i * 211) % canvas.height;
      ellipse(c, x, y, 80 + i % 30, 42, i % 2 ? '#a9c47a' : '#bdd48e');
    }
    c.strokeStyle = '#dbc69b'; c.lineWidth = 150; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 730); c.bezierCurveTo(650, 560, 1050, 970, 2200, 710); c.stroke();
    c.lineWidth = 100; c.beginPath(); c.moveTo(940, 0); c.bezierCurveTo(760, 640, 1140, 800, 970, 1600); c.stroke();
    rect(c, 1370, 550, 210, 310, '#c5a271', 8);
    for (let y = 560; y < 850; y += 22) rect(c, 1378, y, 194, 4, '#a58560', 2);
    rect(c, 1360, 550, 14, 310, '#9a7859', 5); rect(c, 1580, 550, 14, 310, '#9a7859', 5);
    for (let i = 0; i < 140; i++) {
      const x = (i * 193 + 77) % 2200, y = (i * 337 + 23) % 1600;
      if (Math.abs(y - 760) < 125 || Math.abs(x - 990) < 100) continue;
      c.strokeStyle = '#8ca75f'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 4, y - 4); c.lineTo(x, y); c.lineTo(x + 4, y - 5); c.stroke();
      if (i % 3 === 0) { circle(c, x + 8, y - 5, 3, i % 2 ? '#f6ebcb' : '#d5a3bd'); circle(c, x + 8, y - 5, 1, '#e6be67'); }
    }
  } else {
    // Open plaza, two roads, curb strips, pedestrian crossings and cobbled sidewalks.
    for (let x = 0; x < 2200; x += 80) for (let y = 0; y < 1600; y += 80) {
      c.strokeStyle = '#d9d1c0'; c.lineWidth = 1; c.strokeRect(x, y, 80, 80);
    }
    rect(c, 0, 535, 2200, 275, '#cdc9bb'); rect(c, 880, 0, 310, 1600, '#cdc9bb');
    rect(c, 0, 555, 2200, 235, '#9baaaa'); rect(c, 900, 0, 270, 1600, '#9baaaa');
    c.strokeStyle = '#dce0cd'; c.lineWidth = 3; c.setLineDash([30, 28]);
    c.beginPath(); c.moveTo(0, 671); c.lineTo(2200, 671); c.moveTo(1035, 0); c.lineTo(1035, 1600); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 8; i++) { rect(c, 760, 569 + i * 27, 90, 15, '#e9e7d6', 2); rect(c, 1220, 569 + i * 27, 90, 15, '#e9e7d6', 2); }
    for (let i = 0; i < 8; i++) rect(c, 918 + i * 31, 880, 18, 85, '#e9e7d6', 2);
    // Plaza inset is deliberately left open for larger characters.
    rect(c, 470, 835, 340, 255, '#dfd2b9', 25); rect(c, 490, 855, 300, 215, '#e9ddc5', 20);
    for (const [x, y] of [[100, 470], [580, 470], [1630, 490], [2090, 880], [1650, 1430], [180, 1060]]) {
      ellipse(c, x + 7, y + 6, 12, 7, '#575f5624'); circle(c, x, y, 9, '#687971'); circle(c, x, y, 5, '#f6e7a5');
      rect(c, x + 34, y - 10, 20, 25, '#839186', 4); rect(c, x + 33, y - 12, 22, 5, '#667b73', 2);
    }
  }
  for (const o of obstaclesFor(map)) {
    const { x, y, w, h } = o;
    if (o.kind !== 'water') rect(c, x + 6, y + 8, w, h, '#43554820', 12);
    if (o.kind === 'stall') {
      rect(c, x, y, w, h, '#b89a76', 8); rect(c, x + 8, y + 9, w - 16, h - 18, '#f5ebd4', 4);
      const color = x < 1000 ? '#df8870' : '#78a8a1';
      rect(c, x - 7, y - 6, w + 14, h * 0.62, color, 6);
      for (let i = 0; i < 7; i++) rect(c, x + i * (w / 7), y - 4, w / 14, h * 0.62, '#fff3d4');
      for (let i = 0; i < 4; i++) { rect(c, x + 15 + i * 44, y + h - 34, 32, 21, '#dbc5a3', 3); circle(c, x + 30 + i * 44, y + h - 24, 6, i % 2 ? '#e8ad5f' : '#bbcf79'); }
    } else if (o.kind === 'tree' || o.kind === 'planter') {
      if (o.kind === 'planter') rect(c, x, y, w, h, '#b4a88c', 9);
      const cx = x + w / 2, cy = y + h / 2;
      circle(c, cx, cy, Math.min(w, h) * 0.53, '#7f9f5d');
      circle(c, cx - w * 0.19, cy - h * 0.13, h * 0.34, '#91ae66'); circle(c, cx + w * 0.19, cy + h * 0.09, h * 0.34, '#88a861');
      if (nature) { circle(c, cx - 20, cy - 10, 5, '#d89371'); circle(c, cx + 23, cy + 18, 5, '#e3a17c'); }
    } else if (o.kind === 'fountain') {
      rect(c, x, y, w, h, '#b9baaf', 60); rect(c, x + 9, y + 9, w - 18, h - 18, '#8bc2c6', 50);
      c.strokeStyle = '#c3e6dd'; c.lineWidth = 3; c.beginPath(); c.ellipse(x + w / 2, y + h / 2, 49, 33, 0, 0, TAU); c.stroke(); circle(c, x + w / 2, y + h / 2, 19, '#d9ddd0'); circle(c, x + w / 2, y + h / 2, 10, '#a5d9d7');
    } else if (o.kind === 'water') {
      rect(c, x, y, w, h, '#7cb8b8'); rect(c, x - 7, y, 7, h, '#94b071'); rect(c, x + w, y, 7, h, '#94b071');
      for (let wy = y + 20; wy < y + h; wy += 45) { rect(c, x + 20 + wy % 25, wy, 50, 3, '#a3d4cf', 2); }
    } else if (o.kind === 'rock') {
      rect(c, x, y, w, h, '#a6b2a2', 28); rect(c, x + 8, y + 7, w - 25, h - 22, '#bdc6b2', 22);
    } else if (o.kind === 'crate') {
      rect(c, x, y, w, h, '#c69f6e', 5); c.strokeStyle = '#e3bc88'; c.lineWidth = 6; c.strokeRect(x + 7, y + 7, w - 14, h - 14); c.beginPath(); c.moveTo(x + 7, y + 7); c.lineTo(x + w - 7, y + h - 7); c.stroke();
    } else {
      rect(c, x, y, w, h, '#a68861', 8);
      for (let by = y + 5; by < y + h - 3; by += 9) rect(c, x + 4, by, w - 8, 4, '#c6a676', 2);
    }
  }
  return canvas;
}

type Visual = { x: number; y: number; radius: number; facing: number };
export class ArenaRenderer {
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement;
  private visuals = new Map<string, Visual>();
  private camera = { x: 1100, y: 800, zoom: 1.1, initialized: false };
  private width = 1;
  private height = 1;
  private dpr = 1;
  private seen = new Set<number>();
  private particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
  private canvas: HTMLCanvasElement;
  private finishedAt: number | null = null;
  constructor(canvas: HTMLCanvasElement, map: MapId) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!; this.terrain = background(map);
  }
  resize(width: number, height: number) {
    this.width = width; this.height = height; this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.dpr); this.canvas.height = Math.round(height * this.dpr);
  }
  private player(c: CanvasRenderingContext2D, p: Player, v: Visual, state: GameState, local: Player | undefined, you: string, now: number, scale = 1, labels = true) {
    const r = v.radius, recent = state.events.filter(e => e.playerId === p.id && state.time - e.at < 0.65);
    const bite = recent.some(e => e.type === 'eat'), chewing = recent.some(e => e.type === 'food'), bumped = recent.some(e => e.type === 'collision');
    const nearbyFood = state.food.some(f => foodFits(p, f) && inMouth(p, f, FOOD[f.kind].radius, 40));
    const danger = local && p.id !== local.id && massToRadius(p.mass) >= massToRadius(local.mass) * EAT.eating.playerEatRadiusRatio;
    const edible = local && p.id !== local.id && massToRadius(local.mass) >= massToRadius(p.mass) * EAT.eating.playerEatRadiusRatio;
    const scared = state.players.some(other => other.id !== p.id && other.alive && massToRadius(other.mass) >= massToRadius(p.mass) * EAT.eating.playerEatRadiusRatio && distance(p, other) < r + 170);
    const shield = p.effects.shield > state.time, speed = p.effects.speed > state.time;
    c.save(); c.translate(v.x, v.y); c.scale(scale, scale);
    if (p.effects.magnet > state.time) { c.strokeStyle = '#b478d97a'; c.lineWidth = 2; c.setLineDash([6, 10]); c.beginPath(); c.arc(0, 0, r + 15 + Math.sin(now * 3) * 3, 0, TAU); c.stroke(); c.setLineDash([]); }
    if (shield) { circle(c, 0, 0, r + 9, '#88dafa50'); c.strokeStyle = '#b8efff'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r + 9, 0, TAU); c.stroke(); }
    if (speed) for (let i = 1; i <= 3; i++) circle(c, -Math.cos(v.facing) * i * 9, -Math.sin(v.facing) * i * 9, r * (1 - i * 0.15), '#efffac22');
    ellipse(c, 3, r * 0.14 + 4, r * 1.04, r * 0.94, '#38432d2a');
    c.rotate(v.facing);
    const squash = chewing ? Math.sin(now * 28) * 0.045 : 0;
    c.scale(1 + squash, 1 - squash);
    circle(c, 0, 0, r, p.color);
    c.strokeStyle = danger ? '#b65751' : p.id === local?.id ? '#fcffe9' : edible ? '#4f7966' : '#31413033'; c.lineWidth = p.id === local?.id ? 3 : 2;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    // Mouth is a broad front-facing black bowl. The token remains completely flat.
    const open = bite ? 0.86 : nearbyFood ? 0.72 : chewing ? 0.48 + Math.sin(now * 24) * 0.13 : scared ? 0.43 : 0.56;
    c.fillStyle = '#343842'; c.beginPath(); c.moveTo(r * 0.03, -r * open);
    c.bezierCurveTo(r * 1.13, -r * open, r * 1.13, r * open, r * 0.03, r * open);
    c.quadraticCurveTo(r * 0.28, 0, r * 0.03, -r * open); c.fill();
    c.save(); c.clip(); ellipse(c, r * 0.65, r * open * 0.65, r * 0.28, r * 0.19, '#e78291');
    rect(c, r * 0.19, -r * open - 1, r * 0.19, r * 0.18, '#fff8df', r * 0.04);
    rect(c, r * 0.41, -r * open, r * 0.18, r * 0.15, '#fff8df', r * 0.04); c.restore();
    for (const side of [-1, 1]) {
      const ey = r * 0.38 * side;
      ellipse(c, -r * 0.29, ey, r * 0.24, r * (bumped ? 0.08 : 0.28), '#fffef0');
      circle(c, -r * 0.23 + (scared ? -r * 0.04 : 0), ey, r * (scared ? 0.09 : 0.105), '#343842');
      circle(c, -r * 0.2, ey - r * 0.03, r * 0.028, '#fff');
      if (scared || speed) { c.strokeStyle = '#586145'; c.lineWidth = Math.max(1.5, r * 0.04); c.beginPath(); c.moveTo(-r * 0.54, ey + side * r * 0.27); c.lineTo(-r * 0.21, ey + side * r * (scared ? 0.32 : 0.18)); c.stroke(); }
    }
    c.restore();
    if (!labels) return;
    const label = p.id === local?.id ? p.name === you ? you : `${p.name} · ${you}` : p.name;
    c.font = '600 12px "Geist Variable", system-ui, sans-serif'; c.textAlign = 'center';
    const width = c.measureText(label).width + 18;
    rect(c, v.x - width / 2, v.y - r - 32, width, 22, '#2c373de0', 7);
    c.fillStyle = '#fffdf0'; c.fillText(label, v.x, v.y - r - 17);
    if (danger || edible) { c.font = 'bold 15px system-ui'; c.fillStyle = danger ? '#a84441' : '#496f4e'; c.fillText(danger ? '!' : '↓', v.x + r + 9, v.y - r); }
  }
  draw(state: GameState, localId: string, dt: number, you: string, debug: boolean, networked = false) {
    const c = this.ctx, local = state.players.find(p => p.id === localId), followed = local?.alive ? local : state.players.filter(p => p.alive).sort((a, b) => b.mass - a.mass)[0] ?? local;
    const now = performance.now() / 1000, smooth = 1 - Math.exp(-dt * EAT.camera.growthRate);
    for (const p of state.players) {
      const motionSmooth = networked && p.id !== localId ? 1 : 1 - Math.exp(-dt * 18);
      const target = p;
      const v = this.visuals.get(p.id) ?? { x: p.x, y: p.y, radius: massToRadius(p.mass), facing: p.facing };
      v.x += (target.x - v.x) * motionSmooth; v.y += (target.y - v.y) * motionSmooth; v.radius += (massToRadius(p.mass) - v.radius) * smooth;
      v.facing += angleDelta(v.facing, p.facing) * smooth; this.visuals.set(p.id, v);
    }
    if (followed) {
      const target = this.visuals.get(followed.id)!;
      if (!this.camera.initialized) { this.camera.x = target.x; this.camera.y = target.y; this.camera.initialized = true; }
      const follow = 1 - Math.exp(-EAT.camera.followRate * dt);
      this.camera.x += (target.x - this.camera.x) * follow; this.camera.y += (target.y - this.camera.y) * follow;
      const zoom = clamp(EAT.camera.maxZoom * (EAT.player.startingMass / Math.max(EAT.player.startingMass, followed.mass)) ** EAT.camera.zoomCurve, EAT.camera.minZoom, EAT.camera.maxZoom);
      this.camera.zoom += (zoom - this.camera.zoom) * follow;
    }
    const z = this.camera.zoom * Math.min(1, this.width / 700 + 0.36);
    const halfW = this.width / z / 2, halfH = this.height / z / 2;
    this.camera.x = halfW < 1100 ? clamp(this.camera.x, halfW, 2200 - halfW) : 1100;
    this.camera.y = halfH < 800 ? clamp(this.camera.y, halfH, 1600 - halfH) : 800;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.fillStyle = '#6f806a'; c.fillRect(0, 0, this.width, this.height);
    c.save(); c.translate(this.width / 2, this.height / 2); c.scale(z, z); c.translate(-this.camera.x, -this.camera.y);
    c.drawImage(this.terrain, 0, 0);
    const visible = (x: number, y: number, padding = 150) => Math.abs(x - this.camera.x) < halfW + padding && Math.abs(y - this.camera.y) < halfH + padding;
    if (state.time >= EAT.match.zoneStart) {
      c.fillStyle = '#8d586b3a'; c.beginPath(); c.rect(0, 0, 2200, 1600); c.arc(1100, 800, zoneRadius(state.time), 0, TAU, true); c.fill('evenodd');
      c.strokeStyle = '#cf716f'; c.lineWidth = 4; c.setLineDash([12, 10]); c.beginPath(); c.arc(1100, 800, zoneRadius(state.time), 0, TAU); c.stroke(); c.setLineDash([]);
    }
    for (const power of state.powerups) {
      if (!visible(power.x, power.y)) continue;
      const pulse = Math.sin(now * 3 + power.id) * 2, color = POWER_COLOR[power.kind];
      circle(c, power.x, power.y, 27 + pulse, `${color}44`); circle(c, power.x, power.y, 20, '#fff5dd');
      c.strokeStyle = color; c.lineWidth = 3; c.beginPath(); c.arc(power.x, power.y, 20, 0, TAU); c.stroke();
      c.save(); c.translate(power.x, power.y); c.rotate(Math.sin(now * 2) * 0.1); c.fillStyle = '#495758'; c.font = 'bold 29px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(POWER_SYMBOL[power.kind], 0, 0); c.restore();
    }
    for (const p of state.players.filter(p => p.alive).sort((a, b) => a.mass - b.mass)) {
      if (visible(p.x, p.y)) this.player(c, p, this.visuals.get(p.id)!, state, local, you, now);
    }
    // Food travels over the mouth and shrinks only during its final approach.
    for (const f of state.food) {
      if (!visible(f.x, f.y, 40)) continue;
      const owner = f.target && state.players.find(p => p.id === f.target);
      const scale = owner ? clamp(distance(f, mouthPosition(owner)) / 24, 0.15, 1) : 1;
      ellipse(c, f.x + 2, f.y + 4, FOOD[f.kind].radius * 0.95 * scale, FOOD[f.kind].radius * 0.5 * scale, '#4f5c4724');
      drawFood(c, f.kind, f.x, f.y - f.z, scale, f.rotation);
      if (local?.alive && !foodFits(local, f) && distance(local, f) < 135) { c.fillStyle = '#786d5d'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.fillText('+', f.x, f.y - FOOD[f.kind].radius - 7); }
    }
    if (state.status === 'finished') this.finishedAt ??= now;
    for (const event of state.events) {
      const age = state.time - event.at + (this.finishedAt === null ? 0 : now - this.finishedAt);
      if (event.type === 'eat' && age < EAT.eating.playerAnimation) {
        const victim = state.players.find(p => p.id === event.victimId), attacker = state.players.find(p => p.id === event.playerId);
        if (victim && attacker) {
          const t = clamp(age / EAT.eating.playerAnimation, 0, 1), mouth = mouthPosition(attacker);
          this.player(c, victim, { x: event.x + (mouth.x - event.x) * t, y: event.y + (mouth.y - event.y) * t, radius: event.radius!, facing: victim.facing }, state, local, you, now, 1 - t, false);
        }
      }
      if (!this.seen.has(event.id)) {
        this.seen.add(event.id);
        if (event.type !== 'collision') for (let i = 0; i < 6 && this.particles.length < EAT.visuals.maxParticles; i++) {
          const angle = i * TAU / 6; this.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * 48, vy: Math.sin(angle) * 48, life: 0.5, color: event.type === 'power' ? '#fff3c0' : '#fef9dc' });
        }
      }
    }
    if (this.seen.size > 200) this.seen = new Set(state.events.map(e => e.id));
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; c.globalAlpha = Math.max(0, p.life * 2); circle(c, p.x, p.y, 3, p.color); }
    c.globalAlpha = 1; this.particles = this.particles.filter(p => p.life > 0);
    if (debug) for (const p of state.players.filter(p => p.alive)) {
      const r = massToRadius(p.mass), m = mouthPosition(p);
      c.lineWidth = 1; c.strokeStyle = '#087bbc'; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke();
      c.strokeStyle = '#dd3752'; c.beginPath(); c.arc(m.x, m.y, r * 0.44 + EAT.eating.mouthRange, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(p.facing) * (r + 50), p.y + Math.sin(p.facing) * (r + 50)); c.stroke();
      c.strokeStyle = '#643ecc'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + p.vx * 0.4, p.y + p.vy * 0.4); c.stroke();
      c.fillStyle = '#17222c'; c.font = '12px monospace'; c.fillText(`${p.botState} r≥${(r * EAT.eating.playerEatRadiusRatio).toFixed(1)}`, p.x, p.y + r + 20);
    }
    c.restore();
    this.minimap(state, localId);
  }
  private minimap(state: GameState, localId: string) {
    if (this.width < 600) return;
    const c = this.ctx, w = 144, h = w * 1600 / 2200, x = this.width - w - 20, y = this.height - h - 20;
    rect(c, x - 7, y - 7, w + 14, h + 14, '#23352bd9', 13);
    c.save(); c.translate(x, y); c.scale(w / 2200, h / 1600); c.drawImage(this.terrain, 0, 0); c.fillStyle = '#18332955'; c.fillRect(0, 0, 2200, 1600);
    if (state.time > EAT.match.zoneStart) { c.strokeStyle = '#f8b2a4'; c.lineWidth = 20; c.beginPath(); c.arc(1100, 800, zoneRadius(state.time), 0, TAU); c.stroke(); }
    for (const p of state.powerups) circle(c, p.x, p.y, 24, POWER_COLOR[p.kind]);
    for (const p of state.players.filter(p => p.alive)) { circle(c, p.x, p.y, p.id === localId ? 62 : 43, p.id === localId ? '#fff' : '#26392d'); circle(c, p.x, p.y, p.id === localId ? 38 : 28, p.color); }
    c.restore();
  }
}
