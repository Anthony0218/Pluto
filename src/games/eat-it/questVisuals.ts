import { playerRadius } from './config.ts';
import { encounterScale, questScale } from './scaling.ts';
import { ridePose } from './escape.ts';
import type { AnimalKind } from './types.ts';
import * as T from 'three';
import { ModelLibrary } from './models.ts';
import { handPose } from './quests.ts';
import { clamp } from './maps.ts';
import type { GameState } from './types.ts';

export function animalModel(library: ModelLibrary, kind: AnimalKind) {
    const group = new T.Group(), part = library.part.bind(library), cat = kind === 'cat';
    library.finish(part(group, 'ball', cat ? '#e8bb88' : '#a7b8cf', 0, 15, 0, cat ? 22 : 17, 15, 13), cat ? '#e8bb88' : '#a7b8cf', cat ? 'fur' : 'feather');
    part(group, 'ball', cat ? '#f3d3a7' : '#b6cdd7', 13, 27, 0, 12, 12, 12);
    for (const side of [-1, 1]) {
      const wing = part(group, cat ? 'cone' : 'ball', cat ? '#d59e7b' : '#7c93b2', cat ? 13 : -3, cat ? 39 : 17, side * (cat ? 7 : 14), cat ? 5 : 14, cat ? 12 : 4, cat ? 5 : 10);
      wing.name = 'wing';
      library.finish(wing, cat ? '#d59e7b' : '#7c93b2', cat ? 'fur' : 'feather');
      const eye = part(group, 'ball', '#263746', 22, 31, side * 7, 3, 4, 3); eye.name = 'eye';
      part(group, 'ball', '#fffbea', 24, 33, side * 7, 1, 1.3, 1);
      part(group, 'cylinder', cat ? '#f3d3a7' : '#dbad76', side * 10, 5, 0, 3, 10, 3);
    }
    if (cat) {
      for (const child of group.children) child.position.y += 8;
      for (const x of [-1, 1]) for (const z of [-1, 1]) { const leg = part(group, 'cylinder', '#d59e7b', x * 13, 9, z * 10, 4, 18, 4); leg.name = 'leg'; }
      const tail = part(group, 'cylinder', '#d59e7b', -25, 23, 0, 3, 25, 3); tail.rotation.z = -.7;
      for (const side of [-1, 1]) {
        part(group, 'ball', '#fff0d6', 23, 32, side * 3, 4, 3, 4);
        const innerEar = part(group, 'cone', '#dc9f9c', 15, 47, side * 7, 2.5, 7, 2.5);
        innerEar.rotation.z = -.1;
        for (const offset of [-1, 1]) {
          const whisker = part(group, 'box', '#f8eedb', 24, 32 + offset, side * 8, .6, .6, 11);
          whisker.rotation.x = side * offset * .16;
        }
      }
      part(group, 'ball', '#ba817b', 27, 33, 0, 2, 1.6, 2);
    } else {
      const beak = part(group, 'cone', '#e4b366', 26, 25, 0, 4, 10, 4); beak.rotation.z = -Math.PI / 2;
      library.finish(part(group, 'ball', '#80a6a0', 10, 19, 0, 12, 4, 12), '#729f99', 'feather');
      for (const side of [-1, 1]) {
        for (const x of [-5, 2]) part(group, 'ball', '#465d7b', x, 19, side * 20, 2, 2.5, 5);
        for (const toe of [-1, 0, 1]) part(group, 'box', '#cd9277', side * 10 + 3, 1, toe * 2, 8, 1.5, 1.4);
      }
      const tail = part(group, 'ball', '#6b809d', -19, 14, 0, 12, 3, 8);
      library.finish(tail, '#6b809d', 'feather');
    }
    return group;
}

