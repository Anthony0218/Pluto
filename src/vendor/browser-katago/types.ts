// Engine-only types from Web KaTrain (MIT); UI and storage types omitted.
export type BoardSize = 9 | 13 | 19;
export const DEFAULT_BOARD_SIZE: BoardSize = 19;
export type Player = "black" | "white";
export type BoardState = (Player | null)[][];
export type GameRules = "japanese" | "chinese" | "korean" | "aga" | "new-zealand" | "tromp-taylor" | "stone-scoring";
export type KataGoBackendPreference = "wasm" | "webgpu" | "cpu";
export type FloatArray = Float32Array | number[];
export type Move = { x: number; y: number; player: Player };
export type RegionOfInterest = { xMin: number; xMax: number; yMin: number; yMax: number };
