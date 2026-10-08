import type { Campaign, District } from "../../../games/MedievalKingdoms/edravane/types.ts";
import { center, neighbors, NATIONS } from "../../../games/MedievalKingdoms/edravane/world.ts";

export function mapBounds(districts: District[], { includeLegacy = true } = {}) {
  const points = districts.filter((d) => d.biome === "legacy" ? includeLegacy : d.nation).map(center);
  const minX = Math.min(...points.map(([x]) => x)) - 55, maxX = Math.max(...points.map(([x]) => x)) + 55;
  const minY = Math.min(...points.map(([, y]) => y)) - 55, maxY = Math.max(...points.map(([, y]) => y)) + 55;
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY, center: [(minX + maxX) / 2, (minY + maxY) / 2] as [number, number] };
}

/** Labels derive from current control, including occupation, rather than original borders. */
export function territoryLayouts(state: Campaign, scope: "realm" | "house") {
  const houses = new Map(state.houses.map((h) => [h.id, h]));
  const groups = new Map<string, District[]>();
  for (const d of state.districts) {
    const house = houses.get(d.occupation ?? d.owner ?? "");
    if (!house || d.biome === "sea" || d.biome === "legacy") continue;
    const key = scope === "house" || house.rebellion ? house.id : house.nation;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return Array.from(groups, ([id, districts]) => {
    const house = houses.get(id) ?? houses.get(state.titles.find((t) => t.nation === id)?.holder ?? "") ?? state.houses.find((h) => h.nation === id && h.role === "crown")!;
    const unseen = new Set(districts.map((d) => d.id)), components: District[][] = [];
    for (const first of districts) {
      if (!unseen.delete(first.id)) continue;
      const queue = [first];
      for (let i = 0; i < queue.length; i++) for (const next of neighbors(state.districts, queue[i].id)) if (unseen.delete(next.id)) queue.push(next);
      components.push(queue);
    }
    components.sort((a, b) => b.length - a.length || a[0].id.localeCompare(b[0].id));
    // Saltmere's island crown remains the visual heart of its coastal realm.
    if (house.nation === "saltmere" && (scope === "realm" || house.role === "crown")) {
      const home = components.findIndex((component) => component.some((d) => d.biome === "island" && d.seat === "capital" && d.owner === house.id && !d.occupation));
      if (home > 0) components.unshift(...components.splice(home, 1));
    }
    const main = components[0], points = main.map(center);
    const mean = points.reduce(([x, y], [px, py]) => [x + px / points.length, y + py / points.length], [0, 0]);
    // Snap the center to an actual owned field: no sigils floating in a gulf or on a rival estate.
    const anchor = main.reduce((best, d) => {
      const distance = (tile: District) => { const [x, y] = center(tile); return Math.hypot(x - mean[0], y - mean[1]); };
      return distance(d) < distance(best) ? d : best;
    }, main[0]);
    const [x, y] = center(anchor);
    const covariance = points.reduce((sum, [px, py]) => sum + (px - mean[0]) * (py - mean[1]), 0);
    const spreadX = points.reduce((sum, [px]) => sum + (px - mean[0]) ** 2, 0), spreadY = points.reduce((sum, [, py]) => sum + (py - mean[1]) ** 2, 0);
    const angle = Math.max(-28, Math.min(28, Math.atan2(2 * covariance, spreadX - spreadY) * 90 / Math.PI));
    const radians = angle * Math.PI / 180;
    const projected = points.map(([px, py]) => (px - x) * Math.cos(radians) + (py - y) * Math.sin(radians));
    const extent = Math.max(...projected) - Math.min(...projected) + 40;
    const title = scope === "realm" && !house.rebellion ? NATIONS.find((n) => n.id === id)?.name ?? `House ${house.name}` : house.name;
    const fontSize = Math.max(scope === "realm" ? 11 : 8, Math.min(scope === "realm" ? 30 : 16, (scope === "realm" ? 10 : 6) + Math.sqrt(districts.length) * (scope === "realm" ? 1.8 : 1.3), extent / (title.length * .64)));
    // Extend the path enough for uppercase letters and tracking, so small island realms stay legible.
    const width = Math.max(extent, title.length * (fontSize * .78 + (scope === "realm" ? 1.4 : .6)) + 16);
    return { id, house, title, districts, components, anchor, x, y, angle, width, fontSize };
  });
}
