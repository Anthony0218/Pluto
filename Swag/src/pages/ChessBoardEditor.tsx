import { useState, useEffect } from "react";

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
    <div className="grid grid-flow-col grid-rows-3 gap-0">
      <div className="row-span-3 place-items-center outline-4 outline-rose-500">
        <Sidebar
          selectedObject={selectedObject}
          onObjectChange={setSelectedObject}
        />
      </div>

      <div className="col-span-2 h-full bg-mauve-900">
        <Navigation
          dimensions={dimensions}
          onDimensionsChange={handleDimensionsChange}
        />
      </div>

      <div className="col-span-2 row-span-2 pl-4 bg-mauve-900">
        <Grid
          board={board}
          dimensions={dimensions}
          selectedObject={selectedObject}
          onBoardChange={setBoard}
          width={600}
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
    <div className="flex h-full flex-col justify-center gap-8 p-6">
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
    </div>
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

type BoardDimensions = {
  rows: number;
  columns: number;
};

type NavigationProps = {
  dimensions: BoardDimensions;
  onDimensionsChange: (dimensions: BoardDimensions) => void;
};

export function Navigation({
  dimensions,
  onDimensionsChange,
}: NavigationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < lastScrollY) {
        // Scrolling up
        setIsVisible(false);
      } else if (currentScrollY > lastScrollY) {
        // Scrolling down
        setIsVisible(true);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      className={`
        sticky top-0 z-50
        flex items-center justify-center gap-8
        bg-stone-950 h-full
        border-b-4 border-rose-400
        divide-solid divide-rose-500
        transition-transform duration-300
        ${isVisible ? "translate-y-0" : "-translate-y-full"}
      `}
    >
      <label className="flex items-center gap-2">
        Rows
        <select
          value={dimensions.rows}
          onChange={(event) =>
            onDimensionsChange({
              ...dimensions,
              rows: Number(event.target.value),
            })
          }
          className="rounded-md border-2 border-slate-400 bg-white px-3 py-2"
        >
          {Array.from({ length: 10 }, (_, index) => index + 1).map(
            (value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ),
          )}
        </select>
      </label>

      <label className="flex items-center gap-2">
        Columns
        <select
          value={dimensions.columns}
          onChange={(event) =>
            onDimensionsChange({
              ...dimensions,
              columns: Number(event.target.value),
            })
          }
          className="rounded-md border-2 border-slate-400 bg-white px-3 py-2"
        >
          {Array.from({ length: 10 }, (_, index) => index + 1).map(
            (value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ),
          )}
        </select>
      </label>
    </div>
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
type ObjectOverlayProps = {
  color?: string;
  opacity?: number;
};

function ObjectOverlay({
  color = "currentColor",
  opacity = 0.35,
}: ObjectOverlayProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <circle
        cx="50"
        cy="50"
        r="38"
        fill={color}
        fillOpacity={opacity}
        stroke={color}
        strokeWidth="2"
        strokeOpacity={opacity}
      />
    </svg>
  );
}


/* =========================================================
   GRID
   ========================================================= */


type GridProps = {
  board: Cell[];
  dimensions: BoardDimensions;
  selectedObject: ObjectTemplate;
  onBoardChange: (board: Cell[]) => void;
  width?: number;
};


export function Grid({
  board,
  dimensions,
  selectedObject,
  onBoardChange,
  width = 600,
}: GridProps) {
  const columnCount = dimensions.columns;

  function getPosition(index: number) {
    return {
      row: Math.floor(index / columnCount),
      column: index % columnCount,
    };
  }

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

  function swapObjects(indexA: number, indexB: number) {
    const newBoard = [...board];

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

    onBoardChange(newBoard);
  }

  function areAdjacent(indexA: number, indexB: number) {
    const positionA = getPosition(indexA);
    const positionB = getPosition(indexB);

    const rowDifference = Math.abs(positionA.row - positionB.row);
    const columnDifference = Math.abs(
      positionA.column - positionB.column,
    );

    return rowDifference + columnDifference === 1;
  }

  function moveObject(fromIndex: number, toIndex: number) {
    if (!areAdjacent(fromIndex, toIndex)) {
      return;
    }

    swapObjects(fromIndex, toIndex);
  }

  function handleCellClick(index: number) {
    if (board[index].object) {
      removeObject(index);
    } else {
      placeObject(index);
    }
  }

  return (
    <div
      className="grid"
      style={{
        width: `${width}px`,
        gridTemplateColumns: `repeat(${dimensions.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${dimensions.rows}, minmax(0, 1fr))`,
      }}
    >
      {board.map((cell) => (
        <button
          key={cell.index}
          onClick={() => handleCellClick(cell.index)}
          className="relative aspect-square min-w-0 border-2 border-slate-500 bg-slate-100 p-1"
        >
          {cell.object && (
            <>
              <ObjectRenderer object={cell.object} />

              <ObjectOverlay
                color={cell.object.color}
                opacity={0.25}
              />
            </>
          )}
        </button>
      ))}
    </div>
  );
}