import { ui, useUiLanguage } from "@/i18n/ui";
import VariantAiLauncher from "./VariantAiLauncher";

import TotalChaosChess from "../singleplayer/TotalChaosChess";
import BossBattleBoard from "../singleplayer/BossBattle";
import CapitalismChessBoard from "../singleplayer/CapitalismChessBoard";
import ChessCollapseBoard from "../singleplayer/ChessCollapse";
import ChessHotPotatoBoard from "../singleplayer/ChessHotPotatoBoard";
import ChessRouletteBoard from "../singleplayer/ChessRouletteBoard";
import DraftChessBoard from "../singleplayer/DraftChessBoard";
import FogOfWarChessBoard from "../singleplayer/FogOfWarChessBoard";
import HorrorChessBoard from "../singleplayer/HorrorChessBoard";
import MirrorChessBoard from "../singleplayer/MirrorChessBoard";
import MutationChessBoard from "../singleplayer/MutationChessBoard";
import PortalChessBoard from "../singleplayer/PortalChessBoard";
import RandomStartChess from "../singleplayer/RandomStartChess";
import TectonicChess from "../singleplayer/TectonicChess";
import ThreeLivesChessBoard from "../singleplayer/ThreeLivesChessBoard";

export function TotalChaosAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Total Chaos Chess")}
      icon="🌀"
      Board={TotalChaosChess}
    />
  );
}

export function BossBattleAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Boss Battle Chess")}
      icon="♚"
      Board={BossBattleBoard}
      sideLabels={{
        white: "White Army",
        black: "Boss",
      }}
    />
  );
}

export function CapitalismAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Capitalism Chess")}
      icon="🪙"
      Board={CapitalismChessBoard}
    />
  );
}

export function CollapseAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Chess Collapse")}
      icon="⚠"
      Board={ChessCollapseBoard}
    />
  );
}

export function HotPotatoAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Hot Potato Chess")}
      icon="💣"
      Board={ChessHotPotatoBoard}
    />
  );
}

export function RouletteAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Chess Roulette")}
      icon="🎰"
      Board={ChessRouletteBoard}
    />
  );
}

export function DraftAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher title={ui("Draft Chess")} icon="⚔" Board={DraftChessBoard} />
  );
}

export function FogOfWarAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Fog of War Chess")}
      icon="🌫"
      Board={FogOfWarChessBoard}
    />
  );
}

export function HorrorAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher title={ui("Horror Chess")} icon="☠" Board={HorrorChessBoard} />
  );
}

export function MirrorAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher title={ui("Mirror Chess")} icon="◈" Board={MirrorChessBoard} />
  );
}

export function MutationAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Mutation Chess")}
      icon="🧬"
      Board={MutationChessBoard}
    />
  );
}

export function PortalAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Portal Chess")}
      icon="🌀"
      Board={PortalChessBoard}
    />
  );
}

export function RandomStartAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Random Start Chess")}
      icon="🎲"
      Board={RandomStartChess}
    />
  );
}

export function TectonicAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher title={ui("Tectonic Chess")} icon="↻" Board={TectonicChess} />
  );
}

export function ThreeLivesAiPage() {
  useUiLanguage();
  return (
    <VariantAiLauncher
      title={ui("Three Lives Chess")}
      icon="♥"
      Board={ThreeLivesChessBoard}
    />
  );
}
