import { Container, Graphics } from "pixi.js";
import type { BoardMap } from "../../types.ts";
import { label } from "./common.ts";

// Sunspill Islands scenery: sea, six islands with motifs, and the path/bridge network.
export function drawTropicalScenery(world: Container, map: BoardMap) {
  const sea = new Graphics();
  for (let i = 0; i < 90; i++) {
    const x = (i * 137) % 1120,
      y = (i * 89) % 800;
    sea
      .moveTo(x, y)
      .quadraticCurveTo(x + 8, y + 5, x + 17, y)
      .stroke({ color: 0x7cd7d9, width: 2, alpha: 0.24 });
  }
  world.addChild(sea);
  for (const island of map.regions) {
    const land = new Graphics();
    land
      .ellipse(island.x, island.y + 10, 165, 137)
      .fill({ color: 0x076a79, alpha: 0.5 });
    land
      .ellipse(island.x, island.y, 167, 134)
      .fill({ color: 0x71d6c5, alpha: 0.5 });
    land.ellipse(island.x, island.y, 153, 123).fill(0xf1d797);
    land.ellipse(island.x, island.y - 3, 137, 107).fill(island.color);
    land
      .ellipse(island.x - 26, island.y - 18, 73, 55)
      .fill({ color: 0xc3e39b, alpha: 0.2 });
    world.addChild(land);
    const decor = new Graphics();
    const x = island.x,
      y = island.y - 10;
    if (island.motif === "volcano") {
      decor
        .poly([x - 60, y + 30, x - 20, y - 48, x + 14, y - 48, x + 60, y + 30])
        .fill(0x756e77);
      decor
        .poly([
          x - 20,
          y - 48,
          x + 14,
          y - 48,
          x + 28,
          y - 12,
          x + 6,
          y - 24,
          x - 12,
          y - 10,
        ])
        .fill(0xff9471);
      decor.ellipse(x - 2, y - 47, 18, 6).fill(0x453f50);
      decor.circle(x + 1, y - 65, 10).fill({ color: 0xffe8d0, alpha: 0.55 });
    } else if (island.motif === "temple") {
      decor
        .rect(x - 42, y + 20, 84, 13)
        .fill(0x597e76)
        .rect(x - 31, y - 18, 62, 38)
        .fill(0xd0d6aa);
      decor.poly([x - 45, y - 18, x, y - 44, x + 45, y - 18]).fill(0xeee4b6);
      for (let i = -1; i <= 1; i++)
        decor.rect(x + i * 22 - 5, y - 12, 10, 32).fill(0x849c88);
    } else if (island.motif === "boat") {
      decor
        .poly([x - 46, y + 2, x + 48, y + 2, x + 30, y + 26, x - 28, y + 26])
        .fill(0x9f644d);
      decor
        .moveTo(x, y + 3)
        .lineTo(x, y - 50)
        .stroke({ color: 0x785a48, width: 5 });
      decor.poly([x + 5, y - 50, x + 5, y - 1, x + 44, y - 1]).fill(0xfff0c2);
    } else {
      for (const dx of [-34, 25]) {
        decor
          .moveTo(x + dx, y + 28)
          .quadraticCurveTo(x + dx + 10, y, x + dx, y - 25)
          .stroke({ color: 0x977050, width: 8 });
        for (let j = 0; j < 5; j++) {
          const a = (j * Math.PI * 2) / 5;
          decor
            .ellipse(x + dx + Math.cos(a) * 16, y - 25 + Math.sin(a) * 9, 22, 9)
            .fill(j % 2 ? 0x237d63 : 0x329f70);
        }
        decor.circle(x + dx, y - 22, 5).fill(0xe9b576);
      }
    }
    world.addChild(decor, label(island.name, island.x, island.y + 60, 11));
  }
  const paths = new Graphics();
  for (const node of map.nodes)
    for (const id of node.connections) {
      if (node.id >= id) continue;
      const other = map.nodes.find((n) => n.id === id)!;
      const bridge = node.region !== other.region;
      paths
        .moveTo(node.x, node.y + 3)
        .lineTo(other.x, other.y + 3)
        .stroke({
          color: bridge ? 0x125e64 : 0x438c6d,
          width: bridge ? 19 : 10,
          alpha: 0.6,
        });
      paths
        .moveTo(node.x, node.y)
        .lineTo(other.x, other.y)
        .stroke({
          color: bridge ? 0xc79560 : 0xf6e6b2,
          width: bridge ? 13 : 7,
        });
      if (bridge) {
        const length = Math.hypot(other.x - node.x, other.y - node.y),
          dx = ((other.y - node.y) / length) * 7,
          dy = ((node.x - other.x) / length) * 7;
        for (let t = 0.05; t < 0.97; t += 9 / length) {
          const x = node.x + (other.x - node.x) * t,
            y = node.y + (other.y - node.y) * t;
          paths
            .moveTo(x - dx, y - dy)
            .lineTo(x + dx, y + dy)
            .stroke({ color: 0x7d674a, width: 2 });
        }
      }
    }
  world.addChild(paths);
}
