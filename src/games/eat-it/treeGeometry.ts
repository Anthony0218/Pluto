import { FOOD, type FoodKind } from './config.ts';
/** Visible ellipsoid cross-section, in world units. Vertical height is not mouth width. */
export function treeGeometry(kind: FoodKind) {
  const f = FOOD[kind];
  return { trunkRadius: f.width * .065, canopyX: f.width * .46, canopyZ: f.height * .4 };
}
