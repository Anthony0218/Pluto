# Janmann's Gambit

Fixed, experimental Community game by **Yannick**. Canonical identity: `volumeSphere`; slug: `janmanns-gambit`.

## Architecture and integration

The existing `VariantCard` registry, Community catalog/service, card layout, detail dialog, play-mode dialog, lazy routes, React Three Fiber / Drei / Three.js renderer, GLTF chess-piece models, and `ui()` localization are reused. No new dependency or database migration is needed.

Both Chess Custom → Community and Chess Custom → Pluto Variants use the same registry object and `/chess-custom/janmanns-gambit` route. The rules route is `/chess-custom/janmanns-gambit/rules`. The entry has `configurable: false` and no `customId` or configurator route. The existing fixed-variant safeguards prevent editing, remixing, voting, or unpublishing a packaged game. Community scope includes this explicitly authored entry without pulling in the other Pluto games.

Yannick is display metadata. `ownerId` is null: there is no verified account relationship available in this checkout. No fake account or database identifier is created.

`JanmannGambitArtwork.tsx` is selected only by `JANMANN.id`. Its SVG translates the supplied reference into the existing card format: dark study, gold construction lines, wavy-haired figure with hand on chin, table and notes, oblique faceted chess sphere, and mathematical annotations. The other variants retain their artwork and styling.

## Logical board and rules

`topology.ts` generates exactly eight octants × ten unique Dividends. Each octant has a triangular 1+2+3+4 arrangement. Its logical coordinates are signed odd integers with `|x| + |y| + |z| = 9`. These integer coordinates define the graph; camera and mesh coordinates do not enter move generation.

Rook lines are closed rings cut by constant x, y, or z planes. Bishop lines are closed rings cut by x±y, x±z, or y±z planes. Every ring has two ordered traversals. This is an explicit experimental movement convention, not a claim that ordinary chess has a unique extension to a sphere. King neighbors are consecutive rook-ring nodes. Knights jump two ring steps followed by a step off that ring; the relation is made reciprocal at seams. Pawn forward/capture connections are precomputed toward the opposing x cap and are antipodally symmetric.

`rules.ts` implements all six pieces, sliding blockers, captures, king safety, check, immediate checkmate, stalemate, promotion choices, attacks/occupation/control, optional extraction, depletion, sector control, and end-of-turn Volumetric Dominance. There is no hidden 8×8 board.

Turn flow:

1. Make a legal move. Recalculate attacks and control; checkmate ends the game immediately.
2. Extract from one eligible Dividend occupied by your side, or preserve.
3. Transfer 1 m³ from that Dividend to your extracted total. Resolve depletion and sacrifice.
4. Recalculate secured sectors, king state, and victory; pass the turn.

Only uncontested controlled occupation with remaining volume permits extraction. More exclusively controlled non-Void Dividends secures a sector; ties and contested nodes do not. Checkmate takes priority; otherwise ≥50 m³ and ≥5 secured sectors wins at turn resolution.

## Geometry and volume

`geometry.ts` uses one equilateral triangle of side 4, reflected and rotated to create eight congruent sectors around a central square. Voronoi polygons partition each sector into ten selectable Dividend surfaces. Subdivided barycentric polygons project radially onto the eight spherical octants of radius 5. Identical boundary coordinates meet deterministically; the same IDs and piece locations survive assembly and disassembly.

The dedicated SnubCube entity uses 24 chiral vertices derived from the tribonacci constant. Its local scale animates from `[1,1,1]` to `[1,1,5]`; vertex geometry is not stretched permanently. The game scene supports orbit, limited zoom, camera reset, control overlays, legal-move highlights, and a keyboard-accessible sector board. Reduced-motion preference skips assembly interpolation. Development builds expose coordinates, ring continuations, pawn directions, control, remaining/mined volumes, and assembly/stretch values.

`volume.ts` distinguishes geometric volume from competitive yield. It calculates sphere volume, inner volume, shell volume removed by angular selection, and the nonnegative remainder. `Vangle` is cubic metres removed, never a raw angle. The measurement model allocates an equal `4π/80` steradian share per Dividend. Its radius slider and four-stage outer/inner/angle/result visualization are information only. Resource updates happen exclusively in the rules engine.