/** A bounded set of reusable meshes, updated in the existing animation loop. */
export class QuestVisuals {
  private npc = new T.Group();
  private item = new T.Group();
  private shrine = new T.Group();
  private arms = new Map<string, T.Group>();
  private initialized = false;
  private rides = new Map<string, T.Group>();
  private npcScale = 1;
  constructor(privateScene: T.Scene, library: ModelLibrary) { this.scene = privateScene; this.lib = library; }
  private scene: T.Scene;
  private lib: ModelLibrary;
  private build(s: GameState) {
    const e = s.encounter!;
    const part = this.lib.part.bind(this.lib); this.npc = animalModel(this.lib, e.npc.kind);
    if (e.item.kind === 'scroll') {
      const paper = part(this.item, 'cylinder', '#ffdf7f', 0, 10, 0, 6, 24, 6); paper.rotation.z = Math.PI / 2;
      for (const side of [-1, 1]) { const roll = part(this.item, 'cylinder', '#b98934', side * 12, 10, 0, 7, 3, 7); roll.rotation.z = Math.PI / 2; }
      part(this.item, 'box', '#cc735a', 0, 10, 0, 3, 13, 13);
    } else {
      part(this.item, 'box', '#a19bbd', 0, 2, 0, 25, 4, 22);
      part(this.item, 'cylinder', '#e4c292', 0, 17, 0, 4, 30, 4);
      part(this.item, 'box', '#c6b6dc', 0, 32, 0, 24, 5, 20);
      part(this.item, 'ball', '#efe1cb', 9, 22, 0, 4, 4, 4);
    }
    if (e.shrine) {
      part(this.shrine, 'box', '#b0aaa0', 0, 4, 0, 104, 8, 90);
      part(this.shrine, 'box', '#af7456', 0, 34, 0, 64, 58, 53);
      part(this.shrine, 'box', '#534f53', 0, 70, 0, 106, 10, 77);
      for (const side of [-1, 1]) {
        part(this.shrine, 'cylinder', '#c86b50', side * 43, 42, 30, 5, 76, 5);
        const roof = part(this.shrine, 'box', '#686462', side * 26, 82, 0, 60, 8, 80); roof.rotation.z = side * -.2;
      }
      part(this.shrine, 'box', '#c86b50', 0, 85, 30, 122, 8, 12);
      part(this.shrine, 'box', '#eac67a', 0, 41, 28, 22, 24, 2);
      this.shrine.position.set(e.shrine.x, 0, e.shrine.y);
    }
    this.scene.add(this.npc, this.item, this.shrine); this.initialized = true;
  }
  draw(s: GameState, viewerRadius = 24) {
    const e = s.encounter;
    for (const p of s.players) {
      let ride = this.rides.get(p.id);
      if (!p.escape) { if (ride) ride.visible = false; continue; }
      if (!ride) { ride = animalModel(this.lib, p.escape.kind); this.rides.set(p.id, ride); this.scene.add(ride); }
      const pose = ridePose(s, p); ride.visible = true; ride.position.set(pose.animal.x, pose.altitude, pose.animal.y); ride.scale.setScalar(pose.scale); ride.rotation.y = -p.facing;
      ride.children.forEach(child => { if (child.name === 'leg') child.rotation.z = Math.sin(s.time * 20 + Math.sign(child.position.x * child.position.z) * 1.5) * .45; if (child.name === 'wing' && p.escape?.kind === 'pigeon') child.rotation.x = Math.sin(s.time * 18) * .55 * Math.sign(child.position.z); });
    }
    this.shrine.visible = !!e?.shrine;
    if (!e) { this.npc.visible = false; this.item.visible = false; this.shrine.visible = false; this.arms.forEach(arm => { arm.visible = false; }); return; }
    if (!this.initialized) this.build(s);
    const n = e.npc, phase = n.phase, age = s.time - n.since;
    const hostile = phase === 'hostile' || phase === 'emerging';
    const airborne = n.kind === 'pigeon' && (phase === 'flying' || phase === 'friendly' || hostile);
    this.npc.visible = !s.players.some(p => p.id === n.targetId && p.escape) && phase !== 'gone' && phase !== 'devoured' && !(phase === 'leaving' && s.time >= n.until);
    let z = airborne ? 60 + Math.sin(s.time * 4) * 7 : 0;
    if (phase === 'swallowing') z = -90 * (age / .48) ** 2;
    if (phase === 'emerging') z = n.kind === 'pigeon' ? -35 + clamp(age / .65, 0, 1) * 100 : Math.sin(clamp(age / .65, 0, 1) * Math.PI) * 100;
    if (phase === 'hostile') {
      const until=n.nextAction-s.time, since=s.time-n.actionAt;
      const attack=until<.7 ? 1-clamp(until/.7,0,1) : since<.4 ? 1-since/.4 : 0;
      z=n.kind==='cat' ? Math.sin(attack*Math.PI*.75)*55 : z*(1-attack*.85);
    }
    if (phase === 'leaving') z = n.kind === 'pigeon' ? age * 160 : Math.sin(age * Math.PI) * 35;
    this.npc.position.set(n.x, z + (phase === 'running' ? Math.abs(Math.sin(s.time * 14)) * 7 : 0), n.y);
    this.npc.rotation.y = -n.facing; this.npcScale += ((n.scale ?? encounterScale(s)) * (phase === 'leaving' ? Math.max(.01, 1 - age / .8) : 1) - this.npcScale) * .15; this.npc.scale.setScalar(this.npcScale);
    this.npc.children.forEach(child => {
      if (child.name === 'leg') child.rotation.z = phase === 'running' || hostile ? Math.sin(s.time * (hostile ? 20 : 14) + Math.sign(child.position.x * child.position.z) * 1.5) * .4 : 0;
      if (child.name === 'eye' && child instanceof T.Mesh) { child.material = this.lib.material(hostile ? '#ed534f' : '#263746'); child.scale.y = phase === 'friendly' ? 2 : 4; }
      if (child.name === 'wing' && n.kind === 'pigeon') child.rotation.x = airborne ? Math.sin(s.time * 20) * .8 : 0;
    });
    const carrier = s.players.find(p => p.id === (e.item.ownerId ?? e.completedBy));
    const itemScale = questScale(carrier ? playerRadius(carrier, s.time) : viewerRadius);
    this.item.scale.setScalar(itemScale);
    this.item.visible = e.item.status === 'ground' || e.item.status === 'carried' || (e.item.status === 'delivered' && phase === 'friendly' && age < 1);
    this.item.position.set(e.item.x, e.item.status === 'ground' ? 4 + Math.sin(s.time * 3) * 2 : 15, e.item.y);
    if (e.item.status === 'delivered') this.item.position.set(n.x, 25, n.y);
    for (const p of s.players) {
      const pose = handPose(p, s);
      let arm = this.arms.get(p.id);
      if (!pose) { if (arm) arm.visible = false; continue; }
      if (!arm) {
        arm = new T.Group();
        for (let i = 0; i < 3; i++) this.lib.part(arm, 'cylinder', p.color, 0, 0, 0, 1.2, 1, 1.2);
        this.lib.part(arm, 'ball', '#fff0d0', 0, 0, 0, 4, 3, 4);
        this.scene.add(arm); this.arms.set(p.id, arm);
      }
      arm.visible = true;
      const handScale = questScale(playerRadius(p, s.time)), thickness = Math.min(2.4, 1.2 * Math.sqrt(handScale));
      const dx = pose.tip.x - pose.root.x, dy = pose.tip.y - pose.root.y;
      const points = [new T.Vector3(pose.root.x, 5, pose.root.y), new T.Vector3(pose.root.x + dx * .33 - dy * .12, 19, pose.root.y + dy * .33 + dx * .12), new T.Vector3(pose.root.x + dx * .7 + dy * .1, 13, pose.root.y + dy * .7 - dx * .1), new T.Vector3(pose.tip.x, 15, pose.tip.y)];
      for (let i = 0; i < 3; i++) {
        const segment = arm.children[i], delta = points[i + 1].clone().sub(points[i]);
        segment.position.copy(points[i]).addScaledVector(delta, .5); segment.scale.set(thickness, delta.length(), thickness);
        segment.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
      }
      arm.children[3].position.copy(points[3]); arm.children[3].scale.set(4 * handScale, 3 * handScale, 4 * handScale);
      if (e.item.ownerId === p.id && e.item.status === 'carried') this.item.position.copy(points[3]);
    }
  }
  dispose() { this.rides.forEach(ride => this.scene.remove(ride)); this.rides.clear(); this.scene.remove(this.npc, this.item, this.shrine); this.arms.forEach(arm => this.scene.remove(arm)); this.arms.clear(); }
}
