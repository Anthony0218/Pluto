import { Container, Graphics } from "pixi.js";
import type { BoardMap, BoardNode } from "../../types.ts";
import { label } from "./common.ts";

// Mountain scenery (original placeholder art, drawn with Pixi primitives): an alpine sky, layered region
// shelves with a raised look, region props, and path styles that tell the terrain apart — stone trail,
// rope bridge over a gorge, mine rails, ice, and cliff ledge. Purely visual: the graph stays the source of
// truth and elevation never changes movement.

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix(a: number, b: number, t: number): number {
  const r = lerp((a >> 16) & 255, (b >> 16) & 255, t),
    g = lerp((a >> 8) & 255, (b >> 8) & 255, t),
    bl = lerp(a & 255, b & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
// Small deterministic generator so decoration is identical on every client and render.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type EdgeStyle = "trail" | "bridge" | "rail" | "ice" | "cliff";
const GROUND: Record<string, { top: number; edge: number }> = {
  village: { top: 0x9cbf75, edge: 0x5d7a48 },
  mine: { top: 0x93826f, edge: 0x584a40 },
  forest: { top: 0x5f9f68, edge: 0x315b3c },
  lake: { top: 0xc6ebf7, edge: 0x6a9fba },
  cave: { top: 0xa9d6f2, edge: 0x5686aa },
  cliff: { top: 0xaaa197, edge: 0x655c54 },
  summit: { top: 0xf5f9fc, edge: 0x9cb3c6 },
};

export function drawMountainScenery(world: Container, map: BoardMap) {
  const { width, height } = map.size;
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const motifOf = (n: BoardNode) => map.regions[n.region].motif;
  const edges: [BoardNode, BoardNode][] = [];
  for (const n of map.nodes)
    for (const id of n.connections) if (n.id < id) edges.push([n, byId.get(id)!]);
  // Distance from a point to the nearest space or path, used to keep props off the route.
  const segDist = (px: number, py: number, a: BoardNode, b: BoardNode) => {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
  };
  const free = (x: number, y: number, r = 34) =>
    x > 24 &&
    y > 24 &&
    x < width - 24 &&
    y < height - 24 &&
    map.nodes.every((n) => Math.hypot(n.x - x, n.y - y) > r) &&
    edges.every(([a, b]) => segDist(x, y, a, b) > r * 0.7);

  // --- Sky and distant peaks -------------------------------------------------------------------
  const sky = new Graphics();
  const bands = 44;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1),
      color = t < 0.55 ? mix(0xd6e8f5, 0x9fbdd2, t / 0.55) : mix(0x9fbdd2, 0x8fb57f, (t - 0.55) / 0.45);
    sky.rect(0, (height / bands) * i, width, height / bands + 1).fill(color);
  }
  world.addChild(sky);
  const peaks = new Graphics();
  const peak = (cx: number, base: number, w: number, h: number, shade: number) => {
    peaks.poly([cx - w / 2, base, cx, base - h, cx + w / 2, base]).fill({ color: shade, alpha: 0.75 });
    peaks
      .poly([cx - w * 0.13, base - h * 0.78, cx, base - h, cx + w * 0.13, base - h * 0.78, cx + w * 0.04, base - h * 0.7, cx - w * 0.05, base - h * 0.74])
      .fill({ color: 0xffffff, alpha: 0.9 });
  };
  peak(70, 420, 260, 300, 0xa6bccd);
  peak(1060, 400, 280, 320, 0xa6bccd);
  peak(160, 250, 200, 180, 0xb8cbdb);
  peak(980, 230, 220, 200, 0xb8cbdb);
  peak(560, 60, 300, 90, 0xc9d9e6);
  world.addChild(peaks);

  // --- Region shelves ----------------------------------------------------------------------------
  map.regions.forEach((region, index) => {
    const ground = GROUND[region.motif];
    if (!ground) return;
    const nodes = map.nodes.filter((n) => n.region === index);
    const xs = nodes.map((n) => n.x),
      ys = nodes.map((n) => n.y),
      cx = (Math.min(...xs) + Math.max(...xs)) / 2,
      cy = (Math.min(...ys) + Math.max(...ys)) / 2,
      rx = (Math.max(...xs) - Math.min(...xs)) / 2,
      ry = (Math.max(...ys) - Math.min(...ys)) / 2;
    const g = new Graphics();
    // Raised look: a dark lower face first, then the lit top.
    for (const [dy, color] of [[16, ground.edge], [8, mix(ground.edge, ground.top, 0.35)], [0, ground.top]] as const) {
      for (const n of nodes) g.circle(n.x, n.y + dy, 64).fill(color);
      if (region.motif !== "cliff") g.ellipse(cx, cy + dy, rx * 0.85 + 30, ry * 0.85 + 30).fill(color);
    }
    world.addChild(g);
  });
  // Gorge under the rope bridges (dark ravine) so the crossings read as chokepoints.
  const gorge = new Graphics();
  for (const [a, b] of edges)
    if (motifOf(a) === "bridge" || motifOf(b) === "bridge")
      gorge
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({ color: 0x27384a, width: 74, alpha: 0.5, cap: "round" })
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({ color: 0x13202e, width: 44, alpha: 0.55, cap: "round" });
  world.addChild(gorge);

  // --- Region props -------------------------------------------------------------------------------
  const rand = seeded(90210);
  const props = new Graphics();
  const pine = (x: number, y: number, s: number, dark = 0x2f6b45, light = 0x4a8f5c) => {
    props.rect(x - 2 * s, y + 8 * s, 4 * s, 7 * s).fill(0x6b4a2f);
    for (let i = 0; i < 3; i++)
      props
        .poly([x - (14 - i * 3) * s, y + (10 - i * 11) * s, x, y - (16 + i * 11) * s + 8 * s, x + (14 - i * 3) * s, y + (10 - i * 11) * s])
        .fill(i % 2 ? light : dark);
    props.poly([x - 4 * s, y - 20 * s, x, y - 34 * s, x + 4 * s, y - 20 * s]).fill({ color: 0xffffff, alpha: 0.85 });
  };
  const house = (x: number, y: number) => {
    props.ellipse(x, y + 16, 24, 6).fill({ color: 0x000000, alpha: 0.18 });
    props.rect(x - 16, y - 6, 32, 22).fill(0x8a5a3a).stroke({ color: 0x4d3120, width: 2 });
    props.poly([x - 21, y - 5, x, y - 24, x + 21, y - 5]).fill(0xb24a3c).stroke({ color: 0x5e241d, width: 2 });
    props.rect(x - 4, y + 4, 8, 12).fill(0x4d3120);
    props.circle(x + 10, y + 2, 3).fill(0xffe9a8); // warm lit window
    props.circle(x + 10, y + 2, 7).fill({ color: 0xffd36b, alpha: 0.28 });
  };
  const rocks = (x: number, y: number, s: number, color = 0x7f766e) => {
    props.poly([x - 14 * s, y + 8 * s, x - 7 * s, y - 10 * s, x + 4 * s, y - 14 * s, x + 15 * s, y + 8 * s]).fill(color).stroke({ color: 0x4b443f, width: 2 });
    props.poly([x - 7 * s, y - 10 * s, x + 4 * s, y - 14 * s, x + 6 * s, y - 6 * s, x - 2 * s, y - 4 * s]).fill({ color: 0xffffff, alpha: 0.55 });
  };
  const crystal = (x: number, y: number, s: number) => {
    props.poly([x, y - 26 * s, x + 8 * s, y - 4 * s, x, y + 6 * s, x - 8 * s, y - 4 * s]).fill(0x7fd0ff).stroke({ color: 0xe8fbff, width: 2 });
    props.poly([x, y - 26 * s, x + 8 * s, y - 4 * s, x, y - 2 * s]).fill({ color: 0xffffff, alpha: 0.5 });
  };
  const scatter = (motif: string, count: number, place: (x: number, y: number) => void) => {
    const region = map.regions.findIndex((r) => r.motif === motif),
      pool = map.nodes.filter((n) => n.region === region);
    if (!pool.length) return;
    for (let tries = 0, placed = 0; placed < count && tries < count * 40; tries++) {
      const n = pool[Math.floor(rand() * pool.length)],
        x = n.x + (rand() - 0.5) * 190,
        y = n.y + (rand() - 0.5) * 150;
      if (!free(x, y, 40)) continue;
      place(x, y);
      placed++;
    }
  };
  scatter("village", 4, (x, y) => house(x, y));
  scatter("village", 7, (x, y) => pine(x, y, 0.8));
  scatter("forest", 17, (x, y) => pine(x, y, 0.85 + rand() * 0.35, 0x24583a, 0x3f8452));
  scatter("mine", 7, (x, y) => rocks(x, y, 0.9 + rand() * 0.5, 0x6d645d));
  scatter("cliff", 8, (x, y) => rocks(x, y, 1 + rand() * 0.7));
  scatter("cave", 8, (x, y) => crystal(x, y, 0.9 + rand() * 0.6));
  scatter("lake", 4, (x, y) => props.ellipse(x, y, 20, 9).fill({ color: 0xffffff, alpha: 0.6 }));
  scatter("summit", 4, (x, y) => props.ellipse(x, y, 26, 10).fill({ color: 0xdbe8f2, alpha: 0.9 }));
  scatter("summit", 3, (x, y) => pine(x, y, 0.7, 0x476a6a, 0x658a86));
  // Mine: timbered tunnel mouths at the entrance and the exit, lanterns and a parked cart.
  const mineEnd = (n: BoardNode, dx: number) => {
    props.ellipse(n.x + dx, n.y - 8, 26, 22).fill(0x1e1a1a);
    props.rect(n.x + dx - 28, n.y - 30, 6, 40).fill(0x7a5535);
    props.rect(n.x + dx + 22, n.y - 30, 6, 40).fill(0x7a5535);
    props.rect(n.x + dx - 30, n.y - 34, 60, 7).fill(0x7a5535);
    props.circle(n.x + dx + 30, n.y - 20, 4).fill(0xffd166);
    props.circle(n.x + dx + 30, n.y - 20, 10).fill({ color: 0xffd166, alpha: 0.25 });
  };
  for (const transport of map.transports ?? [])
    if (transport.kind === "mine-cart") {
      mineEnd(byId.get(transport.endpoints[0])!, -46);
      mineEnd(byId.get(transport.endpoints[1])!, -46);
    }
  world.addChild(props);

  // Central peak on the Summit ring.
  const summit = map.regions.findIndex((r) => r.motif === "summit");
  if (summit >= 0) {
    const r = map.regions[summit],
      g = new Graphics();
    g.poly([r.x - 78, r.y + 42, r.x - 20, r.y - 36, r.x + 4, r.y - 44, r.x + 30, r.y - 26, r.x + 82, r.y + 42]).fill(0x8e9ba8).stroke({ color: 0x55616d, width: 3 });
    g.poly([r.x - 20, r.y - 36, r.x + 4, r.y - 44, r.x + 30, r.y - 26, r.x + 12, r.y - 14, r.x + 2, r.y - 24, r.x - 10, r.y - 12]).fill(0xffffff);
    g.moveTo(r.x + 4, r.y - 44).lineTo(r.x + 4, r.y - 68).stroke({ color: 0x4d3120, width: 3 });
    g.poly([r.x + 4, r.y - 68, r.x + 24, r.y - 61, r.x + 4, r.y - 54]).fill(0xd94f4f);
    world.addChild(g);
  }

  // --- Paths ---------------------------------------------------------------------------------------
  const styleOf = (a: BoardNode, b: BoardNode): EdgeStyle => {
    const ma = motifOf(a),
      mb = motifOf(b);
    if (ma === "bridge" || mb === "bridge") return "bridge";
    if (ma === "mine" && mb === "mine") return "rail";
    if ((ma === "lake" || ma === "cave") && (mb === "lake" || mb === "cave")) return "ice";
    if (ma === "cliff" && mb === "cliff") return "cliff";
    return "trail";
  };
  const paths = new Graphics();
  for (const [a, b] of edges) {
    const style = styleOf(a, b),
      length = Math.hypot(b.x - a.x, b.y - a.y),
      nx = (b.y - a.y) / length,
      ny = (a.x - b.x) / length;
    const line = (color: number, w: number, alpha = 1, ox = 0, oy = 0) =>
      paths.moveTo(a.x + ox, a.y + oy).lineTo(b.x + ox, b.y + oy).stroke({ color, width: w, alpha, cap: "round" });
    line(0x1c2a36, style === "bridge" ? 20 : 15, 0.28, 0, 4);
    if (style === "bridge") {
      line(0x6b4c33, 15);
      line(0xb58a5c, 12);
      for (let t = 0.04; t < 0.98; t += 8 / length)
        paths
          .moveTo(a.x + (b.x - a.x) * t - nx * 8, a.y + (b.y - a.y) * t - ny * 8)
          .lineTo(a.x + (b.x - a.x) * t + nx * 8, a.y + (b.y - a.y) * t + ny * 8)
          .stroke({ color: 0x6f5238, width: 2 });
      line(0xf1e3c4, 2, 0.9, nx * 9, ny * 9); // rope rails
      line(0xf1e3c4, 2, 0.9, -nx * 9, -ny * 9);
    } else if (style === "rail") {
      line(0x4c4038, 14);
      line(0x86766a, 11);
      for (let t = 0.05; t < 0.98; t += 10 / length)
        paths
          .moveTo(a.x + (b.x - a.x) * t - nx * 6, a.y + (b.y - a.y) * t - ny * 6)
          .lineTo(a.x + (b.x - a.x) * t + nx * 6, a.y + (b.y - a.y) * t + ny * 6)
          .stroke({ color: 0x5a3d26, width: 3 });
      line(0xc7ccd1, 2, 1, nx * 3.5, ny * 3.5);
      line(0xc7ccd1, 2, 1, -nx * 3.5, -ny * 3.5);
    } else if (style === "ice") {
      line(0x6ea6c4, 15);
      line(0xeaf8ff, 10);
      line(0xffffff, 3, 0.9, nx * 2, ny * 2);
    } else if (style === "cliff") {
      line(0x554d46, 12);
      line(0xd0c7bb, 8);
      for (let t = 0.1; t < 0.98; t += 20 / length)
        paths
          .circle(a.x + (b.x - a.x) * t + nx * 9, a.y + (b.y - a.y) * t + ny * 9, 2.4)
          .fill(0x6b4c33); // rope-railing posts on the drop side
    } else {
      line(0x6d5a3d, 14);
      line(0xe2d2ac, 9);
    }
  }
  world.addChild(paths);

  // --- Cable Car and Mine Cart overlays -----------------------------------------------------------
  const rides = new Graphics();
  for (const transport of map.transports ?? []) {
    const a = byId.get(transport.endpoints[0])!,
      b = byId.get(transport.endpoints[1])!;
    if (transport.kind === "cable-car") {
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2 + 60;
      rides.moveTo(a.x, a.y - 34).quadraticCurveTo(mx, my - 34, b.x, b.y - 34).stroke({ color: 0x2f3b47, width: 3 });
      rides.moveTo(a.x, a.y - 34).quadraticCurveTo(mx, my - 34, b.x, b.y - 34).stroke({ color: 0xffffff, width: 1, alpha: 0.6 });
      for (const [x, y] of [[a.x, a.y], [b.x, b.y]]) {
        rides.rect(x - 4, y - 42, 8, 30).fill(0x59636d).stroke({ color: 0x2f3b47, width: 2 });
        rides.circle(x, y - 36, 6).fill(0xd94f4f).stroke({ color: 0xffffff, width: 2 });
      }
      // Two parked gondolas along the line.
      for (const t of [0.32, 0.68]) {
        const u = 1 - t,
          gx = u * u * a.x + 2 * u * t * mx + t * t * b.x,
          gy = u * u * (a.y - 34) + 2 * u * t * (my - 34) + t * t * (b.y - 34);
        rides.moveTo(gx, gy).lineTo(gx, gy + 12).stroke({ color: 0x2f3b47, width: 2 });
        rides.roundRect(gx - 9, gy + 12, 18, 13, 3).fill(0xe25b4b).stroke({ color: 0xffffff, width: 2 });
      }
    } else {
      const dx = -34;
      rides
        .moveTo(a.x + dx, a.y)
        .lineTo(b.x + dx, b.y)
        .stroke({ color: 0xd9a441, width: 4 });
      rides
        .moveTo(a.x + dx, a.y)
        .lineTo(b.x + dx, b.y)
        .stroke({ color: 0x3a2a14, width: 1.5, alpha: 0.8 });
      const cx = a.x + dx,
        cy = (a.y + b.y) / 2;
      rides.poly([cx - 11, cy - 8, cx + 11, cy - 8, cx + 8, cy + 6, cx - 8, cy + 6]).fill(0x7a5a3a).stroke({ color: 0x2a1d10, width: 2 });
      rides.circle(cx - 6, cy + 9, 3.5).fill(0x2a1d10).circle(cx + 6, cy + 9, 3.5).fill(0x2a1d10);
    }
  }
  // Frozen Slide arrows along the forced path.
  for (const slide of map.slides ?? []) {
    const points = [slide.nodeId, ...slide.path].map((id) => byId.get(id)!);
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1],
        q = points[i],
        length = Math.hypot(q.x - p.x, q.y - p.y),
        ux = (q.x - p.x) / length,
        uy = (q.y - p.y) / length,
        mx = (p.x + q.x) / 2,
        my = (p.y + q.y) / 2;
      rides.moveTo(p.x + ux * 20, p.y + uy * 20).lineTo(q.x - ux * 20, q.y - uy * 20).stroke({ color: 0x2f8fd6, width: 4, alpha: 0.85 });
      rides
        .poly([mx + ux * 9, my + uy * 9, mx - ux * 6 - uy * 8, my - uy * 6 + ux * 8, mx - ux * 6 + uy * 8, my - uy * 6 - ux * 8])
        .fill(0x2f8fd6)
        .stroke({ color: 0xffffff, width: 1.5 });
    }
  }
  world.addChild(rides);

  // --- Region names --------------------------------------------------------------------------------
  for (const region of map.regions) {
    const text = label(region.name, region.x, region.y, 11, 0x24384a),
      w = region.name.length * 7.2 + 16,
      chip = new Graphics().roundRect(region.x - w / 2, region.y - 10, w, 20, 10).fill({ color: 0xffffff, alpha: 0.72 });
    world.addChild(chip, text);
  }
}
