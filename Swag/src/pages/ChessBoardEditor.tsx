import { useState } from "react";

import "../index.css";

export default function ChessBoardEditor() {
  const [dimensions, setDimensions] =
    useState<BoardDimensions>({
      rows: 4,
      columns: 4,
    });

  const [board, setBoard] = useState<Cell[]>(
    () => createBoard(4, 4)
  );

  const [selectedObject, setSelectedObject] =
    useState<ObjectTemplate>({
      type: "circle",
      color: "#3b82f6",
      value: "player",
    });

  function handleDimensionsChange(
    newDimensions: BoardDimensions
  ) {
    setDimensions(newDimensions);

    /*
     * Create a new board when the dimensions change.
     *
     * If you want to preserve existing objects when
     * resizing, this can instead be implemented to
     * copy objects from the old board.
     */
    setBoard(
      createBoard(
        newDimensions.rows,
        newDimensions.columns
      )
    );
  }

  return (
    <div className="grid grid-flow-col grid-rows-3 gap-4">
      <div className="row-span-3 ml-8 h-screen w-1/3 place-items-center rounded-sm outline-double">
        <Sidebar
          selectedObject={selectedObject}
          onObjectChange={setSelectedObject}
        />
      </div>

      <div className="col-span-2 w-2/3">
        <Navigation
          dimensions={dimensions}
          onDimensionsChange={
            handleDimensionsChange
          }
        />
      </div>

      <div className="col-span-2 row-span-2 place-self-center">
        <Grid
          board={board}
          dimensions={dimensions}
          selectedObject={selectedObject}
          onBoardChange={setBoard}
        />
      </div>
    </div>
  );
}


/* =========================================================
   TYPES
   ========================================================= */

export type ObjectType =
  | "circle"
  | "square"
  | "triangle";

export type BoardObject = {
  id: string;
  type: ObjectType;
  color: string;
  value: string;
};

export type Cell = {
  index: number;
  object: BoardObject | null;
};

type BoardDimensions = {
  rows: number;
  columns: number;
};

type ObjectTemplate = {
  type: ObjectType;
  color: string;
  value: string;
};


/* =========================================================
   BOARD HELPERS
   ========================================================= */

function createBoard(
  rows: number,
  columns: number
): Cell[] {
  return Array.from(
    { length: rows * columns },
    (_, index) => ({
      index,
      object: null,
    })
  );
}

function createObject(
  template: ObjectTemplate
): BoardObject {
  return {
    id: crypto.randomUUID(),
    type: template.type,
    color: template.color,
    value: template.value,
  };
}


/* =========================================================
   SIDEBAR
   ========================================================= */

type SidebarProps = {
  selectedObject: ObjectTemplate;
  onObjectChange: (
    object: ObjectTemplate
  ) => void;
};

