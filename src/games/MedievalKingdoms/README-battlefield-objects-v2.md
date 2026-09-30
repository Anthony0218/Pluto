# Battlefield Objects v2

All object placement and visual sizing is controlled in `battlefieldObjects.ts`.

For every object you can change:

```ts
position: { x: 50, y: 50 }, // percentage coordinates
visualSize: 6,               // rendered diameter as % of battlefield width
visualAspectRatio: 1,        // optional: 1=circle, >1=wide zone
rotation: 0,                 // optional degrees
radius: 5,                   // gameplay/effect radius
interactRange: 5,            // interaction distance
```

## Current map layouts

### Falcon Bridge
- Market
- High-ground platform
- Healing shrine
- Ballista
- Capture point
- Watchtower
- Blacksmith
- Cliff edge
- River current
- Animated fog area

### Blackthorn / second battlefield
- Supply crate
- Mana shrine
- Bridge lever / gate control
- Barricade
- Forest
- Boss altar
- River current
- Animated fog area

### Emberclaw / third battlefield
- Trap tile
- Teleport rune
- Jump pad
- Mud
- Ice
- Sacred circle
- Cursed circle
- River current
- Animated fog area

## Implemented mechanics

- River current, barricade and cliff edge block movement.
- Mud, forest and ice increase movement cost.
- Forest and fog automatically grant Cover when a unit ends movement inside them.
- Trap tile damages a unit that ends movement on it.
- Supply crate is one-use.
- Mana shrine grants range + damage blessing.
- Bridge lever toggles the linked barricade/gate state.
- Boss altar is one-use and grants healing + damage blessing.
- Teleport rune and jump pad use configurable `targetPosition`.
- Sacred circle heals + blesses.
- Cursed circle trades HP for a longer damage blessing.
- Fog and river current are rendered as animated overlays rather than baked into the battlefield artwork.

The second and third battle definitions were also connected to their own object arrays.
