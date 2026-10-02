# Pluto Community variants

`library/communityCatalog.ts` derives the built-in Community entries from the
same available entries in `src/data/chessVariants.ts` used by the menu. Built-ins
retain their icons, descriptions, and routes. `hotseatRoute` optionally identifies
a direct game route when the menu route opens an editor (currently 3D Chess).
The Community UI and service both prevent remixing built-ins.

`library/plutoVariants.ts` builds three ordinary `GameVariant` documents from the
existing presets. Their IDs, timestamps, rule IDs and event IDs are stable. They
are packaged with the app, so no fake author account, database seed or localStorage
insertion is necessary. The Community service merges them with published rows
before pagination. Official cards follow the menu registry order; player uploads use the selected sort metrics. Both galleries share the menu card and artwork components. Official entries
have no votes or recorded play counts. Their remixes get fresh identities and
lineage through `parseVariantJson`, then use the normal local/cloud repository.

## Team Chess

- 14×14 cross board, four standard 16-piece armies.
- White (bottom, player 1) and Black (top, player 3): Team A.
- Red (left, player 2) and Blue (right, player 4): Team B.
- White → Red → Black → Blue, skipping eliminated armies. Each player moves
  only their own pieces; partners block movement and cannot capture one another.
- No check/checkmate restrictions. Capturing an army's last king eliminates that
  army and removes its pieces; its partner continues. Having no legal move also
  eliminates an army. Defeat both enemy armies to win for the whole alliance,
  including an already eliminated partner.
- Ordinary pawn movement/promotion; no castling or en passant. Draw at 600 plies.
- Four-human hotseat, mixed human/AI, and AI simulation use the existing player
  controls. Online rooms assign four signed-in players to White, Red, Black and
  Blue in joining order and begin once every seat is filled.

## Team Chess Long Edition

- 16×8 rectangular board with 64 pieces. White and Black stand side by side
  along the bottom; Red and Blue face them along the top.
- Each army occupies eight files; both allied pawn directions face the enemy.
- Uses the same turn order, elimination, alliance victory and draw rules as Team Chess.
- All three packaged custom games have menu links for hotseat, singleplayer,
  multiplayer and customization.
- New custom games use SVG artwork; existing variants retain their original art.

## Chaos Chess

- 12×10 board, 26 pieces per army: 12 pawns, two Bombers, and the back rank
  Cannon–Rook–Knight–Wizard–Queen–King–Queen–Dragon–Bishop–Knight–Rook–Cannon.
- Wizards step diagonally or leap 3×1. Cannons move like rooks and capture over
  exactly one screen. Dragons slide up to three squares in any direction or leap
  like knights. Bombers step orthogonally; capturing one explodes adjacent
  non-royal pieces, including a non-royal capturer. Kings are immune to the blast.
- Portal pairs c4↔j7 and j4↔c7 transport arrivals when the exit is free. Ice at
  f5/g5/f6/g6 slides arrivals onward according to the normal terrain engine.
- Pawns promote on the far rank or pads d5/i6 to Queen, Rook, Bishop, Knight,
  Wizard, Cannon, Dragon or Bomber.
- At the start of round 6, an ordinary editable event gives all pawns Dragon
  movement and captures. They remain pawns and retain promotion eligibility.
- Win by capturing the enemy king, or landing an actual Dragon on your goal:
  l10 for White, a1 for Black. No check restrictions, castling or en passant.
  Stalemate or 400 plies is a draw.

## Schema and deployment

Schema v3 adds optional `TeamDefinition.alliance`. Equal non-empty names make
armies allies. Create → Teams exposes the field; alliance membership participates
in captures, attack detection, positional/event outcomes, elimination and AI
scoring/search. The full alliance receives a win, even if a partner was eliminated.
Friendly fire can still be explicitly enabled in a user's custom configuration.

v1/v2 documents migrate to v3 without adding alliances, keeping their original
free-for-all/two-player behavior and saved identities. The alliance schema itself
needs no SQL migration. Four-player online rooms also require
`20261011000000_chess_custom_four_player_matches.sql` to add ordered player seats.
Deploy the shared `chess-custom-match` Edge Function with the frontend so online
games use the v3 parser and four-seat room flow. No deployment is performed by
these source changes.

Regression coverage: `tests/chess-custom-community.test.mjs`, plus the existing
custom engine, editor, navigation, 3D and database suites.