export function Sidebar({
  selectedObject,
  onObjectChange,
}: SidebarProps) {
  return (
    <aside className="flex flex-col gap-6 p-6">
      <h2 className="text-xl font-bold">
        Objects
      </h2>

      {/* Object type */}
      <div className="flex flex-col gap-2">
        <label htmlFor="object-type">
          Type
        </label>

        <select
          id="object-type"
          className="rounded border p-2"
          value={selectedObject.type}
          onChange={(event) =>
            onObjectChange({
              ...selectedObject,
              type:
                event.target.value as ObjectType,
            })
          }
        >
          <option value="circle">
            Circle
          </option>

          <option value="square">
            Square
          </option>

          <option value="triangle">
            Triangle
          </option>
        </select>
      </div>

      {/* Color */}
      <div className="flex flex-col gap-2">
        <label htmlFor="object-color">
          Color
        </label>

        <input
          id="object-color"
          type="color"
          value={selectedObject.color}
          onChange={(event) =>
            onObjectChange({
              ...selectedObject,
              color: event.target.value,
            })
          }
          className="h-10 w-full"
        />
      </div>

      {/* Value */}
      <div className="flex flex-col gap-2">
        <label htmlFor="object-value">
          Value
        </label>

        <input
          id="object-value"
          type="text"
          value={selectedObject.value}
          onChange={(event) =>
            onObjectChange({
              ...selectedObject,
              value: event.target.value,
            })
          }
          className="rounded border p-2"
          placeholder="e.g. player"
        />
      </div>

      {/* Preview */}
      <div className="flex flex-col gap-2">
        <span>Preview</span>

        <div className="flex h-24 items-center justify-center rounded border">
          <ObjectRenderer
            object={createObject(selectedObject)}
          />
        </div>
      </div>
    </aside>
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

type NavigationProps = {
  dimensions: BoardDimensions;
  onDimensionsChange: (
    dimensions: BoardDimensions
  ) => void;
};

export function Navigation({
  dimensions,
  onDimensionsChange,
}: NavigationProps) {
  return (
    <nav className="flex items-center gap-6 p-4">
      <h1 className="text-xl font-bold">
        Board
      </h1>

      <label>
        Rows{" "}
        <select
          value={dimensions.rows}
          onChange={(event) =>
            onDimensionsChange({
              ...dimensions,
              rows: Number(event.target.value),
            })
          }
          className="ml-2 rounded border p-1"
        >
          {Array.from(
            { length: 10 },
            (_, index) => index + 1
          ).map((value) => (
            <option
              key={value}
              value={value}
            >
              {value}
            </option>
          ))}
        </select>
      </label>

      <label>
        Columns{" "}
        <select
          value={dimensions.columns}
          onChange={(event) =>
            onDimensionsChange({
              ...dimensions,
              columns: Number(event.target.value),
            })
          }
          className="ml-2 rounded border p-1"
        >
          {Array.from(
            { length: 10 },
            (_, index) => index + 1
          ).map((value) => (
            <option
              key={value}
              value={value}
            >
              {value}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}


/* =========================================================
   OBJECT RENDERER
   ========================================================= */

function ObjectRenderer({
  object,
}: {
  object: BoardObject;
}) {
  const baseClasses =
    "flex h-full w-full items-center justify-center";

  if (object.type === "circle") {
    return (
      <div
        className={`${baseClasses} rounded-full`}
        style={{
          backgroundColor: object.color,
        }}
      >
        <span className="text-white">
          {object.value}
        </span>
      </div>
    );
  }

  if (object.type === "triangle") {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          color: object.color,
        }}
      >
        <div
          className="h-0 w-0"
          style={{
            borderLeft:
              "30px solid transparent",
            borderRight:
              "30px solid transparent",
            borderBottom: `50px solid ${object.color}`,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} rounded-sm`}
      style={{
        backgroundColor: object.color,
      }}
    >
      <span className="text-white">
        {object.value}
      </span>
    </div>
  );
}


/* =========================================================
   GRID
   ========================================================= */

type GridProps = {
  board: Cell[];
  dimensions: BoardDimensions;
  selectedObject: ObjectTemplate;

  onBoardChange: (
    board: Cell[]
  ) => void;
};

export function Grid({
  board,
  dimensions,
  selectedObject,
  onBoardChange,
}: GridProps) {
  function placeObject(index: number) {
    const newBoard = [...board];

    newBoard[index] = {
      ...newBoard[index],
      object: createObject(selectedObject),
    };

    onBoardChange(newBoard);
  }

  function removeObject(index: number) {
    const newBoard = [...board];

    newBoard[index] = {
      ...newBoard[index],
      object: null,
    };

    onBoardChange(newBoard);
  }

  function swapObjects(
    indexA: number,
    indexB: number
  ) {
    const newBoard = [...board];

    const objectA =
      newBoard[indexA].object;

    const objectB =
      newBoard[indexB].object;

    newBoard[indexA] = {
      ...newBoard[indexA],
      object: objectB,
    };

    newBoard[indexB] = {
      ...newBoard[indexB],
      object: objectA,
    };

    onBoardChange(newBoard);
  }

  function getPosition(index: number) {
    return {
      row: Math.floor(
        index / dimensions.columns
      ),
      column:
        index % dimensions.columns,
    };
  }

  function getAdjacentCells(
    index: number
  ): number[] {
    const { row, column } =
      getPosition(index);

    const result: number[] = [];

    if (row > 0) {
      result.push(
        index - dimensions.columns
      );
    }

    if (
      row <
      dimensions.rows - 1
    ) {
      result.push(
        index + dimensions.columns
      );
    }

    if (column > 0) {
      result.push(index - 1);
    }

    if (
      column <
      dimensions.columns - 1
    ) {
      result.push(index + 1);
    }

    return result;
  }

  function moveObject(
    fromIndex: number,
    toIndex: number
  ) {
    const adjacent =
      getAdjacentCells(fromIndex);

    if (!adjacent.includes(toIndex)) {
      return;
    }

    swapObjects(
      fromIndex,
      toIndex
    );
  }

  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateColumns:
          `repeat(${dimensions.columns}, minmax(0, 1fr))`,
      }}
    >
      {board.map((cell) => (
        <div
          key={cell.index}
          className="aspect-square min-w-0 rounded border p-1"
        >
          <button
            type="button"
            className="h-full w-full rounded"
            onClick={() => {
              if (cell.object) {
                removeObject(cell.index);
              } else {
                placeObject(cell.index);
              }
            }}
          >
            {cell.object ? (
              <ObjectRenderer
                object={cell.object}
              />
            ) : (
              <span className="text-gray-400">
                {cell.index}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}