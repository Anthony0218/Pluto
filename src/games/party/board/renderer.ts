import { Application, Container, Graphics, Text } from "pixi.js";
import { prefersReducedMotion, subscribePreferences } from "../client/preferences.ts";
import { ANIMAL_PHASE_FLOW, COLORS, RULES } from "../config.ts";
import { animalRegistry } from "../animals/registry.ts";
import { tilePresentationFor } from "../content/maps.ts";
import { blockedRoundsLeft } from "../engine/routes.ts";
import { transportRoundsOut } from "../engine/transport.ts";
import { drawScenery, THEMES } from "./scenery/index.ts";
import { ink, label } from "./scenery/common.ts";
import { activePlayer, legalPaths } from "../engine/engine.ts";
import { radiationRoundsLeft } from "../hazards/radiation.ts";
import type { AnimalInstance, BoardMap, Match } from "../types.ts";
const toxic = 0x7cff3a;
// Presentation-only description of a pending board-targeting choice (Comet Melon, Fallout Core).
export interface BoardOverlay {
  selected: string | null;
  damage: ReadonlyMap<string, number>;
  // Fallout Core preview: every node in the blast (centre + directly connected nodes).
  blast?: ReadonlySet<string>;
}
interface Explosion {
  view: Graphics;
  age: number;
  duration: number;
}
interface AnimalView {
  view: Container;
  lifetime: Text;
  x: number;
  y: number;
  // Waypoints still to walk (Animal Phase animation) and a start delay in ms.
  queue: { x: number; y: number; nodeId: string; hit: boolean }[];
  delay: number;
  stepMs: number;
  stepAge: number;
  from: { x: number; y: number } | null;
  despawn: boolean;
}
export class PartyRenderer {
  readonly map: BoardMap;
  private nodeById: Map<string, BoardMap["nodes"][number]>;
  constructor(map: BoardMap) {
    this.map = map;
    this.nodeById = new Map(map.nodes.map((n) => [n.id, n]));
  }
  // Animals sit below-right of a space so they never hide the pawns standing on it.
  private animalSpot(nodeId: string, index: number) {
    const node = this.nodeById.get(nodeId)!;
    return { x: node.x + 20 + index * 16, y: node.y + 18 };
  }
  app = new Application();
  world = new Container();
  pawns = new Map<string, { view: Container; x: number; y: number }>();
  highlights = new Graphics();
  elapsed = 0;
  plutos = new Container();
  plutoSignature = "";
  propertyLayer = new Container();
  propertySignature = "";
  overlayLabels = new Container();
  routeLayer = new Container();
  routeTopLayer = new Container();
  routeSignature = "";
  radiationLayer = new Container();
  radiationSignature = "";
  animalLayer = new Container();
  animals = new Map<string, AnimalView>();
  animalPhaseSeq = -1;
  explosions: Explosion[] = [];
  reduceMotion = false;
  private unsubscribePreferences: (() => void) | null = null;
  async init(host: HTMLElement, onSelect: (id: string) => void) {
    await this.app.init({
      width: this.map.size.width,
      height: this.map.size.height,
      background: THEMES[this.map.theme].background,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      preference: "webgl",
    });
    this.app.ticker.maxFPS = 45;
    this.app.canvas.setAttribute("role", "img");
    this.app.canvas.setAttribute(
      "aria-label",
      `${this.map.name}: ${this.map.nodes.length} connected spaces. Use the path buttons to choose a route.`,
    );
    // Device setting or the in-game override (Settings → Motion); followed live.
    this.reduceMotion = prefersReducedMotion();
    this.unsubscribePreferences = subscribePreferences(() => {
      this.reduceMotion = prefersReducedMotion();
    });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    drawScenery(this.world, this.map);
    const theme = THEMES[this.map.theme],
      presentation = tilePresentationFor(this.map);
    this.world.addChild(this.routeLayer, this.radiationLayer, this.highlights);
    for (const node of this.map.nodes) {
      const tile = new Container();
      tile.position.set(node.x, node.y);
      tile.eventMode = "static";
      tile.cursor = "pointer";
      tile.addChild(
        new Graphics()
          .circle(0, 3, 17)
          .fill(theme.nodeShadow)
          .circle(0, 0, 16)
          .fill(presentation[node.type].color)
          .stroke({ color: theme.nodeRing, width: 3 }),
      );
      const text = label(presentation[node.type].icon, 0, 0, 17);
      tile.addChild(text);
      // Mechanic badges (not colour alone): transport stations and Frozen Slide spaces.
      const station = this.map.transports?.find((t) => t.endpoints.includes(node.id)),
        slide = this.map.slides?.some((sl) => sl.nodeId === node.id);
      if (station || slide) {
        tile.addChild(
          new Graphics()
            .circle(-16, 15, 10)
            .fill(slide ? 0xd8f1ff : 0xfff1c7)
            .stroke({ color: slide ? 0x2f8fd6 : 0x8a5a1c, width: 2 }),
          label(station ? station.icon : "❄", -16, 15, 11, ink),
        );
      }
      tile.on("pointertap", () => onSelect(node.id));
      this.world.addChild(tile);
    }
    this.world.addChild(
      this.propertyLayer,
      this.routeTopLayer,
      this.overlayLabels,
      this.plutos,
      this.animalLayer,
    );
    this.app.ticker.add((ticker) => {
      this.elapsed += ticker.deltaMS;
      for (const explosion of this.explosions) {
        explosion.age += ticker.deltaMS;
        const t = Math.min(1, explosion.age / explosion.duration);
        explosion.view.scale.set(this.reduceMotion ? 1 : 0.2 + t * 1.3);
        explosion.view.alpha = 1 - t;
      }
      this.explosions = this.explosions.filter((explosion) => {
        if (explosion.age < explosion.duration) return true;
        explosion.view.destroy();
        return false;
      });
      this.stepAnimals(ticker.deltaMS);
      this.radiationLayer.alpha = this.reduceMotion
        ? 1
        : 0.8 + Math.sin(this.elapsed / 260) * 0.2;
      for (const pawn of this.pawns.values()) {
        const f = this.reduceMotion ? 1 : 1 - Math.exp(-ticker.deltaMS / 75);
        pawn.view.x += (pawn.x - pawn.view.x) * f;
        pawn.view.y += (pawn.y - pawn.view.y) * f;
        pawn.view.scale.y = this.reduceMotion
          ? 1
          : 1 + Math.sin(this.elapsed / 330 + pawn.x) * 0.025;
      }
      this.plutos.alpha = this.reduceMotion
        ? 1
        : 0.88 + Math.sin(this.elapsed / 350) * 0.12;
      this.highlights.alpha = this.reduceMotion
        ? 1
        : 0.7 + Math.sin(this.elapsed / 180) * 0.3;
    });
  }
  // Owner colour ring plus a numeric level badge, so ownership never relies on colour alone.
  private drawProperties(state: Match) {
    const signature = state.properties
      .map((p) => `${p.ownerPlayerId}:${p.level}`)
      .join(",");
    if (signature === this.propertySignature) return;
    this.propertySignature = signature;
    this.propertyLayer.removeChildren().forEach((child) => child.destroy());
    for (const property of state.properties) {
      const node = this.nodeById.get(property.nodeId)!,
        owner = state.players.find((p) => p.id === property.ownerPlayerId),
        view = new Container();
      view.position.set(node.x, node.y);
      view.eventMode = "none";
      const color = owner
        ? Number(COLORS[owner.avatarId].replace("#", "0x"))
        : 0x7d8a99;
      view.addChild(
        new Graphics()
          .circle(0, 0, 21)
          .stroke({
            color: 0x194c56,
            width: owner ? 8 : 3,
            alpha: owner ? 1 : 0.5,
          })
          .circle(0, 0, 21)
          .stroke({ color, width: owner ? 5 : 2 }),
      );
      if (owner) {
        view.addChild(
          new Graphics()
            .roundRect(-16, 14, 32, 15, 7)
            .fill(0xfff7df)
            .stroke({ color: 0x194c56, width: 2 }),
          label(`LV ${property.level}`, 0, 21.5, 10),
        );
      } else view.addChild(label("OPEN", 0, 25, 9, 0x5b6a78));
      this.propertyLayer.addChild(view);
    }
  }
  explode(nodeId: string, kind: "melon" | "fallout" | "bite" = "melon") {
    const node = this.nodeById.get(nodeId);
    if (!node || !this.app.renderer) return;
    const view = new Graphics();
    if (kind === "fallout")
      view
        .circle(0, 0, 150)
        .fill({ color: toxic, alpha: 0.4 })
        .circle(0, 0, 150)
        .stroke({ color: 0x1d5b12, width: 10 })
        .circle(0, 0, 60)
        .fill({ color: 0xf6ff9e, alpha: 0.9 });
    else if (kind === "bite")
      view
        .circle(0, 0, 30)
        .fill({ color: 0xff3b3b, alpha: 0.45 })
        .circle(0, 0, 30)
        .stroke({ color: 0xffffff, width: 5 });
    else
      view
        .circle(0, 0, 60)
        .fill({ color: 0xffb347, alpha: 0.55 })
        .circle(0, 0, 60)
        .stroke({ color: 0xff5a3c, width: 8 })
        .circle(0, 0, 28)
        .fill({ color: 0xfff1a8, alpha: 0.9 });
    view.position.set(node.x, node.y);
    view.eventMode = "none";
    this.world.addChild(view);
    const base = kind === "fallout" ? 1300 : kind === "bite" ? 500 : 750;
    this.explosions.push({ view, age: 0, duration: this.reduceMotion ? 400 : base });
  }
  // Irradiated spaces: toxic glow + hazard ring + ☢ symbol + rounds-left badge (never colour alone).
  private drawRadiation(state: Match) {
    const signature = `${state.round}:${state.radiationZones.map((z) => `${z.id}:${z.nodeIds.join("+")}`).join(",")}`;
    if (signature === this.radiationSignature) return;
    this.radiationSignature = signature;
    this.radiationLayer.removeChildren().forEach((child) => child.destroy());
    const nodes = new Set(state.radiationZones.flatMap((z) => z.nodeIds));
    for (const id of nodes) {
      const node = this.nodeById.get(id);
      if (!node) continue;
      const view = new Container();
      view.position.set(node.x, node.y);
      view.eventMode = "none";
      const glow = new Graphics()
        .circle(0, 0, 31)
        .fill({ color: toxic, alpha: 0.35 })
        .circle(0, 0, 25)
        .stroke({ color: 0x1b3b10, width: 6 })
        .circle(0, 0, 25)
        .stroke({ color: 0xe8ff3a, width: 3 });
      // Hazard ticks around the ring.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        glow
          .moveTo(Math.cos(a) * 28, Math.sin(a) * 28)
          .lineTo(Math.cos(a) * 34, Math.sin(a) * 34)
          .stroke({ color: 0x1b3b10, width: 3 });
      }
      const rounds = radiationRoundsLeft(state, id);
      view.addChild(
        glow,
        new Graphics().circle(-20, -22, 11).fill(0xe8ff3a).stroke({ color: 0x1b3b10, width: 2 }),
        label("☢", -20, -22, 14, 0x1b3b10),
        new Graphics().roundRect(8, -32, 26, 15, 7).fill(0x1b3b10),
        label(`${rounds}R`, 21, -24.5, 10, 0xe8ff3a),
      );
      this.radiationLayer.addChild(view);
    }
  }
  // Avalanche closures (snow pile, hazard tape, warning sign, rounds left) and closed transports. Redrawn
  // only when the set of closures or the round changes.
  private drawRoutes(state: Match) {
    const signature = `${state.round}|${state.blockedConnections.map((b) => b.id).join(",")}|${state.transportOutages
      .map((o) => `${o.transportId}:${o.expiresAfterRound}`)
      .join(",")}`;
    if (signature === this.routeSignature) return;
    this.routeSignature = signature;
    this.routeLayer.removeChildren().forEach((child) => child.destroy());
    this.routeTopLayer.removeChildren().forEach((child) => child.destroy());
    for (const block of state.blockedConnections) {
      const a = this.nodeById.get(block.fromNodeId),
        b = this.nodeById.get(block.toNodeId);
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2,
        length = Math.hypot(b.x - a.x, b.y - a.y),
        ux = (b.x - a.x) / length,
        uy = (b.y - a.y) / length;
      // Hazard tape over the whole connection.
      const tape = new Graphics()
        .moveTo(a.x + ux * 18, a.y + uy * 18)
        .lineTo(b.x - ux * 18, b.y - uy * 18)
        .stroke({ color: 0x2b2b2b, width: 17, alpha: 0.85, cap: "round" });
      for (let d = 22; d < length - 22; d += 12)
        tape
          .moveTo(a.x + ux * d, a.y + uy * d)
          .lineTo(a.x + ux * Math.min(d + 6, length - 22), a.y + uy * Math.min(d + 6, length - 22))
          .stroke({ color: 0xffc933, width: 11 });
      const pile = new Graphics()
        .ellipse(mx, my + 8, 30, 15)
        .fill({ color: 0x1c2a36, alpha: 0.3 })
        .poly([mx - 30, my + 8, mx - 14, my - 12, mx + 4, my - 18, mx + 22, my - 8, mx + 32, my + 8])
        .fill(0xf4f8fb)
        .stroke({ color: 0x8fa7ba, width: 2 })
        .poly([mx + 4, my - 18, mx + 22, my - 8, mx + 32, my + 8, mx + 8, my + 8])
        .fill({ color: 0xc7d7e4, alpha: 0.9 });
      for (const [dx, dy, r] of [[-20, 6, 5], [12, 10, 6], [26, 3, 4], [-6, -6, 4]])
        pile.circle(mx + dx, my + dy, r).fill(0x7c736b).stroke({ color: 0x4b443f, width: 1.5 });
      this.routeLayer.addChild(tape, pile);
      const left = blockedRoundsLeft(state, block),
        text = `BLOCKED — ${left} ROUND${left === 1 ? "" : "S"}`,
        w = text.length * 6.4 + 14,
        top = new Container();
      top.position.set(mx, my);
      top.addChild(
        new Graphics()
          .poly([0, -52, 15, -28, -15, -28])
          .fill(0xffc933)
          .stroke({ color: 0x2b2b2b, width: 3 })
          .moveTo(0, -28)
          .lineTo(0, -21)
          .stroke({ color: 0x6b4c33, width: 3 }),
        label("!", 0, -37, 14, 0x2b2b2b),
        new Graphics()
          .roundRect(-w / 2, 46, w, 18, 9)
          .fill(0x2b2b2b)
          .stroke({ color: 0xffc933, width: 2 }),
        label(text, 0, 55, 10, 0xffe27a),
      );
      top.eventMode = "none";
      this.routeTopLayer.addChild(top);
    }
    for (const outage of state.transportOutages) {
      const transport = this.map.transports?.find((t) => t.id === outage.transportId);
      if (!transport) continue;
      const left = transportRoundsOut(state, transport.id);
      for (const id of transport.endpoints) {
        const node = this.nodeById.get(id)!,
          view = new Container();
        view.position.set(node.x, node.y);
        view.eventMode = "none";
        view.addChild(
          new Graphics().roundRect(-31, -42, 62, 16, 8).fill(0xb3261e).stroke({ color: 0xffffff, width: 2 }),
          label(`CLOSED ${left}R`, 0, -34, 9, 0xffffff),
        );
        this.routeTopLayer.addChild(view);
      }
    }
  }
  private createAnimalView(animal: AnimalInstance, state: Match): AnimalView {
    const owner = state.players.find((p) => p.id === animal.ownerPlayerId);
    const ownerColor = owner ? Number(COLORS[owner.avatarId].replace("#", "0x")) : 0xffffff;
    const view = new Container();
    view.eventMode = "none";
    // Diamond badge with owner-coloured frame: clearly not a pawn.
    view.addChild(
      new Graphics()
        .ellipse(0, 17, 14, 4)
        .fill({ color: ink, alpha: 0.3 })
        .poly([0, -17, 17, 0, 0, 17, -17, 0])
        .fill(0x3a2b1a)
        .stroke({ color: ownerColor, width: 4 }),
      label(animalRegistry.get(animal.type).icon, 0, 0, 17, 0xffffff),
      new Graphics().circle(-15, -13, 7).fill(ownerColor).stroke({ color: 0xffffff, width: 1.5 }),
      label(String((owner?.avatarId ?? 0) + 1), -15, -13, 9, 0xffffff),
    );
    const badge = new Graphics().roundRect(5, 9, 20, 13, 6).fill(0xfff7df).stroke({ color: ink, width: 1.5 });
    const lifetime = label(String(animal.remainingRounds), 15, 15.5, 9);
    view.addChild(badge, lifetime);
    this.animalLayer.addChild(view);
    return { view, lifetime, x: 0, y: 0, queue: [], delay: 0, stepMs: 300, stepAge: 0, from: null, despawn: false };
  }
  // Animal entities follow authoritative state; a new Animal Phase replays each recorded path in order.
  private drawAnimals(state: Match) {
    const phase = state.animalPhase;
    const replay = phase && phase.sequence !== this.animalPhaseSeq && this.animalPhaseSeq !== -1;
    if (phase) this.animalPhaseSeq = phase.sequence;
    else if (this.animalPhaseSeq === -1) this.animalPhaseSeq = 0;
    const perNode = new Map<string, number>();
    const spot = (nodeId: string) => {
      const index = perNode.get(nodeId) ?? 0;
      perNode.set(nodeId, index + 1);
      return this.animalSpot(nodeId, index);
    };
    const present = new Set<string>();
    for (const animal of [...state.animals].sort((a, b) => a.sequence - b.sequence)) {
      present.add(animal.id);
      let entry = this.animals.get(animal.id);
      const target = spot(animal.currentNodeId);
      if (!entry) {
        entry = this.createAnimalView(animal, state);
        const start = replay ? phase!.steps.find((s) => s.animalId === animal.id)?.fromNodeId : undefined;
        const at = start ? this.animalSpot(start, 0) : target;
        entry.view.position.set(at.x, at.y);
        entry.x = at.x;
        entry.y = at.y;
        this.animals.set(animal.id, entry);
      }
      entry.lifetime.text = String(animal.remainingRounds);
      if (!replay && !entry.queue.length) {
        entry.x = target.x;
        entry.y = target.y;
      }
    }
    if (replay)
      phase!.steps.forEach((step, i) => {
        const entry = this.animals.get(step.animalId);
        if (!entry) return;
        const hitNodes = new Set(step.hits.map((h) => h.nodeId));
        entry.delay = i * ANIMAL_PHASE_FLOW.perAnimalMs * 0.8;
        entry.stepMs = Math.min(320, (ANIMAL_PHASE_FLOW.perAnimalMs * 0.7) / Math.max(1, step.path.length));
        entry.queue = step.path.map((nodeId) => ({
          ...this.animalSpot(nodeId, 0),
          nodeId,
          hit: hitNodes.has(nodeId),
        }));
        if (hitNodes.has(step.fromNodeId))
          entry.queue.unshift({ ...this.animalSpot(step.fromNodeId, 0), nodeId: step.fromNodeId, hit: true });
        entry.despawn = step.despawned;
        entry.from = null;
        entry.stepAge = 0;
      });
    // Removed animals disappear immediately unless they still have a despawn walk to finish.
    for (const [id, entry] of this.animals)
      if (!present.has(id) && !entry.despawn) {
        entry.view.destroy();
        this.animals.delete(id);
      }
  }
  private stepAnimals(deltaMS: number) {
    for (const [id, entry] of this.animals) {
      if (entry.queue.length) {
        if (entry.delay > 0) {
          entry.delay -= deltaMS;
          continue;
        }
        const next = entry.queue[0];
        if (this.reduceMotion) {
          entry.view.position.set(next.x, next.y);
          entry.queue.shift();
          if (next.hit) this.explode(next.nodeId, "bite");
          continue;
        }
        entry.from ??= { x: entry.view.x, y: entry.view.y };
        entry.stepAge += deltaMS;
        const t = Math.min(1, entry.stepAge / entry.stepMs);
        entry.view.x = entry.from.x + (next.x - entry.from.x) * t;
        entry.view.y = entry.from.y + (next.y - entry.from.y) * t - Math.sin(t * Math.PI) * 8;
        if (t >= 1) {
          entry.queue.shift();
          entry.from = null;
          entry.stepAge = 0;
          if (next.hit) this.explode(next.nodeId, "bite");
          if (!entry.queue.length) {
            entry.x = next.x;
            entry.y = next.y;
          }
        }
        continue;
      }
      if (entry.despawn) {
        entry.view.alpha -= deltaMS / 600;
        entry.view.scale.set(Math.max(0.1, entry.view.alpha));
        if (entry.view.alpha <= 0) {
          entry.view.destroy();
          this.animals.delete(id);
        }
        continue;
      }
      const f = this.reduceMotion ? 1 : 1 - Math.exp(-deltaMS / 90);
      entry.view.x += (entry.x - entry.view.x) * f;
      entry.view.y += (entry.y - entry.view.y) * f;
    }
  }
  update(state: Match | null, overlay: BoardOverlay | null = null) {
    this.highlights.clear();
    this.overlayLabels.removeChildren().forEach((child) => child.destroy());
    if (overlay)
      for (const node of this.map.nodes) {
        const damage = overlay.damage.get(node.id) ?? 0,
          selected = node.id === overlay.selected;
        if (overlay.blast) {
          const inBlast = overlay.blast.has(node.id);
          // Every space is tappable (thin ring); blast spaces get a thick dark ring over a toxic fill.
          this.highlights
            .circle(node.x, node.y, selected ? 32 : inBlast ? 29 : 22)
            .fill({ color: inBlast ? toxic : 0xffffff, alpha: inBlast ? 0.75 : 0.22 })
            .stroke({
              color: inBlast ? 0x1b3b10 : 0xffe27a,
              width: selected ? 8 : inBlast ? 6 : 3,
            });
          if (inBlast)
            this.highlights
              .circle(node.x, node.y, selected ? 24 : 21)
              .stroke({ color: 0xe8ff3a, width: 3 });
          if (inBlast)
            this.overlayLabels.addChild(
              label(selected ? "☢ CENTRE" : "☢", node.x, node.y + 33, selected ? 13 : 16, 0x1b3b10),
            );
          continue;
        }
        this.highlights
          .circle(node.x, node.y, selected ? 30 : 23)
          .fill({
            color: damage ? 0xff7a59 : 0xffffff,
            alpha: damage ? 0.3 + damage / 40 : 0.22,
          })
          .stroke({
            color: selected ? 0xd7263d : 0xffe27a,
            width: selected ? 6 : 3,
          });
        if (damage)
          this.overlayLabels.addChild(
            label(`-${damage}`, node.x, node.y + 31, 20, 0xa3200f),
          );
      }
    if (!state) return;
    this.drawProperties(state);
    this.drawRoutes(state);
    this.drawRadiation(state);
    this.drawAnimals(state);
    const signature = state.plutoNodeIds.join(",");
    if (signature !== this.plutoSignature) {
      this.plutoSignature = signature;
      this.plutos.removeChildren().forEach((child) => child.destroy());
      for (const id of state.plutoNodeIds) {
        const node = this.nodeById.get(id)!;
        const marker = new Container();
        marker.position.set(node.x, node.y);
        marker.eventMode = "none";
        marker.addChild(
          new Graphics()
            .circle(0, 0, 28)
            .fill({ color: 0xffe579, alpha: 0.3 })
            .circle(0, 0, 21)
            .stroke({ color: 0xfff3a6, width: 4 })
            .ellipse(0, -36, 24, 11)
            .stroke({ color: 0xffda61, width: 2 })
            .circle(0, -36, 15)
            .fill(0xffcc50)
            .stroke({ color: 0xfff3b0, width: 2 })
            .circle(-5, -38, 2)
            .fill(ink)
            .circle(5, -38, 2)
            .fill(ink)
            .moveTo(-4, -31)
            .quadraticCurveTo(0, -27, 4, -31)
            .stroke({ color: ink, width: 1.5 }),
        );
        marker.addChild(label(String(RULES.plutoPrice), 0, -61, 12, 0xfff5c9));
        this.plutos.addChild(marker);
      }
    }
    if (state.phase === "PATH_SELECTION")
      for (const id of legalPaths(state, this.map)) {
        const node = this.nodeById.get(id)!;
        this.highlights
          .circle(node.x, node.y, 25)
          .fill({ color: 0xffffff, alpha: 0.35 })
          .stroke({ color: 0xffffff, width: 4 });
      }
    for (const player of state.players) {
      const node = this.nodeById.get(player.currentNodeId)!;
      const peers = state.players.filter((p) => p.currentNodeId === node.id),
        index = peers.findIndex((p) => p.id === player.id);
      const x = node.x + (index - (peers.length - 1) / 2) * 19,
        y = node.y - 28;
      let pawn = this.pawns.get(player.id);
      if (!pawn) {
        const view = new Container();
        view.position.set(x, y);
        const color = Number(COLORS[player.avatarId].replace("#", "0x"));
        const body = new Graphics()
          .ellipse(0, 22, 13, 5)
          .fill({ color: 0x194c56, alpha: 0.3 })
          .roundRect(-11, -8, 22, 29, 9)
          .fill(color)
          .stroke({ color: 0xfff7df, width: 2 })
          .circle(-4, 1, 2)
          .fill(ink)
          .circle(4, 1, 2)
          .fill(ink);
        body
          .moveTo(-3, 8)
          .quadraticCurveTo(0, 12, 4, 8)
          .stroke({ color: ink, width: 1.5 });
        view.addChild(
          body,
          label(String(player.avatarId + 1), 0, -18, 11, 0xffffff),
        );
        this.world.addChild(view);
        pawn = { view, x, y };
        this.pawns.set(player.id, pawn);
      }
      pawn.x = x;
      pawn.y = y;
      pawn.view.alpha = player.id === activePlayer(state).id ? 1 : 0.83;
    }
  }
  destroy() {
    this.unsubscribePreferences?.();
    this.unsubscribePreferences = null;
    this.app.destroy(true, { children: true });
  }
}
