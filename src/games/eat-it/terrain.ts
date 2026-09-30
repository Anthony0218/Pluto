import { CITY, cityRoads } from './cityLayout.ts';
import { EAT, type PowerKind } from './config.ts';
import { obstaclesFor } from './maps.ts';
import type { MapId } from './types.ts';
const TAU = Math.PI * 2;
export const POWER_COLOR: Record<PowerKind, string> = { speed: '#bceb56', shield: '#70cfff', magnet: '#e6a0ff', divider: '#ff665e', multiplier: '#ffcc63', jump: '#65edce', strike: '#ff9754' };
export const POWER_SYMBOL: Record<PowerKind, string> = { speed: '↯', shield: '◇', magnet: '∩', divider: '/2', multiplier: '2x', jump: '⇧', strike: '✹' };
function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); c.fill();
}
function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, radius = 0) {
  c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
}
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); c.fill();
}

/** Locally drawn ground colors; all raised scenery is built as meshes. */
export function background(map: MapId): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = EAT.match.width; canvas.height = EAT.match.height;
  const c = canvas.getContext('2d')!;
  const nature = map === 'nature'; c.fillStyle = nature ? '#b3cd83' : '#e8deca'; c.fillRect(0, 0, canvas.width, canvas.height);
  // District ground tints track the generation sectors without adding colliders.
  for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) rect(c, x * canvas.width / 4, y * canvas.height / 3, canvas.width / 4, canvas.height / 3,
    (nature ? ['#c2d991', '#a9c47a', '#bfc392', '#bec7a6'] : ['#e7d4b3', '#cbd8ad', '#e2d8c8', '#d5d1c3'])[x]);
  c.save(); c.scale(canvas.width / 2200, canvas.height / 1600);
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
    // Undo the legacy drawing scale: placement and street texture share world coordinates.
    c.save(); c.scale(2200/canvas.width,1600/canvas.height);
    for (let col=0;col<5;col++) for (let row=0;row<4;row++) {
      const park=(col+row*2)%5===1;
      rect(c,col*800+90,row*760+90,620,580,park?'#afc790':'#e2d6bf',12);
      // Center alley / park promenade separates the frontage rows.
      rect(c,col*800+122,row*760+367,556,26,park?'#dfcc9d':'#c8bcaa');
    }
    const roads=cityRoads();
    for(const x of roads.vertical) { rect(c,x-122,0,244,canvas.height,'#c5bca9');rect(c,x-90,0,CITY.roadWidth,canvas.height,'#889a9c'); }
    for(const y of roads.horizontal) { rect(c,0,y-122,canvas.width,244,'#c5bca9');rect(c,0,y-90,canvas.width,CITY.roadWidth,'#889a9c'); }
    c.strokeStyle='#ede4c7';c.lineWidth=3;c.setLineDash([24,24]);c.beginPath();
    for(const x of roads.vertical){c.moveTo(x,0);c.lineTo(x,canvas.height);}
    for(const y of roads.horizontal){c.moveTo(0,y);c.lineTo(canvas.width,y);}
    c.stroke();c.setLineDash([]);
    for(const x of roads.vertical.slice(1,-1))for(const y of roads.horizontal.slice(1,-1))for(let i=-3;i<=3;i++) {
      rect(c,x+i*22-7,y+104,14,30,'#f3ebd5');rect(c,x+104,y+i*22-7,30,14,'#f3ebd5');
    }
    c.restore();
  }
  c.restore();
  for (const o of obstaclesFor(map)) if (o.kind === 'water') {
    rect(c, o.x, o.y, o.w, o.h, '#7cb8b8');
    for (let y = o.y + 20; y < o.y + o.h; y += 45) rect(c, o.x + 20 + y % 25, y, 50, 3, '#a3d4cf', 2);
  }
  return canvas;
}
