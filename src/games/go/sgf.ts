import { applyGoMove, createInitialGoState, toggleDeadGoGroup, type GoState } from "./rules.ts";

type Properties = Map<string, string[]>;
const sgfPoint = (row: number, col: number) => String.fromCharCode(97 + col, 97 + row);
const escapeSgf = (value: string) => value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\r?\n/g, " ");

/** SGF FF[4] main line. Variations and annotations are read but not imported. */
function mainLine(text: string): Properties[] {
  if (text.length > 2_000_000) throw new Error("SGF file is too large.");
  let at = 0;
  const space = () => { while (/\s/.test(text[at] ?? "")) at += 1; };
  const value = () => {
    if (text[at++] !== "[") throw new Error("Invalid SGF property.");
    let result = "";
    while (at < text.length && text[at] !== "]") {
      if (text[at] === "\\") { at += 1; if (at < text.length) result += text[at++]; }
      else result += text[at++];
    }
    if (text[at++] !== "]") throw new Error("Unclosed SGF property.");
    return result;
  };
  const tree = (): Properties[] => {
    space(); if (text[at++] !== "(") throw new Error("Expected an SGF game tree.");
    const nodes: Properties[] = [];
    space();
    while (text[at] === ";") {
      at += 1;
      const props: Properties = new Map();
      space();
      while (/[A-Z]/.test(text[at] ?? "")) {
        let key = "";
        while (/[A-Z]/.test(text[at] ?? "")) key += text[at++];
        space();
        const values: string[] = [];
        while (text[at] === "[") { values.push(value()); space(); }
        if (!values.length) throw new Error("SGF property has no value.");
        props.set(key, values);
      }
      nodes.push(props); space();
    }
    if (!nodes.length) throw new Error("SGF tree has no nodes.");
    let first: Properties[] | null = null;
    while (text[at] === "(") { const branch = tree(); if (!first) first = branch; space(); }
    if (text[at++] !== ")") throw new Error("Unclosed SGF game tree.");
    return [...nodes, ...(first ?? [])];
  };
  const nodes = tree(); space();
  if (at !== text.length) throw new Error("Expected one SGF game tree.");
  return nodes;
}

function readPoint(value: string, size: number): number {
  if (!/^[a-s]{2}$/.test(value)) throw new Error("Unsupported SGF coordinate.");
  const col = value.charCodeAt(0) - 97, row = value.charCodeAt(1) - 97;
  if (row >= size || col >= size) throw new Error("SGF coordinate is outside the board.");
  return row * size + col;
}

export type ImportedGoSgf = { game: GoState; players: { black: string; white: string }; savedAt: string };
export function importGoSgf(text: string): ImportedGoSgf {
  const nodes = mainLine(text), root = nodes[0];
  const prop = (name: string) => root.get(name)?.[0];
  if (prop("GM") !== "1" || prop("FF") !== "4") throw new Error("Import requires an SGF FF[4] Go game.");
  const size = Number(prop("SZ"));
  if (size !== 9 && size !== 13 && size !== 19) throw new Error("Only 9, 13 and 19 point boards are supported.");
  if (Number(prop("KM")) !== 6.5 || !/^chinese/i.test(prop("RU") ?? "")) throw new Error("This game requires Chinese area rules and 6.5 komi.");
  if (["AB", "AW", "AE", "HA"].some(name => root.has(name)) || nodes.some(node => node.has("AB") || node.has("AW") || node.has("AE"))) throw new Error("Handicap and setup stones are not supported for import.");
  if (prop("PL") && prop("PL") !== "B") throw new Error("This game requires Black to move first.");
  let game = createInitialGoState(size);
  for (const node of nodes) {
    const black = node.get("B"), white = node.get("W");
    if (black && white) throw new Error("An SGF node cannot contain both moves.");
    const values = black ?? white;
    if (!values) continue;
    if (values.length !== 1) throw new Error("SGF move has multiple coordinates.");
    const player = black ? "black" : "white";
    if (game.currentPlayer !== player) throw new Error("SGF move order does not match the game.");
    const point = values[0];
    if (point === "") game = applyGoMove(game, { type: "pass" });
    else { const index = readPoint(point, size); game = applyGoMove(game, { type: "place", row: Math.floor(index / size), col: index % size }); }
  }
  const dead = root.get("XDS") ?? [];
  for (const marker of dead) {
    const point = readPoint(marker, size);
    if (!game.deadStones?.includes(point)) game = toggleDeadGoGroup(game, point);
  }
  if (dead.length && (game.deadStones?.length ?? 0) !== dead.length) throw new Error("Invalid dead-stone annotations.");
  const result = prop("RE");
  if (result) {
    if (/^[BW]\+R(?:esign)?$/i.test(result)) {
      if (game.status !== "playing") throw new Error("SGF resignation conflicts with the move history.");
      const winner = result[0].toUpperCase() === "B" ? "black" : "white";
      if (game.currentPlayer !== winner) game = applyGoMove(game, { type: "resign" });
      else game = { ...game, status: "finished", winner, result: `${winner} wins by resignation` };
    } else if (/^[BW]\+T(?:ime)?$/i.test(result)) {
      if (game.status !== "playing") throw new Error("SGF timeout conflicts with the move history.");
      const winner = result[0].toUpperCase() === "B" ? "black" : "white";
      game = { ...game, status: "finished", winner, result: `${winner} wins by timeout` };
    } else {
      const expected = game.winner === "draw" ? "0" : `${game.winner === "black" ? "B" : "W"}+${game.result?.match(/by (\d+(?:\.\d+)?)/)?.[1] ?? "?"}`;
      if (game.status !== "finished" || result !== expected) throw new Error("Unsupported or inconsistent SGF result.");
    }
  }
  const date = prop("DT") ?? "";
  return { game, players: { black: prop("PB") ?? "Black", white: prop("PW") ?? "White" }, savedAt: /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) ? new Date(date + "T12:00:00Z").toISOString() : new Date().toISOString() };
}

export function exportGoSgf(game: GoState, players: { black: string; white: string }, savedAt = new Date().toISOString()): string {
  const date = savedAt.slice(0, 10);
  const winner = game.winner === "black" ? "B" : game.winner === "white" ? "W" : "";
  const result = !game.result ? "" : game.winner === "draw" ? "RE[0]" : `RE[${winner}+${/resignation/i.test(game.result) ? "R" : /timeout/i.test(game.result) ? "T" : game.result.match(/by (\d+(?:\.\d+)?)/)?.[1] ?? "?"}]`;
  const dead = game.deadStones?.length ? `XDS${game.deadStones.map(index => `[${sgfPoint(Math.floor(index / game.boardSize), index % game.boardSize)}]`).join("")}` : "";
  const root = `(;FF[4]GM[1]CA[UTF-8]AP[Pluto:1]SZ[${game.boardSize}]KM[${game.komi}]RU[Chinese]PB[${escapeSgf(players.black)}]PW[${escapeSgf(players.white)}]DT[${date}]${result}${dead}`;
  const moves = game.moveHistory.filter(move => move.type !== "resign").map(move => `;${move.player === "black" ? "B" : "W"}[${move.type === "pass" ? "" : sgfPoint(move.row, move.col)}]`).join("");
  return root + moves + ")";
}
