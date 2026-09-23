import type { BattlefieldObject } from "./types";

/*
 * ALL battlefield object placement is controlled here.
 *
 * position.x / position.y  = location in % of map width/height
 * visualSize               = visual diameter in % of battlefield width
 * visualAspectRatio        = width / height (1 = circle)
 * radius                    = gameplay/effect radius
 * interactRange             = how close a unit must stand to interact
 *
 * The coordinates below are starter positions. Move/resize anything here
 * without touching Battlefield.tsx.
 */

export const FALCON_BRIDGE_OBJECTS: BattlefieldObject[] = [
  {
    id: "bridge-market",
    type: "market",
    name: "Crossroads Market",
    description:
      "Buy temporary battle supplies. The current prototype bundle restores health and improves range and movement.",
    position: { x: 67, y: 66 },
    radius: 4.5,
    visualSize: 4.8,
    interactRange: 6,
    interactive: true,
  },
  {
    id: "north-platform",
    type: "highGroundPlatform",
    name: "Falcon Perch",
    description:
      "A raised shooting platform that greatly increases attack range.",
    position: { x: 57, y: 28 },
    radius: 4,
    visualSize: 4.2,
    interactRange: 5,
    interactive: true,
  },
  {
    id: "old-shrine",
    type: "healingShrine",
    name: "Shrine of the White Feather",
    description: "A nearby unit can invoke the shrine to restore health.",
    position: { x: 38, y: 73 },
    radius: 4,
    visualSize: 4.2,
    interactRange: 5,
    interactive: true,
  },
  {
    id: "east-ballista",
    type: "ballista",
    name: "Bridge Ballista",
    description:
      "A fixed siege weapon. Operate it to strike the nearest enemy.",
    position: { x: 75, y: 39 },
    radius: 4,
    visualSize: 4.4,
    interactRange: 5,
    interactive: true,
  },
  {
    id: "central-banner",
    type: "capturePoint",
    name: "Falcon Banner",
    description:
      "A contested command point that can be claimed by the active clan.",
    position: { x: 49, y: 52 },
    radius: 5,
    visualSize: 4.6,
    interactRange: 5,
    interactive: true,
  },
  {
    id: "watchtower",
    type: "watchtower",
    name: "Broken Watchtower",
    description:
      "Survey the field from above and increase the unit's attack range.",
    position: { x: 98, y: 68 },
    radius: 4,
    visualSize: 4.4,
    interactRange: 5,
    interactive: true,
  },
  {
    id: "field-smith",
    type: "blacksmith",
    name: "Field Blacksmith",
    description: "Reinforce a nearby unit's armor and increase Toughness.",
    position: { x: 22, y: 31 },
    radius: 4,
    visualSize: 4.4,
    interactRange: 5,
    interactive: true,
  },
  {
    id: "south-cliff",
    type: "cliffEdge",
    name: "Raven's Drop",
    description:
      "A lethal cliff edge. Units cannot intentionally move into this hazard zone.",
    position: { x: 89, y: 60 },
    radius: 5.5,
    visualSize: 7.5,
    visualAspectRatio: 1.8,
    rotation: -18,
    interactRange: 0,
    interactive: false,
  },
  {
    id: "falcon-current",
    type: "riverCurrent",
    name: "Falcon Current",
    description:
      "Fast water cuts across the battlefield. The current zone is impassable.",
    position: { x: 48, y: 62 },
    radius: 6,
    visualSize: 13,
    visualAspectRatio: 2.4,
    rotation: -10,
    interactRange: 0,
    interactive: false,
  },
  {
    id: "falcon-fog",
    type: "fogArea",
    name: "Morning Fog",
    description:
      "A drifting fog bank. Units ending movement here automatically gain temporary cover.",
    position: { x: 72, y: 78 },
    radius: 7,
    visualSize: 15,
    visualAspectRatio: 1.8,
    rotation: 8,
    interactRange: 0,
    interactive: false,
  },
];