React state for measurement, camera, selection, and assembly is separate from `GameState`. Animation-frame callbacks and measurement timers are cancelled on cleanup; locally allocated BufferGeometry and ConvexGeometry are disposed. The shared chess model component retains its existing lifecycle. See the [React Three Fiber lifecycle documentation](https://r3f.docs.pmnd.rs/api/hooks) and [resource disposal documentation](https://r3f.docs.pmnd.rs/api/objects#disposal).

## Explicit design assumptions

- Initial mode is two-player local hotseat. Unsupported AI and online modes stay disabled using the existing play-mode dialog.
- Each side starts with 16 familiar pieces on opposite caps, mirrored through the origin. Both kings start safe; both sides have 62 legal initial moves.
- Every Dividend contains 3 m³, for a symmetric board total of 240 m³. Extraction rate is 1 m³ per turn. Balance is experimental and has not undergone human competitive playtesting.
- After a move, extraction may use **any** eligible occupied Dividend, including a piece that stayed in place.
- Taking the final unit sacrifices the occupying non-king piece. A king cannot take the last unit, and an extraction exposing its own king is forbidden. This resolves the specification's otherwise undefined occupied-then-Void case.
- Pawns promote on the opposing cap at signed x ≤−5 for White or ≥5 for Black. Players choose queen, rook, bishop, or knight. No castling, double pawn step, or en passant.
- Closed spherical lines can approach a blocker from the other direction. A Void does not block a ray, but an occupant does.
- Stalemate is a draw. Repetition and fifty-move draws are not imposed on a game where repeated movement can deliberately preserve/extract terrain.
- Geometric measurement uses an equal solid-angle explanatory model, not exact numerical integration of each projected Voronoi cell. Competitive yield is normalized independently.
- The session is local and resets on leaving/reloading the route. Undo and reset are provided; no online persistence is claimed.
- German controls/rules use the app's existing localization system; other languages use its normal English fallback.

## Verification

Automated coverage in `tests/chess-janmann.test.mjs` includes canonical identity, both discovery scopes, no configurator/account fabrication, 80 unique nodes, graph connectivity, reciprocal seam neighbors, all six piece classes, symmetric pawns/deployment, king safety, captures, promotion, attack/occupation/control, extraction/preserve, atomic volume accounting, sacrifice/Voids, sector ties, checkmate priority, both victory thresholds, congruent sectors, spherical radii, stable IDs/state through transformations and measurement, 1×→5× stretch, 24 SnubCube vertices, volume formulas, and deterministic complete play sequences with conservation checks.

Existing Community tests cover catalog order, pagination, remote entries, fixed-variant protections, and the three configurable Pluto games. `npm run test:natura` runs the repository's full test suite; `node --test tests/chess-janmann.test.mjs tests/chess-custom-community.test.mjs` runs the focused integration suite.

Verification completed:

- `npm run build`: passes TypeScript project checks, party-server typecheck, and the Vite production build. Vite retains the existing large-chunk warning.
- `npm run test:natura`: 862/862 tests passed outside the sandbox (socket tests need local listen permission).
- Final focused Janmann/Community run: 29/29 passed, including two additional cases added after the full run for contested/sacrifice king safety and stalemate.
- Targeted ESLint for the new modules and supporting integration files: passes. Repository-wide lint still reports 155 errors and 70 warnings in existing code, including pre-existing Fast Refresh violations in `main.tsx`; these unrelated issues were not rewritten.
- `git diff --check`: passes.
- Chrome: inspected the dedicated illustration and attribution in the variant grid; verified the Community and Pluto cards each show Yannick and Not configurable; launched both through Hotseat into the identical canonical route with no configurator.
- Chrome: rendered the planar construction, assembled the spherical board to Locked / 100%, returned to flat, and retained the opening turn/resources. Existing chess models render on the projected Dividend surfaces.
- Chrome: made a legal pawn move, entered the optional extraction phase, extracted from an eligible occupied Dividend, observed White gain 1 m³ and the Dividend fall from 3 to 2 m³, and verified Black became the active player. The four-stage measurement panel reached its resulting-volume display.
- Chrome: changed measurement radius from 2.25 m to 4.75 m without changing the current turn or game resources. Reset restored the opening position, zero extracted resources, planar view, and disabled Undo. Leaving for discovery and relaunching started a fresh isolated session.
- Rules tests exercise all pieces, promotion, seam movement, checkmate, extraction through depletion, Void destinations/traversal, sector ties, both volume-victory thresholds, and conservation during deterministic play. Those exhaustive scenarios are automated coverage, not claims of manual browser playthroughs.

No human balance study, online mode, AI opponent, or saved-session persistence is included in this experimental hotseat implementation.
