import { useState } from "react";

const ROW_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const COLUMN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

type ObjectType = "circle" | "square" | "triangle";

type BoardObject = {
  id: string;
  type: ObjectType;
  color: string;
};

type Cell = {
  index: number;
  object: BoardObject | null;
};

function createBoard(rows: number, columns: number): Cell[] {
  return Array.from(
    { length: rows * columns },
    (_, index) => ({
      index,
      object: null,
    })
  );
}

export default function ChessBoard() {
  const [rowCount, setRowCount] = useState(4);
  const [columnCount, setColumnCount] = useState(4);

  const [board, setBoard] = useState<Cell[]>(() =>
    createBoard(4, 4)
  );

  /*
   * Put an object into a specific cell.
   */
  function setObject(
    index: number,
    object: BoardObject | null
  ) {
    setBoard((currentBoard) => {
      const newBoard = [...currentBoard];

      newBoard[index] = {
        ...newBoard[index],
        object,
      };

      return newBoard;
    });
  }

  /*
   * Swap the objects between two cells.
   *
   * The cells themselves don't move.
   * Only their objects change positions.
   */
  function swapObjects(
    indexA: number,
    indexB: number
  ) {
    setBoard((currentBoard) => {
      const newBoard = [...currentBoard];

      const objectA = newBoard[indexA].object;
      const objectB = newBoard[indexB].object;

      newBoard[indexA] = {
        ...newBoard[indexA],
        object: objectB,
      };

      newBoard[indexB] = {
        ...newBoard[indexB],
        object: objectA,
      };

      return newBoard;
    });
  }

  /*
   * Return the indexes of all cells directly
   * adjacent to the supplied cell.
   */
  function getAdjacentCells(index: number): number[] {
    const row = Math.floor(index / columnCount);
    const column = index % columnCount;

    const adjacent: number[] = [];

    // Up
    if (row > 0) {
      adjacent.push(index - columnCount);
    }

    // Down
    if (row < rowCount - 1) {
      adjacent.push(index + columnCount);
    }

    // Left
    if (column > 0) {
      adjacent.push(index - 1);
    }

    // Right
    if (column < columnCount - 1) {
      adjacent.push(index + 1);
    }

    return adjacent;
  }

  /*
   * Move an object from one cell to an adjacent cell.
   *
   * This is simply a swap, so the target cell's
   * object moves back to the original cell.
   */
  function moveObject(
    fromIndex: number,
    toIndex: number
  ) {
    const adjacentCells = getAdjacentCells(fromIndex);

    if (!adjacentCells.includes(toIndex)) {
      return;
    }

    swapObjects(fromIndex, toIndex);
  }

  /*
   * Change the board dimensions.
   */
  function resizeBoard(
    rows: number,
    columns: number
  ) {
    setRowCount(rows);
    setColumnCount(columns);
    setBoard(createBoard(rows, columns));
  }

  /*
   * Example: create an object and put it into
   * a specific cell.
   */
  function addExampleObject(index: number) {
    setObject(index, {
      id: crypto.randomUUID(),
      type: "circle",
      color: "red",
    });
  }

  function getPosition(index: number) { 
    return { row: Math.floor(index / columnCount), column: index % columnCount, }; 
  }

  function areOnSameLine( indexA: number, indexB: number ): boolean { 
    const positionA = getPosition(indexA); 
    const positionB = getPosition(indexB); 
    return ( positionA.row === positionB.row || positionA.column === positionB.column ); 
  }

  function areOnSameDiagonal( indexA: number, indexB: number ): boolean { 
    const positionA = getPosition(indexA); 
    const positionB = getPosition(indexB); 
    const rowDifference = Math.abs( positionA.row - positionB.row ); 
    const columnDifference = Math.abs( positionA.column - positionB.column ); 
    return rowDifference === columnDifference; 
  }

  function areAdjacent( indexA: number, indexB: number ): boolean { 
    const positionA = getPosition(indexA); 
    const positionB = getPosition(indexB); 
    const rowDifference = Math.abs( positionA.row - positionB.row ); 
    const columnDifference = Math.abs( positionA.column - positionB.column ); 
    return ( rowDifference <= 1 && columnDifference <= 1 && (rowDifference !== 0 || columnDifference !== 0) ); 
  }

  return (
    <div>
      {/* Board controls */}
      <div style={{ marginBottom: "16px" }}>
        <label htmlFor="row-count">
          Rows:
        </label>

        <select
          id="row-count"
          value={rowCount}
          onChange={(event) =>
            resizeBoard(
              Number(event.target.value),
              columnCount
            )
          }
        >
          {ROW_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>

        <label
          htmlFor="column-count"
          style={{ marginLeft: "16px" }}
        >
          Columns:
        </label>

        <select
          id="column-count"
          value={columnCount}
          onChange={(event) =>
            resizeBoard(
              rowCount,
              Number(event.target.value)
            )
          }
        >
          {COLUMN_OPTIONS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      {/* Board */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: `repeat(${rowCount}, 80px)`,
          gridTemplateColumns: `repeat(${columnCount}, 80px)`,
          gap: "8px",
        }}
      >
        {board.map((cell) => (
          <div
            key={cell.index}
            style={{
              border: "1px solid #ccc",
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (cell.object === null) {
                  addExampleObject(cell.index);
                }
              }}
              style={{
                width: "100%",
                height: "100%",
                padding: "8px",
                boxSizing: "border-box",
              }}
            >
              {cell.object ? (
                <span
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    backgroundColor:
                      cell.object.color,
                  }}
                />
              ) : (
                cell.index
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Example movement controls */}
      <div style={{ marginTop: "16px" }}>
        <button
          type="button"
          onClick={() => moveObject(0, 1)}
        >
          Move object 0 → 1
        </button>

        <button
          type="button"
          onClick={() => moveObject(1, 5)}
          style={{ marginLeft: "8px" }}
        >
          Move object 1 → 5
        </button>
      </div>
    </div>
  );
}