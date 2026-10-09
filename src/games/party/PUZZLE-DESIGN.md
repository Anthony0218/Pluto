# Constellation Cascade: design and IP research

Research checked on 9 October 2026. This is a limited design-risk review, not legal clearance, a trademark search, a patent search or a jurisdiction-specific legal opinion.

The US Copyright Office distinguishes game ideas and methods of play from protectable expression such as rule text and artwork. However, the US District Court in *Tetris Holding, LLC v. Xio Interactive, Inc.* (2012) found a close clone infringed copyright and trade dress. Simply changing a title or palette is not a reliable way to remove similarity risk. This case is US authority, not a ruling that every falling-object puzzle infringes, and does not settle the position in every launch market.

Sources:

- [US Copyright Office: Games](https://www.copyright.gov/register/tx-games.html)
- [Official court opinion, 30 May 2012](https://www.govinfo.gov/content/pkg/USCOURTS-njd-3_09-cv-06115/pdf/USCOURTS-njd-3_09-cv-06115-0.pdf)

## Implemented concept

- Independent source code, original moon glyph artwork drawn in SVG and original rule text.
- A rounded sky containing nine staggered hexagonal columns and ten rows; circular, symbol-coded moon tokens.
- Falling pairs, with a swap of their top/bottom order. No seven-piece tetromino roster or block rotation system.
- Four or more matching glyphs connected through hexagonal adjacency clear in any direction. There is no full-row-clearing rule.
- Gravity resolves matching constellations into chain reactions; the successive chain number multiplies each clear's score.
- A short 75-second scoring contest with overflow recovery, not an endless line-clearing survival game.
- No next-piece panel, landing ghost, hold-piece slot, copied assets, music, logos, franchise terminology or branded product presentation.
- Players see their own sky and a horizontal score strip, not miniature opponent wells.

These decisions reduce resemblance to the identified Tetris presentation and change the core objective. They cannot guarantee that nobody will assert an IP claim, or establish clearance against other puzzle games. Legal review in the intended release markets remains the route to a definitive commercial assessment.
