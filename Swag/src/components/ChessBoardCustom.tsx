import { useState } from "react";

const ROW_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const COLUMN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Cell = {
  id: number;
  content: string;
};

export default function ChessBoard() {
  const [rowCount, setRowCount] = useState(3);
  const [columnCount, setColumnCount] = useState(4);

  const [cells, setCells] = useState<Cell[]>(() =>
    createCells(3, 4)
  );

  function createCells(rows: number, columns: number): Cell[] {
    return Array.from(
      { length: rows * columns },
      (_, index) => ({
        id: index,
        content: `Cell ${index + 1}`,
      })
    );
  }

  function changeRows(rows: number) {
    setRowCount(rows);
    setCells(createCells(rows, columnCount));
  }

  function changeColumns(columns: number) {
    setColumnCount(columns);
    setCells(createCells(rowCount, columns));
  }

  /**
   * Swap the contents of two cells.
   */
  function swapCells(indexA: number, indexB: number) {
    setCells((currentCells) => {
      const newCells = [...currentCells];

      const temp = newCells[indexA].content;
      newCells[indexA].content = newCells[indexB].content;
      newCells[indexB].content = temp;

      return newCells;
    });
  }

  /**
   * Find the adjacent cells of a given cell.
   *
   * Returns the indexes of the cells that exist
   * above, below, left and right.
   */
  function getAdjacentCells(index: number): {
    up?: number;
    down?: number;
    left?: number;
    right?: number;
  } {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;

    const adjacent: {
      up?: number;
      down?: number;
      left?: number;
      right?: number;
    } = {};

    // Cell above
    if (row > 0) {
      adjacent.up = index - columnCount;
    }

    // Cell below
    if (row < rowCount - 1) {
      adjacent.down = index + columnCount;
    }

    // Cell to the left
    if (column > 0) {
      adjacent.left = index - 1;
    }

    // Cell to the right
    if (column < columnCount - 1) {
      adjacent.right = index + 1;
    }

    return adjacent;
  }

  function handleCellClick(index: number) {
    const adjacent = getAdjacentCells(index);

    console.log(`Cell ${index} clicked`);
    console.log("Adjacent cells:", adjacent);
  }

  return (
    <div>
      <div>
        <label htmlFor="row-count">
          Number of rows:
        </label>

        <select
          id="row-count"
          value={rowCount}
          onChange={(event) =>
            changeRows(Number(event.target.value))
          }
        >
          {ROW_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="column-count">
          Number of columns:
        </label>

        <select
          id="column-count"
          value={columnCount}
          onChange={(event) =>
            changeColumns(Number(event.target.value))
          }
        >
          {COLUMN_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateRows: `repeat(${rowCount}, 50px)`,
          gridTemplateColumns: `repeat(${columnCount}, 100px)`,
          gap: "8px",
          marginTop: "16px",
        }}
      >
        {cells.map((cell, index) => (
          <div
            key={cell.id}
            style={{
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <button
              type="button"
              onClick={() => handleCellClick(index)}
              style={{
                width: "100%",
                height: "100%",
                padding: 0,
                boxSizing: "border-box",
                cursor: "pointer",
              }}
            >
              {cell.content}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "16px" }}>
        <button
          type="button"
          onClick={() => swapCells(0, 1)}
        >
          Swap first two cells
        </button>
      </div>
    </div>
  );
}