import { EAT, FOOD, type FoodKind } from './config.ts';
import type { Vec } from './types.ts';
/** Shared by terrain drawing and placement. Roads remain open between frontage rows. */
export const CITY = { blockWidth: 800, blockHeight: 760, roadWidth: 180, sidewalk: 32 } as const;
export const cityRoads = () => ({
  vertical: Array.from({ length: 6 }, (_, i) => i * CITY.blockWidth),
  horizontal: Array.from({ length: 5 }, (_, i) => i * CITY.blockHeight),
});
export function cityZone(p: Vec): 'street' | 'green' | 'block' | 'sidewalk' {
  const x = ((p.x % CITY.blockWidth) + CITY.blockWidth) % CITY.blockWidth;
  const y = ((p.y % CITY.blockHeight) + CITY.blockHeight) % CITY.blockHeight;
  const edge = Math.min(x, CITY.blockWidth-x, y, CITY.blockHeight-y);
  if (edge < CITY.roadWidth/2) return 'street';
  if (edge < CITY.roadWidth/2 + CITY.sidewalk) return 'sidewalk';
  return (Math.floor(p.x/CITY.blockWidth)+Math.floor(p.y/CITY.blockHeight)*2)%5 === 1 ? 'green' : 'block';
}
export function citySlots(kind: FoodKind): (Vec & { rotation: number })[] {
  const f = FOOD[kind], slots: (Vec & { rotation: number })[] = [];
  if (f.building) {
    for (let col=0;col<5;col++) for (let row=0;row<4;row++) for (const x of [240,560]) for (const y of [245,515]) {
      const at = { x:col*800+x,y:row*760+y,rotation:y<380?Math.PI:0 };
      if (cityZone(at)==='block' && f.width<=300 && f.height<=250) slots.push(at);
    }
  } else if (f.shape==='vehicle') {
    for (const y of cityRoads().horizontal.slice(1,-1)) for (let col=0;col<5;col++) for (const x of [250,550]) for (const side of [-1,1]) slots.push({x:col*800+x,y:y+side*44,rotation:side===1?0:Math.PI});
    for (const x of cityRoads().vertical.slice(1,-1)) for (let row=0;row<4;row++) for (const y of [230,530]) for (const side of [-1,1]) slots.push({x:x+side*44,y:row*760+y,rotation:side===1?Math.PI/2:-Math.PI/2});
  }
  return slots.filter(p=>p.x>f.radius && p.y>f.radius && p.x<EAT.match.width-f.radius && p.y<EAT.match.height-f.radius);
}
export function cityPropZone(kind: FoodKind, p: Vec) {
  const f=FOOD[kind], zone=cityZone(p);
  return f.spawnZone==='green' ? zone==='green'||zone==='sidewalk' : !f.building && f.shape!=='vehicle';
}
