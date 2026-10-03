# Chess opening book

`openingBook.json` is generated from the five `a.tsv`–`e.tsv` files in
[lichess-org/chess-openings](https://github.com/lichess-org/chess-openings).
The Lichess README dedicates the data to the public domain under CC0.

Run `node scripts/chess/build-opening-book.mjs a.tsv b.tsv c.tsv d.tsv e.tsv`
from the repository root to rebuild it after downloading a matching snapshot.
The index contains the resulting position of every prefix of each published
opening line. A move is Book when its resulting position is in this index and
it is among the first 30 plies. Position keys use the board, side to move,
castling rights and en passant field; move clocks are ignored. Named entries
carry the published ECO code and opening name. An intermediate position can
qualify as Book before it has its own name. This is a catalogue match, not an
engine judgment about the move's quality.
