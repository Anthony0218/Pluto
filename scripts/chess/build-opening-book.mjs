/** Build an offline position index from lichess-org/chess-openings a.tsv–e.tsv (CC0). */
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const paths = process.argv.slice(2);
if (paths.length !== 5) throw new Error('Pass the five Lichess TSV files in ECO order.');
const positions = new Map();
for (const path of paths) {
  const rows = readFileSync(path, 'utf8').trim().split('\n').slice(1);
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history();
    const replay = new Chess();
    for (let index = 0; index < moves.length; index++) {
      replay.move(moves[index]);
      // Include side, castling and legal en-passant state, but omit move clocks.
      const key = replay.fen().split(' ').slice(0, 4).join(' ');
      if (!positions.has(key)) positions.set(key, null);
      if (index === moves.length - 1) positions.set(key, [eco, name]);
    }
  }
}
const output = Object.fromEntries([...positions].sort(([a], [b]) => a.localeCompare(b)));
writeFileSync('src/games/chess/openingBook.json', JSON.stringify(output));
console.log(`${positions.size} book positions`);
