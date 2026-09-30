import { elegantPieceTheme } from "./elegant";
import { geometricPieceTheme } from "./geometric";
import { jazzPieceTheme } from "./jazz";
import { russianPieceTheme } from "./russian";

export const chessPieceAssetThemes = {
  elegant: elegantPieceTheme,
  geometric: geometricPieceTheme,
  jazz: jazzPieceTheme,
  russian: russianPieceTheme,
} as const;
