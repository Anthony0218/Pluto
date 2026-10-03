import { treeGeometry } from './treeGeometry.ts';
import { EAT, FOOD, type FoodKind } from './config.ts';
import { consumptionDuration, largeSwallow, mouthOpening, mouthPosition, MOUTH } from './rules.ts';
import { playerRadius } from './config.ts';
import type { FoodObject, Player } from './types.ts';

/** Model height above its declared ground footprint (world units). */
export function objectHeight(kind: FoodKind): number {
  const f = FOOD[kind];
  switch (f.shape) {
    case 'building': return f.height * (kind === 'skyscraper' ? 2.2 : kind === 'officeTower' ? 1.7 : kind === 'windmill' ? 1.55 : kind === 'apartment' ? 1.1 : kind === 'mansion' ? .85 : .75) + f.underpassClearance * 1.15;
    case 'lamp': return 96;
    case 'meter': return 44;
    case 'mailbox': return 40;
    case 'scarecrow': return 72;
    case 'beehive': return 30;
    case 'campfire': return 26;
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

/** A tall heavy prop that tips over the lip swings its full height across the opening.
 * When that height is longer than the opening is wide, its top catches the far rim and
 * it bridges the hole instead of falling in. Trees use their own canopy rule. */
export const tooLongToSwallow = (p: Player, kind: FoodKind, time = 0) =>
  FOOD[kind].shape !== 'tree' && largeSwallow({ kind }) && objectHeight(kind) > mouthOpening(p, time);
/** Decided at capture (`fallWedge`); snapshots from before that field re-derive it. */
export const jamsInMouth = (p: Player, f: FoodObject, time = 0) => f.fallLean !== undefined ? !!f.fallWedge : (f.fallTip ?? 0) > .1 && tooLongToSwallow(p, f.kind, time);
/** Fall age (seconds) at which a too-long prop has leaned far enough to wedge against the far rim. */
export const jamAge = (f: Pick<FoodObject, 'kind'>) => consumptionDuration(f) * .3;

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
  const opening = playerRadius(p, time) * MOUTH.radius, lip = Math.max(0, opening - d);
  // The nearest remaining support is the outside lip. If the entire footprint
  // has lost support, gravity takes over without an invented tipping impulse.
  f.fallPivot = Math.min(extent, lip);
  f.fallTip = extent > .001 ? Math.max(0, 1 - lip / extent) : 0;
  // The prop drops where it entered. It only slides inward far enough for its
  // near edge to clear the lip, instead of being pulled to the mouth's center.
  // Wide footprints also keep their side corners inside the rim where they can.
  const tree = FOOD[f.kind].shape === 'tree', near = tree ? treeGeometry(f.kind).trunkRadius : extent;
  const side = tree ? 0 : Math.abs(-f.fallX * sin + f.fallY * cos) * FOOD[f.kind].width / 2 + Math.abs(f.fallX * cos + f.fallY * sin) * FOOD[f.kind].height / 2;
  delete f.fallLean; delete f.fallWedge; delete f.fallFar; delete f.fallHole;
  // A prop too tall to fit wedges ACROSS the whole mouth: its base slides onto the near
  // rim and it leans over the opening until its front face rests on the far rim.
  const wedge = !tree && f.fallTip > .1 && tooLongToSwallow(p, f.kind, time);
  const rest = wedge ? Math.max(0, opening - extent) : Math.min(d, Math.max(0, Math.sqrt(Math.max(0, (opening * .96) ** 2 - side ** 2)) - near));
  f.fallRestX = mouth.x - p.x - (d > .001 ? dx / d : 0) * rest;
  f.fallRestY = mouth.y - p.y - (d > .001 ? dy / d : 0) * rest;
  if (wedge) {
    f.fallWedge = true; f.fallPivot = Math.min(extent, opening - rest);
    f.fallLean = Math.max(.25, Math.acos(Math.min(1, (f.fallPivot + extent) / (2 * opening))));
  } else if (!tree && f.fallTip > .001) {
    // No fixed lean limit: `fallPose` keeps the prop's cut through the ground inside the
    // hole at every instant, so it can keep tumbling as it sinks. The hole is stored along
    // the fall axis: its far rim measured from the rest point, and its radius.
    f.fallLean = Math.PI; f.fallFar = opening + rest; f.fallHole = opening;
  }
}

/** Horizontal offset from the eater's center while a claimed prop falls (world axes). */
export function fallOffset(f: FoodObject, age: number) {
  // Wedges finish sliding onto the near rim by the jam age (30%).
  const span = FOOD[f.kind].shape === 'tree' ? EAT.eating.treeEntryDuration : consumptionDuration(f) * (f.fallWedge ? .3 : .4);
  const t = Math.max(0, Math.min(1, age / span)), ease = t * t * (3 - 2 * t);
  // Snapshots from before this change have no rest point and keep the old center pull.
  const rx = f.fallRestX ?? 0, ry = f.fallRestY ?? 0, ox = f.fallOffsetX ?? 0, oy = f.fallOffsetY ?? 0;
  return { x: ox + (rx - ox) * ease, y: oy + (ry - oy) * ease };
}
/** How far below the rim a prop ends up: deep enough that it vanishes into the pit's darkness. */
const pitDepth = (kind: FoodKind) => Math.min(600, Math.max(320, objectHeight(kind) + Math.hypot(FOOD[kind].width, FOOD[kind].height) + 200));

/** Deterministic rigid transform shared by authority and renderer. This is a
 * supported-edge approximation, not a general-purpose rigid-body solver. */
export function fallPose(f: FoodObject, age: number) {
  const t = Math.max(0, Math.min(1, age / consumptionDuration(f)));
  if (FOOD[f.kind].shape === 'tree') {
    const entry=Math.min(1,age/EAT.eating.treeEntryDuration), smooth=entry*entry*(3-2*entry);
    const finish=Math.max(0,(age-EAT.eating.treeEntryDuration)/(EAT.eating.treeAnimation-EAT.eating.treeEntryDuration));
    return {angle:0,shift:0,z:-(f.treeEntryDepth??objectHeight(f.kind)*.44)*smooth-pitDepth(f.kind)*Math.min(1,finish)**2};
  }
  if (f.fallWedge && t < .45) {
    // Too tall: it tips until its face rests on the far rim by the jam age (30%), without dropping.
    // The authority converts it into a choke there; the margin covers render-ahead interpolation.
    const lean = (f.fallLean ?? 0) * Math.sin(Math.min(1, t / .3) * Math.PI / 2) ** 2, pivot = f.fallPivot ?? 0;
    return { angle: lean, shift: pivot * (Math.cos(lean) - 1), z: -pivot * Math.sin(lean) };
  }
  // Tip over the lip, then keep tumbling while falling free (a symmetric drop stays level).
  // One continuous curve: the lean never pauses between the tip and the drop.
  const angle = tumble(f, t);
  // Snapshots from before the hole was stored keep the old fixed lean limit.
  if (f.fallFar === undefined || f.fallHole === undefined || angle <= 0) return tiltedPose(f, t, Math.min(angle, f.fallLean ?? Math.PI));
  const track = fallTrack(f, Math.min(1, t + SLIDE_LEAD)), at = Math.min(t * TRACK_STEPS, track.lean.length - 1), i = Math.min(Math.floor(at), track.lean.length - 2);
  const lean = track.lean[i] + (track.lean[i + 1] - track.lean[i]) * (at - i);
  // The slide only grows, and eases in `SLIDE_LEAD` before it is needed, so the prop backs
  // off the far rim once instead of chasing its fast-moving ground cut back and forth.
  let slide = 0;
  track.back.forEach((back, j) => {
    const ramp = Math.max(0, Math.min(1, 1 - (j / TRACK_STEPS - t) / SLIDE_LEAD));
    slide = Math.max(slide, back * ramp * ramp * (3 - 2 * ramp));
  });
  const pose = tiltedPose(f, t, lean);
  return { ...pose, shift: pose.shift - slide };
}

const TRACK_STEPS = 90, SLIDE_LEAD = .15, TURN_RATE = 5;
/** Lean (radians) at fall progress `t`: an accelerating tip that keeps turning while the prop sinks. */
const tumble = (f: FoodObject, t: number) => (f.fallTip ?? .65) * 2.4 * Math.sin(t ** .8 * Math.PI / 2) ** 2;
/** Pivot on the lip, then accelerate down: gravity carries even the tallest roof deep into the pit. */
function tiltedPose(f: FoodObject, t: number, lean: number) {
  const tip = f.fallTip ?? .65, release = tip * .32, falling = Math.max(0, (t - release) / (1 - release)), pivot = f.fallPivot ?? 0;
  const drop = Math.max(objectHeight(f.kind) + Math.hypot(FOOD[f.kind].width, FOOD[f.kind].height) + 24, pitDepth(f.kind)) * falling * falling + .6 * t * t;
  return { angle: lean, shift: pivot * (Math.cos(lean) - 1), z: -pivot * Math.sin(lean) - drop };
}
/** Steps the fall from capture to progress `until`: the lean follows `tumble` (at most
 * `TURN_RATE` rad per fall) while the prop's cut through the ground plane fits the hole,
 * and holds only while leaning further would not. `back` is how far each step must slide
 * toward the near rim to keep that cut inside the far rim. Footprints that fit by area but
 * not by shape keep their unavoidable overhang, centered on the hole instead. */
function fallTrack(f: FoodObject, until: number) {
  const duration = consumptionDuration(f), extent = footprintDepth(f), height = objectHeight(f.kind), turn = TURN_RATE / TRACK_STEPS;
  // Footprints that only fit by area may still tip a little (about 30 degrees) over both rims.
  const width = Math.max(2 * f.fallHole! - RIM_MARGIN, 2 * extent * 1.15), lean = [0], back = [0];
  const cutAt = (t: number, l: number) => { const pose = tiltedPose(f, t, l); return groundCut(extent, height, l, pose.shift, pose.z); };
  const fits = (t: number, l: number) => { const cut = cutAt(t, l); return !cut || cut[1] - cut[0] <= width; };
  for (let k = 1; k <= Math.ceil(until * TRACK_STEPS); k++) {
    const t = k / TRACK_STEPS, last = lean[k - 1], goal = tumble(f, t);
    const toward = Math.max(last - turn, Math.min(last + turn, goal)), next = toward <= last || fits(t, toward) ? toward : last;
    const offset = fallOffset(f, t * duration), cut = cutAt(t, next);
    const far = f.fallFar! - ((offset.x - (f.fallRestX ?? 0)) * (f.fallX ?? 0) + (offset.y - (f.fallRestY ?? 0)) * (f.fallY ?? 0));
    lean.push(next); back.push(cut ? Math.max(0, Math.min(cut[1] - (far - RIM_MARGIN), (cut[0] + cut[1]) / 2 - (far - f.fallHole!))) : 0);
  }
  if (lean.length < 2) { lean.push(lean[0]); back.push(back[0]); }
  return { lean, back };
}

/** Inset from the drawn rim, so the prop never grazes the ground at the lip. */
const RIM_MARGIN = 6;
/** Half the footprint measured along the fall axis. */
const footprintDepth = (f: FoodObject) => {
  const cos = Math.cos(f.rotation), sin = Math.sin(f.rotation), x = f.fallX ?? 0, y = f.fallY ?? 0;
  return Math.abs(x * cos + y * sin) * FOOD[f.kind].width / 2 + Math.abs(-x * sin + y * cos) * FOOD[f.kind].height / 2;
};
/** The [near, far] span where a box (half-depth `extent`, `height` tall), leaned by `lean`
 * toward the fall direction and moved by (shift, z), crosses ground level; null when it doesn't. */
function groundCut(extent: number, height: number, lean: number, shift: number, z: number): [number, number] | null {
  const c = Math.cos(lean), s = Math.sin(lean);
  const corners = [[-extent, 0], [extent, 0], [extent, height], [-extent, height]].map(([x, h]) => [x * c + h * s + shift, -x * s + h * c + z]);
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    if ((az > 0) === (bz > 0)) continue;
    const x = ax + (bx - ax) * az / (az - bz);
    low = Math.min(low, x); high = Math.max(high, x);
  }
  return low <= high ? [low, high] : null;
}