export const BLACKTHORN_BRIDGE_OBJECTS: BattlefieldObject[] = [
  {
    id: "blackthorn-supply",
    type: "supplyCrate",
    name: "Supply Crate",
    description:
      "A one-use cache of field supplies. Restores health and improves mobility.",
    position: { x: 37, y: 81 },
    radius: 3.5,
    visualSize: 4.2,
    interactRange: 5,
    interactive: true,
    usesRemaining: 1,
  },
  {
    id: "blackthorn-mana",
    type: "manaShrine",
    name: "Mana Shrine",
    description:
      "Arcane energy blesses a nearby unit, increasing range and empowering its next attacks.",
    position: { x: 72, y: 17 },
    radius: 4,
    visualSize: 5,
    interactRange: 5,
    interactive: true,
  },
  {
    id: "blackthorn-gate-control",
    type: "bridgeControl",
    name: "Bridge Lever",
    description:
      "Raises or lowers the local gate. The state is data-driven and ready to be connected to a dynamic bridge mask later.",
    position: { x: 62, y: 26 },
    radius: 3,
    visualSize: 3.8,
    interactRange: 4.5,
    interactive: true,
    active: false,
    linkedObjectId: "blackthorn-barricade",
  },
  {
    id: "blackthorn-barricade",
    type: "barricade",
    name: "Timber Barricade",
    description:
      "A physical obstacle. Units cannot move through its battlefield zone.",
    position: { x: 27, y: 71 },
    radius: 4.2,
    visualSize: 6,
    visualAspectRatio: 1.7,
    rotation: 18,
    interactRange: 0,
    interactive: false,
    active: true,
  },
  {
    id: "blackthorn-forest",
    type: "forest",
    name: "Darkwood Thicket",
    description:
      "Dense woods slow movement. Units ending movement here gain automatic cover.",
    position: { x: 21, y: 41 },
    radius: 7,
    visualSize: 14,
    visualAspectRatio: 1.35,
    rotation: -12,
    interactRange: 0,
    interactive: false,
  },
  {
    id: "blackthorn-boss-altar",
    type: "bossAltar",
    name: "Boss Altar",
    description:
      "A one-use dark altar. Invoke it for a powerful battle blessing. It can later be replaced by an actual boss-summon system.",
    position: { x: 90, y: 73 },
    radius: 5,
    visualSize: 6,
    interactRange: 6,
    interactive: true,
    usesRemaining: 1,
  },
  {
    id: "blackthorn-current",
    type: "riverCurrent",
    name: "Blackthorn Current",
    description:
      "Fast water cuts across the battlefield. The current zone is impassable.",
    position: { x: 42, y: 38 },
    radius: 6,
    visualSize: 14,
    visualAspectRatio: 2.6,
    rotation: 12,
    interactRange: 0,
    interactive: false,
  },
  {
    id: "blackthorn-fog",
    type: "fogArea",
    name: "Lowland Fog",
    description:
      "A drifting fog bank. Units ending movement here automatically gain temporary cover.",
    position: { x: 45, y: 82 },
    radius: 7,
    visualSize: 16,
    visualAspectRatio: 2,
    rotation: -6,
    interactRange: 0,
    interactive: false,
  },
];

export const EMBERCLAW_BRIDGE_OBJECTS: BattlefieldObject[] = [
  {
    id: "ember-trap-tile",
    type: "trapTile",
    name: "Spike Trap Tile",
    description:
      "A visible hazard tile. A unit that ends movement inside it takes damage.",
    position: { x: 35, y: 57 },
    radius: 4,
    visualSize: 5,
    interactRange: 0,
    interactive: false,
    usesRemaining: 99,
  },
  {
    id: "ember-teleport",
    type: "teleportRune",
    name: "Teleport Rune",
    description:
      "Teleport a nearby unit directly to the configured destination point.",
    position: { x: 22, y: 27 },
    radius: 4,
    visualSize: 5.5,
    interactRange: 5,
    interactive: true,
    targetPosition: { x: 78, y: 72 },
  },
  {
    id: "ember-jump-pad",
    type: "jumpPad",
    name: "Wind Jump Pad",
    description: "Launches a nearby unit to the configured landing position.",
    position: { x: 70, y: 31 },
    radius: 4,
    visualSize: 5,
    interactRange: 5,
    interactive: true,
    targetPosition: { x: 57, y: 56 },
  },
  {
    id: "ember-mud",
    type: "mud",
    name: "Sinking Mud",
    description:
      "Movement through this zone costs substantially more movement range.",
    position: { x: 30, y: 77 },
    radius: 7,
    visualSize: 13,
    visualAspectRatio: 1.45,
    rotation: 6,
    interactRange: 0,
    interactive: false,
  },
  {
    id: "ember-ice",
    type: "ice",
    name: "Glass Ice",
    description:
      "Slippery terrain slightly increases movement cost and is visually marked on the field.",
    position: { x: 82, y: 53 },
    radius: 6,
    visualSize: 12,
    visualAspectRatio: 1.35,
    rotation: -8,
    interactRange: 0,
    interactive: false,
  },
  {
    id: "ember-sacred-circle",
    type: "sacredCircle",
    name: "Sacred Circle",
    description: "A holy circle that heals and blesses a nearby unit.",
    position: { x: 53.5, y: 23 },
    radius: 4.5,
    visualSize: 6,
    interactRange: 5,
    interactive: true,
  },
  {
    id: "ember-cursed-circle",
    type: "cursedCircle",
    name: "Cursed Circle",
    description: "Trade health for a powerful damage blessing.",
    position: { x: 83, y: 42 },
    radius: 4.5,
    visualSize: 6,
    interactRange: 5,
    interactive: true,
  },
  {
    id: "ember-current",
    type: "riverCurrent",
    name: "Ember Current",
    description:
      "Fast water cuts across the battlefield. The current zone is impassable.",
    position: { x: 49, y: 48 },
    radius: 6,
    visualSize: 14,
    visualAspectRatio: 2.5,
    rotation: -16,
    interactRange: 0,
    interactive: false,
  },
  {
    id: "ember-fog",
    type: "fogArea",
    name: "Ash Fog",
    description:
      "A drifting fog bank. Units ending movement here automatically gain temporary cover.",
    position: { x: 20, y: 66 },
    radius: 7,
    visualSize: 15,
    visualAspectRatio: 1.9,
    rotation: 10,
    interactRange: 0,
    interactive: false,
  },
];

// Optional fourth map remains empty for now. Keeping a named array avoids
// hard-coding [] in battleData.ts and makes expansion easy.
export const ONE_EYED_OAK_OBJECTS: BattlefieldObject[] = [];
