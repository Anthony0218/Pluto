import { treeGeometry } from './treeGeometry.ts';
import { EAT, FOOD, type FoodKind } from './config.ts';
import { consumptionDuration, mouthPosition, MOUTH } from './rules.ts';
import { playerRadius } from './config.ts';
import type { FoodObject, Player } from './types.ts';

/** Model height above its declared ground footprint (world units). */
export function objectHeight(kind: FoodKind): number {
  const f = FOOD[kind];
  switch (f.shape) {
    case 'building': return f.height * (kind === 'apartment' ? 1.1 : .75) + f.underpassClearance * 1.15;
    case 'tree': return kind === 'bush' ? 36 : kind === 'smallTree' ? 85 : 150;
    case 'vehicle': return f.height * .7 + f.underpassClearance * 1.15;
    case 'pluto': return f.width;
    case 'sign': return 76;
    case 'machine': return 105;
    case 'flower': return 24;
    case 'pot': return 42;
    case 'chair': return 44;
    case 'bench': return 38;
    case 'table': return 44;
    case 'sofa': return 42;
    case 'bicycle': return f.height * 1.1;
    case 'bin': return f.height * .9;
    case 'barrel': return 48;
    case 'book': return 6;
    case 'coin': return 3;
    case 'leaf': return 3;
    case 'boat': return 34;
    case 'log': return 28;
    default: return Math.min(f.width, f.height) * .8;
  }
}

/** Freeze the unsupported side in world space. Turning the eater cannot reverse
 * the torque after capture. Symmetric loss of support produces a straight drop. */
export function beginFall(f: FoodObject, p: Player, time: number) {
  if (FOOD[f.kind].shape === 'tree') {
    const g=treeGeometry(f.kind), ratio=Math.min(1,playerRadius(p,time)*MOUTH.radius/Math.max(g.canopyX,g.canopyZ));
    f.treeEntryDepth=objectHeight(f.kind)*(.72-.28*Math.sqrt(1-ratio*ratio));
  }
  const mouth = mouthPosition(p, playerRadius(p, time));
  const dx = mouth.x - f.x, dy = mouth.y - f.y, d = Math.hypot(dx, dy);
  f.fallX = d > .001 ? dx / d : 0;
  f.fallY = d > .001 ? dy / d : 0;
  f.fallOffsetX = f.x - p.x; f.fallOffsetY = f.y - p.y;
  const cos = Math.cos(f.rotation), sin = Math.sin(f.rotation);
  const extent = Math.abs(f.fallX * cos + f.fallY * sin) * FOOD[f.kind].width / 2 +
    Math.abs(-f.fallX * sin + f.fallY * cos) * FOOD[f.kind].height / 2;
  const lip = Math.max(0, playerRadius(p, time) * MOUTH.radius - d);
  // The nearest remaining support is the outside lip. If the entire footprint
  // has lost support, gravity takes over without an invented tipping impulse.
  f.fallPivot = Math.min(extent, lip);
  f.fallTip = extent > .001 ? Math.max(0, 1 - lip / extent) : 0;
}

/** Deterministic rigid transform shared by authority and renderer. This is a
 * supported-edge approximation, not a general-purpose rigid-body solver. */
export function fallPose(f: FoodObject, age: number) {
  const t = Math.max(0, Math.min(1, age / consumptionDuration(f)));
  if (FOOD[f.kind].shape === 'tree') {
    const entry=Math.min(1,age/EAT.eating.treeEntryDuration), smooth=entry*entry*(3-2*entry);
    const finish=Math.max(0,(age-EAT.eating.treeEntryDuration)/(EAT.eating.treeAnimation-EAT.eating.treeEntryDuration));
    return {angle:0,shift:0,z:-(f.treeEntryDepth??objectHeight(f.kind)*.44)*smooth-(objectHeight(f.kind)+30)*finish*finish};
  }
  const tip = f.fallTip ?? .65;
  const angle = tip * 1.45 * Math.sin(t * Math.PI / 2) ** 2;
  const pivot = f.fallPivot ?? 0;
  const height = objectHeight(f.kind);
  // Zero scale changes: even the tallest roof is below the surface at completion.
  const release = tip * .32;
  const falling = Math.max(0, (t - release) / (1 - release));
  const drop = (height + Math.hypot(FOOD[f.kind].width, FOOD[f.kind].height) + 24) * falling * falling + .6 * t * t;
  return { angle, shift: pivot * (Math.cos(angle) - 1), z: -pivot * Math.sin(angle) - drop };
}
