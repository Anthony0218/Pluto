import type { BoardNode, Region, TileType } from "../types.ts";

// Scenic optional loops keep the original routes, transports and event chokepoints intact.
export function expandBoard(nodes: BoardNode[], regions: Region[], prefix: string, perRegion: number): BoardNode[] {
  const expanded = nodes.map((n) => ({ ...n, connections: [...n.connections] }));
  const types: TileType[] = prefix === "mountain" ? ["coin", "item", "deposit", "coin"] : ["coin", "item", "deposit", "heal", "event", "coin"];
  for (let region = 0; region < regions.length; region++) {
    const original = expanded.filter((n) => n.region === region);
    const center = regions[region], loop: BoardNode[] = [];
    for (let i = 0; i < perRegion; i++) {
      const angle = i / perRegion * Math.PI * 2 - Math.PI / 2;
      loop.push({ id: `${prefix}-${nodes.length + region * perRegion + i}`, region, type: types[i % types.length],
        x: center.x + Math.cos(angle) * 66, y: center.y + Math.sin(angle) * 53, connections: [], plutoEligible: true });
    }
    // A side loop at the west bridge must not bypass an avalanche chokepoint.
    const exit = regions[region].motif === "bridge" ? 0 : prefix === "space" ? 7 : Math.floor(original.length / 2);
    const route = [original[prefix === "space" ? 2 : 0], ...loop, original[exit]];
    for (let i = 1; i < route.length; i++) { route[i - 1].connections.push(route[i].id); route[i].connections.push(route[i - 1].id); }
    expanded.push(...loop);
  }
  return expanded;
}
