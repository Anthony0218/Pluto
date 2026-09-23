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
  return (
    <VariantAiLauncher
      title="Total Chaos Chess"
      icon="🌀"
      Board={TotalChaosChess}
    />
  );
}

export function BossBattleAiPage() {
  return (
    <VariantAiLauncher
      title="Boss Battle Chess"
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
  return (
    <VariantAiLauncher
      title="Capitalism Chess"
      icon="🪙"
      Board={CapitalismChessBoard}
    />
  );
}

export function CollapseAiPage() {
  return (
    <VariantAiLauncher
      title="Chess Collapse"
      icon="⚠"
      Board={ChessCollapseBoard}
    />
  );
}

export function HotPotatoAiPage() {
  return (
    <VariantAiLauncher
      title="Hot Potato Chess"
      icon="💣"
      Board={ChessHotPotatoBoard}
    />
  );
}

export function RouletteAiPage() {
  return (
    <VariantAiLauncher
      title="Chess Roulette"
      icon="🎰"
      Board={ChessRouletteBoard}
    />
  );
}

export function DraftAiPage() {
  return (
    <VariantAiLauncher title="Draft Chess" icon="⚔" Board={DraftChessBoard} />
  );
}

export function FogOfWarAiPage() {
  return (
    <VariantAiLauncher
      title="Fog of War Chess"
      icon="🌫"
      Board={FogOfWarChessBoard}
    />
  );
}

export function HorrorAiPage() {
  return (
    <VariantAiLauncher title="Horror Chess" icon="☠" Board={HorrorChessBoard} />
  );
}

export function MirrorAiPage() {
  return (
    <VariantAiLauncher title="Mirror Chess" icon="◈" Board={MirrorChessBoard} />
  );
}

export function MutationAiPage() {
  return (
    <VariantAiLauncher
      title="Mutation Chess"
      icon="🧬"
      Board={MutationChessBoard}
    />
  );
}

export function PortalAiPage() {
  return (
    <VariantAiLauncher
      title="Portal Chess"
      icon="🌀"
      Board={PortalChessBoard}
    />
  );
}

export function RandomStartAiPage() {
  return (
    <VariantAiLauncher
      title="Random Start Chess"
      icon="🎲"
      Board={RandomStartChess}
    />
  );
}

export function TectonicAiPage() {
  return (
    <VariantAiLauncher title="Tectonic Chess" icon="↻" Board={TectonicChess} />
  );
}

export function ThreeLivesAiPage() {
  return (
    <VariantAiLauncher
      title="Three Lives Chess"
      icon="♥"
      Board={ThreeLivesChessBoard}
    />
  );
}
